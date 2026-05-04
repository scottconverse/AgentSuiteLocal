"""
Integration test: _execute_run with a mocked LLM provider.

Verifies that a single-agent run completes end-to-end (status → "waiting")
without raising ModuleNotFoundError from the missing PipelineOrchestrator.

This test was written BEFORE the PipelineOrchestrator shim (Sprint 1, step 2)
and will fail until that shim is in place.  Once the shim replaces the import
with a direct BaseAgent.run() call, the test should pass with the mocked LLM.
"""

from __future__ import annotations

import asyncio
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from agentsuitelocal.api.execution import _execute_run
from agentsuitelocal.api.schemas import RunRequest
from agentsuitelocal.api.state import _runs


@pytest.fixture(autouse=True)
def _clear_runs():
    _runs.clear()
    yield
    _runs.clear()


def _make_run(run_id: str, agent_id: str = "founder", project: str = "exec-test") -> dict:
    run = {
        "id": run_id,
        "agent": agent_id,
        "project": project,
        "goal": "Integration test goal",
        "status": "running",
        "started_at": time.time(),
        "events": [],
        "artifacts": [],
        "qa_score": None,
        "qa_dimensions": [],
        "agentsuite_run_id": None,
        "partial_artifacts": False,
    }
    _runs[run_id] = run
    return run


def _fake_run_state(run_id: str = "agentsuite-test-run-id"):
    """Build a minimal RunState that satisfies the shim's return-shape expectations."""
    from agentsuite.kernel.schema import AgentRequest, RunState

    request = AgentRequest(
        agent_name="founder",
        role_domain="business",
        user_request="Integration test goal",
    )
    return RunState(run_id=run_id, agent="founder", inputs=request)


async def test_execute_run_completes_without_module_not_found_error():
    """_execute_run must reach status='waiting', not status='error' from a missing import."""
    run_id = "run-exec-test-001"
    req = RunRequest(agent_id="founder", goal="Integration test goal", project="exec-test")
    _make_run(run_id)

    fake_state = _fake_run_state()

    mock_llm = MagicMock()

    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.founder.agent.FounderAgent.run", return_value=fake_state),
        patch("agentsuitelocal.api.execution._save_state"),
        patch("agentsuitelocal.api.execution._log_telemetry"),
        patch("agentsuitelocal.api.execution._send_notification"),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_run(run_id, req, cancel_token=threading.Event())

    run = _runs[run_id]
    assert run["status"] == "waiting", (
        f"Expected status='waiting' but got status='{run['status']}'. "
        f"Error: {run.get('error', '(none)')}"
    )
    assert run["agentsuite_run_id"] == "agentsuite-test-run-id"
