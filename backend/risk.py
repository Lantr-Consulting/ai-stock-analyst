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

    ok, detail = asset_check if asset_check is not None else (True, "not checked")
    check("Tradable asset", ok, detail)
    check(
        "Penny-stock floor",
        price >= 3.0,
        f"Price ${price:,.2f} {'≥' if price >= 3.0 else '<'} $3.00 minimum",
    )

    if action == "buy":
        is_core = symbol in sg.get("coreSymbols", [])
        cap = sg["maxCorePositionPct"] if is_core else sg["maxPositionPct"]
        resulting = (held.get(symbol, 0.0) + order_value) / equity * 100
        check(
            "Position limit",
            resulting <= cap,
            f"Resulting allocation {resulting:.1f}% vs {cap:.0f}% "
            f"{'core' if is_core else 'single-position'} limit",
        )
        cash_after = (cash - order_value) / equity * 100
        check(
            "Cash floor",
            cash_after >= sg["minCashPct"],
            f"Cash after purchase {cash_after:.1f}% vs {sg['minCashPct']:.0f}% minimum",
        )
    else:  # sell
        have = held.get(symbol, 0.0)
        check(
            "Position exists",
            have >= order_value * 0.99,
            f"Selling ~${order_value:,.0f} of ${have:,.0f} held in {symbol}",
        )

    order_pct = order_value / equity * 100
    check(
        "Order size",
        order_pct <= sg["maxOrderPct"],
        f"Order is {order_pct:.1f}% of portfolio vs {sg['maxOrderPct']:.0f}% limit",
    )

    check(
        "Trade frequency",
        trades_today < sg["maxTradesPerDay"],
        f"{trades_today} of {sg['maxTradesPerDay']} trades used today",
    )

    check(
        "No duplicate proposal",
        symbol not in pending_symbols,
        f"{'No' if symbol not in pending_symbols else 'Existing'} pending proposal for {symbol}",
    )

    return checks


def passed(checks: list[dict[str, str]]) -> bool:
    return all(c["status"] == "pass" for c in checks)
