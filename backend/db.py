"""Supabase data access (PostgREST) — per-user agents and decision records.

The backend uses the secret (service) key, which bypasses Row-Level Security;
authorization happens in auth.py by resolving the caller's JWT to a user id,
and every query here filters on that user id. Users' direct reads (if ever
added) are protected by the RLS policies in schema.sql.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import requests as http

URL = os.environ["SUPABASE_URL"].rstrip("/")
SECRET = os.environ["SUPABASE_SECRET_KEY"]


def _headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    return {
        "apikey": SECRET,
        "Authorization": f"Bearer {SECRET}",
        "Content-Type": "application/json",
        **(extra or {}),
    }


def _rest(method: str, path: str, *, params: dict | None = None, json: Any = None,
          extra_headers: dict | None = None) -> Any:
    r = http.request(
        method,
        f"{URL}/rest/v1/{path}",
        headers=_headers(extra_headers),
        params=params,
        json=json,
        timeout=20,
    )
    r.raise_for_status()
    return r.json() if r.text else None


# ---------------------------------------------------------------------------
# Agents (one row per user)
# ---------------------------------------------------------------------------

def get_agent(user_id: str) -> dict[str, Any] | None:
    rows = _rest("GET", "agents", params={"user_id": f"eq.{user_id}", "limit": 1})
    return rows[0] if rows else None


def ensure_agent(user_id: str, email: str, default_profile: dict, default_strategy: dict) -> dict[str, Any]:
    agent = get_agent(user_id)
    if agent:
        return agent
    row = {
        "user_id": user_id,
        "email": email,
        "profile": default_profile,
        "strategy": default_strategy,
        "profile_version": 1,
        "strategy_version": 1,
    }
    created = _rest(
        "POST", "agents", json=row, extra_headers={"Prefer": "return=representation"}
    )
    return created[0]


def update_agent(user_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    fields = {**fields, "updated_at": datetime.now(timezone.utc).isoformat()}
    rows = _rest(
        "PATCH",
        "agents",
        params={"user_id": f"eq.{user_id}"},
        json=fields,
        extra_headers={"Prefer": "return=representation"},
    )
    return rows[0]


# ---------------------------------------------------------------------------
# Decisions
# ---------------------------------------------------------------------------

def _to_api(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "action": row["action"],
        "symbol": row["symbol"],
        "qty": float(row["qty"]) if row["qty"] is not None else None,
        "estValue": float(row["est_value"]) if row["est_value"] is not None else None,
        "rationale": row["rationale"],
        "strategyVersion": row["strategy_version"],
        "evidence": row["evidence"],
        "safeguards": row["safeguards"],
        "status": row["status"],
        "order": row["order_record"],
        "feedback": row.get("feedback"),
    }


def list_decisions(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    rows = _rest(
        "GET",
        "decisions",
        params={
            "user_id": f"eq.{user_id}",
            "order": "created_at.desc",
            "limit": limit,
        },
    )
    return [_to_api(r) for r in rows]


def get_decision(user_id: str, decision_id: str) -> dict[str, Any] | None:
    rows = _rest(
        "GET",
        "decisions",
        params={"id": f"eq.{decision_id}", "user_id": f"eq.{user_id}", "limit": 1},
    )
    return _to_api(rows[0]) if rows else None


def add_decision(user_id: str, d: dict[str, Any]) -> dict[str, Any]:
    row = {
        "id": f"dec-{uuid.uuid4().hex[:8]}",
        "user_id": user_id,
        "action": d["action"],
        "symbol": d.get("symbol"),
        "qty": d.get("qty"),
        "est_value": d.get("estValue"),
        "rationale": d.get("rationale", ""),
        "strategy_version": d.get("strategyVersion", 0),
        "evidence": d.get("evidence", []),
        "safeguards": d.get("safeguards", []),
        "status": d["status"],
        "order_record": d.get("order"),
    }
    created = _rest(
        "POST", "decisions", json=row, extra_headers={"Prefer": "return=representation"}
    )
    return _to_api(created[0])


def update_decision(user_id: str, decision_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    mapped: dict[str, Any] = {}
    if "status" in fields:
        mapped["status"] = fields["status"]
    if "order" in fields:
        mapped["order_record"] = fields["order"]
    if "safeguards" in fields:
        mapped["safeguards"] = fields["safeguards"]
    if "feedback" in fields:
        mapped["feedback"] = fields["feedback"]
    rows = _rest(
        "PATCH",
        "decisions",
        params={"id": f"eq.{decision_id}", "user_id": f"eq.{user_id}"},
        json=mapped,
        extra_headers={"Prefer": "return=representation"},
    )
    return _to_api(rows[0]) if rows else None


def pending_symbols(user_id: str) -> set[str]:
    rows = _rest(
        "GET",
        "decisions",
        params={"user_id": f"eq.{user_id}", "status": "eq.proposed", "select": "symbol"},
    )
    return {r["symbol"] for r in rows if r.get("symbol")}


# ---------------------------------------------------------------------------
# Chat messages (persisted threads)
# ---------------------------------------------------------------------------

def add_message(user_id: str, role: str, text: str) -> None:
    _rest("POST", "messages", json={"user_id": user_id, "role": role, "text": text})


def list_messages(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    rows = _rest(
        "GET", "messages",
        params={"user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": limit},
    )
    return [
        {"id": str(r["id"]), "role": r["role"], "text": r["text"], "at": r["created_at"]}
        for r in reversed(rows)
    ]


def supersede_pending(user_id: str) -> int:
    rows = _rest(
        "PATCH", "decisions",
        params={"user_id": f"eq.{user_id}", "status": "eq.proposed"},
        json={"status": "rejected", "feedback": "Superseded by a newer research cycle."},
        extra_headers={"Prefer": "return=representation"},
    )
    return len(rows or [])
