"""
Integration tests — real uvicorn server, real HTTP, real SSE stream.

These tests start the FastAPI app on a free port via uvicorn and make live
requests. Unlike the unit tests (TestClient, in-process), this exercises the
actual asyncio event loop, background task scheduling, and SSE generator.

No Ollama required. The pipeline will fail to import AgentSuite and emit an
"error" event, but the transport layer (HTTP + SSE) is fully exercised.
"""

from __future__ import annotations

import json
import time

import httpx
import pytest

from agentsuitelocal.api.main import app, _runs

# live_server is session-scoped and defined in tests/conftest.py


@pytest.fixture(autouse=True)
def clear_runs_integration():
    _runs.clear()
    yield
    _runs.clear()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_live_health(live_server):
    r = httpx.get(f"{live_server}/api/health", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "ollama" in data
    assert "status" in data


def test_live_hardware(live_server):
    r = httpx.get(f"{live_server}/api/hardware", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert data["ram"]["total_gb"] > 0
    assert data["recommended_tier"] in ("light", "balanced", "pro")


# ---------------------------------------------------------------------------
# Run lifecycle over real HTTP
# ---------------------------------------------------------------------------


def test_live_start_and_get_run(live_server):
    r = httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "founder", "goal": "Test goal", "project": "integration-test"},
        timeout=5,
    )
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    assert run_id.startswith("run-")

    r2 = httpx.get(f"{live_server}/api/run/{run_id}", timeout=5)
    assert r2.status_code == 200
    data = r2.json()
    assert data["id"] == run_id
    assert data["agent"] == "founder"
    assert data["project"] == "integration-test"


def test_live_run_404(live_server):
    r = httpx.get(f"{live_server}/api/run/run-doesnotexist", timeout=5)
    assert r.status_code == 404


def test_live_reject(live_server):
    r = httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "design", "goal": "Reject me", "project": "p"},
        timeout=5,
    )
    run_id = r.json()["run_id"]
    r2 = httpx.post(f"{live_server}/api/run/{run_id}/reject", timeout=5)
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"


def test_live_list_runs(live_server):
    httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "product", "goal": "A", "project": "q"},
        timeout=5,
    )
    r = httpx.get(f"{live_server}/api/runs", timeout=5)
    assert r.status_code == 200
    assert len(r.json()["runs"]) >= 1


# ---------------------------------------------------------------------------
# SSE stream — reads the stream until first event or timeout
# ---------------------------------------------------------------------------


def test_live_sse_emits_agent_start(live_server):
    """POST /api/run then connect to the SSE stream and verify agent_start fires."""
    r = httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "founder", "goal": "SSE test", "project": "sse-proj"},
        timeout=5,
    )
    run_id = r.json()["run_id"]

    received: list[dict] = []
    deadline = time.monotonic() + 8

    with httpx.stream("GET", f"{live_server}/api/run/{run_id}/stream", timeout=10) as resp:
        assert resp.status_code == 200
        for line in resp.iter_lines():
            if time.monotonic() > deadline:
                break
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[5:].strip())
            received.append(payload)
            # Stop reading once we have the first event
            if received:
                break

    assert len(received) >= 1
    event_types = {e["type"] for e in received}
    # agent_start is always the first event emitted by _execute_run
    assert "agent_start" in event_types


def test_live_sse_terminates_on_error(live_server):
    """SSE stream must close (not hang) even when the pipeline errors."""
    r = httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "founder", "goal": "Error path", "project": "err-proj"},
        timeout=5,
    )
    run_id = r.json()["run_id"]

    events: list[dict] = []
    with httpx.stream("GET", f"{live_server}/api/run/{run_id}/stream", timeout=15) as resp:
        for line in resp.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))

    # Stream must have closed; we must have at least agent_start + error/waiting
    assert len(events) >= 1
    final_types = {e["type"] for e in events}
    assert final_types & {"error", "agent_waiting"}


# ---------------------------------------------------------------------------
# Kernel + Projects
# ---------------------------------------------------------------------------


def test_live_kernel(live_server):
    r = httpx.get(f"{live_server}/api/kernel", timeout=5)
    assert r.status_code == 200
    assert "projects" in r.json()


def test_live_projects_from_runs(live_server):
    httpx.post(
        f"{live_server}/api/run",
        json={"agent_id": "founder", "goal": "A", "project": "proj-x"},
        timeout=5,
    )
    r = httpx.get(f"{live_server}/api/projects", timeout=5)
    slugs = [p["slug"] for p in r.json()["projects"]]
    assert "proj-x" in slugs
