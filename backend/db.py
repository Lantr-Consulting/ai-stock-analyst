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
        "runId": row.get("run_id"),
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
        "run_id": d.get("runId"),
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

def add_message(user_id: str, role: str, text: str, thread_id: str | None = None) -> None:
    _rest("POST", "messages",
          json={"user_id": user_id, "role": role, "text": text, "thread_id": thread_id})


def list_messages(user_id: str, limit: int = 50, thread_id: str | None = None) -> list[dict[str, Any]]:
    params = {"user_id": f"eq.{user_id}", "order": "created_at.desc", "limit": limit}
    if thread_id:
        params["thread_id"] = f"eq.{thread_id}"
    rows = _rest("GET", "messages", params=params)
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


# ---------------------------------------------------------------------------
# Research runs & chat threads (workspace upgrade)
# ---------------------------------------------------------------------------

def create_run(user_id: str) -> dict[str, Any]:
    row = {"id": f"run-{uuid.uuid4().hex[:8]}", "user_id": user_id, "status": "running"}
    return _rest("POST", "research_runs", json=row,
                 extra_headers={"Prefer": "return=representation"})[0]


def finish_run(user_id: str, run_id: str, status: str, error: str | None = None) -> None:
    _rest("PATCH", "research_runs",
          params={"id": f"eq.{run_id}", "user_id": f"eq.{user_id}"},
          json={"status": status, "error": error,
                "finished_at": datetime.now(timezone.utc).isoformat()})


def list_runs(user_id: str, limit: int = 20) -> list[dict[str, Any]]:
    return _rest("GET", "research_runs",
                 params={"user_id": f"eq.{user_id}", "order": "started_at.desc",
                         "limit": limit})


def steer_run(user_id: str, run_id: str, text: str) -> dict[str, Any] | None:
    rows = _rest("GET", "research_runs",
                 params={"id": f"eq.{run_id}", "user_id": f"eq.{user_id}", "limit": 1})
    if not rows:
        return None
    steer = [*rows[0].get("steer", []), text]
    return _rest("PATCH", "research_runs",
                 params={"id": f"eq.{run_id}", "user_id": f"eq.{user_id}"},
                 json={"steer": steer},
                 extra_headers={"Prefer": "return=representation"})[0]


def recent_steers(user_id: str, limit: int = 5) -> list[str]:
    out: list[str] = []
    for r in list_runs(user_id, limit):
        out.extend(r.get("steer", []))
    return out[-limit:]


def create_thread(user_id: str, title: str = "New chat") -> dict[str, Any]:
    row = {"id": f"th-{uuid.uuid4().hex[:8]}", "user_id": user_id, "title": title[:80]}
    return _rest("POST", "threads", json=row,
                 extra_headers={"Prefer": "return=representation"})[0]


def list_threads(user_id: str) -> list[dict[str, Any]]:
    return _rest("GET", "threads",
                 params={"user_id": f"eq.{user_id}", "order": "created_at.desc"})


def rename_thread(user_id: str, thread_id: str, title: str) -> None:
    _rest("PATCH", "threads",
          params={"id": f"eq.{thread_id}", "user_id": f"eq.{user_id}"},
          json={"title": title[:80]})
