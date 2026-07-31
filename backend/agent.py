"""The research agent: LangChain tool-calling loop over the Alpaca read tools.

One research cycle = the agent reads the strategy, pulls live prices, bars,
and news for the universe, looks at the current portfolio, and returns exactly
one decision as JSON. Tool calls are captured as evidence items so every
decision record shows what the agent actually looked at.
"""

import json
import os
import re
from datetime import datetime, timezone
from typing import Any

from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

import broker

SYSTEM = """You are the research engine of a personal AI stock analyst managing \
a SIMULATED paper-trading portfolio. Think like a portfolio manager, not a \
stock picker: allocations first, individual trades second.

Run one research cycle:
1. Check the portfolio, then latest prices for the watchlist.
2. Pull recent news for the watchlist, and check market movers for
   opportunities beyond it that fit the user's profile.
3. Pull indicators (trend, RSI, volatility, drawdown) for the 3-5 most
   relevant candidates given the strategy and current gaps.
4. Design a TARGET ALLOCATION for the whole portfolio (percent per symbol,
   plus cash) that expresses the strategy and the user's profile.
5. Propose the basket of orders (0-5) that moves the portfolio toward the
   target. Multiple orders in one cycle are encouraged when the portfolio is
   far from target.

Rules you must respect (a deterministic risk engine re-checks each order):
{rules}

Discipline:
- Every order needs evidence from your tool calls (price/indicator trend,
  news catalyst, or allocation gap). Cite specifics in the rationale.
- Each single order stays within {max_order_pct}% of equity, whole shares
  only. Large targets are built over multiple cycles.
- Weight the allocation toward the user's stated preferences; the strategy
  rules set the bounds.
- If the portfolio already matches the target, return zero orders — holding
  is a respectable decision.
- Start from the watchlist ({universe}) but you may research and propose
  ANY US-listed stock or ETF that fits the user's profile — when you go
  beyond the watchlist, say why in the order's rationale. Avoid illiquid
  or sub-$3 names; a deterministic engine rejects them anyway.

When done researching, respond with ONLY a JSON object, no prose:
{{"targetAllocation": [{{"symbol": "XYZ" or "CASH", "pct": <number>}}, ...],
  "orders": [{{"action": "buy" | "sell", "symbol": "XYZ", "qty": <whole number>, "why": "<1 sentence>"}}, ...],
  "rationale": "<3-5 sentences: the portfolio thesis and how the basket moves toward target>"}}"""


def _tools(keys: broker.Keys = None) -> list[Any]:
    @tool
    def get_portfolio() -> str:
        """Current paper account: cash, equity, and open positions."""
        return json.dumps(broker.account_snapshot(keys))

    @tool
    def get_latest_prices(symbols: str) -> str:
        """Latest trade prices. Pass comma-separated symbols, e.g. 'AAPL,MSFT'."""
        return json.dumps(
            broker.latest_prices([s.strip() for s in symbols.split(",")], keys)
        )

    @tool
    def get_daily_bars(symbol: str, days: int = 30) -> str:
        """Recent daily OHLCV bars for one symbol (default 30 days)."""
        return json.dumps(broker.daily_bars(symbol, days, keys))

    @tool
    def get_recent_news(symbols: str, limit: int = 8) -> str:
        """Recent market news. Pass comma-separated symbols."""
        return json.dumps(
            broker.recent_news([s.strip() for s in symbols.split(",")], limit, keys)
        )

    @tool
    def get_market_movers() -> str:
        """Today's top gainers, losers, and most-active US stocks —
        for discovering candidates beyond the watchlist."""
        return json.dumps(broker.market_movers(keys))

    @tool
    def get_indicators(symbol: str) -> str:
        """Quant indicators for one symbol: price vs SMA20/SMA50 (trend),
        RSI14 (momentum), annualized volatility, 60-day max drawdown,
        30-day return."""
        return json.dumps(broker.indicators(symbol, keys))

    return [get_portfolio, get_latest_prices, get_daily_bars, get_recent_news, get_market_movers, get_indicators]


def _llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
        api_key=os.environ["DEEPSEEK_API_KEY"],
        base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        temperature=0.2,
    )


def _summarize_tool_output(name: str, output: str) -> str:
    text = output if isinstance(output, str) else json.dumps(output)
    return text[:400]


def run_research_cycle(
    strategy: dict[str, Any],
    safeguards: dict[str, Any],
    keys: broker.Keys = None,
) -> dict[str, Any]:
    """Returns {action, symbol, qty, rationale, evidence:[...]}."""
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM),
            ("human", "Strategy:\n{strategy}\n\nRun one research cycle now."),
            ("placeholder", "{agent_scratchpad}"),
        ]
    )
    tools = _tools(keys)
    executor = AgentExecutor(
        agent=create_tool_calling_agent(_llm(), tools, prompt),
        tools=tools,
        max_iterations=10,
        return_intermediate_steps=True,
    )
    result = executor.invoke(
        {
            "strategy": json.dumps(strategy),
            "rules": "\n".join(f"- {r}" for r in strategy.get("rules", [])),
            "universe": ", ".join(strategy.get("universe", [])),
            "max_order_pct": safeguards.get("maxOrderPct", 10),
        }
    )

    evidence = []
    for action_step, output in result.get("intermediate_steps", []):
        evidence.append(
            {
                "source": f"Tool — {action_step.tool}({json.dumps(action_step.tool_input)})",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "summary": _summarize_tool_output(action_step.tool, output),
            }
        )

    raw = result.get("output", "")
    if isinstance(raw, list):  # some providers return content blocks
        raw = " ".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in raw)
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {"targetAllocation": [], "orders": [],
                "rationale": f"Research cycle produced no parseable plan. Raw: {raw[:200]}",
                "evidence": evidence}
    plan = json.loads(match.group(0))
    plan.setdefault("targetAllocation", [])
    plan.setdefault("orders", [])
    plan["evidence"] = evidence
    return plan
