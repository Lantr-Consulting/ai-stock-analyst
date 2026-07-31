"""AI Stock Analyst backend.

Milestone 3 (The Brain): /interpret-profile and /chat.
Milestone 4 (Hands): live Alpaca portfolio, agent research cycles with real
market data, a deterministic risk engine, and the approve -> order -> fill loop.

Paper trading only. Every screen that shows this data is labeled simulated.
"""

import json
import os
import time
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel

load_dotenv()

import agent as research_agent  # noqa: E402
import broker  # noqa: E402
import risk  # noqa: E402
import store  # noqa: E402

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
)
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

app = FastAPI(title="AI Stock Analyst backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Server-side defaults until profiles live in the database (Milestone 5).
DEFAULT_STRATEGY = {
    "version": 3,
    "summary": "Hold a core broad-market position, tilt toward large-cap technology and AI infrastructure, add on evidence-backed opportunities, and keep a cash buffer.",
    "rules": [
        "Core: keep 30-50% in VOO as the portfolio anchor",
        "Tilt: up to 15% per single technology position",
        "Buy only with at least two independent pieces of supporting evidence",
        "Hold at least 10% cash at all times",
        "Propose, don't execute - every order needs approval",
    ],
    "universe": ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
}


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-stock-analyst-backend"}


# ---------------------------------------------------------------------------
# Portfolio (live paper account)
# ---------------------------------------------------------------------------

@app.get("/portfolio")
def portfolio() -> dict[str, Any]:
    snapshot = broker.account_snapshot()
    snapshot["history"] = broker.value_history()
    return snapshot


# ---------------------------------------------------------------------------
# Decisions: research -> propose -> approve/reject -> order -> fill
# ---------------------------------------------------------------------------

TERMINAL_ORDER_STATUSES = {"filled", "canceled", "expired", "rejected"}


@app.get("/decisions")
def decisions() -> list[dict[str, Any]]:
    records = store.list_decisions()
    # Reconcile any non-terminal orders with Alpaca while listing.
    for r in records:
        order = r.get("order")
        if order and order.get("status") not in TERMINAL_ORDER_STATUSES:
            fresh = broker.get_order(order["id"])
            if fresh != order:
                updates: dict[str, Any] = {"order": fresh}
                if fresh["status"] == "filled":
                    updates["status"] = "filled"
                store.update(r["id"], **updates)
                r.update(updates)
    return records


class ResearchRequest(BaseModel):
    strategy: dict[str, Any] | None = None
    safeguards: dict[str, Any] | None = None


@app.post("/research-cycle")
def research_cycle(req: ResearchRequest) -> dict[str, Any]:
    strategy = req.strategy or DEFAULT_STRATEGY
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(req.safeguards or {})}

    decision = research_agent.run_research_cycle(strategy, safeguards)
    action = decision.get("action", "hold")
    evidence = decision.get("evidence", [])
    rationale = decision.get("rationale", "")

    if action == "hold" or not decision.get("symbol") or not decision.get("qty"):
        return store.add(
            {
                "action": "hold",
                "symbol": None,
                "qty": None,
                "estValue": None,
                "rationale": rationale or "No opportunity cleared the evidence bar.",
                "strategyVersion": strategy.get("version", 0),
                "evidence": evidence,
                "safeguards": [],
                "status": "approved",
            }
        )

    symbol = decision["symbol"].upper()
    qty = int(decision["qty"])
    price = broker.latest_prices([symbol]).get(symbol)
    if price is None:
        raise HTTPException(status_code=502, detail=f"no price for {symbol}")

    account = broker.account_snapshot()
    checks = risk.run_safeguards(
        action=action,
        symbol=symbol,
        qty=qty,
        price=price,
        account=account,
        safeguards=safeguards,
        trades_today=broker.orders_submitted_today(),
        pending_symbols=store.pending_symbols(),
    )

    return store.add(
        {
            "action": action,
            "symbol": symbol,
            "qty": qty,
            "estValue": round(qty * price, 2),
            "rationale": rationale,
            "strategyVersion": strategy.get("version", 0),
            "evidence": evidence,
            "safeguards": checks,
            "status": "proposed" if risk.passed(checks) else "blocked",
        }
    )


class DecisionAction(BaseModel):
    safeguards: dict[str, Any] | None = None


@app.post("/decisions/{decision_id}/approve")
def approve(decision_id: str, req: DecisionAction) -> dict[str, Any]:
    record = store.get(decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")

    # Re-run safeguards at approval time — state may have changed since proposal.
    price = broker.latest_prices([record["symbol"]]).get(record["symbol"])
    account = broker.account_snapshot()
    checks = risk.run_safeguards(
        action=record["action"],
        symbol=record["symbol"],
        qty=record["qty"],
        price=price or 0,
        account=account,
        safeguards={**risk.DEFAULT_SAFEGUARDS, **(req.safeguards or {})},
        trades_today=broker.orders_submitted_today(),
        pending_symbols=store.pending_symbols() - {record["symbol"]},
    )
    if not risk.passed(checks):
        return store.update(decision_id, status="blocked", safeguards=checks)

    order = broker.submit_market_order(record["symbol"], record["qty"], record["action"])
    # Give fast fills a moment to land (market hours); otherwise reconcile later.
    for _ in range(3):
        if order["status"] in TERMINAL_ORDER_STATUSES:
            break
        time.sleep(1.5)
        order = broker.get_order(order["id"])

    return store.update(
        decision_id,
        status="filled" if order["status"] == "filled" else "approved",
        order=order,
        safeguards=checks,
    )


@app.post("/decisions/{decision_id}/reject")
def reject(decision_id: str) -> dict[str, Any]:
    record = store.get(decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")
    return store.update(decision_id, status="rejected")


# ---------------------------------------------------------------------------
# Profile interpretation (Milestone 3)
# ---------------------------------------------------------------------------

INTERPRET_SYSTEM = """You are the strategy engine of a personal AI stock analyst \
for a beginner investor using a simulated paper-trading account.

You receive the user's CURRENT investor profile and strategy as JSON, plus NEW \
plain-English instructions. Merge the new instructions into the profile and \
strategy. Keep everything that still applies; change only what the new \
instructions affect; never invent preferences the user did not state.

Constraints:
- US-listed stocks and broad-market ETFs only. No options, margin, short \
selling, or crypto.
- The universe is a watchlist of at most 10 liquid symbols consistent with the \
user's stated interests. When preferred sectors or avoided names change, add \
or remove universe symbols to match.
- riskTolerance is exactly one of: "conservative", "moderate", "aggressive".
- Rules must be concrete and checkable, and must always include an approval \
rule ("Propose, don't execute — every order needs approval") unless the user \
explicitly asked for autonomous mode.
- Write for a smart beginner: plain language, no jargon.

Respond with JSON only, exactly this shape:
{
  "profile": {
    "goals": str,
    "riskTolerance": "conservative" | "moderate" | "aggressive",
    "timeHorizon": str,
    "preferredSectors": [str],
    "avoid": [str],
    "marketViews": [str],
    "tradingFrequency": str
  },
  "strategy": {
    "summary": str,
    "watching": [str],
    "rules": [str],
    "universe": [str]
  }
}"""


class InterpretRequest(BaseModel):
    instructions: str
    profile: dict[str, Any]
    strategy: dict[str, Any]


@app.post("/interpret-profile")
def interpret_profile(req: InterpretRequest) -> dict[str, Any]:
    if not req.instructions.strip():
        raise HTTPException(status_code=400, detail="instructions is empty")
    current = {"profile": req.profile, "strategy": req.strategy}
    completion = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": INTERPRET_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"CURRENT:\n{json.dumps(current)}\n\n"
                    f"NEW INSTRUCTIONS:\n{req.instructions}"
                ),
            },
        ],
        temperature=0.3,
    )
    try:
        result = json.loads(completion.choices[0].message.content or "{}")
        return {"profile": result["profile"], "strategy": result["strategy"]}
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"model returned bad JSON: {exc}")


# ---------------------------------------------------------------------------
# Grounded chat — context is now built server-side from live records
# ---------------------------------------------------------------------------

CHAT_SYSTEM = """You are a personal AI stock analyst and portfolio manager \
talking to the account owner — a beginner investor with a SIMULATED \
paper-trading account. Real money is never involved.

Ground every answer in the ACCOUNT STATE JSON below: the strategy, live \
portfolio, and recorded decisions (each with evidence and safeguard results). \
When asked why something happened, cite the recorded decision — do not invent \
trades, prices, news, or reasons that are not in the records. If the records \
don't contain the answer, say so plainly.

Style: warm, concise, plain language for a smart beginner. A few sentences, \
not essays. Never give advice about real-money investing; if asked, remind \
the user this is a simulated learning account.

ACCOUNT STATE:
"""


class ChatMessage(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict[str, Any] | None = None  # legacy; server data takes precedence


@app.post("/chat")
def chat(req: ChatRequest) -> dict[str, str]:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is empty")

    def slim(r: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in r.items() if k != "evidence"} | {
            "evidence": [e["source"] for e in r.get("evidence", [])][:6]
        }

    try:
        context = {
            "strategy": DEFAULT_STRATEGY,
            "portfolio": broker.account_snapshot(),
            "decisions": [slim(r) for r in store.list_decisions()[:10]],
        }
    except Exception:
        context = req.context or {}

    history = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.text}
        for m in req.messages[-12:]
    ]
    completion = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": CHAT_SYSTEM + json.dumps(context)},
            *history,
        ],
        temperature=0.5,
    )
    return {"text": completion.choices[0].message.content or ""}
