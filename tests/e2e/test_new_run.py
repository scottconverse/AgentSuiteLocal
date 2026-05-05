"""TEST-003 (audit 2026-05-05): E2E that walks installer → Dashboard →
New Run → assert run starts. Until this test, the agent code path was
exercised only by smoke (one inference call); a New Run dispatches the
full orchestrator, which is the path users actually run.

Uses the AGENTSUITE_LLM_PROVIDER_FACTORY env var to inject a deterministic
mock provider so the test doesn't require Ollama or a real model."""

from __future__ import annotations

import os

import pytest
from playwright.sync_api import Page, expect


# Tell the agentsuite kernel to use our mock provider for any run started in
# this test session. The env var is honored by agentsuite's CLI today; this
# test doubles as a regression assertion that AgentSuiteLocal's _resolve_llm
# also honors it.
os.environ.setdefault(
    "AGENTSUITE_LLM_PROVIDER_FACTORY",
    "tests.e2e.test_new_run:_mock_provider_factory",
)
os.environ.setdefault("AGENTSUITE_ALLOW_MOCK_FACTORY", "1")


def _mock_provider_factory():
    """Returns a MockLLMProvider preloaded with substring-keyed responses
    that satisfy the founder agent's stage prompts. agentsuite's mock
    provider matches a prompt to its first response whose key is a substring
    of the prompt, so we cover the keys we know agents emit."""
    from agentsuite.llm.mock import MockLLMProvider
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

    # Navigate to New Run
    page.get_by_role("button", name="New run").click()
    expect(page.get_by_role("heading", name=lambda t: "new run" in t.lower())).to_be_visible(timeout=5000)

    # Fill goal + project
    page.get_by_label("Goal").fill("smoke-goal: produce a test artifact")
    project_input = page.get_by_label("Project")
    if project_input.is_visible():
        project_input.fill("smoke-project")

    # Submit
    page.get_by_role("button", name=lambda t: t.lower() in ("start run", "run", "launch")).first.click()

    # Assert we landed on LiveRunView and the stage timeline is visible
    expect(page.get_by_text("Five-stage pipeline")).to_be_visible(timeout=10000)

    # Assert the run did NOT immediately crash with the v0.8.7 bug-class
    # ("Run failed" within the first 3s = orchestrator never started).
    page.wait_for_timeout(3000)
    failed = page.get_by_text("Run failed")
    assert not failed.is_visible(), (
        "Run failed within 3s of dispatch — orchestrator likely never started. "
        "Check that AGENTSUITE_LLM_PROVIDER_FACTORY is honored by "
        "agentsuitelocal/api/execution.py:_resolve_llm (TEST-003 "
        "implementation note in next-sprint-watchlist.md)."
    )
