"""Deterministic risk engine.

Every proposed order runs through these coded checks against the REAL account
state. The language model has no say here — a proposal either passes every
check or it is blocked. Mirrors the safeguards screen in the frontend.
"""

from typing import Any

DEFAULT_SAFEGUARDS = {
    "approvedUniverse": ["AAPL", "MSFT", "NVDA", "AMZN", "AVGO", "VOO", "QQQ"],
    "maxPositionPct": 15.0,
    # Broad-market core ETFs may grow larger than a single-stock position —
    # but the per-order cap still forces the core to be built incrementally.
    "coreSymbols": ["VOO", "QQQ"],
    "maxCorePositionPct": 50.0,
    "minCashPct": 10.0,
    "maxOrderPct": 10.0,
    "maxTradesPerDay": 2,
}


def run_safeguards(
    action: str,
    symbol: str,
    qty: float,
    price: float,
    account: dict[str, Any],
    safeguards: dict[str, Any],
    trades_today: int,
    pending_symbols: set[str],
    asset_check: tuple[bool, str] | None = None,
) -> list[dict[str, str]]:
    sg = {**DEFAULT_SAFEGUARDS, **(safeguards or {})}
    equity = account["equity"]
    cash = account["cash"]
    order_value = qty * price
    held = {p["symbol"]: p["shares"] * p["price"] for p in account["positions"]}

    checks: list[dict[str, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append({"name": name, "detail": detail, "status": "pass" if ok else "fail"})

    ok, detail = asset_check if asset_check is not None else (True, "未单独检查")
    check("标的可交易", ok, detail)
    check(
        "最低股价",
        price >= 3.0,
        f"当前股价 ${price:,.2f}，最低要求为 $3.00",
    )

    if action == "buy":
        is_core = symbol in sg.get("coreSymbols", [])
        cap = sg["maxCorePositionPct"] if is_core else sg["maxPositionPct"]
        resulting = (held.get(symbol, 0.0) + order_value) / equity * 100
        check(
            "仓位上限",
            resulting <= cap,
            f"交易后仓位为 {resulting:.1f}%，上限为 {cap:.0f}%"
            f"（{'核心 ETF' if is_core else '单一标的'}）",
        )
        cash_after = (cash - order_value) / equity * 100
        check(
            "最低现金比例",
            cash_after >= sg["minCashPct"],
            f"买入后现金比例为 {cash_after:.1f}%，最低要求为 {sg['minCashPct']:.0f}%",
        )
    else:  # sell
        have = held.get(symbol, 0.0)
        check(
            "持仓充足",
            have >= order_value * 0.99,
            f"计划卖出约 ${order_value:,.0f}，当前持有 {symbol} 市值约 ${have:,.0f}",
        )

    order_pct = order_value / equity * 100
    check(
        "单笔订单上限",
        order_pct <= sg["maxOrderPct"],
        f"订单占组合资产 {order_pct:.1f}%，上限为 {sg['maxOrderPct']:.0f}%",
    )

    check(
        "每日交易次数",
        trades_today < sg["maxTradesPerDay"],
        f"今天已使用 {trades_today}/{sg['maxTradesPerDay']} 笔交易额度",
    )

    check(
        "无重复建议",
        symbol not in pending_symbols,
        f"{symbol} {'没有' if symbol not in pending_symbols else '已有'}待确认建议",
    )

    return checks


def passed(checks: list[dict[str, str]]) -> bool:
    return all(c["status"] == "pass" for c in checks)
