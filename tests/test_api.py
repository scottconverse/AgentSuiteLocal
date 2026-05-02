"""
API endpoint tests — no AgentSuite required, no Ollama required.

Tests cover: health, hardware, ollama/status, run CRUD, kernel, projects,
pipeline state machine, pipeline SSE stream, inputs_dir validation.
All network calls degrade gracefully; the test suite runs from a clean clone.
"""

import pytest
from fastapi.testclient import TestClient

from agentsuitelocal.api.main import app, _runs, _pipelines

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_runs():
    """Isolate each test from leftover run/pipeline state."""
    _runs.clear()
    _pipelines.clear()
    yield
    _runs.clear()
    _pipelines.clear()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_returns_schema():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert "ollama" in data
    assert "status" in data
    assert isinstance(data["ollama"], bool)
    # No Ollama in CI — status should be "no_daemon"
    assert data["status"] in ("healthy", "no_daemon")


# ---------------------------------------------------------------------------
# Hardware
# ---------------------------------------------------------------------------

def test_hardware_returns_all_fields():
    r = client.get("/api/hardware")
    assert r.status_code == 200
    data = r.json()
    assert "cpu" in data and "cores" in data["cpu"]
    assert "ram" in data and "total_gb" in data["ram"]
    assert "disk" in data and "free_gb" in data["disk"]
    assert data["recommended_tier"] in ("light", "balanced", "pro")


def test_hardware_ram_total_positive():
    r = client.get("/api/hardware")
    assert r.json()["ram"]["total_gb"] > 0


# ---------------------------------------------------------------------------
# Ollama status
# ---------------------------------------------------------------------------

def test_ollama_status_schema():
    r = client.get("/api/ollama/status")
    assert r.status_code == 200
    data = r.json()
    assert "running" in data
    assert "models" in data
    assert isinstance(data["models"], list)


# ---------------------------------------------------------------------------
# Run management
# ---------------------------------------------------------------------------

def test_start_run_returns_run_id():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Build a SaaS for dog groomers",
        "project": "test-project",
    })
    assert r.status_code == 200
    data = r.json()
    assert "run_id" in data
    assert data["run_id"].startswith("run-")


def test_get_run_after_start():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test goal",
        "project": "test-project",
    })
    run_id = r.json()["run_id"]
    r2 = client.get(f"/api/run/{run_id}")
    assert r2.status_code == 200
    data = r2.json()
    assert data["id"] == run_id
    assert data["agent"] == "founder"
    assert data["project"] == "test-project"
    assert data["goal"] == "Test goal"
    assert data["status"] in ("running", "error", "waiting")


def test_get_run_404_for_unknown():
    r = client.get("/api/run/run-doesnotexist")
    assert r.status_code == 404


def test_approve_run_wrong_state_returns_400():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test",
        "project": "proj",
    })
    run_id = r.json()["run_id"]
    # Run is "running" or "error" — not "waiting" — so approve should 400
    # Force status to running to ensure consistent state
    from agentsuitelocal.api.main import _runs
    _runs[run_id]["status"] = "running"
    r2 = client.post(f"/api/run/{run_id}/approve", json={"approver": "test"})
    assert r2.status_code == 400


def test_approve_run_in_waiting_state():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test",
        "project": "proj",
    })
    run_id = r.json()["run_id"]
    from agentsuitelocal.api.main import _runs
    _runs[run_id]["status"] = "waiting"
    r2 = client.post(f"/api/run/{run_id}/approve", json={"approver": "alice"})
    assert r2.status_code == 200
    assert r2.json()["status"] == "approved"
    assert _runs[run_id]["status"] == "approved"


def test_reject_run():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test",
        "project": "proj",
    })
    run_id = r.json()["run_id"]
    r2 = client.post(f"/api/run/{run_id}/reject")
    assert r2.status_code == 200
    assert r2.json()["status"] == "rejected"


def test_list_runs_empty():
    r = client.get("/api/runs")
    assert r.status_code == 200
    assert r.json()["runs"] == []


def test_list_runs_after_start():
    client.post("/api/run", json={"agent_id": "founder", "goal": "A", "project": "p1"})
    client.post("/api/run", json={"agent_id": "design",  "goal": "B", "project": "p2"})
    r = client.get("/api/runs")
    assert r.status_code == 200
    assert len(r.json()["runs"]) == 2


# ---------------------------------------------------------------------------
# Kernel
# ---------------------------------------------------------------------------

def test_kernel_returns_projects_dict():
    r = client.get("/api/kernel")
    assert r.status_code == 200
    assert "projects" in r.json()
    # No real workspace in CI — should return empty dict, not crash
    assert isinstance(r.json()["projects"], dict)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

def test_projects_empty_when_no_runs():
    r = client.get("/api/projects")
    assert r.status_code == 200
    assert r.json()["projects"] == []


def test_projects_derived_from_runs():
    client.post("/api/run", json={"agent_id": "founder", "goal": "A", "project": "myco"})
    client.post("/api/run", json={"agent_id": "design",  "goal": "B", "project": "myco"})
    client.post("/api/run", json={"agent_id": "product", "goal": "C", "project": "other"})
    r = client.get("/api/projects")
    projects = {p["slug"]: p for p in r.json()["projects"]}
    assert "myco" in projects
    assert "other" in projects
    assert projects["myco"]["runs"] == 2
    assert projects["other"]["runs"] == 1


# ---------------------------------------------------------------------------
# TEST-006: Settings PATCH endpoint
# ---------------------------------------------------------------------------

def test_get_settings_returns_schema():
    r = client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert "model_tier" in data


def test_settings_patch_updates_field():
    r = client.patch("/api/settings", json={"model_tier": "pro"})
    assert r.status_code == 200
    assert r.json()["model_tier"] == "pro"


def test_settings_patch_does_not_wipe_other_fields():
    client.patch("/api/settings", json={"model_tier": "light"})
    client.patch("/api/settings", json={"open_on_launch": True})
    r = client.get("/api/settings")
    data = r.json()
    assert data["model_tier"] == "light"
    assert data["open_on_launch"] is True


def test_settings_patch_redacts_api_key():
    client.patch("/api/settings", json={"api_key": "sk-ant-secret"})
    r = client.get("/api/settings")
    assert r.json()["api_key"] == "****"


# ---------------------------------------------------------------------------
# TEST-007: Path traversal guard
# ---------------------------------------------------------------------------

def test_start_run_rejects_traversal_in_project():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Path traversal test",
        "project": "../../etc/passwd",
    })
    assert r.status_code == 422


def test_start_run_rejects_traversal_in_agent_id():
    r = client.post("/api/run", json={
        "agent_id": "../sneaky",
        "goal": "Injection test",
        "project": "valid-project",
    })
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# TEST-005: Pipeline endpoints
# ---------------------------------------------------------------------------

def test_list_pipelines_empty():
    r = client.get("/api/pipelines")
    assert r.status_code == 200
    assert "pipelines" in r.json()
    assert isinstance(r.json()["pipelines"], list)


def test_start_pipeline_returns_id():
    r = client.post("/api/pipelines", json={
        "name": "Test Pipeline",
        "project": "pipe-test",
        "goal": "Test pipeline",
        "agents": ["founder", "design"],
    })
    assert r.status_code == 200
    data = r.json()
    assert "pipeline_id" in data
    assert data["pipeline_id"].startswith("pipeline-")


def test_get_pipeline_after_start():
    r = client.post("/api/pipelines", json={
        "name": "Get Test Pipeline",
        "project": "pipe-get",
        "goal": "Get test",
        "agents": ["founder"],
    })
    pid = r.json()["pipeline_id"]
    r2 = client.get(f"/api/pipelines/{pid}")
    assert r2.status_code == 200
    data = r2.json()
    assert data["id"] == pid
    assert data["project"] == "pipe-get"


def test_get_pipeline_404():
    r = client.get("/api/pipelines/pipe-doesnotexist")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# TEST-001: Pipeline state machine — _advance_pipeline, approve/reject
# ---------------------------------------------------------------------------

def _make_pipeline(agents=None, auto_approve=False):
    """Helper: create a pipeline and return its ID."""
    r = client.post("/api/pipelines", json={
        "name": "State Machine Test",
        "project": "sm-test",
        "goal": "Test pipeline state machine",
        "agents": agents or ["founder", "design"],
        "auto_approve": auto_approve,
    })
    assert r.status_code == 200
    return r.json()["pipeline_id"]


def test_pipeline_approve_advances_to_awaiting_approval():
    pid = _make_pipeline()
    # Force first step into awaiting_approval so we can approve it
    _pipelines[pid]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["run_id"] = None

    r = client.post(f"/api/pipelines/{pid}/approve", json={"approver": "user"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "approved"
    assert data["step"] == 0


def test_pipeline_approve_wrong_state_returns_400():
    pid = _make_pipeline()
    _pipelines[pid]["status"] = "running"

    r = client.post(f"/api/pipelines/{pid}/approve", json={"approver": "user"})
    assert r.status_code == 400


def test_pipeline_reject_sets_status_rejected():
    pid = _make_pipeline()
    _pipelines[pid]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["status"] = "awaiting_approval"

    r = client.post(f"/api/pipelines/{pid}/reject")
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
    assert _pipelines[pid]["status"] == "rejected"
    assert _pipelines[pid]["steps"][0]["status"] == "rejected"


def test_pipeline_reject_emits_pipeline_rejected_event():
    pid = _make_pipeline()
    _pipelines[pid]["status"] = "awaiting_approval"

    client.post(f"/api/pipelines/{pid}/reject")
    event_types = [e["type"] for e in _pipelines[pid]["events"]]
    assert "pipeline_rejected" in event_types


def test_pipeline_approve_404_for_unknown():
    r = client.post("/api/pipelines/pipe-doesnotexist/approve", json={"approver": "user"})
    assert r.status_code == 404


def test_pipeline_reject_404_for_unknown():
    r = client.post("/api/pipelines/pipe-doesnotexist/reject")
    assert r.status_code == 404


def test_pipeline_step_status_after_reject_is_rejected():
    pid = _make_pipeline()
    _pipelines[pid]["status"] = "awaiting_approval"
    step_idx = _pipelines[pid]["current_step"]
    _pipelines[pid]["steps"][step_idx]["status"] = "awaiting_approval"

    client.post(f"/api/pipelines/{pid}/reject")
    assert _pipelines[pid]["steps"][step_idx]["status"] == "rejected"


def test_pipeline_done_state_sets_all_steps_done():
    """Manually drive a single-step pipeline to done and verify state."""
    pid = _make_pipeline(agents=["founder"])
    _pipelines[pid]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["run_id"] = None

    # Approve — _advance_pipeline schedules a task that sets done
    client.post(f"/api/pipelines/{pid}/approve", json={"approver": "user"})
    # After approve, current_step advances to 1 which equals len(steps) == 1
    # _advance_pipeline sets status="done" synchronously in the task
    # In TestClient (sync), tasks run after response — verify step 0 is done
    assert _pipelines[pid]["steps"][0]["status"] == "done"


# ---------------------------------------------------------------------------
# TEST-002: Pipeline SSE stream — terminal event emission
# ---------------------------------------------------------------------------

def test_pipeline_sse_stream_returns_200():
    pid = _make_pipeline()
    _pipelines[pid]["status"] = "done"
    _pipelines[pid]["events"].append({
        "type": "pipeline_done",
        "pipeline_id": pid,
        "ts": 0,
    })
    r = client.get(f"/api/pipelines/{pid}/stream")
    assert r.status_code == 200


def test_pipeline_sse_stream_404_for_unknown():
    r = client.get("/api/pipelines/pipe-doesnotexist/stream")
    assert r.status_code == 404


def test_pipeline_sse_stream_emits_buffered_events():
    # sse_starlette binds AppStatus.should_exit_event to the first event loop it sees.
    # Reset it so it gets recreated fresh on this request's event loop.
    from sse_starlette.sse import AppStatus
    AppStatus.should_exit_event = None
    AppStatus.should_exit = False

    pid = _make_pipeline()
    _pipelines[pid]["events"].extend([
        {"type": "agent_start", "pipeline_id": pid, "ts": 0},
        {"type": "agent_waiting", "pipeline_id": pid, "ts": 1},
    ])
    _pipelines[pid]["status"] = "done"

    fresh = TestClient(app)
    r = fresh.get(f"/api/pipelines/{pid}/stream")
    assert r.status_code == 200
    assert "agent_start" in r.text
    assert "agent_waiting" in r.text


# ---------------------------------------------------------------------------
# TEST-NEW: inputs_dir validation (QA-NEW-001 / ENG-002)
# ---------------------------------------------------------------------------

def test_run_rejects_windows_system_path_as_inputs_dir():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test traversal",
        "project": "test-proj",
        "inputs_dir": "C:\\Windows\\System32",
    })
    assert r.status_code == 422


def test_run_rejects_traversal_inputs_dir():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test traversal",
        "project": "test-proj",
        "inputs_dir": "../../etc/passwd",
    })
    assert r.status_code == 422


def test_pipeline_rejects_traversal_inputs_dir():
    r = client.post("/api/pipelines", json={
        "name": "Traversal test",
        "project": "test-proj",
        "goal": "Test traversal",
        "agents": ["founder"],
        "inputs_dir": "../../etc/passwd",
    })
    assert r.status_code == 422


def test_run_accepts_none_inputs_dir():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test with no inputs dir",
        "project": "test-proj",
    })
    assert r.status_code == 200


def test_run_rejects_goal_over_2000_chars():
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "x" * 2001,
        "project": "test-proj",
    })
    assert r.status_code == 422


def test_pipeline_rejects_name_over_200_chars():
    r = client.post("/api/pipelines", json={
        "name": "n" * 201,
        "project": "test-proj",
        "goal": "Test goal",
        "agents": ["founder"],
    })
    assert r.status_code == 422


def test_pipeline_rejects_invalid_project_slug():
    r = client.post("/api/pipelines", json={
        "name": "Test Pipeline",
        "project": "../../etc/passwd",
        "goal": "Test goal",
        "agents": ["founder"],
    })
    assert r.status_code == 422
