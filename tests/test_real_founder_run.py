"""
Real-model agent E2E (Sprint 1, v0.9 plan).

Closes the test-honesty gap that v0.8.7's missing-`ollama`-SDK and v0.8.9's
xfail'd `test_execute_run_real_path_against_factory_provider` both surfaced:
no green test currently proves a New Run produces approve-able artifacts
end-to-end through the real agent code path. Mocked providers can satisfy
prompt-routing but cannot satisfy the founder agent's per-stage JSON
contract; production correctly rejects mock prose at the extract stage.

This test runs against a real Ollama daemon with a real `gemma4:e4b`
model loaded. It is OPT-IN — the `real_ollama` pytest marker keeps it
out of the default suite (`pytest tests/` skips it). Run it with:

    pytest tests/test_real_founder_run.py -v -m real_ollama

Or as the dedicated CI workflow does:

    pytest tests/ -v -m real_ollama

Where it runs:
- Local dev — only when explicitly invoked, only when Ollama is
  installed with `gemma4:e4b` pulled.
- CI — `.github/workflows/real-e2e.yml` (separate from the default
  `ci.yml`), nightly cron + on tag push + on PRs labeled `run-real-e2e`.
- Default `pytest tests/` and the main CI `ci.yml` job — excluded via
  `-m "not real_ollama"`.

Why this is a top-level test file (not under `tests/e2e/`):
- `tests/e2e/conftest.py` sets `AGENTSUITE_LLM_PROVIDER_FACTORY` to a
  mock factory. We need the OPPOSITE: a backend with NO factory env
  set, so `_resolve_llm` builds a real `OllamaProvider`.
- Running at `tests/` keeps us out of the e2e conftest's mock plumbing.
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

# Module-level marker: every test in this file requires real Ollama.
# Default `pytest tests/` skips this entire file via `-m "not real_ollama"`.
pytestmark = pytest.mark.real_ollama


@pytest.fixture(autouse=True)
def _isolate_state(monkeypatch, tmp_path: Path):
    """Per-test workspace + state cleanup. Critically: does NOT set
    AGENTSUITE_LLM_PROVIDER_FACTORY — that's the whole point. The
    resolver must build a real OllamaProvider against the real daemon.
    """
    monkeypatch.setenv("AGENTSUITE_WORKSPACE", str(tmp_path))
    monkeypatch.setenv(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )
    # Belt-and-braces: in case some other test left it set.
    monkeypatch.delenv("AGENTSUITE_LLM_PROVIDER_FACTORY", raising=False)
    _runs.clear()
    yield
    _runs.clear()


async def test_resolver_builds_real_ollama_provider() -> None:
    """The smallest possible real-Ollama resolver test. Mirrors the
    `test_resolve_llm_returns_factory_provider_with_no_patching` test
    in test_execution_integration.py but with NO factory env, so the
    resolver constructs a real `OllamaProvider`.

    If this fails: either `import ollama` is broken in the bundle (the
    v0.8.7 class), or the Ollama daemon isn't reachable on
    localhost:11434, or `_resolve_llm` itself regressed.
    """
    provider = await _resolve_llm({})
    assert provider is not None, (
        "_resolve_llm returned None against real Ollama (no factory env). "
        "Most likely cause: `import ollama` failed in the bundle (v0.8.7-class "
        "regression) or the Ollama daemon is not reachable. Inspect "
        "agentsuitelocal.api.execution.get_last_resolver_error()."
    )
    assert provider.__class__.__name__ == "OllamaProvider", (
        f"Expected real OllamaProvider, got {type(provider).__name__}. "
        "Either a stray AGENTSUITE_LLM_PROVIDER_FACTORY env leaked into "
        "this test, or _resolve_llm fell back to a different provider."
    )


async def test_founder_run_produces_approveable_artifacts(tmp_path: Path) -> None:
    """End-to-end through `_execute_run` with the REAL `OllamaProvider`
    against a REAL `gemma4:e4b` daemon.

    This is the test that v0.8.7's missing-SDK regression and
    v0.8.9's substring-router xfail both pointed at — a green
    proof that a New Run produces approve-able artifacts end-to-end
    through the unmocked agent code path.

    Runtime: ~5–15 min on free CI runners depending on agent stage
    output volume. The synthetic goal is deliberately minimal to keep
    output short. The test's own timeout is 20 min (1200s); if it
    consistently runs longer, the founder agent's prompts may need
    a "smoke goal" mode that produces shorter stage outputs.
    """
    run_id = "run-real-founder-001"
    req = RunRequest(
        agent_id="founder",
        goal="Smoke test goal — produce minimal artifacts.",
        project="real-e2e-smoke",
    )
    _runs[run_id] = {
        "id": run_id,
        "agent": "founder",
        "project": "real-e2e-smoke",
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
            timeout=1200.0,  # 20 min — exceeds the default 15 min run_timeout
        )
    except TimeoutError:
        pytest.fail(
            f"Real-model Founder run did not complete in 20 min. "
            f"Run state: {_runs[run_id]}. The CI runner may be slow, the "
            f"goal may be producing too much output, or the agent may be "
            f"stuck in a stage. Check the SSE event log for the last stage_update."
        )

    run = _runs[run_id]

    # Status must reach "waiting" (success — awaiting approval). "error" is
    # what the v0.8.7 SDK regression and the v0.8.9 mock-fixture limit produced;
    # this test exists to prove the real-model path doesn't hit either.
    assert run["status"] == "waiting", (
        f"Real-model run did not reach status='waiting'. Got '{run['status']}'. "
        f"Error: {run.get('error', '<no error message>')}. "
        f"Last 3 events: {run.get('events', [])[-3:]}. "
        f"This is the test failure that closes the v0.8.7-class gap — "
        f"investigate the agent stage that crashed."
    )

    # agentsuite_run_id is populated by BaseAgent.run; if it's missing, the
    # run completed without ever reaching the agent layer (smoke screen failure
    # without the agent being invoked at all).
    assert run.get("agentsuite_run_id"), (
        "agentsuite_run_id is not set on a successful run — that field is "
        "populated by BaseAgent.run; if it's missing, the run completed "
        "without ever reaching the agent layer."
    )

    # Artifacts must exist. The Founder agent produces ~26 in production runs;
    # a synthetic smoke goal will produce fewer, but should produce SOME.
    assert len(run["artifacts"]) > 0, (
        f"Run reached status='waiting' but produced 0 artifacts. "
        f"Workspace: {tmp_path}. The agent dispatched but no files were "
        f"written — likely a stage failed silently or the workspace path "
        f"is wrong. Inspect the run dir: "
        f"{tmp_path}/.agentsuite/runs/{run.get('agentsuite_run_id')}"
    )

    # qa_score should be a real number (the QA stage parses model output as
    # JSON — that's exactly the contract the substring mock can't satisfy).
    # If qa_score is None here, the QA stage failed to produce parseable JSON.
    assert run.get("qa_score") is not None, (
        "qa_score is None — the QA stage's JSON parse failed. This is the "
        "extract/qa-stage JSON-contract gap that the substring mock provider "
        "couldn't bridge. With real gemma4:e4b, parse failures here mean "
        "the model produced non-JSON output for the QA scoring prompt — "
        "which is the bug class this test is designed to surface."
    )

    # qa_score should be in the valid range [0, 10]. The QA gate threshold
    # defaults to 7.0, so a score below that means the run is approve-able
    # via Override but not via the default Approve.
    assert 0.0 <= run["qa_score"] <= 10.0, (
        f"qa_score {run['qa_score']} is out of expected [0, 10] range. "
        f"The QA stage's parsing or normalization is wrong."
    )
