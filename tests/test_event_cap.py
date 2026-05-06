"""
Regression test for ENG-088-002 (audit-AgentSuiteLocal-2026-05-05-v088).

Class of bug: per-run / per-pipeline event lists grew unbounded as
agents emit stage_progress / agent_done / etc., and were serialized
to SQLite on every _save_state(). Long pipeline runs amplified disk/
memory cost linearly with run length.

Fix: a single _append_event(container, evt) helper that FIFO-evicts
beyond _MAX_EVENTS_PER_RUN (200). Every appender — execution.emit,
runs.cancel, pipelines.reject, _emit_pipeline — goes through it.

This test asserts the helper caps correctly and that re-introducing a
direct ``run["events"].append(...)`` would regress.
"""
from __future__ import annotations

import re
from pathlib import Path

from agentsuitelocal.api.state import _MAX_EVENTS_PER_RUN, _append_event

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_append_event_caps_at_max() -> None:
    run: dict = {"events": []}
    for i in range(_MAX_EVENTS_PER_RUN + 50):
        _append_event(run, {"type": "stage_progress", "i": i})
    assert len(run["events"]) == _MAX_EVENTS_PER_RUN, (
        f"events list should be capped at {_MAX_EVENTS_PER_RUN}, "
        f"got {len(run['events'])}"
    )
    # FIFO: oldest evicted, newest preserved
    assert run["events"][0]["i"] == 50, "oldest 50 events should be evicted"
    assert run["events"][-1]["i"] == _MAX_EVENTS_PER_RUN + 49


def test_append_event_initialises_missing_events_key() -> None:
    """Some legacy run records may lack an 'events' key; helper must seed it."""
    run: dict = {"id": "run-1"}
    _append_event(run, {"type": "agent_start"})
    assert run["events"] == [{"type": "agent_start"}]


def test_append_event_works_on_pipelines_too() -> None:
    """Pipelines have the same shape; helper is container-agnostic."""
    pipeline: dict = {"id": "pipe-1", "events": []}
    for _ in range(_MAX_EVENTS_PER_RUN + 5):
        _append_event(pipeline, {"type": "agent_start"})
    assert len(pipeline["events"]) == _MAX_EVENTS_PER_RUN


def test_no_direct_events_append_in_production_modules() -> None:
    """Lint-style guard: production code must use _append_event, not
    raw ``run["events"].append(...)``. Re-introducing the direct call
    would silently regress ENG-088-002.

    api/state.py is excluded because it defines the helper and its
    docstring legitimately mentions the antipattern as the thing it
    prevents.
    """
    pattern = re.compile(r'\["events"\]\.append\b')
    excluded = {REPO_ROOT / "agentsuitelocal" / "api" / "state.py"}
    suspect: list[str] = []
    for path in (REPO_ROOT / "agentsuitelocal").rglob("*.py"):
        if path in excluded:
            continue
        text = path.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), start=1):
            stripped = line.lstrip()
            # Skip pure comment lines.
            if stripped.startswith("#"):
                continue
            if pattern.search(line):
                suspect.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {line.strip()}")
    assert not suspect, (
        "Found direct ['events'].append(...) call in production code. "
        "Use _append_event(container, evt) from api.state to preserve "
        "the ENG-088-002 cap. Offenders:\n  " + "\n  ".join(suspect)
    )
