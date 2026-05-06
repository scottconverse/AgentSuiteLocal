"""
Regression test for QA-DD-001 (audit-AgentSuiteLocal-2026-05-05-v088).

Class of bug: agent-slug drift between the four sources of truth that
must agree for `/api/run` to dispatch the seven advertised agents:

  1. launcher.py    — AGENTSUITE_ENABLED_AGENTS env default
  2. cli.py         — same env default for CLI entry
  3. config.py      — _SETTINGS_DEFAULTS["enabled_agents"]
  4. web/src/data.js — frontend AGENTS list rendered in the picker

In v0.8.8 the data.js entry was `id: "trust"` while launcher/cli used
`trust_risk`. POSTing /api/run with `agent_id="trust"` accepted (200)
and then errored 3s later with `Agent 'trust' is not enabled or not
registered`. One of seven advertised agents was 100% broken.

This test asserts all four sources agree as a set.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def _parse_env_string(text: str) -> set[str]:
    """Extract the comma-separated agent list from a Python env-default string."""
    m = re.search(r'"(founder,[^"]*)"', text)
    assert m, f"Could not find env-string with founder list in: {text[:200]}"
    return {s.strip() for s in m.group(1).split(",") if s.strip()}


def _launcher_agents() -> set[str]:
    return _parse_env_string((REPO_ROOT / "launcher.py").read_text())


def _cli_agents() -> set[str]:
    return _parse_env_string((REPO_ROOT / "agentsuitelocal" / "cli.py").read_text())


def _config_default_agents() -> set[str]:
    from agentsuitelocal.api.config import _SETTINGS_DEFAULTS
    return set(_SETTINGS_DEFAULTS["enabled_agents"])


def _frontend_agents() -> set[str]:
    """Parse web/src/data.js for the AGENTS list `id:` slugs."""
    text = (REPO_ROOT / "web" / "src" / "data.js").read_text()
    # Match the AGENTS array specifically (avoid grabbing mock-run agent: refs).
    agents_block = re.search(
        r"export\s+const\s+AGENTS\s*=\s*\[(.*?)\];",
        text, re.DOTALL,
    )
    assert agents_block, "Could not find AGENTS export in web/src/data.js"
    return set(re.findall(r'\bid:\s*"([a-z_][a-z0-9_]*)"', agents_block.group(1)))


def test_agent_slugs_agree_across_all_four_sources() -> None:
    """The four sources of truth for the enabled-agent set must agree.

    If this fails: a recent change introduced agent-slug drift. Pick the
    canonical name (recommend the one matching the upstream AgentSuite
    library agent-class registry) and align the other sources.
    """
    sources = {
        "launcher.py":    _launcher_agents(),
        "cli.py":         _cli_agents(),
        "config.py":      _config_default_agents(),
        "web/src/data.js": _frontend_agents(),
    }

    canonical = sources["launcher.py"]
    assert len(canonical) == 7, (
        f"Expected 7 advertised agents in launcher.py, got {len(canonical)}: {sorted(canonical)}"
    )

    drift = {name: agents for name, agents in sources.items() if agents != canonical}
    assert not drift, (
        f"Agent-slug drift detected. Canonical (launcher.py): {sorted(canonical)}.\n"
        + "\n".join(
            f"  {name}: missing={sorted(canonical - agents)}, "
            f"extra={sorted(agents - canonical)}"
            for name, agents in drift.items()
        )
    )
