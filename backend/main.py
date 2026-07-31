"""AI Stock Analyst backend.

Milestone 3 (The Brain): profile interpretation and grounded chat.
Milestone 4 (Hands): live Alpaca portfolio, agent research cycles, a
deterministic risk engine, and the approve -> order -> fill loop.
Milestone 5 (Memory & accounts): Supabase sign-in, one agent per user,
per-user Alpaca paper accounts, durable decision records with RLS.

Paper trading only. Every screen that shows this data is labeled simulated.
"""

import json
import os
import time
from typing import Any, Literal

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from openai import OpenAI  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import agent as research_agent  # noqa: E402
import broker  # noqa: E402
import db  # noqa: E402
import risk  # noqa: E402
from auth import current_user  # noqa: E402

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

DEFAULT_PROFILE = {
    "goals": "Grow a long-term portfolio while learning how markets work",
    "riskTolerance": "moderate",
    "timeHorizon": "3-5 years",
    "preferredSectors": ["Technology", "AI infrastructure", "Broad-market ETFs"],
    "avoid": ["Penny stocks", "Options, margin, and crypto (out of scope)"],
    "marketViews": ["AI infrastructure demand keeps growing"],
    "tradingFrequency": "Up to 2 new trades per week",
}

DEFAULT_STRATEGY = {
    "summary": "Hold a core broad-market position, tilt toward large-cap technology and AI infrastructure, add on evidence-backed opportunities, and keep a cash buffer.",
    "watching": [
        "AI infrastructure earnings and guidance (NVDA, MSFT, AVGO)",
        "Broad-market trend vs. the VOO benchmark",
        "News that changes the thesis for any held position",
    ],
    "rules": [
        "Core: keep 30-50% in VOO as the portfolio anchor",
        "Tilt: up to 15% per single technology position",
        "Buy only with at least two independent pieces of supporting evidence",
        "Hold at least 10% cash at all times",
        "Propose, don't execute - every order needs approval",
    ],
    "universe": ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
}


def _agent_for(user: dict[str, Any]) -> dict[str, Any]:
    return db.ensure_agent(user["id"], user["email"], DEFAULT_PROFILE, DEFAULT_STRATEGY)


def _keys_for(agent_row: dict[str, Any]) -> broker.Keys:
    if agent_row.get("alpaca_api_key") and agent_row.get("alpaca_secret_key"):
        return (agent_row["alpaca_api_key"], agent_row["alpaca_secret_key"])
    return None  # shared demo account from env


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-stock-analyst-backend"}


# ---------------------------------------------------------------------------
# Me: the signed-in user's agent
# ---------------------------------------------------------------------------

@app.get("/me")
def me(user: dict = Depends(current_user)) -> dict[str, Any]:
    row = _agent_for(user)
    return {
        "email": row["email"],
        "profile": row["profile"],
        "strategy": row["strategy"],
        "profileVersion": row["profile_version"],
        "strategyVersion": row["strategy_version"],
        "rawInstructions": row["raw_instructions"],
        "hasAlpacaKeys": bool(row.get("alpaca_api_key")),
        "paused": row["paused"],
    }


class AlpacaKeysRequest(BaseModel):
    apiKey: str
    secretKey: str


@app.post("/me/alpaca-keys")
def set_alpaca_keys(
    req: AlpacaKeysRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    _agent_for(user)
    keys = (req.apiKey.strip(), req.secretKey.strip())
    if not broker.keys_valid(keys):
        raise HTTPException(
            status_code=400,
            detail="Alpaca rejected those keys — check they're PAPER keys and copied fully",
        )
    db.update_agent(user["id"], {"alpaca_api_key": keys[0], "alpaca_secret_key": keys[1]})
    return {"ok": True, "hasAlpacaKeys": True}


# ---------------------------------------------------------------------------
# Portfolio (the signed-in user's paper account)
# ---------------------------------------------------------------------------

@app.get("/portfolio")
def portfolio(user: dict = Depends(current_user)) -> dict[str, Any]:
    keys = _keys_for(_agent_for(user))
    snapshot = broker.account_snapshot(keys)
    snapshot["history"] = broker.value_history(keys)
    snapshot["sharedDemoAccount"] = keys is None
    return snapshot


# ---------------------------------------------------------------------------
# Decisions: research -> propose -> approve/reject -> order -> fill
# ---------------------------------------------------------------------------

TERMINAL_ORDER_STATUSES = {"filled", "canceled", "expired", "rejected"}


@app.get("/decisions")
def decisions(user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    keys = _keys_for(_agent_for(user))
    records = db.list_decisions(user["id"])
    for r in records:
        order = r.get("order")
        if order and order.get("status") not in TERMINAL_ORDER_STATUSES:
            fresh = broker.get_order(order["id"], keys)
            if fresh != order:
                updates: dict[str, Any] = {"order": fresh}
                if fresh["status"] == "filled":
                    updates["status"] = "filled"
                db.update_decision(user["id"], r["id"], updates)
                r.update(updates)
    return records


@app.post("/research-cycle")
def research_cycle(user: dict = Depends(current_user)) -> dict[str, Any]:
    row = _agent_for(user)
    if row["paused"]:
        raise HTTPException(status_code=409, detail="agent is paused")
    keys = _keys_for(row)
    strategy = {**row["strategy"], "version": row["strategy_version"]}
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})}
    safeguards["approvedUniverse"] = strategy.get(
        "universe", safeguards["approvedUniverse"]
    )

    decision = research_agent.run_research_cycle(strategy, safeguards, keys)
    action = decision.get("action", "hold")
    evidence = decision.get("evidence", [])
    rationale = decision.get("rationale", "")

    if action == "hold" or not decision.get("symbol") or not decision.get("qty"):
        return db.add_decision(
            user["id"],
            {
                "action": "hold",
                "rationale": rationale or "No opportunity cleared the evidence bar.",
                "strategyVersion": row["strategy_version"],
                "evidence": evidence,
                "safeguards": [],
                "status": "approved",
            },
        )

    symbol = decision["symbol"].upper()
    qty = int(decision["qty"])
    price = broker.latest_prices([symbol], keys).get(symbol)
    if price is None:
        raise HTTPException(status_code=502, detail=f"no price for {symbol}")

    account = broker.account_snapshot(keys)
    checks = risk.run_safeguards(
        action=action,
        symbol=symbol,
        qty=qty,
        price=price,
        account=account,
        safeguards=safeguards,
        trades_today=broker.orders_submitted_today(keys),
        pending_symbols=db.pending_symbols(user["id"]),
    )

    return db.add_decision(
        user["id"],
        {
            "action": action,
            "symbol": symbol,
            "qty": qty,
            "estValue": round(qty * price, 2),
            "rationale": rationale,
            "strategyVersion": row["strategy_version"],
            "evidence": evidence,
            "safeguards": checks,
            "status": "proposed" if risk.passed(checks) else "blocked",
        },
    )


@app.post("/decisions/{decision_id}/approve")
def approve(decision_id: str, user: dict = Depends(current_user)) -> dict[str, Any]:
    row = _agent_for(user)
    keys = _keys_for(row)
    record = db.get_decision(user["id"], decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")

    price = broker.latest_prices([record["symbol"]], keys).get(record["symbol"])
    account = broker.account_snapshot(keys)
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})}
    checks = risk.run_safeguards(
        action=record["action"],
        symbol=record["symbol"],
        qty=record["qty"],
        price=price or 0,
        account=account,
        safeguards=safeguards,
        trades_today=broker.orders_submitted_today(keys),
        pending_symbols=db.pending_symbols(user["id"]) - {record["symbol"]},
    )
    if not risk.passed(checks):
        return db.update_decision(
            user["id"], decision_id, {"status": "blocked", "safeguards": checks}
        )

    order = broker.submit_market_order(record["symbol"], record["qty"], record["action"], keys)
    for _ in range(3):
        if order["status"] in TERMINAL_ORDER_STATUSES:
            break
        time.sleep(1.5)
        order = broker.get_order(order["id"], keys)

    return db.update_decision(
        user["id"],
        decision_id,
        {
            "status": "filled" if order["status"] == "filled" else "approved",
            "order": order,
            "safeguards": checks,
        },
    )


@app.post("/decisions/{decision_id}/reject")
def reject(decision_id: str, user: dict = Depends(current_user)) -> dict[str, Any]:
    record = db.get_decision(user["id"], decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")
    return db.update_decision(user["id"], decision_id, {"status": "rejected"})


# ---------------------------------------------------------------------------
# Profile interpretation — now persisted per user
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


@app.post("/interpret-profile")
def interpret_profile(
    req: InterpretRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    if not req.instructions.strip():
        raise HTTPException(status_code=400, detail="instructions is empty")
    row = _agent_for(user)
    current = {"profile": row["profile"], "strategy": row["strategy"]}
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
        profile, strategy = result["profile"], result["strategy"]
    except (json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=502, detail=f"model returned bad JSON: {exc}")

    updated = db.update_agent(
        user["id"],
        {
            "profile": profile,
            "strategy": strategy,
            "profile_version": row["profile_version"] + 1,
            "strategy_version": row["strategy_version"] + 1,
            "raw_instructions": [*row["raw_instructions"], req.instructions.strip()],
        },
    )
    return {
        "profile": updated["profile"],
        "strategy": updated["strategy"],
        "profileVersion": updated["profile_version"],
        "strategyVersion": updated["strategy_version"],
        "rawInstructions": updated["raw_instructions"],
    }


# ---------------------------------------------------------------------------
# Grounded chat — context from the signed-in user's live records
# ---------------------------------------------------------------------------

CHAT_SYSTEM = """You are a personal AI stock analyst and portfolio manager \
talking to the account owner — a beginner investor with a SIMULATED \
paper-trading account. Real money is never involved.

Ground every answer in the ACCOUNT STATE JSON below: the investor profile, \
strategy, live portfolio, and recorded decisions (each with evidence and \
safeguard results). When asked why something happened, cite the recorded \
decision — do not invent trades, prices, news, or reasons that are not in \
the records. If the records don't contain the answer, say so plainly.

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


@app.post("/chat")
def chat(req: ChatRequest, user: dict = Depends(current_user)) -> dict[str, str]:
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages is empty")
    row = _agent_for(user)
    keys = _keys_for(row)

    def slim(r: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in r.items() if k != "evidence"} | {
            "evidence": [e["source"] for e in r.get("evidence", [])][:6]
        }

    context = {
        "profile": row["profile"],
        "strategy": row["strategy"],
        "portfolio": broker.account_snapshot(keys),
        "decisions": [slim(r) for r in db.list_decisions(user["id"], limit=10)],
    }

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
