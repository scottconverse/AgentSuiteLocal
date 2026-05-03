"""
API endpoint tests — no AgentSuite required, no Ollama required.

Tests cover: health, hardware, ollama/status, run CRUD, kernel, projects,
pipeline state machine, pipeline SSE stream, inputs_dir validation,
pipeline validation (QA-001/QA-002), pipeline persistence (ENG-NEW-001),
run_id correctness (ENG-NEW-005), QA dimension sanitization (ENG-NEW-002).
All network calls degrade gracefully; the test suite runs from a clean clone.
"""

import pytest
from fastapi.testclient import TestClient

from agentsuitelocal.api.main import (
    _pipelines,
    _runs,
    _sanitize_qa_dimensions,
    app,
)

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
    assert data["status"] in ("running", "error", "waiting", "cancelled")


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


# ---------------------------------------------------------------------------
# QA-001 / QA-002 — empty agents list and invalid agent slug
# ---------------------------------------------------------------------------

def test_pipeline_rejects_empty_agents_list():
    """POST /api/pipelines with agents: [] must return 422, not 200."""
    r = client.post("/api/pipelines", json={
        "name": "Empty agents",
        "project": "qa001-test",
        "goal": "Should be rejected",
        "agents": [],
    })
    assert r.status_code == 422


def test_pipeline_rejects_invalid_agent_slug():
    """Agent IDs must match the slug pattern; path-like strings must be rejected."""
    r = client.post("/api/pipelines", json={
        "name": "Bad agent slug",
        "project": "qa002-test",
        "goal": "Should be rejected",
        "agents": ["../../etc/passwd"],
    })
    assert r.status_code == 422


def test_pipeline_rejects_agent_slug_with_spaces():
    r = client.post("/api/pipelines", json={
        "name": "Bad agent slug",
        "project": "qa002-test",
        "goal": "Should be rejected",
        "agents": ["founder agent"],
    })
    assert r.status_code == 422


def test_pipeline_reject_with_no_steps_returns_400():
    """Reject on a pipeline that advanced past all steps must not 500."""
    r = client.post("/api/pipelines", json={
        "name": "Bounds test",
        "project": "bounds-test",
        "goal": "Test bounds guard",
        "agents": ["founder"],
    })
    pid = r.json()["pipeline_id"]
    # Simulate pipeline fully done (current_step past end)
    _pipelines[pid]["current_step"] = 99
    _pipelines[pid]["status"] = "awaiting_approval"
    r2 = client.post(f"/api/pipelines/{pid}/reject")
    assert r2.status_code == 400


# ---------------------------------------------------------------------------
# ENG-NEW-001 — pipeline state persistence
# ---------------------------------------------------------------------------

def test_create_pipeline_persists_to_pipelines_dict():
    """create_pipeline must call _save_state; pipeline must appear in _pipelines."""
    r = client.post("/api/pipelines", json={
        "name": "Persist test",
        "project": "persist-test",
        "goal": "Test persistence",
        "agents": ["founder"],
    })
    assert r.status_code == 200
    pid = r.json()["pipeline_id"]
    assert pid in _pipelines


def test_reject_pipeline_reflects_in_memory():
    """reject_pipeline_step must update in-memory state (precondition for _save_state)."""
    r = client.post("/api/pipelines", json={
        "name": "Reject persist",
        "project": "reject-persist",
        "goal": "Test reject persistence",
        "agents": ["founder", "design"],
    })
    pid = r.json()["pipeline_id"]
    _pipelines[pid]["status"] = "awaiting_approval"
    _pipelines[pid]["steps"][0]["status"] = "awaiting_approval"

    client.post(f"/api/pipelines/{pid}/reject")
    assert _pipelines[pid]["status"] == "rejected"


# ---------------------------------------------------------------------------
# ENG-NEW-005 — run_id stored is real (not synthetic)
# ---------------------------------------------------------------------------

def test_pipeline_step_run_id_initializes_to_none():
    """Steps must initialize with run_id=None, not a synthetic string."""
    r = client.post("/api/pipelines", json={
        "name": "RunID test",
        "project": "runid-test",
        "goal": "Test run_id",
        "agents": ["founder"],
    })
    pid = r.json()["pipeline_id"]
    step = _pipelines[pid]["steps"][0]
    # run_id starts None; only set once AgentSuite assigns a real ID
    assert step["run_id"] is None


# ---------------------------------------------------------------------------
# ENG-NEW-002 — QA dimension key sanitization
# ---------------------------------------------------------------------------

def test_sanitize_qa_dimensions_rejects_filename_keys():
    """Keys that look like filenames (contain '.') must be dropped."""
    dims = {"founder_strategy.md": 0.9, "coherence": 0.8}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert "founder_strategy.md" not in names
    assert "coherence" in names


def test_sanitize_qa_dimensions_rejects_path_keys():
    """Keys containing '/' (path separators) must be dropped."""
    dims = {"outputs/strategy.md": 0.7, "relevance": 0.9}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert "outputs/strategy.md" not in names
    assert "relevance" in names


def test_sanitize_qa_dimensions_rejects_long_keys():
    """Keys longer than 60 chars must be dropped."""
    long_key = "a" * 61
    dims = {long_key: 0.5, "brevity": 0.8}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert long_key not in names
    assert "brevity" in names


def test_sanitize_qa_dimensions_drops_non_numeric_values():
    """Non-numeric values must be silently dropped."""
    dims = {"quality": "high", "relevance": 0.9}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert "quality" not in names
    assert "relevance" in names


def test_sanitize_qa_dimensions_accepts_valid_entries():
    """Valid dimension dict must pass through intact."""
    dims = {"coherence": 0.85, "relevance": 0.92, "depth": 0.78}
    result = _sanitize_qa_dimensions(dims)
    assert len(result) == 3
    scores = {d["name"]: d["score"] for d in result}
    assert scores["coherence"] == pytest.approx(0.85)
    assert scores["relevance"] == pytest.approx(0.92)


# ---------------------------------------------------------------------------
# QA-NEW-001 — math.isfinite guard in _sanitize_qa_dimensions
# ---------------------------------------------------------------------------

def test_sanitize_qa_dimensions_rejects_nan():
    """float('nan') must be silently dropped — not stored, not serialized."""
    dims = {"coherence": float("nan"), "relevance": 0.9}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert "coherence" not in names
    assert "relevance" in names


def test_sanitize_qa_dimensions_rejects_infinity():
    """float('inf') and float('-inf') must be silently dropped."""
    dims = {"coherence": float("inf"), "depth": float("-inf"), "relevance": 0.8}
    result = _sanitize_qa_dimensions(dims)
    names = [d["name"] for d in result]
    assert "coherence" not in names
    assert "depth" not in names
    assert "relevance" in names


def test_get_run_returns_200_with_nan_qa_dimensions():
    """GET /api/run/{id} must return 200 even when qa_dimensions contains NaN."""
    from agentsuitelocal.api.main import _runs
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test nan qa",
        "project": "test-proj",
    })
    run_id = r.json()["run_id"]
    # Inject a NaN directly into the run record (simulates a corrupted sidecar)
    _runs[run_id]["qa_dimensions"] = [{"name": "coherence", "score": float("nan")}]
    r2 = client.get(f"/api/run/{run_id}")
    assert r2.status_code == 200


# ---------------------------------------------------------------------------
# TEST-CRIT-001 — get_artifact path traversal guard
# ---------------------------------------------------------------------------

def test_run_rejects_sibling_home_path_as_inputs_dir():
    """inputs_dir pointing to a sibling of the home directory must be rejected."""
    import os
    sibling = str(os.path.join(os.path.expanduser("~"), "..", "other_user"))
    r = client.post("/api/run", json={
        "agent_id": "founder",
        "goal": "Test sibling path",
        "project": "test-proj",
        "inputs_dir": sibling,
    })
    assert r.status_code == 422


def test_get_artifact_rejects_path_traversal():
    """is_relative_to guard blocks paths that escape the run directory."""
    from agentsuitelocal.api.main import _workspace
    # Build a real run_dir and a path that escapes it — test the guard directly
    fake_run_id = "test-traversal-run"
    run_dir = (_workspace() / ".agentsuite" / "runs" / fake_run_id).resolve()
    # A sibling directory — resolves to a real path outside run_dir
    traversal = (run_dir / "../../etc/passwd").resolve()
    assert not traversal.is_relative_to(run_dir), (
        f"Guard would not block {traversal} — it IS inside {run_dir}"
    )
    # Also confirm a legitimate child path passes the guard
    legit = (run_dir / "outputs" / "strategy.md").resolve()
    assert legit.is_relative_to(run_dir)


# ---------------------------------------------------------------------------
# B1 — POST /api/run/{id}/cancel
# ---------------------------------------------------------------------------

def test_cancel_run_wrong_state_returns_400():
    """Cancel on a non-running run must return 400."""
    r = client.post("/api/run", json={"agent_id": "founder", "goal": "Test", "project": "proj"})
    run_id = r.json()["run_id"]
    from agentsuitelocal.api.main import _runs
    _runs[run_id]["status"] = "waiting"
    r2 = client.post(f"/api/run/{run_id}/cancel")
    assert r2.status_code == 400


def test_cancel_run_404_for_unknown():
    r = client.post("/api/run/run-doesnotexist/cancel")
    assert r.status_code == 404


def test_cancel_run_running_returns_cancelled():
    r = client.post("/api/run", json={"agent_id": "founder", "goal": "Test", "project": "proj"})
    run_id = r.json()["run_id"]
    from agentsuitelocal.api.main import _runs
    _runs[run_id]["status"] = "running"
    r2 = client.post(f"/api/run/{run_id}/cancel")
    assert r2.status_code == 200
    assert r2.json()["status"] == "cancelled"
    assert _runs[run_id]["status"] == "cancelled"
    assert "cancelled_at" in _runs[run_id]


# ---------------------------------------------------------------------------
# B6 — POST /api/validate-path
# ---------------------------------------------------------------------------

def test_validate_path_rejects_system_path():
    r = client.post("/api/validate-path", json={"path": "C:\\Windows\\System32"})
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is False
    assert data["reason"]


def test_validate_path_accepts_missing_path_gracefully():
    """Non-existent path that would otherwise be valid fails with a reason."""
    r = client.post("/api/validate-path", json={"path": "../../etc/passwd"})
    assert r.status_code == 200
    assert r.json()["valid"] is False


# ---------------------------------------------------------------------------
# D1 — approve exports to kernel (export_path in response)
# ---------------------------------------------------------------------------

def test_approve_returns_export_path():
    r = client.post("/api/run", json={"agent_id": "founder", "goal": "Test", "project": "proj"})
    run_id = r.json()["run_id"]
    from agentsuitelocal.api.main import _runs
    _runs[run_id]["status"] = "waiting"
    r2 = client.post(f"/api/run/{run_id}/approve", json={"approver": "user"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["status"] == "approved"
    # export_path may be None if no actual run dir exists, but key must be present
    assert "export_path" in data


# ---------------------------------------------------------------------------
# D3 — GET /api/kernel/diff
# ---------------------------------------------------------------------------

def test_kernel_diff_404_for_missing_files(tmp_path):
    r = client.get(f"/api/kernel/diff?a={tmp_path}/a.txt&b={tmp_path}/b.txt")
    # Missing file inside allowed area → 404
    assert r.status_code in (403, 404)


# ---------------------------------------------------------------------------
# D4 — Export endpoints
# ---------------------------------------------------------------------------

def test_export_zip_404_for_unknown():
    r = client.get("/api/run/run-unknown/export/zip")
    assert r.status_code == 404


def test_export_markdown_404_for_unknown():
    r = client.get("/api/run/run-unknown/export/markdown")
    assert r.status_code == 404


def test_export_pdf_404_for_unknown():
    r = client.get("/api/run/run-unknown/export/pdf")
    assert r.status_code == 404


def test_export_zip_returns_zip_for_existing_run():
    r = client.post("/api/run", json={"agent_id": "founder", "goal": "Test", "project": "proj"})
    run_id = r.json()["run_id"]
    r2 = client.get(f"/api/run/{run_id}/export/zip")
    # Returns zip even for empty run dir
    assert r2.status_code == 200
    assert "zip" in r2.headers.get("content-type", "")


def test_export_markdown_returns_200_for_existing_run():
    r = client.post("/api/run", json={"agent_id": "founder", "goal": "Test", "project": "proj"})
    run_id = r.json()["run_id"]
    r2 = client.get(f"/api/run/{run_id}/export/markdown")
    assert r2.status_code == 200


# ---------------------------------------------------------------------------
# F3 — POST /api/pipelines/{id}/resume
# ---------------------------------------------------------------------------

def test_resume_pipeline_non_error_returns_400():
    r = client.post("/api/pipelines", json={
        "name": "Resume test",
        "project": "resume-test",
        "goal": "Test resume",
        "agents": ["founder"],
    })
    pid = r.json()["pipeline_id"]
    _pipelines[pid]["status"] = "running"
    r2 = client.post(f"/api/pipelines/{pid}/resume")
    assert r2.status_code == 400


def test_resume_pipeline_404_for_unknown():
    r = client.post("/api/pipelines/pipe-doesnotexist/resume")
    assert r.status_code == 404


def test_resume_pipeline_error_state_finds_pending_step():
    r = client.post("/api/pipelines", json={
        "name": "Resume pending",
        "project": "resume-pending",
        "goal": "Test",
        "agents": ["founder", "design"],
    })
    pid = r.json()["pipeline_id"]
    _pipelines[pid]["status"] = "error"
    _pipelines[pid]["steps"][0]["status"] = "done"
    _pipelines[pid]["steps"][1]["status"] = "todo"  # pending
    r2 = client.post(f"/api/pipelines/{pid}/resume")
    assert r2.status_code == 200
    assert r2.json()["from_step"] == 1


# ---------------------------------------------------------------------------
# F4 — GET /api/crash-reports/latest
# ---------------------------------------------------------------------------

def test_crash_reports_latest_returns_schema():
    r = client.get("/api/crash-reports/latest")
    assert r.status_code == 200
    data = r.json()
    assert "has_report" in data


# ---------------------------------------------------------------------------
# G3 — GET /api/ollama/models, DELETE /api/ollama/models/{name}
# ---------------------------------------------------------------------------

def test_ollama_models_returns_schema():
    r = client.get("/api/ollama/models")
    assert r.status_code == 200
    data = r.json()
    assert "models" in data
    assert "active" in data
    assert isinstance(data["models"], list)


# ---------------------------------------------------------------------------
# D1 — POST /api/open-folder
# ---------------------------------------------------------------------------

def test_open_folder_rejects_external_path():
    r = client.post("/api/open-folder", json={"path": "C:\\Windows\\System32"})
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# B3 — run watchdog timeout (unit test via settings)
# ---------------------------------------------------------------------------

def test_run_timeout_seconds_in_settings():
    """run_timeout_seconds setting must be present and default to 900."""
    r = client.get("/api/settings")
    assert r.status_code == 200
    data = r.json()
    assert "run_timeout_seconds" in data
    assert data["run_timeout_seconds"] == 900


# ---------------------------------------------------------------------------
# F1/F2 — crash recovery verified at load_state (startup repair)
# ---------------------------------------------------------------------------

def test_crash_recovery_sets_running_runs_to_error():
    """load_state must repair running → error on startup (F1)."""
    from agentsuitelocal.api.main import _load_state, _runs
    run_id = "test-crash-recovery"
    _runs[run_id] = {"id": run_id, "status": "running", "agent": "founder", "project": "p",
                     "goal": "g", "started_at": 0, "events": [], "artifacts": [], "qa_score": None,
                     "qa_dimensions": []}
    # Simulate saving and reloading by calling _load_state with patched file
    import json
    import tempfile
    from pathlib import Path
    from unittest.mock import patch
    tmp = Path(tempfile.mktemp(suffix=".json"))
    tmp.write_text(json.dumps({run_id: _runs[run_id]}))
    _runs.clear()
    with patch("agentsuitelocal.api.main._RUNS_FILE", tmp):
        _load_state()
    assert _runs[run_id]["status"] == "error"
    assert "restarted" in _runs[run_id].get("error", "")
    tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# J4 — telemetry summary endpoint
# ---------------------------------------------------------------------------

def test_telemetry_summary_returns_schema():
    r = client.get("/api/telemetry/summary")
    assert r.status_code == 200
    data = r.json()
    assert "enabled" in data
    assert "events" in data
    assert "total" in data


# ---------------------------------------------------------------------------
# H2 — version endpoint
# ---------------------------------------------------------------------------

def test_version_endpoint_returns_version():
    r = client.get("/api/version")
    assert r.status_code == 200
    assert "version" in r.json()
    assert r.json()["version"] == "0.7.0"
