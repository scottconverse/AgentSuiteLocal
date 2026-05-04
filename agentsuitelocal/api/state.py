"""Shared in-memory state and SQLite persistence."""

from __future__ import annotations

import asyncio
import collections
import json
import math
import sqlite3
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any

_runs: dict[str, dict[str, Any]] = {}
_pipelines: dict[str, dict[str, Any]] = {}

# RLock: callers may hold lock before calling _save_state()
_state_write_lock = threading.RLock()
_settings_lock = threading.RLock()

# B3: per-run asyncio Tasks and threading.Events for cooperative cancellation
_run_tasks: dict[str, asyncio.Task] = {}
_run_cancel_tokens: dict[str, threading.Event] = {}

# B4: per-run SSE event buffer (last N events per run)
_run_event_buffers: dict[str, collections.deque] = {}

_DB_FILE = Path.home() / ".agentsuitelocal" / "state.db"
# Legacy JSON paths — read once during one-time migration, then ignored
_RUNS_FILE = Path.home() / ".agentsuitelocal" / "runs.json"
_PIPELINES_FILE = Path.home() / ".agentsuitelocal" / "pipelines.json"
_MAX_RUNS = 50
_SSE_BUFFER_SIZE = 100


@contextmanager
def _get_conn():
    """Open a SQLite connection, commit on success, close on exit."""
    conn = sqlite3.connect(str(_DB_FILE))
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _init_db() -> bool:
    """Create tables if they don't exist. Returns True if the DB was newly created."""
    _DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    is_new = not _DB_FILE.exists()
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                started_at REAL
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS pipelines (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        """)
    return is_new


def _migrate_from_json() -> None:
    """One-time migration: import runs.json and pipelines.json into SQLite."""
    for path, table in ((_RUNS_FILE, "runs"), (_PIPELINES_FILE, "pipelines")):
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
            with _get_conn() as conn:
                for k, v in data.items():
                    started_at = v.get("started_at", 0)
                    conn.execute(
                        f"INSERT OR IGNORE INTO {table} (id, data, started_at) VALUES (?, ?, ?)",  # noqa: S608
                        (k, json.dumps(v, default=str), started_at),
                    )
        except Exception:
            pass


def _load_state() -> None:
    """Populate _runs and _pipelines from SQLite on startup. F1/F2: repair running records."""
    is_new = _init_db()
    if is_new:
        _migrate_from_json()

    with _get_conn() as conn:
        for row in conn.execute("SELECT id, data FROM runs"):
            try:
                v = json.loads(row[1])
            except Exception:
                continue
            # F1: Crash recovery — running → error with clear message
            if v.get("status") == "running":
                v["status"] = "error"
                v["error"] = "AgentSuiteLocal restarted while this run was in progress."
                v["error_message"] = v["error"]
                v["finished_at"] = time.time()
            # Migration: scrub any non-finite floats
            if v.get("qa_dimensions"):
                v["qa_dimensions"] = [
                    d for d in v["qa_dimensions"]
                    if isinstance(d.get("score"), int | float) and math.isfinite(float(d["score"]))
                ]
            _runs[v.get("id", row[0])] = v

        for row in conn.execute("SELECT id, data FROM pipelines"):
            try:
                v = json.loads(row[1])
            except Exception:
                continue
            # F2: Pipeline orphan repair — pipelines stuck running → error
            if v.get("status") == "running":
                v["status"] = "error"
                v["error_message"] = "AgentSuiteLocal restarted during pipeline execution."
                v["updated_at"] = time.time()
                for step in v.get("steps", []):
                    if step.get("status") == "running":
                        step["status"] = "error"
            _pipelines[v.get("id", row[0])] = v


def _save_state() -> None:
    """Persist _runs and _pipelines to SQLite. Evicts oldest runs beyond _MAX_RUNS."""
    with _state_write_lock:
        _DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        if len(_runs) > _MAX_RUNS:
            sorted_ids = sorted(_runs, key=lambda r: _runs[r].get("started_at", 0))
            for rid in sorted_ids[: len(_runs) - _MAX_RUNS]:
                del _runs[rid]

        with _get_conn() as conn:
            for run_id, run in _runs.items():
                conn.execute(
                    "INSERT OR REPLACE INTO runs (id, data, started_at) VALUES (?, ?, ?)",
                    (run_id, json.dumps(run, default=str), run.get("started_at", 0)),
                )
            # Remove DB rows for evicted runs
            existing_ids = {row[0] for row in conn.execute("SELECT id FROM runs")}
            for rid in existing_ids - set(_runs):
                conn.execute("DELETE FROM runs WHERE id = ?", (rid,))

            for pid, pipeline in _pipelines.items():
                conn.execute(
                    "INSERT OR REPLACE INTO pipelines (id, data) VALUES (?, ?)",
                    (pid, json.dumps(pipeline, default=str)),
                )
            # Remove DB rows for deleted pipelines
            existing_pids = {row[0] for row in conn.execute("SELECT id FROM pipelines")}
            for pid in existing_pids - set(_pipelines):
                conn.execute("DELETE FROM pipelines WHERE id = ?", (pid,))


_load_state()
