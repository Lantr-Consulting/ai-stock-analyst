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
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from openai import OpenAI  # noqa: E402
from pydantic import BaseModel  # noqa: E402

import agent as research_agent  # noqa: E402
import broker  # noqa: E402
import db  # noqa: E402
import demo  # noqa: E402
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
    "goals": "在理解市场的同时稳步积累长期资产",
    "riskTolerance": "moderate",
    "timeHorizon": "3 至 5 年",
    "preferredSectors": ["科技", "AI 基础设施", "宽基指数 ETF"],
    "avoid": ["低价股", "期权、融资融券和加密资产（不在项目范围内）"],
    "marketViews": ["AI 基础设施需求仍会增长"],
    "tradingFrequency": "每周最多新增 2 笔交易",
}

DEFAULT_STRATEGY = {
    "summary": "以宽基指数作为核心仓位，适度配置大型科技与 AI 基础设施公司；只在证据充分时加仓，并保留现金缓冲。",
    "watching": [
        "AI 基础设施公司的财报和业绩指引（NVDA、MSFT、AVGO）",
        "大盘走势与 VOO 基准的差异",
        "可能改变现有持仓逻辑的新闻",
    ],
    "rules": [
        "核心仓位：将 30% 至 50% 配置在 VOO，作为组合锚点",
        "方向倾斜：单一科技股仓位不超过 15%",
        "至少有两项相互独立的依据时才提出买入建议",
        "始终保留至少 10% 的现金",
        "只提出建议，不自动执行；每笔订单都要用户确认",
    ],
    "universe": ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
}

DEFAULT_PROFILE_EN = {
    "goals": "Build a durable long-term portfolio while learning how markets work",
    "riskTolerance": "moderate",
    "timeHorizon": "3 to 5 years",
    "preferredSectors": ["Technology", "AI infrastructure", "Broad-market ETFs"],
    "avoid": ["Penny stocks", "Options, margin, and crypto"],
    "marketViews": ["Demand for AI infrastructure should continue to grow"],
    "tradingFrequency": "No more than two new trades per week",
}

DEFAULT_STRATEGY_EN = {
    "summary": "Use a broad-market ETF as the core, add measured exposure to profitable technology and AI infrastructure companies, and preserve a cash buffer.",
    "watching": [
        "Earnings and guidance from AI infrastructure companies (NVDA, MSFT, AVGO)",
        "Performance against the VOO benchmark",
        "News that changes the thesis for an existing holding",
    ],
    "rules": [
        "Keep 30% to 50% in VOO as the portfolio anchor",
        "Keep each individual technology stock below 15%",
        "Require at least two independent pieces of evidence before proposing a buy",
        "Keep at least 10% in cash",
        "Propose, never auto-execute; every simulated order needs approval",
    ],
    "universe": ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
}


EMPTY_PROFILE: dict[str, Any] = {}
EMPTY_STRATEGY = {"summary": "", "watching": [], "rules": [], "universe": []}


def _agent_for(user: dict[str, Any]) -> dict[str, Any]:
    # New agents start EMPTY and inactive: the user describes how they invest,
    # reviews the interpreted strategy, universe, and safeguards, then
    # explicitly activates. No defaults they didn't bless.
    if not demo.is_demo_user(user):
        return db.ensure_agent(user["id"], user["email"], EMPTY_PROFILE, EMPTY_STRATEGY)

    english = demo.language_for(user) == "en"
    row = db.ensure_agent(
        user["id"],
        user["email"],
        DEFAULT_PROFILE_EN if english else DEFAULT_PROFILE,
        DEFAULT_STRATEGY_EN if english else DEFAULT_STRATEGY,
    )
    if not row["activated"]:
        row = db.update_agent(user["id"], {"activated": True})
    if not db.list_decisions(user["id"], limit=1):
        now = account_ts()
        db.add_decision(user["id"], {
            "action": "hold",
            "rationale": (
                "The portfolio remains close to its target allocation. The next useful step is to compare current AI-infrastructure valuations before adding risk."
                if english else
                "当前持仓与目标配置相差不大。下一步更值得做的是比较 AI 基础设施公司的估值，再决定是否增加风险。"
            ),
            "strategyVersion": row["strategy_version"],
            "evidence": [{
                "source": "Demo portfolio review" if english else "演示组合复盘",
                "timestamp": now,
                "summary": "No order was needed; the cash buffer and position limits remain intact." if english else "本轮无需下单，现金缓冲和仓位限制都保持正常。",
            }],
            "safeguards": [],
            "status": "approved",
        })
    if not db.list_automations(user["id"]):
        seeded = db.create_automation(
            user["id"],
            "Weekly portfolio review" if english else "每周持仓复盘",
            "Review the portfolio, recent market changes, and the strongest evidence for or against adjusting a position."
            if english else
            "复盘当前持仓和近期市场变化，说明是否有充分依据调整仓位。",
            "weekly",
            13,
        )
        db.update_automation(user["id"], seeded["id"], {"enabled": False})
    return row


def _demo_portfolio() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    points = [
        {"date": (now - timedelta(days=42 - i * 3)).date().isoformat(), "value": value}
        for i, value in enumerate([100000, 100620, 99880, 101240, 102150, 101730, 103080,
                                   102760, 104110, 104880, 104420, 105760, 106340, 107180, 107640])
    ]
    return {
        "asOf": now.isoformat(),
        "cash": 24125.50,
        "equity": 107640.00,
        "openOrders": [],
        "positions": [
            {"symbol": "VOO", "name": "Vanguard S&P 500 ETF", "shares": 70, "costBasis": 512.10, "price": 538.42, "unrealizedPl": 1842.40, "unrealizedPlPct": 5.14, "todayPct": 0.32},
            {"symbol": "MSFT", "name": "Microsoft", "shares": 40, "costBasis": 448.30, "price": 471.18, "unrealizedPl": 915.20, "unrealizedPlPct": 5.10, "todayPct": -0.18},
            {"symbol": "NVDA", "name": "NVIDIA", "shares": 100, "costBasis": 129.75, "price": 142.60, "unrealizedPl": 1285.00, "unrealizedPlPct": 9.90, "todayPct": 1.24},
            {"symbol": "AMZN", "name": "Amazon", "shares": 50, "costBasis": 196.40, "price": 209.85, "unrealizedPl": 672.50, "unrealizedPlPct": 6.85, "todayPct": 0.41},
        ],
        "history": points,
        "sharedDemoAccount": False,
        "privateDemo": True,
    }


def _keys_for(agent_row: dict[str, Any]) -> broker.Keys:
    if agent_row.get("alpaca_api_key") and agent_row.get("alpaca_secret_key"):
        return (agent_row["alpaca_api_key"], agent_row["alpaca_secret_key"])
    return None  # shared demo account from env


def _request_language(request: Request) -> str:
    return "en" if request.headers.get("accept-language", "").lower().startswith("en") else "zh"


def _language_rule(language: str) -> str:
    if language == "en":
        return "Write every user-facing field in natural English; keep stock symbols and JSON keys unchanged."
    return "Write every user-facing field in natural Simplified Chinese; keep stock symbols and JSON keys unchanged."


@app.get("/")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-stock-analyst-backend"}


class DemoSessionRequest(BaseModel):
    language: Literal["zh", "en"] = "zh"
    code: str | None = None


@app.get("/demo/config")
def demo_config() -> dict[str, Any]:
    return demo.config()


@app.post("/demo/session")
def demo_session(req: DemoSessionRequest, request: Request) -> dict[str, Any]:
    return demo.create_session(request, language=req.language, code=req.code)


@app.get("/demo/status")
def demo_status(user: dict = Depends(current_user)) -> dict[str, Any]:
    return demo.status(user)


@app.post("/demo/reset")
def demo_reset(request: Request, user: dict = Depends(current_user)) -> dict[str, Any]:
    return demo.reset_session(request, user)


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
        "demo": demo.status(user) if demo.is_demo_user(user) else {"isDemo": False},
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
            raise HTTPException(status_code=400, detail="研究范围不能为空")
        fields["strategy"] = {**row["strategy"], "universe": symbols}
    if req.paused is not None:
        fields["paused"] = req.paused
    if not fields:
        raise HTTPException(status_code=400, detail="没有需要更新的内容")
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
            detail="请先描述你的投资方式，并确认研究策略和研究范围",
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
    if demo.is_demo_user(user):
        raise HTTPException(status_code=403, detail="临时演示不会连接外部券商账户")
    _agent_for(user)
    keys = (req.apiKey.strip(), req.secretKey.strip())
    if not broker.keys_valid(keys):
        raise HTTPException(
            status_code=400,
            detail="Alpaca 无法验证这些密钥，请确认使用的是完整的模拟交易密钥",
        )
    db.update_agent(user["id"], {"alpaca_api_key": keys[0], "alpaca_secret_key": keys[1]})
    return {"ok": True, "hasAlpacaKeys": True}


# ---------------------------------------------------------------------------
# Portfolio (the signed-in user's paper account)
# ---------------------------------------------------------------------------

@app.get("/portfolio")
def portfolio(user: dict = Depends(current_user)) -> dict[str, Any]:
    if demo.is_demo_user(user):
        _agent_for(user)
        return _demo_portfolio()
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
    if demo.is_demo_user(user):
        return records
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


def _do_research(
    user: dict,
    row: dict,
    run_id: str,
    automation: dict | None = None,
    language: str = "zh",
) -> None:
    keys = _keys_for(row)
    strategy = {**row["strategy"], "version": row["strategy_version"]}
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})}
    try:
        lessons = []
        for st in db.recent_steers(user["id"]):
            lessons.append(f'用户补充要求：“{st}”')
        for r in db.list_decisions(user["id"], limit=30):
            if r.get("symbol") and r["status"] == "rejected" and r.get("feedback") != "已由更新一轮的研究结果替代。":
                why = f'；原因：“{r["feedback"]}”' if r.get("feedback") else ""
                lessons.append(f'用户拒绝了 {r["action"]} {r["qty"]} 股 {r["symbol"]}{why}')
            elif r.get("symbol") and r["status"] in ("approved", "filled"):
                lessons.append(f'用户确认了 {r["action"]} {r["qty"]} 股 {r["symbol"]}')
        private_demo = demo.is_demo_user(user)
        pre = _demo_portfolio() if private_demo else broker.account_snapshot(keys)
        trades_used = (
            sum(1 for item in db.list_decisions(user["id"], limit=100)
                if item["status"] in ("approved", "filled") and item.get("symbol"))
            if private_demo else broker.orders_submitted_today(keys)
        )
        trades_left = max(0, int(safeguards["maxTradesPerDay"]) - trades_used)
        max_order = safeguards["maxOrderPct"] / 100 * pre["equity"]
        open_syms = sorted({o["symbol"] for o in pre.get("openOrders", [])})
        held_txt = ", ".join(
            f"{p['symbol']} ${p['shares']*p['price']:,.0f}" for p in pre["positions"]
        ) or "无"
        constraints = (
            f"组合资产 ${pre['equity']:,.0f}；现金 ${pre['cash']:,.0f}；"
            f"单笔订单上限 ${max_order:,.0f}（组合资产的 {safeguards['maxOrderPct']}%）；"
            f"现金比例不得低于 {safeguards['minCashPct']}%；"
            f"单一标的仓位上限 {safeguards['maxPositionPct']}% "
            f"（核心 ETF 为 {safeguards.get('maxCorePositionPct', 50)}%）；"
            f"今天还能交易 {trades_left} 笔，最多只能提出 {trades_left} 笔建议；"
            f"当前持仓：{held_txt}；"
            f"未成交订单（不得重复建议）：{', '.join(open_syms) or '无'}"
        )
        plan = research_agent.run_research_cycle(
            strategy, safeguards, keys, lessons[:12],
            mission=automation["prompt"] if automation else None,
            constraints=constraints,
            language=language,
            portfolio_override=pre if private_demo else None,
        )
        db.supersede_pending(user["id"])
        evidence = plan.get("evidence", [])
        rationale = plan.get("rationale", "")
        target = [t for t in plan.get("targetAllocation", []) if isinstance(t, dict) and t.get("symbol")]
        orders = [o for o in plan.get("orders", []) if isinstance(o, dict) and o.get("symbol") and o.get("qty")][:5]
        plan_evidence = [{"source": "目标配置", "timestamp": account_ts(),
                          "summary": "、".join(f"{t['symbol']} {t['pct']}%" for t in target) or "保持不变"}, *evidence]
        plan_record = db.add_decision(user["id"], {"action": "rebalance" if orders else "hold",
            "rationale": rationale or "当前组合已经符合目标配置。",
            "strategyVersion": row["strategy_version"], "evidence": plan_evidence,
            "safeguards": [], "status": "approved", "runId": run_id})
        account = _demo_portfolio() if private_demo else broker.account_snapshot(keys)
        trades_today = trades_used if private_demo else broker.orders_submitted_today(keys)
        pending = db.pending_symbols(user["id"]) | {
            o["symbol"] for o in account.get("openOrders", [])
        }
        held_val = {p["symbol"]: p["shares"] * p["price"] for p in account["positions"]}
        equity = account["equity"]
        proposed_count = 0
        skipped: list[str] = []
        need: dict[str, int] = {}
        for o in orders:
            symbol = str(o["symbol"]).upper(); qty = int(o["qty"])
            action = "sell" if o.get("action") == "sell" else "buy"
            price = broker.latest_prices([symbol], keys).get(symbol)
            if price is None or price <= 0:
                continue
            orig_qty = qty
            if action == "buy":
                # Pre-size to the tightest limit so proposals pass by construction.
                cap = (safeguards["maxCorePositionPct"]
                       if symbol in safeguards.get("coreSymbols", [])
                       else safeguards["maxPositionPct"])
                fits = [
                    safeguards["maxOrderPct"] / 100 * equity,                      # order size
                    cap / 100 * equity - held_val.get(symbol, 0.0),                # position cap
                    account["cash"] - safeguards["minCashPct"] / 100 * equity,     # cash floor
                ]
                qty = min(qty, int(min(fits) // price))
            def _note_needs(oq: int) -> None:
                ov = oq * price
                pct_order = ov / equity * 100
                if pct_order > safeguards["maxOrderPct"]:
                    need["maxOrderPct"] = max(need.get("maxOrderPct", 0), min(25, int(pct_order + 1)))
                pos_pct = (held_val.get(symbol, 0.0) + ov) / equity * 100
                is_core = symbol in safeguards.get("coreSymbols", [])
                if not is_core and pos_pct > safeguards["maxPositionPct"]:
                    need["maxPositionPct"] = max(need.get("maxPositionPct", 0), min(40, int(pos_pct + 1)))
                cash_after = (account["cash"] - ov) / equity * 100
                if cash_after < safeguards["minCashPct"]:
                    need["minCashPct"] = min(need.get("minCashPct", 100), max(2, int(cash_after)))

            if qty < 1:
                _note_needs(orig_qty)
                skipped.append(f"{action} {symbol}（当前风控范围内没有可用空间）")
                continue
            checks = risk.run_safeguards(action=action, symbol=symbol, qty=qty, price=price,
                account=account, safeguards=safeguards,
                trades_today=trades_today + proposed_count, pending_symbols=pending,
                asset_check=broker.asset_ok(symbol, keys))
            if not risk.passed(checks):
                fails = [c["name"] for c in checks if c["status"] == "fail"]
                if "Trade frequency" in fails:
                    need["maxTradesPerDay"] = min(10, trades_today + len(orders))
                _note_needs(orig_qty)
                skipped.append(f"{action} {qty} 股 {symbol}（{'、'.join(fails)}）")
                continue
            proposed_count += 1; pending.add(symbol)
            why = o.get("why", rationale)
            if qty != orig_qty:
                why = f"{why}（为符合风控限制，建议数量已从 {orig_qty} 股下调到 {qty} 股）"
            db.add_decision(user["id"], {"action": action, "symbol": symbol, "qty": qty,
                "estValue": round(qty * price, 2), "rationale": why,
                "strategyVersion": row["strategy_version"], "evidence": [],
                "safeguards": checks, "status": "proposed", "runId": run_id})
        if skipped:
            patch: dict[str, Any] = {
                "rationale": plan_record["rationale"]
                + "\n\n以下方案超出风控限制，未生成交易建议："
                + "；".join(skipped)
            }
            if need:
                patch["feedback"] = json.dumps(
                    {"suggest": need, "why": "; ".join(skipped)[:400]}
                )
            db._rest("PATCH", "decisions",
                     params={"id": f"eq.{plan_record['id']}"}, json=patch)
        summary = rationale or "本轮研究已完成，暂时没有值得采取行动的新发现。"
        if orders:
            summary += "\n\n建议：" + "、".join(
                f"{'卖出' if o.get('action') == 'sell' else '买入'} {o.get('qty')} 股 {o.get('symbol')}" for o in orders
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
def research_cycle(request: Request, user: dict = Depends(current_user)) -> dict[str, Any]:
    # DB-backed lock (works across workers): any run still 'running' and
    # younger than 15 minutes blocks a new one.
    from datetime import datetime, timedelta, timezone
    for r in db.list_runs(user["id"], limit=3):
        if r["status"] == "running":
            started = datetime.fromisoformat(r["started_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - started < timedelta(minutes=15):
                raise HTTPException(status_code=409, detail="已有一轮研究正在运行，完成后会自动显示结果")
            db.finish_run(user["id"], r["id"], "error", "运行超时")
    row = _agent_for(user)
    if not row["activated"]:
        raise HTTPException(status_code=409, detail="请先完成投资偏好设置并启用研究助手")
    if row["paused"]:
        raise HTTPException(status_code=409, detail="研究助手当前已暂停")
    demo.consume_ai_action(user)
    run = db.create_run(user["id"])
    _research_in_flight.add(user["id"])
    threading.Thread(
        target=_do_research,
        args=(user, row, run["id"], None, _request_language(request)),
        daemon=True,
    ).start()
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
        raise HTTPException(status_code=400, detail="补充要求不能为空")
    run = db.steer_run(user["id"], run_id, req.text.strip()[:300])
    if not run:
        raise HTTPException(status_code=404, detail="没有找到这次研究")
    return {"ok": True, "steer": run["steer"],
            "note": "补充要求已保存，将用于下一轮研究。"}


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
        raise HTTPException(status_code=404, detail="没有找到这条交易建议")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail="这条交易建议已经处理过")
    if req and req.qty is not None:
        if req.qty < 1:
            raise HTTPException(status_code=400, detail="交易数量至少为 1")
        record["qty"] = req.qty

    price = broker.latest_prices([record["symbol"]], keys).get(record["symbol"])
    private_demo = demo.is_demo_user(user)
    account = _demo_portfolio() if private_demo else broker.account_snapshot(keys)
    safeguards = {**risk.DEFAULT_SAFEGUARDS, **(row.get("safeguards") or {})}
    checks = risk.run_safeguards(
        action=record["action"],
        symbol=record["symbol"],
        qty=record["qty"],
        price=price or 0,
        account=account,
        safeguards=safeguards,
        trades_today=(
            sum(1 for item in db.list_decisions(user["id"], limit=100)
                if item["status"] in ("approved", "filled") and item.get("symbol"))
            if private_demo else broker.orders_submitted_today(keys)
        ),
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
    if private_demo:
        order = {
            "id": f"demo-{decision_id}",
            "submittedAt": account_ts(),
            "status": "filled",
            "filledAt": account_ts(),
            "fillPrice": price,
            "simulated": True,
        }
        return db.update_decision(
            user["id"], decision_id,
            {"status": "filled", "order": order, "safeguards": checks},
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


class RejectRequest(BaseModel):
    reason: str | None = None


@app.post("/decisions/{decision_id}/reject")
def reject(
    decision_id: str, req: RejectRequest, user: dict = Depends(current_user)
) -> dict[str, Any]:
    record = db.get_decision(user["id"], decision_id)
    if not record:
        raise HTTPException(status_code=404, detail="没有找到这条交易建议")
    if record["status"] != "proposed":
        raise HTTPException(status_code=409, detail="这条交易建议已经处理过")
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
        raise HTTPException(status_code=404, detail=f"没有找到美股标的 {sym}")
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
        raise HTTPException(status_code=400, detail="不支持这个运行频率")
    if not req.title.strip() or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="请填写任务名称和具体要求")
    row = db.create_automation(user["id"], req.title.strip(), req.prompt.strip(),
                               req.cadence, max(0, min(23, req.hourUtc)))
    if demo.is_demo_user(user):
        row = db.update_automation(user["id"], row["id"], {"enabled": False})
    return row


class AutomationPatch(BaseModel):
    enabled: bool | None = None


@app.patch("/automations/{auto_id}")
def patch_automation(auto_id: str, req: AutomationPatch, user: dict = Depends(current_user)) -> dict[str, Any]:
    fields = {}
    if req.enabled is not None:
        fields["enabled"] = False if demo.is_demo_user(user) else req.enabled
    updated = db.update_automation(user["id"], auto_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="没有找到这个定时任务")
    return updated


@app.delete("/automations/{auto_id}")
def remove_automation(auto_id: str, user: dict = Depends(current_user)) -> dict[str, Any]:
    db.delete_automation(user["id"], auto_id)
    return {"ok": True}


def _start_automation_run(user_id: str, email: str, auto: dict, language: str = "zh") -> bool:
    row = db.get_agent(user_id)
    if not row or not row["activated"] or row["paused"] or user_id in _research_in_flight:
        return False
    run = db.create_run(user_id)
    db._rest("PATCH", "research_runs", params={"id": f"eq.{run['id']}"},
             json={"automation_id": auto["id"]})
    _research_in_flight.add(user_id)
    threading.Thread(target=_do_research,
                     args=({"id": user_id, "email": email}, row, run["id"], auto, language),
                     daemon=True).start()
    return True


@app.post("/automations/{auto_id}/run")
def run_automation(auto_id: str, request: Request, user: dict = Depends(current_user)) -> dict[str, Any]:
    autos = [a for a in db.list_automations(user["id"]) if a["id"] == auto_id]
    if not autos:
        raise HTTPException(status_code=404, detail="没有找到这个定时任务")
    demo.consume_ai_action(user)
    if not _start_automation_run(user["id"], user["email"], autos[0], _request_language(request)):
        raise HTTPException(status_code=409, detail="研究助手尚未启用、已暂停，或正在进行另一轮研究")
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
                if demo.is_demo_user_id(auto["user_id"]):
                    continue
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
- Write every user-facing field in natural Simplified Chinese. Keep stock
  symbols and the riskTolerance enum unchanged. Avoid translated English
  phrasing; write as a native Chinese financial product would.
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


def _apply_instructions(
    user: dict[str, Any],
    row: dict[str, Any],
    instructions: str,
    language: str = "zh",
) -> dict[str, Any]:
    current = {"profile": row["profile"], "strategy": row["strategy"]}
    completion = client.chat.completions.create(
        model=MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": INTERPRET_SYSTEM + "\n" + _language_rule(language)},
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
        raise HTTPException(status_code=502, detail="模型返回的研究策略格式无效，请重试")

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
    req: InterpretRequest, request: Request, user: dict = Depends(current_user)
) -> dict[str, Any]:
    if not req.instructions.strip():
        raise HTTPException(status_code=400, detail="请先填写投资偏好")
    demo.consume_ai_action(user)
    return _apply_instructions(
        user,
        _agent_for(user),
        req.instructions.strip(),
        _request_language(request),
    )


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

Always answer in natural Simplified Chinese, even when the source data or the
user's message is in English. Keep stock symbols unchanged. Translate and
summarize English news instead of repeating it verbatim.

ACCOUNT STATE:
"""


CHAT_TOOLS = [
    {"type": "function", "function": {"name": "start_research", "description": "Launch a live research run for the user: scans their portfolio, watchlist, market movers, news, and indicators, then proposes safeguard-checked trades (or a report). Use when the user asks you to research, dig into something, or propose trades. The mission describes what to focus on.", "parameters": {"type": "object", "properties": {"mission": {"type": "string", "description": "What this run should focus on, in plain English."}}, "required": ["mission"]}}},
    {"type": "function", "function": {"name": "lookup_asset", "description": "Verify whether a symbol is a real, tradable US listing and get its latest price.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}},
    {"type": "function", "function": {"name": "get_latest_prices", "description": "Latest trade prices for comma-separated symbols.", "parameters": {"type": "object", "properties": {"symbols": {"type": "string"}}, "required": ["symbols"]}}},
    {"type": "function", "function": {"name": "get_indicators", "description": "Quant indicators for one symbol: price vs SMA20/50, RSI14, volatility, drawdown, 30-day return.", "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}}, "required": ["symbol"]}}},
    {"type": "function", "function": {"name": "get_recent_news", "description": "Recent market news for comma-separated symbols.", "parameters": {"type": "object", "properties": {"symbols": {"type": "string"}}, "required": ["symbols"]}}},
]


def _chat_tool(
    name: str,
    args: dict,
    keys,
    user=None,
    row=None,
    thread_id=None,
    language: str = "zh",
) -> str:
    try:
        if name == "start_research":
            if user is None or row is None:
                return json.dumps({"error": "当前无法执行这项操作"}, ensure_ascii=False)
            if not row["activated"] or row["paused"]:
                return json.dumps({"error": "研究助手尚未启用或已暂停，请先启用或恢复"})
            if user["id"] in _research_in_flight:
                return json.dumps({"error": "已有一轮研究正在进行"})
            demo.consume_ai_action(user)
            run = db.create_run(user["id"])
            _research_in_flight.add(user["id"])
            threading.Thread(
                target=_do_research,
                args=(user, row, run["id"],
                      {"title": "研究任务", "prompt": str(args.get("mission", ""))[:1500],
                       "thread_id": thread_id}, language),
                daemon=True,
            ).start()
            return json.dumps({"ok": True, "runId": run["id"],
                               "note": "研究已经开始，通常需要约一分钟；结论会发到本次对话，交易建议会显示在研究助手页面。"})
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
        return json.dumps({"error": "无法识别这项操作"}, ensure_ascii=False)
    except HTTPException as exc:
        return json.dumps({"error": exc.detail}, ensure_ascii=False)
    except Exception:
        return json.dumps({"error": "操作暂时失败，请稍后重试"}, ensure_ascii=False)


class ChatMessage(BaseModel):
    role: Literal["user", "agent"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    threadId: str | None = None


@app.post("/chat")
def chat(req: ChatRequest, request: Request, user: dict = Depends(current_user)) -> dict[str, Any]:
    if not req.messages:
        raise HTTPException(status_code=400, detail="消息不能为空")
    demo.consume_ai_action(user)
    row = _agent_for(user)
    keys = _keys_for(row)
    language = _request_language(request)

    def slim(r: dict[str, Any]) -> dict[str, Any]:
        return {k: v for k, v in r.items() if k != "evidence"} | {
            "evidence": [e["source"] for e in r.get("evidence", [])][:6]
        }

    context = {
        "profile": row["profile"],
        "strategy": row["strategy"],
        "portfolio": _demo_portfolio() if demo.is_demo_user(user) else broker.account_snapshot(keys),
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
        {"role": "system", "content": CHAT_SYSTEM + json.dumps(context) + "\n\n" + _language_rule(language)},
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
                             "content": _chat_tool(t.function.name, targs, keys, user, row, thread_id, language)})
            continue
        text = msg.content or ""
        break
    strategy_updated = False
    if "UPDATE_STRATEGY:" in text:
        instruction = text.rsplit("UPDATE_STRATEGY:", 1)[1].strip()
        text = text.rsplit("UPDATE_STRATEGY:", 1)[0].strip()
        if instruction and row["activated"]:
            try:
                _apply_instructions(user, row, instruction, language)
                strategy_updated = True
                text += "\n\n（我已根据这项要求更新你的研究策略。）"
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
