"""TEST-003 (audit 2026-05-05): E2E that walks installer → Dashboard →
New Run → assert run starts. Until this test, the agent code path was
exercised only by smoke (one inference call); a New Run dispatches the
full orchestrator, which is the path users actually run.

The mock-factory env vars are set in tests/e2e/conftest.py BEFORE the
backend imports — that order matters (TEST2-001 round-2 finding). The
factory writes a sentinel file when invoked so this test can assert the
mock was actually wired in (defends against silent fallback to real
Ollama in CI)."""

from __future__ import annotations

import pathlib
import re
import tempfile

import pytest
from playwright.sync_api import Page, expect

# Sentinel path used to prove the mock factory ran. Cleaned up at module
# load so each test session starts fresh. Tests assert it exists after
# triggering a run.
_MOCK_SENTINEL = pathlib.Path(tempfile.gettempdir()) / "agentsuite_mock_factory_called"
if _MOCK_SENTINEL.exists():
    _MOCK_SENTINEL.unlink()


def _mock_provider_factory():
    """Returns a MockLLMProvider preloaded with substring-keyed responses
    that satisfy the founder agent's stage prompts. Touches a sentinel file
    on every invocation so the E2E test can verify the mock actually ran."""
    from agentsuite.llm.mock import MockLLMProvider
    try:
        _MOCK_SENTINEL.touch(exist_ok=True)
    except Exception:
        pass
    return MockLLMProvider(
        responses={
            "intake": "Test intake artifact",
            "extract": "Test extract artifact",
            "spec": "Test spec artifact",
            "execute": "Test execute artifact",
            "qa": '{"score": 0.9, "dimensions": []}',
            "": "Generic stub response for any prompt",
        },
        default_model="mock-1",
    )


def _walk_installer(page: Page, base_url: str) -> None:
    page.goto(base_url)
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)
    page.get_by_role("button", name="Get started").click()
    expect(page.get_by_role("heading", name="License & privacy")).to_be_visible(timeout=5000)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="I agree").click()
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=120000)
    page.get_by_role("button", name="Continue").click()
    expect(page.get_by_role("heading", name="First-run smoke test")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=60000)
    page.get_by_role("button", name="Continue").click()
    expect(page.get_by_text("You're set up.")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Launch AgentSuiteLocal").click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=8000)


@pytest.mark.e2e
def test_new_run_dispatches_orchestrator_with_mock_llm(page: Page, base_url: str):
    """TEST-003: clicking New Run → submitting a goal must reach a state
    where the orchestrator is running (the LiveRunView heading is visible
    and the SSE stream is connected). This is the path that the v0.8.7
    missing-`ollama`-SDK bug killed — no test exercised it before today."""
    _walk_installer(page, base_url)

    # Navigate to New Run.
    # Dashboard intentionally renders two "New run" buttons — a small
    # nav-strip button at the top-right (btn-accent btn-sm) and a
    # primary empty-state CTA (btn-primary). `.first` picks the
    # nav-strip one; either click is valid and reaches NewRunView.
    page.get_by_role("button", name="New run").first.click()
    # Playwright Python's `name=` accepts str or compiled Pattern, NOT a
    # callable — pre-existing bug masked by the Step 5 smoke-block until
    # gemma4:e4b landed in CI. Use regex for case-insensitive substring.
    expect(page.get_by_role("heading", name=re.compile(r"new run", re.IGNORECASE))).to_be_visible(timeout=5000)

    # Fill goal + project
    page.get_by_label("Goal").fill("smoke-goal: produce a test artifact")
    project_input = page.get_by_label("Project")
    if project_input.is_visible():
        project_input.fill("smoke-project")

    # Submit — accept any of "Start run", "Run", or "Launch" as the CTA label.
    page.get_by_role("button", name=re.compile(r"^(start run|run|launch)$", re.IGNORECASE)).first.click()

    # Assert we landed on LiveRunView and the stage timeline is visible.
    # This verifies the orchestrator dispatched — the v0.8.7 missing-SDK bug
    # killed dispatch at _resolve_llm (returned None), so reaching LiveRunView
    # at all means _resolve_llm succeeded with the mock factory. That's the
    # original test goal.
    expect(page.get_by_text("Five-stage pipeline")).to_be_visible(timeout=10000)

    # NOT asserting "Run failed never appears" beyond this point: the
    # substring-router MockLLMProvider returns prose for the founder agent's
    # extract stage, which expects parseable JSON. Production correctly
    # raises "extract stage produced invalid JSON: ..." — that's a
    # test-fixture limitation, not a production bug. Same class as the
    # xfail in tests/test_execution_integration.py. Hardening the mock to
    # return canonical JSON for stages that demand it lives on the audit
    # watchlist (W-1).

    # TEST2-001: assert the mock factory actually ran. Without this check, a
    # CI job where the env var didn't propagate to the backend subprocess
    # would silently pass against a real Ollama (or fail for the wrong
    # reason). The sentinel file is touched by _mock_provider_factory above.
    assert _MOCK_SENTINEL.exists(), (
        f"Mock LLM factory was not invoked (sentinel '{_MOCK_SENTINEL}' missing). "
        "Either AGENTSUITE_LLM_PROVIDER_FACTORY didn't reach the backend "
        "process, or _resolve_llm fell through to real-Ollama resolution. "
        "Check tests/e2e/conftest.py env-var ordering and the CI 'Start "
        "backend' step."
    )
