"""
E2E: Installer flow — walks all 11 visible steps and enters the app.
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
def test_installer_welcome_renders(page: Page, base_url: str):
    page.goto(base_url)
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)


@pytest.mark.e2e
def test_installer_full_flow(page: Page, base_url: str):
    """Walk all installer steps from Welcome through to the main app."""
    page.goto(base_url)

    # Step 1 — Welcome
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)
    page.get_by_role("button", name="Get started").click()

    # Step 2 — License & privacy (must check the checkbox before "I agree" enables)
    expect(page.get_by_role("heading", name="License & privacy")).to_be_visible(timeout=5000)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="I agree").click()

    # Step 3 — Checking your hardware (nextDisabled until probe completes)
    expect(page.get_by_role("heading", name="Checking your hardware")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=12000)
    page.get_by_role("button", name="Continue").click()

    # Step 4 — Pick a model
    expect(page.get_by_role("heading", name="Pick a model")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Continue").click()

    # Step 5 — Ollama runtime (nextDisabled until phase=done)
    expect(page.get_by_role("heading", name="Ollama runtime")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 6 — Downloading model (nextDisabled until pct=100)
    expect(page.get_by_role("heading", name="Downloading model")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 7 — Setting up the runtime (Python, nextDisabled until allDone)
    expect(page.get_by_role("heading", name="Setting up the runtime")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=12000)
    page.get_by_role("button", name="Continue").click()

    # Step 8 — Pick your agents (regression guard: was crashing with null state)
    expect(page.get_by_role("heading", name="Pick your agents")).to_be_visible(timeout=5000)
    for name in ["Founder", "Design", "Product", "Engineering", "Marketing"]:
        expect(page.get_by_text(name, exact=True).first).to_be_visible()
    page.get_by_role("button", name="Continue").click()

    # Step 9 — Cloud fallback (API keys)
    expect(page.get_by_role("heading", name="Cloud fallback (optional)")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Continue").click()

    # Step 10 — First-run smoke test (nextDisabled until allDone)
    expect(page.get_by_role("heading", name="First-run smoke test")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 11 — You're set up
    expect(page.get_by_text("You're set up.")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Launch AgentSuiteLocal").click()

    # Main app
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=5000)
