"""
State-machine tests for _execute_run / _execute_pipeline_step.

These tests patch out _resolve_llm, the agent class, _save_state,
telemetry, and notifications. They cover the run-status state machine
(running → waiting / error / cancelled / timeout), the dispatch-by-
agent-id path, the SSE stage_update event flow, and the orchestrator
route for pipeline step 0 — i.e. the wiring between routes, executor,
and state.

They do NOT cover the resolver path or any layer below the agent class.
audit-AgentSuiteLocal-2026-05-05-v088 finding TEST-CRIT-001 named this
file as the source of v0.8.7's missing-`ollama`-SDK regression: because
every test here mocks _resolve_llm, the resolver was never exercised
by the suite. tests/test_dependencies.py and
tests/test_execution_integration.py close that hole — they exercise
the real resolver path with no patching.

Originally named test_execution.py with an "Integration test"
docstring. Both labels were misleading. Renamed in v0.8.9
(TEST-CRIT-001 fix) so the contract this file actually upholds is
visible from the filename.
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


@pytest.fixture
def _all_agents_enabled(monkeypatch):
    """Prime AGENTSUITE_ENABLED_AGENTS as the entry points do at startup.

    Applied explicitly to non-founder tests so that removing the setdefault
    from launcher.py / cli.py causes test_launcher.py / test_cli.py to fail,
    not these tests — keeping failure signals clear.
    """
    monkeypatch.setenv(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )


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

    # Sprint B B7 (MOCKING_AUDIT closure): _save_state / _log_telemetry /
    # _load_settings are now substituted via injected callables (kwargs on
    # _execute_run), not mock-patched. _send_notification stays as patch
    # (it wraps OS-level toast/balloon — BOUNDARY-OK per audit). _resolve_llm,
    # FounderAgent.run, _workspace stay as patch (INTERNAL-JUSTIFIED /
    # filesystem-boundary).
    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.founder.agent.FounderAgent.run", return_value=fake_state),
        patch("agentsuitelocal.api.execution._send_notification"),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_run(
            run_id, req, cancel_token=threading.Event(),
            save_state=lambda: None,
            log_telemetry=lambda *a, **kw: None,
            load_settings=lambda: {"api_key": "mock-key", "run_timeout_seconds": 30},
        )

    run = _runs[run_id]
    assert run["status"] == "waiting", (
        f"Expected status='waiting' but got status='{run['status']}'. "
        f"Error: {run.get('error', '(none)')}"
    )
    assert run["agentsuite_run_id"] == "agentsuite-test-run-id"


async def test_execute_run_dispatches_non_founder_agent(_all_agents_enabled):
    """_execute_run must reach status='waiting' for a non-founder agent.

    Regression guard for the AGENTSUITE_ENABLED_AGENTS footgun: without
    the setdefault in launcher.py/cli.py, get_class('design') raises
    UnknownAgent and the run lands in status='error'.
    """

    run_id = "run-exec-test-design-001"
    req = RunRequest(agent_id="design", goal="Design integration test", project="exec-test")
    _make_run(run_id, agent_id="design")

    fake_state = _fake_run_state("agentsuite-design-run-id")
    mock_llm = MagicMock()

    # Sprint B B7 (MOCKING_AUDIT closure): see test_execute_run_completes_*.
    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.design.agent.DesignAgent.run", return_value=fake_state),
        patch("agentsuitelocal.api.execution._send_notification"),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_run(
            run_id, req, cancel_token=threading.Event(),
            save_state=lambda: None,
            log_telemetry=lambda *a, **kw: None,
            load_settings=lambda: {"api_key": "mock-key", "run_timeout_seconds": 30},
        )

    run = _runs[run_id]
    assert run["status"] == "waiting", (
        f"Expected status='waiting' but got status='{run['status']}'. "
        f"Error: {run.get('error', '(none)')}"
    )
    assert run["agentsuite_run_id"] == "agentsuite-design-run-id"


async def test_execute_pipeline_step_dispatches_non_founder_agent(_all_agents_enabled):
    """_execute_pipeline_step (step 0) must complete for a non-founder agent via PipelineOrchestrator.

    Verifies orchestrator path: orch.run() → awaiting_approval → step state updated.
    """

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

    mock_llm = MagicMock()

    def fake_orch_run(*, agents, project_slug, business_goal, pipeline_id=None,
                      inputs_dir=None, auto_approve=False, llm=None,
                      on_progress=None, kernel_progress_callback=None, **_):
        from agentsuite.pipeline.schema import PipelineState, PipelineStepState
        step = PipelineStepState(agent="design", run_id="agentsuite-pipeline-design-run-id", status="awaiting_approval")
        state = PipelineState(
            pipeline_id=pipeline_id or "pipe-test",
            project_slug=project_slug,
            business_goal=business_goal,
            agents=agents,
            steps=[step],
            current_step_index=0,
            status="awaiting_approval",
        )
        if on_progress:
            on_progress("agent_waiting", step, state)
        return state

    # Sprint B B7 (MOCKING_AUDIT closure): _save_state and _load_settings
    # injected via kwargs on _execute_pipeline_step.
    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.pipeline.orchestrator.PipelineOrchestrator.run", side_effect=fake_orch_run),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_pipeline_step(
            pipeline_id, 0,
            save_state=lambda: None,
            load_settings=lambda: {"api_key": "mock-key"},
        )

    await asyncio.sleep(0)  # flush call_soon_threadsafe callbacks

    step = _pipelines[pipeline_id]["steps"][0]
    assert step["run_id"] == "agentsuite-pipeline-design-run-id"
    assert step["status"] == "awaiting_approval"

    del _pipelines[pipeline_id]


async def test_execute_run_emits_progress_events():
    """Removing progress_callback= from agent.run() at execution.py L187 must fail this test.

    The side_effect invokes the passed progress_callback synchronously (inside the
    thread-pool executor). The callback uses loop.call_soon_threadsafe to schedule
    emit() on the asyncio event loop. After sleep(0) flushes the queue, the resulting
    stage_update events must appear in run["events"].
    """
    run_id = "run-progress-test-001"
    req = RunRequest(agent_id="founder", goal="Progress test goal", project="progress-test")
    _make_run(run_id)

    fake_state = _fake_run_state()
    mock_llm = MagicMock()

    def fake_agent_run(*, request, run_id, progress_callback=None):  # noqa: ARG001
        if progress_callback is not None:
            progress_callback({"type": "stage_progress", "stage": "intake", "step": 1, "total": 5, "message": "Starting Intake"})
            progress_callback({"type": "stage_progress", "stage": "intake", "step": 1, "total": 5, "message": "Intake complete"})
        return fake_state

    # Sprint B B7 (MOCKING_AUDIT closure): _load_settings, _save_state,
    # _log_telemetry injected via kwargs.
    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.agents.founder.agent.FounderAgent.run", side_effect=fake_agent_run),
        patch("agentsuitelocal.api.execution._send_notification"),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_run(
            run_id, req, cancel_token=threading.Event(),
            save_state=lambda: None,
            log_telemetry=lambda *a, **kw: None,
            load_settings=lambda: {"api_key": "mock-key", "run_timeout_seconds": 30},
        )

    await asyncio.sleep(0)  # flush call_soon_threadsafe callbacks scheduled from executor thread

    run = _runs[run_id]
    stage_update_events = [e for e in run["events"] if e.get("type") == "stage_update"]
    assert len(stage_update_events) >= 2, (
        f"Expected ≥2 stage_update events but got {len(stage_update_events)}. "
        f"All event types: {[e['type'] for e in run['events']]}. "
        "Likely cause: progress_callback=progress_callback was removed from agent.run() at execution.py L187."
    )
    assert stage_update_events[0].get("stage") == "intake"


async def test_execute_pipeline_step_emits_progress_events(_all_agents_enabled):
    """kernel_progress_callback must be wired through PipelineOrchestrator to produce stage_update events.

    Removing kernel_progress_callback= from orch.run() in execution.py must fail this test.
    """
    from agentsuitelocal.api.execution import _execute_pipeline_step
    from agentsuitelocal.api.state import _pipelines

    pipeline_id = "pipe-progress-test-001"
    _pipelines[pipeline_id] = {
        "id": pipeline_id,
        "project": "progress-test",
        "goal": "Pipeline progress test",
        "inputs_dir": None,
        "auto_approve": False,
        "status": "running",
        "current_step": 0,
        "steps": [{"agent": "design", "status": "running", "run_id": None, "artifacts": [], "qa_score": None, "qa_dimensions": []}],
        "events": [],
        "updated_at": time.time(),
        "error_message": None,
    }

    mock_llm = MagicMock()

    def fake_orch_run(*, agents, project_slug, business_goal, pipeline_id=None,  # noqa: ARG001
                      inputs_dir=None, auto_approve=False, llm=None,
                      on_progress=None, kernel_progress_callback=None, **_):
        if kernel_progress_callback is not None:
            kernel_progress_callback({"type": "stage_progress", "stage": "extract", "step": 2, "total": 5, "message": "Starting Extraction"})
        from agentsuite.pipeline.schema import PipelineState, PipelineStepState
        step = PipelineStepState(agent="design", run_id="agentsuite-pipeline-progress-run-id", status="awaiting_approval")
        state = PipelineState(
            pipeline_id=pipeline_id or "pipe-test",
            project_slug=project_slug,
            business_goal=business_goal,
            agents=agents,
            steps=[step],
            current_step_index=0,
            status="awaiting_approval",
        )
        if on_progress:
            on_progress("agent_waiting", step, state)
        return state

    # Sprint B B7 (MOCKING_AUDIT closure): _save_state and _load_settings
    # injected via kwargs on _execute_pipeline_step.
    with (
        patch("agentsuitelocal.api.execution._resolve_llm", return_value=mock_llm),
        patch("agentsuite.pipeline.orchestrator.PipelineOrchestrator.run", side_effect=fake_orch_run),
        patch("agentsuitelocal.api.execution._workspace", return_value=Path("/tmp/agentsuite-exec-test")),
    ):
        await _execute_pipeline_step(
            pipeline_id, 0,
            save_state=lambda: None,
            load_settings=lambda: {"api_key": "mock-key"},
        )

    await asyncio.sleep(0)  # flush call_soon_threadsafe callbacks

    pipeline = _pipelines[pipeline_id]
    stage_update_events = [e for e in pipeline["events"] if e.get("type") == "stage_update"]
    assert len(stage_update_events) >= 1, (
        f"Expected ≥1 stage_update event but got {len(stage_update_events)}. "
        f"All event types: {[e['type'] for e in pipeline['events']]}. "
        "Likely cause: kernel_progress_callback was removed from orch.run() call in execution.py."
    )
    assert stage_update_events[0].get("stage") == "extract"
    assert stage_update_events[0].get("step") == 0  # pipeline step index, not stage step

    del _pipelines[pipeline_id]
