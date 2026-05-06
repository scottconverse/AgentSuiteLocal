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
- Putting the file at `tests/` lets us start our own backend with a
  clean env, separate from the mock-factory plumbing.

Sprint 1 day 2 will fill in the test body. Day 1 ships only the
skeleton + marker registration so the workflow validates and the
default suite stays unaffected.
"""
from __future__ import annotations

import pytest

# Module-level marker: every test in this file requires real Ollama.
# Default `pytest tests/` skips this entire file via `-m "not real_ollama"`.
pytestmark = pytest.mark.real_ollama


def test_skeleton_marker_registered() -> None:
    """Day-1 placeholder. Confirms the marker is wired and the file is
    discoverable. Day 2 replaces with the real-Ollama Founder agent run.
    """
    # If this test runs, it means -m real_ollama was passed. The day-2
    # implementation will assert against a live Ollama daemon.
    assert True
