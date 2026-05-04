"""
Integration test: _execute_run with a mocked LLM provider.

Verifies that a single-agent run completes end-to-end (status → "waiting")
without raising ModuleNotFoundError from the missing PipelineOrchestrator.

This test was written BEFORE the PipelineOrchestrator shim (Sprint 1, step 2)
and will fail until that shim is in place.  Once the shim replaces the import
with a direct BaseAgent.run() call, the test should pass with the mocked LLM.
"""

from __future__ import annotations

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


async def test_execute_run_dispatches_non_founder_agent():
    """_execute_run must reach status='waiting' for a non-founder agent.

    Regression guard for the AGENTSUITE_ENABLED_AGENTS footgun: without
    the setdefault in launcher.py/cli.py, get_class('design') raises
    UnknownAgent and the run lands in status='error'.
    """
    import os
    os.environ.setdefault(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )

    run_id = "run-exec-test-design-001"
    req = RunRequest(agent_id="design", goal="Design integration test", project="exec-test")
    _make_run(run_id, agent_id="design")

    fake_state = _fake_run_state("agentsuite-design-run-id")
    mock_llm = MagicMock()

    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.design.agent.DesignAgent.run", return_value=fake_state),
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
    assert run["agentsuite_run_id"] == "agentsuite-design-run-id"


async def test_execute_pipeline_step_dispatches_non_founder_agent():
    """_execute_pipeline_step must complete for a non-founder agent.

    Covers the second shim site (line ~305 in execution.py), which had
    zero test coverage. Also guards against the AGENTSUITE_ENABLED_AGENTS
    footgun for pipeline runs.
    """
    import os
    os.environ.setdefault(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )

    from agentsuitelocal.api.execution import _execute_pipeline_step
    from agentsuitelocal.api.state import _pipelines

    pipeline_id = "pipe-exec-test-001"
    _pipelines[pipeline_id] = {
        "id": pipeline_id,
        "project": "exec-test",
        "goal": "Pipeline integration test",
        "inputs_dir": None,
        "auto_approve": False,
        "status": "running",
        "current_step": 0,
        "steps": [{"agent": "design", "status": "running", "run_id": None, "artifacts": [], "qa_score": None, "qa_dimensions": []}],
        "events": [],
        "updated_at": time.time(),
        "error_message": None,
    }

    fake_state = _fake_run_state("agentsuite-pipeline-design-run-id")
    mock_llm = MagicMock()

    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.design.agent.DesignAgent.run", return_value=fake_state),
        patch("agentsuitelocal.api.execution._save_state"),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_pipeline_step(pipeline_id, 0)

    step = _pipelines[pipeline_id]["steps"][0]
    assert step["run_id"] == "agentsuite-pipeline-design-run-id"
    assert step["status"] == "awaiting_approval"

    del _pipelines[pipeline_id]
