"""
API endpoint tests — no AgentSuite required, no Ollama required.

Tests cover: health, hardware, ollama/status, run CRUD, kernel, projects.
All network calls degrade gracefully; the test suite runs from a clean clone.
"""

import pytest
from fastapi.testclient import TestClient

from agentsuitelocal.api.main import app, _runs

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_runs():
    """Isolate each test from leftover run state."""
    _runs.clear()
    yield
    _runs.clear()


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
