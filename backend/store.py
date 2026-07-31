"""Decision records, persisted to a JSON file.

Milestone 4 keeps records on local disk (survives restarts, not redeploys —
Railway's filesystem is ephemeral across deploys). Milestone 5 moves this to
Supabase; the record shape already matches the frontend's Decision type.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

PATH = os.environ.get("DECISIONS_PATH", "decisions.json")
_lock = threading.Lock()


def _load() -> list[dict[str, Any]]:
    if not os.path.exists(PATH):
        return []
    try:
        with open(PATH) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save(records: list[dict[str, Any]]) -> None:
    with open(PATH, "w") as f:
        json.dump(records, f, indent=1)


def list_decisions() -> list[dict[str, Any]]:
    with _lock:
        return sorted(_load(), key=lambda r: r["createdAt"], reverse=True)


def get(decision_id: str) -> dict[str, Any] | None:
    with _lock:
        return next((r for r in _load() if r["id"] == decision_id), None)


def add(record: dict[str, Any]) -> dict[str, Any]:
    record = {
        "id": f"dec-{uuid.uuid4().hex[:8]}",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        **record,
    }
    with _lock:
        records = _load()
        records.append(record)
        _save(records)
    return record


def update(decision_id: str, **fields: Any) -> dict[str, Any] | None:
    with _lock:
        records = _load()
        for r in records:
            if r["id"] == decision_id:
                r.update(fields)
                _save(records)
                return r
    return None


def pending_symbols() -> set[str]:
    return {
        r["symbol"]
        for r in list_decisions()
        if r.get("status") == "proposed" and r.get("symbol")
    }
