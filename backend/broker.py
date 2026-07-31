"""Alpaca paper-trading access: account, market data, news, and orders.

Everything here talks to the PAPER endpoint only. The API keys live in
environment variables; nothing in this module decides anything — it just
fetches and executes. Decisions belong to the agent, checks to risk.py.
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


def _keys() -> tuple[str, str]:
    return os.environ["ALPACA_API_KEY"], os.environ["ALPACA_SECRET_KEY"]


def trading() -> TradingClient:
    key, secret = _keys()
    return TradingClient(key, secret, paper=True)


def data() -> StockHistoricalDataClient:
    key, secret = _keys()
    return StockHistoricalDataClient(key, secret)


def news_client() -> NewsClient:
    key, secret = _keys()
    return NewsClient(key, secret)


def _headers() -> dict[str, str]:
    key, secret = _keys()
    return {"APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret}


# ---------------------------------------------------------------------------
# Account & portfolio
# ---------------------------------------------------------------------------

def account_snapshot() -> dict[str, Any]:
    acct = trading().get_account()
    positions = trading().get_all_positions()
    return {
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


def value_history() -> list[dict[str, Any]]:
    """Daily portfolio value for the chart, via the portfolio-history REST API."""
    r = http.get(
        f"{PAPER_BASE}/v2/account/portfolio/history",
        headers=_headers(),
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

def latest_prices(symbols: list[str]) -> dict[str, float]:
    req = StockLatestTradeRequest(symbol_or_symbols=symbols)
    trades = data().get_stock_latest_trade(req)
    return {sym: round(float(t.price), 2) for sym, t in trades.items()}


def daily_bars(symbol: str, days: int = 30) -> list[dict[str, Any]]:
    start = datetime.now(timezone.utc) - timedelta(days=days * 2)
    req = StockBarsRequest(
        symbol_or_symbols=symbol, timeframe=TimeFrame.Day, start=start
    )
    bars = data().get_stock_bars(req)
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


def recent_news(symbols: list[str], limit: int = 10) -> list[dict[str, str]]:
    req = NewsRequest(symbols=",".join(symbols), limit=limit)
    result = news_client().get_news(req)
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

def submit_market_order(symbol: str, qty: float, side: str) -> dict[str, Any]:
    order = trading().submit_order(
        MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=OrderSide.BUY if side == "buy" else OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
    )
    return order_record(order)


def get_order(order_id: str) -> dict[str, Any]:
    return order_record(trading().get_order_by_id(order_id))


def order_record(order: Any) -> dict[str, Any]:
    return {
        "id": str(order.id),
        "submittedAt": order.submitted_at.isoformat() if order.submitted_at else "",
        "status": str(order.status.value if hasattr(order.status, "value") else order.status),
        "filledAt": order.filled_at.isoformat() if order.filled_at else None,
        "fillPrice": float(order.filled_avg_price) if order.filled_avg_price else None,
    }


def orders_submitted_today() -> int:
    start_of_day = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    req = GetOrdersRequest(status=QueryOrderStatus.ALL, after=start_of_day, limit=100)
    return len(trading().get_orders(req))
