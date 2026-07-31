"""Alpaca paper-trading access: account, market data, news, and orders.

Everything here talks to the PAPER endpoint only. Every function accepts an
optional `keys=(api_key, secret_key)` — the signed-in user's own paper
account. Without it, the shared demo account from the environment is used.
Nothing in this module decides anything — it just fetches and executes.
Decisions belong to the agent, checks to risk.py.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests as http
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.historical.news import NewsClient
from alpaca.data.requests import NewsRequest, StockBarsRequest, StockLatestTradeRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, QueryOrderStatus, TimeInForce
from alpaca.trading.requests import GetOrdersRequest, MarketOrderRequest

PAPER_BASE = "https://paper-api.alpaca.markets"

Keys = tuple[str, str] | None


def _keys(keys: Keys = None) -> tuple[str, str]:
    if keys:
        return keys
    return os.environ["ALPACA_API_KEY"], os.environ["ALPACA_SECRET_KEY"]


def trading(keys: Keys = None) -> TradingClient:
    key, secret = _keys(keys)
    return TradingClient(key, secret, paper=True)


def data(keys: Keys = None) -> StockHistoricalDataClient:
    key, secret = _keys(keys)
    return StockHistoricalDataClient(key, secret)


def news_client(keys: Keys = None) -> NewsClient:
    key, secret = _keys(keys)
    return NewsClient(key, secret)


def _headers(keys: Keys = None) -> dict[str, str]:
    key, secret = _keys(keys)
    return {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}


def keys_valid(keys: Keys) -> bool:
    r = http.get(f"{PAPER_BASE}/v2/account", headers=_headers(keys), timeout=10)
    return r.status_code == 200


# ---------------------------------------------------------------------------
# Account & portfolio
# ---------------------------------------------------------------------------

def open_orders(keys: Keys = None) -> list[dict[str, Any]]:
    req = GetOrdersRequest(status=QueryOrderStatus.OPEN, limit=50)
    return [
        {"symbol": o.symbol, "side": str(o.side.value if hasattr(o.side, "value") else o.side),
         "qty": float(o.qty or 0), "status": str(o.status.value if hasattr(o.status, "value") else o.status)}
        for o in trading(keys).get_orders(req)
    ]


def account_snapshot(keys: Keys = None) -> dict[str, Any]:
    client = trading(keys)
    acct = client.get_account()
    positions = client.get_all_positions()
    return {
        "openOrders": open_orders(keys),
        "asOf": datetime.now(timezone.utc).isoformat(),
        "cash": float(acct.cash),
        "equity": float(acct.equity),
        "positions": [
            {
                "symbol": p.symbol,
                "name": p.symbol,
                "shares": float(p.qty),
                "costBasis": float(p.avg_entry_price),
                "price": float(p.current_price or p.avg_entry_price),
            }
            for p in positions
        ],
    }


def value_history(keys: Keys = None) -> list[dict[str, Any]]:
    """Daily portfolio value for the chart, via the portfolio-history REST API."""
    r = http.get(
        f"{PAPER_BASE}/v2/account/portfolio/history",
        headers=_headers(keys),
        params={"period": "2M", "timeframe": "1D"},
        timeout=15,
    )
    r.raise_for_status()
    body = r.json()
    out = []
    for ts, eq in zip(body.get("timestamp") or [], body.get("equity") or []):
        if not eq:  # skip days before the account existed
            continue
        out.append(
            {
                "date": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                "value": round(float(eq), 2),
            }
        )
    return out


# ---------------------------------------------------------------------------
# Market data & news (the agent's read tools call these)
# ---------------------------------------------------------------------------

def latest_prices(symbols: list[str], keys: Keys = None) -> dict[str, float]:
    req = StockLatestTradeRequest(symbol_or_symbols=symbols)
    trades = data(keys).get_stock_latest_trade(req)
    return {sym: round(float(t.price), 2) for sym, t in trades.items()}


def daily_bars(symbol: str, days: int = 30, keys: Keys = None) -> list[dict[str, Any]]:
    start = datetime.now(timezone.utc) - timedelta(days=days * 2)
    req = StockBarsRequest(
        symbol_or_symbols=symbol, timeframe=TimeFrame.Day, start=start
    )
    bars = data(keys).get_stock_bars(req)
    rows = bars.data.get(symbol, [])[-days:]
    return [
        {
            "date": b.timestamp.strftime("%Y-%m-%d"),
            "open": float(b.open),
            "close": float(b.close),
            "high": float(b.high),
            "low": float(b.low),
            "volume": int(b.volume),
        }
        for b in rows
    ]


def recent_news(symbols: list[str], limit: int = 10, keys: Keys = None) -> list[dict[str, str]]:
    req = NewsRequest(symbols=",".join(symbols), limit=limit)
    result = news_client(keys).get_news(req)
    items = result.data.get("news", [])
    return [
        {
            "headline": n.headline,
            "source": n.source,
            "symbols": ",".join(n.symbols or []),
            "at": n.created_at.isoformat() if n.created_at else "",
            "summary": (n.summary or "")[:300],
        }
        for n in items
    ]


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

def submit_market_order(symbol: str, qty: float, side: str, keys: Keys = None) -> dict[str, Any]:
    order = trading(keys).submit_order(
        MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
    )
    return order_record(order)


def get_order(order_id: str, keys: Keys = None) -> dict[str, Any]:
    return order_record(trading(keys).get_order_by_id(order_id))


def order_record(order: Any) -> dict[str, Any]:
    return {
        "id": str(order.id),
        "submittedAt": order.submitted_at.isoformat() if order.submitted_at else "",
        "status": str(order.status.value if hasattr(order.status, "value") else order.status),
        "filledAt": order.filled_at.isoformat() if order.filled_at else None,
        "fillPrice": float(order.filled_avg_price) if order.filled_avg_price else None,
    }


def orders_submitted_today(keys: Keys = None) -> int:
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    req = GetOrdersRequest(status=QueryOrderStatus.ALL, after=start_of_day, limit=100)
    return len(trading(keys).get_orders(req))


# ---------------------------------------------------------------------------
# Indicators (computed from daily bars — the agent's quant toolkit)
# ---------------------------------------------------------------------------

def indicators(symbol: str, keys: Keys = None) -> dict[str, Any]:
    bars = daily_bars(symbol, 60, keys)
    closes = [b["close"] for b in bars]
    if len(closes) < 20:
        return {"symbol": symbol, "error": "not enough history"}

    def sma(n: int) -> float | None:
        return round(sum(closes[-n:]) / n, 2) if len(closes) >= n else None

    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d for d in deltas[-14:] if d > 0]
    losses = [-d for d in deltas[-14:] if d < 0]
    avg_gain = sum(gains) / 14
    avg_loss = sum(losses) / 14
    rsi = 100.0 if avg_loss == 0 else round(100 - 100 / (1 + avg_gain / avg_loss), 1)

    rets = [deltas[i] / closes[i] for i in range(len(deltas))]
    mean = sum(rets) / len(rets)
    vol = (sum((r - mean) ** 2 for r in rets) / len(rets)) ** 0.5 * (252 ** 0.5)

    peak, max_dd = closes[0], 0.0
    for c in closes:
        peak = max(peak, c)
        max_dd = max(max_dd, (peak - c) / peak)

    return {
        "symbol": symbol,
        "price": closes[-1],
        "sma20": sma(20),
        "sma50": sma(50),
        "rsi14": rsi,
        "annualizedVolPct": round(vol * 100, 1),
        "maxDrawdown60dPct": round(max_dd * 100, 1),
        "return30dPct": round((closes[-1] / closes[-21] - 1) * 100, 1) if len(closes) >= 21 else None,
    }


def asset_ok(symbol: str, keys: Keys = None) -> tuple[bool, str]:
    """Deterministic sanity check: real, active, tradable US equity/ETF."""
    try:
        a = trading(keys).get_asset(symbol)
    except Exception:
        return False, f"{symbol} is not a known US-listed asset"
    exch = str(getattr(a, "exchange", ""))
    if not a.tradable or str(a.status) not in ("AssetStatus.ACTIVE", "active"):
        return False, f"{symbol} is not active/tradable on Alpaca"
    if "OTC" in exch.upper():
        return False, f"{symbol} trades OTC — excluded"
    return True, f"{symbol} is an active, tradable listing ({exch.split('.')[-1]})"


def market_movers(keys: Keys = None) -> dict[str, Any]:
    """Top market movers + most-active stocks (Alpaca screener)."""
    key, secret = _keys(keys)
    h = {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}
    out: dict[str, Any] = {}
    r = http.get("https://data.alpaca.markets/v1beta1/screener/stocks/movers",
                 headers=h, params={"top": 10}, timeout=15)
    if r.status_code == 200:
        b = r.json()
        out["gainers"] = [{"symbol": m["symbol"], "pctChange": m["percent_change"], "price": m["price"]} for m in b.get("gainers", [])]
        out["losers"] = [{"symbol": m["symbol"], "pctChange": m["percent_change"], "price": m["price"]} for m in b.get("losers", [])]
    r = http.get("https://data.alpaca.markets/v1beta1/screener/stocks/most-actives",
                 headers=h, params={"top": 10, "by": "volume"}, timeout=15)
    if r.status_code == 200:
        out["mostActive"] = [{"symbol": m["symbol"], "volume": m["volume"]} for m in r.json().get("most_actives", [])]
    return out


def asset_info(symbol: str, keys: Keys = None) -> dict[str, Any] | None:
    try:
        a = trading(keys).get_asset(symbol)
    except Exception:
        return None
    return {
        "symbol": a.symbol,
        "name": a.name,
        "exchange": str(getattr(a, "exchange", "")).split(".")[-1],
        "tradable": bool(a.tradable),
    }
