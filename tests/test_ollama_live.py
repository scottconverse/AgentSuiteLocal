"""
Live Ollama tests — require a running Ollama daemon with a loaded model.

Marked @pytest.mark.ollama so they skip automatically when Ollama is not
reachable. Run them with: pytest -m ollama

The smoke run test fires a real PipelineOrchestrator.run() call against the
local model. It uses a minimal goal ("one sentence") to keep runtime short,
but it still exercises the full AgentSuite code path end-to-end.
"""

from __future__ import annotations

import json
import socket
import threading
import time
from pathlib import Path

import httpx
import pytest

from agentsuitelocal.api.main import app, _runs

# ---------------------------------------------------------------------------
# Autoskip when Ollama is not reachable
# ---------------------------------------------------------------------------


def _ollama_reachable() -> bool:
    try:
        r = httpx.get("http://localhost:11434/api/tags", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.ollama

# Apply module-level skip so the entire file is skipped gracefully in CI
if not _ollama_reachable():
    pytest.skip("Ollama not reachable — skipping live tests", allow_module_level=True)


# ---------------------------------------------------------------------------
# Server fixture (same pattern as integration tests)
# ---------------------------------------------------------------------------


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="module")
def live_server(tmp_path_factory):
    import uvicorn

    port = _free_port()
    workspace = tmp_path_factory.mktemp("agentsuite_workspace")
    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=port,
        log_level="error",
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                break
        except OSError:
            time.sleep(0.05)

    yield f"http://127.0.0.1:{port}", workspace

    server.should_exit = True
    thread.join(timeout=3)


@pytest.fixture(autouse=True)
def clear_runs_ollama():
    _runs.clear()
    yield
    _runs.clear()


# ---------------------------------------------------------------------------
# Daemon + model presence
# ---------------------------------------------------------------------------


def test_ollama_daemon_running():
    r = httpx.get("http://localhost:11434/api/tags", timeout=3.0)
    assert r.status_code == 200
    data = r.json()
    assert "models" in data
    assert len(data["models"]) > 0, "No models found — pull a model first"


def test_ollama_model_loaded():
    r = httpx.get("http://localhost:11434/api/ps", timeout=3.0)
    assert r.status_code == 200


def test_api_health_reports_ollama_up(live_server):
    base, _ = live_server
    r = httpx.get(f"{base}/api/health", timeout=5)
    data = r.json()
    assert data["ollama"] is True
    assert data["status"] == "healthy"
    assert data["model"] is not None


def test_api_ollama_status_running(live_server):
    base, _ = live_server
    r = httpx.get(f"{base}/api/ollama/status", timeout=5)
    data = r.json()
    assert data["running"] is True
    assert len(data["models"]) > 0


# ---------------------------------------------------------------------------
# Smoke run — exercises the full PipelineOrchestrator path
# ---------------------------------------------------------------------------


def test_smoke_run_reaches_waiting_or_error(live_server):
    """
    Fire a real agent run against the local model and wait for the pipeline to
    either reach 'waiting' (success path) or 'error' (AgentSuite not installed
    or model too slow). Either terminal state means the SSE loop closed cleanly.

    Timeout: 120 s — generous for a slow model; real runs take 9–16 min but
    we use a trivial goal so only the orchestrator bootstrap matters.
    """
    base, workspace = live_server
    import os
    os.environ["AGENTSUITE_WORKSPACE"] = str(workspace)

    r = httpx.post(
        f"{base}/api/run",
        json={
            "agent_id": "founder",
            "goal": "Name a dog grooming startup in one word.",
            "project": "ollama-smoke",
        },
        timeout=10,
    )
    assert r.status_code == 200
    run_id = r.json()["run_id"]

    events: list[dict] = []
    with httpx.stream("GET", f"{base}/api/run/{run_id}/stream", timeout=120) as resp:
        assert resp.status_code == 200
        for line in resp.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))

    assert len(events) >= 1
    event_types = {e["type"] for e in events}
    assert "agent_start" in event_types

    terminal = event_types & {"agent_waiting", "error"}
    assert terminal, f"Stream closed without terminal event. Got: {event_types}"

    # Verify the run record is in the expected terminal state
    run = _runs[run_id]
    assert run["status"] in ("waiting", "error")


def test_smoke_run_sse_events_have_required_fields(live_server):
    """Every SSE event must carry run_id and ts fields."""
    base, workspace = live_server
    import os
    os.environ["AGENTSUITE_WORKSPACE"] = str(workspace)

    r = httpx.post(
        f"{base}/api/run",
        json={
            "agent_id": "founder",
            "goal": "One word company name for a bakery.",
            "project": "ollama-fields",
        },
        timeout=10,
    )
    run_id = r.json()["run_id"]

    events: list[dict] = []
    with httpx.stream("GET", f"{base}/api/run/{run_id}/stream", timeout=120) as resp:
        for line in resp.iter_lines():
            if line.startswith("data:"):
                events.append(json.loads(line[5:].strip()))

    for evt in events:
        assert "type" in evt, f"Missing 'type': {evt}"
        assert "run_id" in evt, f"Missing 'run_id': {evt}"
        assert "ts" in evt, f"Missing 'ts': {evt}"
        assert evt["run_id"] == run_id
