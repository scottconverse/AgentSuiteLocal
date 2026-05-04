"""Tests for launcher.py — frozen-distributable entry point.

Verifies that main() primes AGENTSUITE_ENABLED_AGENTS before the server starts.
These tests are regression guards: removing the setdefault from launcher.py
will cause test_primes_enabled_agents_env to fail.
"""

from __future__ import annotations

import os
from unittest.mock import patch

_EXPECTED_AGENTS = frozenset(
    {"founder", "design", "product", "engineering", "marketing", "trust_risk", "cio"}
)


def _run_launcher_main() -> None:
    """Call launcher.main() with all blocking I/O patched out."""
    from launcher import main

    with (
        patch("launcher._find_free_port", return_value=9999),
        patch("launcher._wait_for_server", return_value=True),
        patch("launcher.threading"),
        patch("launcher.webbrowser"),
        patch("launcher._log"),
    ):
        main()


class TestLauncherMain:
    def test_primes_enabled_agents_env(self, monkeypatch):
        """main() must set AGENTSUITE_ENABLED_AGENTS to all seven agents."""
        monkeypatch.delenv("AGENTSUITE_ENABLED_AGENTS", raising=False)
        _run_launcher_main()
        val = os.environ.get("AGENTSUITE_ENABLED_AGENTS", "")
        for agent in _EXPECTED_AGENTS:
            assert agent in val, f"'{agent}' missing from AGENTSUITE_ENABLED_AGENTS={val!r}"

    def test_does_not_override_operator_env(self, monkeypatch):
        """main() must not overwrite an operator-set AGENTSUITE_ENABLED_AGENTS."""
        monkeypatch.setenv("AGENTSUITE_ENABLED_AGENTS", "founder,design")
        _run_launcher_main()
        assert os.environ["AGENTSUITE_ENABLED_AGENTS"] == "founder,design"
