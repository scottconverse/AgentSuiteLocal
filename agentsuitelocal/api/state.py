"""Shared in-memory state and JSON sidecar persistence."""

from __future__ import annotations

import asyncio
import collections
import json
import math
import threading
import time
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

_RUNS_FILE = Path.home() / ".agentsuitelocal" / "runs.json"
_PIPELINES_FILE = Path.home() / ".agentsuitelocal" / "pipelines.json"
_MAX_RUNS = 50
_SSE_BUFFER_SIZE = 100


def _load_state() -> None:
    """Populate _runs and _pipelines from disk on startup. F1: repair running runs."""
    for path, store in ((_RUNS_FILE, _runs), (_PIPELINES_FILE, _pipelines)):
        if path.exists():
            try:
                data = json.loads(path.read_text())
                for k, v in data.items():
                    # F1: Crash recovery — running → error with clear message
                    if v.get("status") == "running":
                        v["status"] = "error"
                        v["error"] = "AgentSuiteLocal restarted while this run was in progress."
                        v["error_message"] = v["error"]
                        v["finished_at"] = time.time()
                    # F2: Pipeline orphan repair — pipelines stuck running → error
                    if store is _pipelines and v.get("status") == "running":
                        v["status"] = "error"
                        v["error_message"] = "AgentSuiteLocal restarted during pipeline execution."
                        v["updated_at"] = time.time()
                        for step in v.get("steps", []):
                            if step.get("status") == "running":
                                step["status"] = "error"
                    # Migration: scrub any non-finite floats
                    if v.get("qa_dimensions"):
                        v["qa_dimensions"] = [
                            d for d in v["qa_dimensions"]
                            if isinstance(d.get("score"), int | float) and math.isfinite(float(d["score"]))
                        ]
                    store[k] = v
            except Exception:
                pass


def _save_state() -> None:
    """Persist _runs and _pipelines to disk. Evicts oldest runs beyond _MAX_RUNS."""
    with _state_write_lock:
        _RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)
        if len(_runs) > _MAX_RUNS:
            sorted_ids = sorted(_runs, key=lambda r: _runs[r].get("started_at", 0))
            for rid in sorted_ids[: len(_runs) - _MAX_RUNS]:
                del _runs[rid]
        _RUNS_FILE.write_text(json.dumps(_runs, indent=2, default=str))
        _PIPELINES_FILE.write_text(json.dumps(_pipelines, indent=2, default=str))


_load_state()
