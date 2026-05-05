"""
E2E: Installer flow — walks all 5 steps (UX-1 combined screens) and enters the app.
"""

import json

import httpx
import pytest
from playwright.sync_api import Page, expect


@pytest.mark.e2e
def test_installer_welcome_renders(page: Page, base_url: str):
    page.goto(base_url)
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)


@pytest.mark.e2e
def test_installer_full_flow(page: Page, base_url: str):
    """Walk all 5 installer steps from Welcome through to the main app.

    UX-1 combined the original 11 steps into 5:
      1. Welcome
      2. License & privacy
      3. Hardware & model  (was: Checking your hardware + Tier selection)
      4. Ollama & model    (was: Ollama runtime + Model download + Python + Agents + API keys + Smoke)
      5. Ready (You're set up.)
    """
    page.goto(base_url)

    # Step 1 — Welcome
    expect(page.get_by_role("button", name="Get started")).to_be_visible(timeout=8000)
    page.get_by_role("button", name="Get started").click()

    # Step 2 — License & privacy (must check the checkbox before "I agree" enables)
    expect(page.get_by_role("heading", name="License & privacy")).to_be_visible(timeout=5000)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="I agree").click()

    # Step 3 — Hardware & model (async probe; Continue disabled until scan completes)
    # networkidle ensures /api/hardware has settled before asserting heading
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Hardware & model")).to_be_visible(timeout=15000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=15000)
    page.get_by_role("button", name="Continue").click()

    # Step 4 — Ollama & model (disabled until Ollama running and model verified)
    expect(page.get_by_role("heading", name="Ollama & model")).to_be_visible(timeout=5000)
    expect(page.get_by_role("button", name="Continue")).to_be_enabled(timeout=120000)
    page.get_by_role("button", name="Continue").click()

    # Step 5 — Ready
    expect(page.get_by_text("You're set up.")).to_be_visible(timeout=5000)
    page.get_by_role("button", name="Launch AgentSuiteLocal").click()

    # Main app
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible(timeout=8000)


@pytest.mark.e2e
def test_runtime_verify_reports_all_dependencies_present(base_url: str):
    """Hard gate: after install, /api/runtime/verify must report all_ok.

    This is the test that would have caught the v0.8.7 'Ollama SDK not
    installed' bug at CI time. The endpoint exercises real `import` of
    every dependency the runtime needs on the hot path. If the build is
    missing one (because pyproject.toml didn't declare it, because the
    PyInstaller spec didn't bundle it, or for any other reason), this
    fails with a precise list of what's missing — not a vague 'try
    again' an end user can't act on.

    Specifically asserts ollama is checked + present, since that was the
    exact regression. Add new entries here when adding new runtime deps.
    """
    r = httpx.get(f"{base_url}/api/runtime/verify", timeout=10)
    r.raise_for_status()
    body = r.json()
    failing = [c for c in body["checks"] if not c["ok"]]
    assert body["all_ok"], (
        "Runtime integrity check reports missing components:\n"
        + json.dumps(failing, indent=2)
        + "\n\nMost likely cause: a package is declared as a hiddenimport "
        "in AgentSuiteLocal.spec but is not in [project.dependencies] of "
        "pyproject.toml, so pip never installed it and PyInstaller never "
        "bundled it. Add the missing package to pyproject.toml."
    )

    checked = {c["name"] for c in body["checks"]}
    must_be_checked = {
        "Ollama Python SDK",
        "Anthropic SDK (cloud fallback)",
        "OpenAI SDK (cloud fallback)",
        "MCP client",
        "OS credential store",
    }
    not_checked = must_be_checked - checked
    assert not not_checked, (
        f"runtime_verify endpoint is not checking these critical deps: "
        f"{sorted(not_checked)}. They must be added to the loop in "
        f"agentsuitelocal/api/routers/ollama.py so missing-bundle bugs "
        f"surface in the in-app integrity check."
    )
