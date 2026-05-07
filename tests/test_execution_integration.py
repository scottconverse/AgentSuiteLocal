"""
Real-path integration test for _execute_run — closes TEST-CRIT-001
(audit-AgentSuiteLocal-2026-05-05-v088).

Bug class: every test in tests/test_execution_state_machine.py mocks
_resolve_llm, the agent class, _save_state, _log_telemetry,
_send_notification, and _workspace. That is the same mocking pattern
that shipped v0.8.7's missing-`ollama`-SDK regression — the resolver
was never exercised.

This test exercises the real path with no patching:

  - AGENTSUITE_LLM_PROVIDER_FACTORY pointed at this module's factory
    (which the production allowlist permits via the `tests.` prefix).
  - The factory returns a real `agentsuite.llm.mock.MockLLMProvider`
    with substring-keyed responses sufficient for the Founder agent's
    five stages (intake / extract / spec / execute / qa).
  - AGENTSUITE_WORKSPACE pointed at a per-test tmp dir so _save_state,
    artifact persistence, and (optionally) kernel push touch real
    files instead of the user's home directory.
  - _resolve_llm, _save_state, _log_telemetry, _send_notification,
    and _workspace are all UNPATCHED.

If this test ever fails because the agent dispatch or resolver path
itself is broken, that's exactly the class of bug the audit asked us
to surface — keep it green by fixing the production path, not by
re-patching the test.
"""
from __future__ import annotations

import asyncio
import threading
import time
from pathlib import Path

import pytest

from agentsuitelocal.api.execution import _execute_run, _resolve_llm
from agentsuitelocal.api.schemas import RunRequest
from agentsuitelocal.api.state import _runs


def _fake_provider_factory():
    """Real-path mock provider for the integration test.

    Returns a MockLLMProvider preloaded with substring-keyed responses
    so the Founder agent's five stages (intake / extract / spec /
    execute / qa) all receive non-empty text. The empty-string key
    is the catch-all for any prompt the substring router doesn't match.

    TEST-002 fix (2026-05-07 audit): the extract stage parses the LLM
    response as JSON. The original "Test extract artifact body." prose
    response caused a JSON parse error, making the test an xfail fixture
    bug rather than a production bug. All stage responses that the agent
    layer parses as JSON now return valid JSON objects.
    """
    from agentsuite.llm.mock import MockLLMProvider
    return MockLLMProvider(
        responses={
            # intake stage: prose is acceptable (no JSON parse in intake)
            "intake": "Test intake artifact body.",
            # extract stage: must return JSON — the agent parses it
            "extract": '{"facts": ["key fact 1", "key fact 2"], "context": "Test extraction context.", "entities": []}',
            # spec stage: return JSON to be safe
            "spec": '{"spec": "Test specification content.", "requirements": []}',
            # execute stage: return JSON to be safe
            "execute": '{"output": "Test execution output.", "artifacts": []}',
            # qa stage: must return JSON with score and canonical dimensions
            "qa": (
                '{"score": 8.5, "weighted_score": 8.5, "dimensions": {'
                '"clarity": 8.5, "completeness": 8.5, "coherence": 8.5,'
                '"specificity": 8.5, "brand_alignment": 8.5, "feasibility": 8.5,'
                '"differentiation": 8.5, "depth": 8.5, "actionability": 8.5}}'
            ),
            "": '{"response": "Generic stub response for any prompt."}',
        },
        default_model="mock-integration",
    )


@pytest.fixture(autouse=True)
def _isolate_state(monkeypatch, tmp_path: Path):
    """Per-test workspace + factory env wiring + state cleanup."""
    monkeypatch.setenv("AGENTSUITE_WORKSPACE", str(tmp_path))
    monkeypatch.setenv(
        "AGENTSUITE_LLM_PROVIDER_FACTORY",
        "tests.test_execution_integration:_fake_provider_factory",
    )
    monkeypatch.setenv(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )
    _runs.clear()
    yield
    _runs.clear()


async def test_resolve_llm_returns_factory_provider_with_no_patching() -> None:
    """The resolver must dispatch the env-var factory and return its
    provider — no patching, no fallback. This is the smallest possible
    real-path resolver test and catches the v0.8.7-class regression
    directly: if `import ollama` (or any other resolver-side import)
    were ever broken again, this would fail before any agent code runs.
    """
    provider = await _resolve_llm({})
    assert provider is not None, (
        "_resolve_llm returned None against AGENTSUITE_LLM_PROVIDER_FACTORY="
        "tests.test_execution_integration:_fake_provider_factory. "
        "Either the factory module didn't import, the allowlist rejected it, "
        "or the resolver swallowed an exception. Inspect "
        "agentsuitelocal.api.execution.get_last_resolver_error()."
    )
    assert provider.__class__.__name__ == "MockLLMProvider", (
        f"Expected MockLLMProvider, got {type(provider).__name__}. "
        "If this is OllamaProvider, the factory env var didn't reach "
        "the resolver — check PYTEST_CURRENT_TEST gating."
    )


async def test_execute_run_real_path_against_factory_provider(tmp_path: Path) -> None:
    """End-to-end through _execute_run with no patching.

    This exercises:
      - _resolve_llm (real)
      - real agent class dispatch (`get_class("founder")` from agentsuite registry)
      - real BaseAgent.run with the mock provider's substring responses
      - _save_state writing to a tmp SQLite (via AGENTSUITE_WORKSPACE)
      - _log_telemetry / _send_notification real
      - the run state-machine path through to a terminal status

    TEST-002 fix (2026-05-07 audit): the xfail decorator was removed after
    _fake_provider_factory was updated to return valid JSON for all stages
    that the agent layer parses (extract / spec / execute / qa). The fixture
    bug was the root cause; production parsing is correct.

    If this test fails, the failure message documents which production code
    is uncovered. Fix the production path, do not re-mock.
    """
    run_id = "run-integration-001"
    req = RunRequest(
        agent_id="founder",
        goal="Smoke test goal — produce minimal artifacts.",
        project="integration-test",
    )
    _runs[run_id] = {
        "id": run_id,
        "agent": "founder",
        "project": "integration-test",
        "goal": req.goal,
        "status": "running",
        "started_at": time.time(),
        "events": [],
        "artifacts": [],
        "qa_score": None,
        "qa_dimensions": [],
        "agentsuite_run_id": None,
        "partial_artifacts": False,
    }

    cancel_token = threading.Event()
    try:
        await asyncio.wait_for(
            _execute_run(run_id, req, cancel_token=cancel_token),
            timeout=60.0,
        )
    except TimeoutError:
        pytest.fail(
            f"_execute_run did not complete in 60s. Run state: {_runs[run_id]}. "
            "Likely the agent's prompt loop is calling out to an unmocked "
            "dependency (real Ollama, real network)."
        )

    run = _runs[run_id]
    assert run["status"] in ("waiting", "error"), (
        f"Expected terminal status 'waiting' (success) or 'error' (uncovered "
        f"production-path bug — file as a follow-up). Got: {run['status']}"
    )
    # If status is "error", surface the message so the failure points at the
    # offending production code rather than just saying the test failed.
    if run["status"] == "error":
        pytest.fail(
            f"Real-path run errored: {run.get('error', '<no error message>')}. "
            f"This is the 'second wave of bugs' the audit predicted; file as "
            f"a follow-up against the production path that crashed and "
            f"@pytest.mark.xfail this test with the linked finding ID."
        )
    # On success, the agentsuite_run_id should be populated.
    assert run.get("agentsuite_run_id"), (
        "agentsuite_run_id is not set on a successful run — that field is "
        "populated by BaseAgent.run; if it's missing, the run completed "
        "without ever reaching the agent layer."
    )
