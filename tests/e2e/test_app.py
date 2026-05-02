"""
E2E: Main app screens — verifies all 7 sidebar nav items render and the
New Run → Cancel round-trip works. Each test walks the full installer first
to reach the app; the installer flow is also a regression guard for step 8.
"""

import pytest
from playwright.sync_api import Page, expect


def _enter_app(page: Page, base_url: str) -> None:
    """Walk the installer to reach the main app."""
    page.goto(base_url)

    # Step 1 — Welcome
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)
    page.get_by_role("button", name="Get started").click()

    # Step 2 — License (must check checkbox before "I agree" enables)
    expect(page.get_by_role("heading", name="License & privacy")).to_be_visible(timeout=5000)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="I agree").click()

    # Step 3 — Hardware (async probe)
    expect(page.get_by_role("heading", name="Checking your hardware")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=12000)
    page.get_by_role("button", name="Continue").click()

    # Steps 4–9: Pick a model → Ollama → Model download → Python → Agents → API keys
    for heading in [
        "Pick a model",
        "Ollama runtime",
        "Downloading model",
        "Setting up the runtime",
        "Pick your agents",
        "Cloud fallback (optional)",
    ]:
        expect(page.get_by_role("heading", name=heading)).to_be_visible(timeout=5000)
        expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
        page.get_by_role("button", name="Continue").click()

    # Step 10 — Smoke test
    expect(page.get_by_role("heading", name="First-run smoke test")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 11 — Launch
    expect(page.get_by_text("You're set up.")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Launch AgentSuiteLocal").click()

    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=8000)


@pytest.fixture()
def app_page(page: Page, base_url: str) -> Page:
    _enter_app(page, base_url)
    return page


# ---------------------------------------------------------------------------
# Sidebar navigation
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_nav_agents(app_page: Page):
    app_page.get_by_role("button", name="Agents").click()
    expect(app_page.get_by_role("heading", name="Agents")).to_be_visible(timeout=5000)
    expect(app_page.get_by_text("Founder", exact=True).first).to_be_visible()


@pytest.mark.e2e
def test_nav_runs(app_page: Page):
    app_page.get_by_role("button", name="Runs").click()
    expect(app_page.get_by_role("heading", name="Runs")).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_nav_kernel(app_page: Page):
    app_page.get_by_role("button", name="Kernel").click()
    expect(app_page.get_by_text("source of truth", exact=False)).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_nav_pipelines(app_page: Page):
    app_page.get_by_role("button", name="Pipelines").click()
    expect(app_page.get_by_role("heading", name="Pipelines")).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_nav_settings(app_page: Page):
    app_page.get_by_role("button", name="Settings").click()
    expect(app_page.get_by_role("heading", name="Settings")).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_nav_manual(app_page: Page):
    app_page.get_by_role("button", name="Manual").click()
    expect(app_page.get_by_text("30-second mental model", exact=False)).to_be_visible(timeout=5000)


@pytest.mark.e2e
def test_nav_dashboard_round_trip(app_page: Page):
    app_page.get_by_role("button", name="Agents").click()
    expect(app_page.get_by_role("heading", name="Agents")).to_be_visible(timeout=5000)
    app_page.get_by_role("button", name="Dashboard").click()
    expect(app_page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=5000)


# ---------------------------------------------------------------------------
# New Run flow
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_new_run_opens_and_hides_sidebar(app_page: Page):
    app_page.get_by_role("button", name="New run").click()
    expect(app_page.get_by_text("Business goal")).to_be_visible(timeout=5000)
    expect(app_page.get_by_role("button", name="Dashboard")).not_to_be_visible()


@pytest.mark.e2e
def test_new_run_cancel_returns_to_dashboard(app_page: Page):
    app_page.get_by_role("button", name="New run").click()
    expect(app_page.get_by_text("Business goal")).to_be_visible(timeout=5000)
    app_page.get_by_role("button", name="Cancel").first.click()
    expect(app_page.get_by_role("button", name="Dashboard")).to_be_visible(timeout=5000)
    expect(app_page.get_by_role("heading", name="Dashboard")).to_be_visible()


# ---------------------------------------------------------------------------
# Approval Gate
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_approval_gate_opens(app_page: Page):
    review_btn = app_page.get_by_role("button", name="Review run")
    expect(review_btn).to_be_visible(timeout=5000)
    review_btn.click()
    expect(app_page.get_by_text("QA SCORE", exact=False)).to_be_visible(timeout=5000)
    expect(app_page.get_by_role("button", name="Approve & promote")).to_be_visible()
    expect(app_page.get_by_role("button", name="Dashboard")).not_to_be_visible()
