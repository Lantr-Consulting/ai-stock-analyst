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
import threading
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


EMPTY_PROFILE: dict[str, Any] = {}
EMPTY_STRATEGY = {"summary": "", "watching": [], "rules": [], "universe": []}


def _agent_for(user: dict[str, Any]) -> dict[str, Any]:
    # New agents start EMPTY and inactive: the user describes how they invest,
    # reviews the interpreted strategy, universe, and safeguards, then
    # explicitly activates. No defaults they didn't bless.
    return db.ensure_agent(user["id"], user["email"], EMPTY_PROFILE, EMPTY_STRATEGY)


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
        "activated": row["activated"],
        "safeguards": {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})},
    }


class SettingsRequest(BaseModel):
    safeguards: dict[str, Any] | None = None
    universe: list[str] | None = None
    paused: bool | None = None


@app.patch("/me/settings")
def update_settings(
    req: SettingsRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    row = _agent_for(user)
    fields: dict[str, Any] = {}
    if req.safeguards is not None:
        allowed = {
            "maxPositionPct", "maxCorePositionPct", "minCashPct",
            "maxOrderPct", "maxTradesPerDay", "coreSymbols", "approvalMode",
        }
        fields["safeguards"] = {
            **(row.get("safeguards") or {}),
            **{k: v for k, v in req.safeguards.items() if k in allowed},
        }
    if req.universe is not None:
        symbols = [s.strip().upper() for s in req.universe if s.strip()][:20]
        if not symbols:
            raise HTTPException(status_code=400, detail="universe cannot be empty")
        fields["strategy"] = {**row["strategy"], "universe": symbols}
    if req.paused is not None:
        fields["paused"] = req.paused
    if not fields:
        raise HTTPException(status_code=400, detail="nothing to update")
    updated = db.update_agent(user["id"], fields)
    return {
        "ok": True,
        "safeguards": {**risk.DEFAULT_SAFEGUARDS, **(updated.get("safeguards") or {})},
        "universe": updated["strategy"].get("universe", []),
        "paused": updated["paused"],
    }


@app.post("/me/activate")
def activate(user: dict = Depends(current_user)) -> dict[str, Any]:
    row = _agent_for(user)
    if not row["strategy"].get("universe") or row["strategy_version"] < 1:
        raise HTTPException(
            status_code=409,
            detail="describe how you invest first — the agent needs an interpreted strategy and universe before it can run",
        )
    db.update_agent(user["id"], {"activated": True})
    return {"ok": True, "activated": True}


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


_research_in_flight: set[str] = set()


def _do_research(user: dict, row: dict, run_id: str, automation: dict | None = None) -> None:
    keys = _keys_for(row)
    strategy = {**row["strategy"], "version": row["strategy_version"]}
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})}
    try:
        lessons = []
        for st in db.recent_steers(user["id"]):
            lessons.append(f'STEERING from the user: "{st}"')
        for r in db.list_decisions(user["id"], limit=30):
            if r.get("symbol") and r["status"] == "rejected" and r.get("feedback") != "Superseded by a newer research cycle.":
                why = f' — their reason: "{r["feedback"]}"' if r.get("feedback") else ""
                lessons.append(f'REJECTED {r["action"]} {r["qty"]} {r["symbol"]}{why}')
            elif r.get("symbol") and r["status"] in ("approved", "filled"):
                lessons.append(f'approved {r["action"]} {r["qty"]} {r["symbol"]}')
        plan = research_agent.run_research_cycle(
            strategy, safeguards, keys, lessons[:12],
            mission=automation["prompt"] if automation else None,
        )
        db.supersede_pending(user["id"])
        evidence = plan.get("evidence", [])
        rationale = plan.get("rationale", "")
        target = [t for t in plan.get("targetAllocation", []) if isinstance(t, dict) and t.get("symbol")]
        orders = [o for o in plan.get("orders", []) if isinstance(o, dict) and o.get("symbol") and o.get("qty")][:5]
        plan_evidence = [{"source": "Target allocation", "timestamp": account_ts(),
                          "summary": ", ".join(f"{t['symbol']} {t['pct']}%" for t in target) or "unchanged"}, *evidence]
        db.add_decision(user["id"], {"action": "rebalance" if orders else "hold",
            "rationale": rationale or "Portfolio already matches the target allocation.",
            "strategyVersion": row["strategy_version"], "evidence": plan_evidence,
            "safeguards": [], "status": "approved", "runId": run_id})
        account = broker.account_snapshot(keys)
        trades_today = broker.orders_submitted_today(keys)
        pending = db.pending_symbols(user["id"]) | {
            o["symbol"] for o in account.get("openOrders", [])
        }
        proposed_count = 0
        for o in orders:
            symbol = str(o["symbol"]).upper(); qty = int(o["qty"])
            action = "sell" if o.get("action") == "sell" else "buy"
            price = broker.latest_prices([symbol], keys).get(symbol)
            if price is None:
                continue
            checks = risk.run_safeguards(action=action, symbol=symbol, qty=qty, price=price,
                account=account, safeguards=safeguards,
                trades_today=trades_today + proposed_count, pending_symbols=pending,
                asset_check=broker.asset_ok(symbol, keys))
            ok = risk.passed(checks)
            if ok:
                proposed_count += 1; pending.add(symbol)
            db.add_decision(user["id"], {"action": action, "symbol": symbol, "qty": qty,
                "estValue": round(qty * price, 2), "rationale": o.get("why", rationale),
                "strategyVersion": row["strategy_version"], "evidence": [],
                "safeguards": checks, "status": "proposed" if ok else "blocked", "runId": run_id})
        summary = rationale or "Run complete — no findings this time."
        if orders:
            summary += "\n\nProposed: " + ", ".join(
                f"{o.get('action','buy')} {o.get('qty')} {o.get('symbol')}" for o in orders
            )
        # Chat-initiated research reports back into its conversation; scheduled
        # automations present their results on the Automations page instead.
        if automation and automation.get("thread_id"):
            db.add_message(user["id"], "agent", summary, automation["thread_id"])
        db.finish_run(user["id"], run_id, "done", report=summary)
    except Exception as exc:
        db.finish_run(user["id"], run_id, "error", str(exc)[:300])
    finally:
        _research_in_flight.discard(user["id"])


@app.post("/research-cycle")
def research_cycle(user: dict = Depends(current_user)) -> dict[str, Any]:
    # DB-backed lock (works across workers): any run still 'running' and
    # younger than 15 minutes blocks a new one.
    from datetime import datetime, timedelta, timezone
    for r in db.list_runs(user["id"], limit=3):
        if r["status"] == "running":
            started = datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - started < timedelta(minutes=15):
                raise HTTPException(status_code=409, detail="a research cycle is already running — results appear when it finishes")
            db.finish_run(user["id"], r["id"], "error", "timed out")
    row = _agent_for(user)
    if not row["activated"]:
        raise HTTPException(status_code=409, detail="finish agent setup and activate first")
    if row["paused"]:
        raise HTTPException(status_code=409, detail="agent is paused")
    run = db.create_run(user["id"])
    _research_in_flight.add(user["id"])
    threading.Thread(target=_do_research, args=(user, row, run["id"]), daemon=True).start()
    return {"runId": run["id"], "status": "running"}


@app.get("/research-runs")
def research_runs(user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    runs = db.list_runs(user["id"])
    decisions = db.list_decisions(user["id"], limit=100)
    by_run: dict[str, list] = {}
    for d in decisions:
        by_run.setdefault(d.get("runId") or "", []).append(d)
    return [{**r, "decisions": by_run.get(r["id"], [])} for r in runs]


class SteerRequest(BaseModel):
    text: str


@app.post("/research-runs/{run_id}/steer")
def steer(run_id: str, req: SteerRequest, user: dict = Depends(current_user)) -> dict[str, Any]:
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="empty steer")
    run = db.steer_run(user["id"], run_id, req.text.strip()[:300])
    if not run:
        raise HTTPException(status_code=404, detail="run not found")
    return {"ok": True, "steer": run["steer"],
            "note": "Guidance saved — it steers the next research cycle."}


def account_ts() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


class ApproveRequest(BaseModel):
    qty: int | None = None  # user-edited share count


@app.post("/decisions/{decision_id}/approve")
def approve(decision_id: str, req: ApproveRequest = None, user: dict = Depends(current_user)) -> dict[str, Any]:
    row = _agent_for(user)
    keys = _keys_for(row)
    record = db.get_decision(user["id"], decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")
    if req and req.qty is not None:
        if req.qty < 1:
            raise HTTPException(status_code=400, detail="qty must be at least 1")
        record["qty"] = req.qty

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
        pending_symbols=(db.pending_symbols(user["id"]) - {record["symbol"]})
        | {o["symbol"] for o in account.get("openOrders", [])},
        asset_check=broker.asset_ok(record["symbol"], keys),
    )
    if not risk.passed(checks):
        return db.update_decision(
            user["id"], decision_id, {"status": "blocked", "safeguards": checks}
        )

    db.update_decision(user["id"], decision_id,
                       {"qty": record["qty"],
                        "estValue": round(record["qty"] * (price or 0), 2)})
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


class RejectRequest(BaseModel):
    reason: str | None = None


@app.post("/decisions/{decision_id}/reject")
def reject(
    decision_id: str, req: RejectRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    record = db.get_decision(user["id"], decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="decision not found")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail=f"decision is {record['status']}, not proposed")
    fields: dict[str, Any] = {"status": "rejected"}
    if req.reason and req.reason.strip():
        fields["feedback"] = req.reason.strip()[:500]
    return db.update_decision(user["id"], decision_id, fields)


# ---------------------------------------------------------------------------
# Market discovery (public market data — no account information)
# ---------------------------------------------------------------------------

@app.get("/market/overview")
def market_overview() -> dict[str, Any]:
    out = broker.market_movers()
    symbols = list({
        m["symbol"]
        for group in ("gainers", "losers", "mostActive")
        for m in out.get(group, [])[:8]
    })
    try:
        out["sparks"] = broker.multi_closes(symbols, 30)
    except Exception:
        out["sparks"] = {}
    return out


@app.get("/market/ticker/{symbol}")
def market_ticker(symbol: str) -> dict[str, Any]:
    sym = symbol.upper().strip()
    info = broker.asset_info(sym)
    if not info:
        raise HTTPException(status_code=404, detail=f"{sym} is not a known US-listed asset")
    out: dict[str, Any] = {"info": info}
    try:
        out["indicators"] = broker.indicators(sym)
    except Exception:
        out["indicators"] = None
    try:
        out["bars"] = broker.daily_bars(sym, 60)
    except Exception:
        out["bars"] = []
    try:
        out["news"] = broker.recent_news([sym], 6)
    except Exception:
        out["news"] = []
    return out


@app.get("/market/sparklines")
def market_sparklines(symbols: str) -> dict[str, Any]:
    syms = [x.strip().upper() for x in symbols.split(",") if x.strip()][:30]
    try:
        return {"sparks": broker.multi_closes(syms, 30)}
    except Exception:
        return {"sparks": {}}


# ---------------------------------------------------------------------------
# Automations
# ---------------------------------------------------------------------------

class AutomationRequest(BaseModel):
    title: str
    prompt: str
    cadence: str = "manual"  # manual | daily | weekly | market_open
    hourUtc: int = 21


@app.get("/automations")
def automations(user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    return db.list_automations(user["id"])


@app.post("/automations")
def create_automation(req: AutomationRequest, user: dict = Depends(current_user)) -> dict[str, Any]:
    if req.cadence not in ("manual", "daily", "weekly", "market_open"):
        raise HTTPException(status_code=400, detail="bad cadence")
    if not req.title.strip() or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="title and prompt required")
    return db.create_automation(user["id"], req.title.strip(), req.prompt.strip(),
                                req.cadence, max(0, min(23, req.hourUtc)))


class AutomationPatch(BaseModel):
    enabled: bool | None = None


@app.patch("/automations/{auto_id}")
def patch_automation(auto_id: str, req: AutomationPatch, user: dict = Depends(current_user)) -> dict[str, Any]:
    fields = {}
    if req.enabled is not None:
        fields["enabled"] = req.enabled
    updated = db.update_automation(user["id"], auto_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="not found")
    return updated


@app.delete("/automations/{auto_id}")
def remove_automation(auto_id: str, user: dict = Depends(current_user)) -> dict[str, Any]:
    db.delete_automation(user["id"], auto_id)
    return {"ok": True}


def _start_automation_run(user_id: str, email: str, auto: dict) -> bool:
    row = db.get_agent(user_id)
    if not row or not row["activated"] or row["paused"] or user_id in _research_in_flight:
        return False
    run = db.create_run(user_id)
    db._rest("PATCH", "research_runs", params={"id": f"eq.{run['id']}"},
             json={"automation_id": auto["id"]})
    _research_in_flight.add(user_id)
    threading.Thread(target=_do_research,
                     args=({"id": user_id, "email": email}, row, run["id"], auto),
                     daemon=True).start()
    return True


@app.post("/automations/{auto_id}/run")
def run_automation(auto_id: str, user: dict = Depends(current_user)) -> dict[str, Any]:
    autos = [a for a in db.list_automations(user["id"]) if a["id"] == auto_id]
    if not autos:
        raise HTTPException(status_code=404, detail="not found")
    if not _start_automation_run(user["id"], user["email"], autos[0]):
        raise HTTPException(status_code=409, detail="agent inactive, paused, or already researching")
    db.update_automation(user["id"], auto_id, {"last_run_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()})
    return {"ok": True}


def _automation_due(auto: dict, now) -> bool:
    if not auto["enabled"] or auto["cadence"] == "manual":
        return False
    last = auto.get("last_run_at")
    if last:
        from datetime import datetime as _dt
        last_dt = _dt.fromisoformat(last.replace("Z", "+00:00"))
        if (now - last_dt).total_seconds() < 3600 * 20:
            return False
    if auto["cadence"] == "daily":
        return now.hour == auto["hour_utc"]
    if auto["cadence"] == "weekly":
        return now.weekday() == 4 and now.hour == auto["hour_utc"]
    if auto["cadence"] == "market_open":
        return now.weekday() < 5 and now.hour == 13 and now.minute >= 30
    return False


def _scheduler_loop() -> None:
    from datetime import datetime as _dt, timezone as _tz
    while True:
        try:
            now = _dt.now(_tz.utc)
            for auto in db.list_automations():
                if _automation_due(auto, now) and db.claim_automation(auto):
                    _start_automation_run(auto["user_id"], "", auto)
        except Exception:
            pass
        time.sleep(60)


threading.Thread(target=_scheduler_loop, daemon=True).start()


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
- The "universe" field is simply the WATCHLIST: 5-15 liquid symbols the \
user cares about most. It never limits anything — the agent researches the \
whole US market. Never write rules mentioning a "universe" or restricting \
research/trading to any list.
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


def _apply_instructions(user: dict[str, Any], row: dict[str, Any], instructions: str) -> dict[str, Any]:
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
                    f"NEW INSTRUCTIONS:\n{instructions}"
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
            "raw_instructions": [*row["raw_instructions"], instructions.strip()],
        },
    )
    return {
        "profile": updated["profile"],
        "strategy": updated["strategy"],
        "profileVersion": updated["profile_version"],
        "strategyVersion": updated["strategy_version"],
        "rawInstructions": updated["raw_instructions"],
    }


@app.post("/interpret-profile")
def interpret_profile(
    req: InterpretRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    if not req.instructions.strip():
        raise HTTPException(status_code=400, detail="instructions is empty")
    return _apply_instructions(user, _agent_for(user), req.instructions.strip())


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

Speak like a seasoned buy-side analyst: direct, opinionated where the data \
supports it, plain language. There is NO symbol restriction of any kind — \
the strategy's "universe" field is merely the user's watchlist. NEVER use \
the word "universe", never call any list "approved", and never say a stock \
can't be considered or traded. Any US-listed name can be researched and \
proposed. NEVER assert market facts from memory — whether a company is \
public, its ticker, price, or valuation; your knowledge may be stale. If a \
fact isn't in the records, USE YOUR LIVE TOOLS — lookup_asset verifies any \
ticker against the live asset list, get_latest_prices/get_indicators/\
get_recent_news pull real market data. Verify, then answer; never guess.

If the user expresses a DURABLE preference or instruction that should change \
how their agent invests (sectors, names to favor/avoid, risk, cadence), end \
your reply with a line in exactly this form (otherwise omit it):
UPDATE_STRATEGY: <one-sentence instruction capturing the preference>

Style: warm, concise, plain language for a smart beginner. A few sentences, \
not essays. Never give advice about real-money investing; if asked, remind \
the user this is a simulated learning account.

ACCOUNT STATE:
"""


CHAT_TOOLS = [
    {"type": "function", "function": {"name": "start_research", "description": "Launch a live research run for the user: scans their portfolio, watchlist, market movers, news, and indicators, then proposes safeguard-checked trades (or a report). Use when the user asks you to research, dig into something, or propose trades. The mission describes what to focus on.", "parameters": {"type": "object", "properties": {"mission": {"type": "string", "description": "What this run should focus on, in plain English."}}, "required": ["mission"]}}},
    {"type": "function", "function": {"name": "lookup_asset", "description": "Verify whether a symbol is a real, tradable US listing and get its latest price.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}},
    {"type": "function", "function": {"name": "get_latest_prices", "description": "Latest trade prices for comma-separated symbols.", "parameters": {"type": "object", "properties": {"symbols": {"type": "string"}}, "required": ["symbols"]}}},
    {"type": "function", "function": {"name": "get_indicators", "description": "Quant indicators for one symbol: price vs SMA20/50, RSI14, volatility, drawdown, 30-day return.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}},
    {"type": "function", "function": {"name": "get_recent_news", "description": "Recent market news for comma-separated symbols.", "parameters": {"type": "object", "properties": {"symbols": {"type": "string"}}, "required": ["symbols"]}}},
]


def _chat_tool(name: str, args: dict, keys, user=None, row=None, thread_id=None) -> str:
    try:
        if name == "start_research":
            if user is None or row is None:
                return json.dumps({"error": "unavailable"})
            if not row["activated"] or row["paused"]:
                return json.dumps({"error": "agent is inactive or paused — activate/resume it first"})
            if user["id"] in _research_in_flight:
                return json.dumps({"error": "a research run is already in progress"})
            run = db.create_run(user["id"])
            _research_in_flight.add(user["id"])
            threading.Thread(
                target=_do_research,
                args=(user, row, run["id"],
                      {"title": "Research", "prompt": str(args.get("mission", ""))[:1500],
                       "thread_id": thread_id}),
                daemon=True,
            ).start()
            return json.dumps({"ok": True, "runId": run["id"],
                               "note": "Research started — it takes about a minute; the findings will be posted into this conversation and any trades appear as proposals here."})
        if name == "lookup_asset":
            sym = str(args["symbol"]).upper()
            ok, detail = broker.asset_ok(sym, keys)
            out = {"tradable": ok, "detail": detail}
            if ok:
                out["price"] = broker.latest_prices([sym], keys).get(sym)
            return json.dumps(out)
        if name == "get_latest_prices":
            return json.dumps(broker.latest_prices([x.strip().upper() for x in str(args["symbols"]).split(",")], keys))
        if name == "get_indicators":
            return json.dumps(broker.indicators(str(args["symbol"]).upper(), keys))
        if name == "get_recent_news":
            return json.dumps(broker.recent_news([x.strip().upper() for x in str(args["symbols"]).split(",")], 8, keys))
        return json.dumps({"error": "unknown tool"})
    except Exception as e:
        return json.dumps({"error": str(e)[:200]})


class ChatMessage(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    threadId: str | None = None


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

    thread_id = req.threadId
    if not thread_id:
        threads_list = db.list_threads(user["id"])
        thread_id = threads_list[0]["id"] if threads_list else db.create_thread(user["id"])["id"]

    history = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.text}
        for m in req.messages[-12:]
    ]
    msgs = [
        {"role": "system", "content": CHAT_SYSTEM + json.dumps(context)},
        *history,
    ]
    text = ""
    for _ in range(4):
        completion = client.chat.completions.create(
            model=MODEL, messages=msgs, tools=CHAT_TOOLS, temperature=0.5
        )
        msg = completion.choices[0].message
        if msg.tool_calls:
            msgs.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [{"id": t.id, "type": "function",
                                         "function": {"name": t.function.name, "arguments": t.function.arguments}}
                                        for t in msg.tool_calls]})
            for t in msg.tool_calls:
                try:
                    targs = json.loads(t.function.arguments or "{}")
                except Exception:
                    targs = {}
                msgs.append({"role": "tool", "tool_call_id": t.id,
                             "content": _chat_tool(t.function.name, targs, keys, user, row, thread_id)})
            continue
        text = msg.content or ""
        break
    strategy_updated = False
    if "UPDATE_STRATEGY:" in text:
        instruction = text.rsplit("UPDATE_STRATEGY:", 1)[1].strip()
        text = text.rsplit("UPDATE_STRATEGY:", 1)[0].strip()
        if instruction and row["activated"]:
            try:
                _apply_instructions(user, row, instruction)
                strategy_updated = True
                text += "\n\n(I've updated your strategy to reflect this.)"
            except Exception:
                pass
    if len(req.messages) == 1:
        db.rename_thread(user["id"], thread_id, req.messages[-1].text[:60])
    db.add_message(user["id"], "user", req.messages[-1].text, thread_id)
    db.add_message(user["id"], "agent", text, thread_id)
    return {"text": text, "strategyUpdated": strategy_updated, "threadId": thread_id}


@app.get("/chat/history")
def chat_history(threadId: str | None = None, user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    return db.list_messages(user["id"], thread_id=threadId)


@app.get("/threads")
def threads(user: dict = Depends(current_user)) -> list[dict[str, Any]]:
    return db.list_threads(user["id"])


@app.post("/threads")
def new_thread(user: dict = Depends(current_user)) -> dict[str, Any]:
    return db.create_thread(user["id"])
