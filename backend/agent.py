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
a SIMULATED paper-trading portfolio for a beginner investor.

Run one research cycle:
1. Check the portfolio and latest prices for the universe.
2. Pull recent news for the most relevant symbols.
3. Pull daily bars for at most 2 candidates you are seriously considering.
4. Decide ONE action: buy, sell, or hold.

Rules you must respect (a deterministic risk engine re-checks them after you):
{rules}

Decision discipline:
- Propose a buy ONLY with at least two independent pieces of supporting
  evidence from your tool calls (e.g. a news catalyst AND a price trend).
- Size buy orders between 2% and {max_order_pct}% of portfolio equity, in
  whole shares. A single order may NEVER exceed {max_order_pct}% of equity —
  build large target allocations (like a core ETF position) incrementally,
  one order per cycle.
- If nothing clears the bar, hold — holding is a respectable decision.
- Never use symbols outside the universe: {universe}

When you are done researching, respond with ONLY a JSON object, no prose:
{{"action": "buy" | "sell" | "hold", "symbol": "XYZ" or null, "qty": <whole number> or null, "rationale": "<2-3 sentences citing your evidence>"}}"""


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

    return [get_portfolio, get_latest_prices, get_daily_bars, get_recent_news]


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
        return {"action": "hold", "symbol": None, "qty": None,
                "rationale": f"Research cycle produced no parseable decision. Raw: {raw[:200]}",
                "evidence": evidence}
    decision = json.loads(match.group(0))
    decision["evidence"] = evidence
    return decision
