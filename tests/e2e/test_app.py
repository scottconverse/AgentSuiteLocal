"""
E2E: Main app screens — verifies all 7 sidebar nav items render and the
New Run → Cancel round-trip works. Each test walks the full installer first
to reach the app; the installer flow is also a regression guard for step 8.

UX-1: installer is 5 steps (Welcome → License → Hardware & model →
Ollama & model → Ready). Tests reflect the combined screen headings.
"""

import httpx
import pytest
from playwright.sync_api import Page, expect


def _enter_app(page: Page, base_url: str) -> None:
    """Walk the 5-step installer to reach the main app."""
    page.goto(base_url)

    # Step 1 — Welcome
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)
    page.get_by_role("button", name="Get started").click()

    # Step 2 — License (must check checkbox before "I agree" enables)
    expect(page.get_by_role("heading", name="License & privacy")).to_be_visible(timeout=5000)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="I agree").click()

    # Step 3 — Hardware & model (UX-1: combined screen; async probe disables Continue)
    # networkidle ensures /api/hardware has responded before we assert the heading
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Hardware & model")).to_be_visible(timeout=15000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 4 — Ollama & model (UX-1: combined screen; disabled until model verified)
    expect(page.get_by_role("heading", name="Ollama & model")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=120000)
    page.get_by_role("button", name="Continue").click()

    # Step 5 — Ready
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
    # Use heading role — text also appears in TOC links, causing strict-mode violation
    expect(app_page.get_by_role("heading", name="30-second mental model", exact=False)).to_be_visible(timeout=5000)


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
    # Use .first — the TopBar and Dashboard both render "New run" buttons
    app_page.get_by_role("button", name="New run").first.click()
    expect(app_page.get_by_text("Business goal")).to_be_visible(timeout=5000)
    expect(app_page.get_by_role("button", name="Dashboard")).not_to_be_visible()


@pytest.mark.e2e
def test_new_run_cancel_returns_to_dashboard(app_page: Page):
    app_page.get_by_role("button", name="New run").first.click()
    expect(app_page.get_by_text("Business goal")).to_be_visible(timeout=5000)
    app_page.get_by_role("button", name="Cancel").first.click()
    expect(app_page.get_by_role("button", name="Dashboard")).to_be_visible(timeout=5000)
    expect(app_page.get_by_role("heading", name="Dashboard")).to_be_visible()


# ---------------------------------------------------------------------------
# Approval Gate
# ---------------------------------------------------------------------------


@pytest.mark.e2e
def test_runs_list_shows_seeded_run(app_page: Page):
    # Seed a run via API and verify it appears in the Runs view.
    # Full approval-gate flow requires a waiting run from actual agent execution;
    # tested separately when Ollama is available and agents complete.
    r = httpx.post(
        "http://127.0.0.1:8765/api/run",
        json={"agent_id": "founder", "goal": "E2E runs list test", "project": "e2e-test"},
    )
    assert r.status_code == 200
    app_page.get_by_role("button", name="Runs").click()
    expect(app_page.get_by_role("heading", name="Runs")).to_be_visible(timeout=5000)
    # At least one run row should appear (RunsView capitalises agent names)
    expect(app_page.get_by_text("Founder", exact=True).first).to_be_visible(timeout=8000)
