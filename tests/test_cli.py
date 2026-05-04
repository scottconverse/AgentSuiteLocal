"""Tests for agentsuitelocal.cli — argument parsing and startup behaviour.

uvicorn is imported lazily inside main() so we inject it via sys.modules
rather than patching a module-level attribute.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

from agentsuitelocal.cli import main


def _mock_uvicorn() -> MagicMock:
    mock = MagicMock()
    mock.run = MagicMock()
    return mock


class TestArgDefaults:
    def test_default_host_and_port(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading"),
        ):
            main()
        _, kwargs = uv.run.call_args
        assert kwargs["host"] == "127.0.0.1"
        assert kwargs["port"] == 8765

    def test_default_reload_false(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading"),
        ):
            main()
        _, kwargs = uv.run.call_args
        assert kwargs["reload"] is False

    def test_default_opens_browser_thread(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading") as mock_threading,
        ):
            main()
        mock_threading.Thread.assert_called_once()
        assert mock_threading.Thread.call_args.kwargs.get("daemon") is True


class TestCustomArgs:
    def test_custom_port(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--port", "9000"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading"),
        ):
            main()
        _, kwargs = uv.run.call_args
        assert kwargs["port"] == 9000

    def test_custom_host(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--host", "0.0.0.0"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading"),
        ):
            main()
        _, kwargs = uv.run.call_args
        assert kwargs["host"] == "0.0.0.0"

    def test_no_browser_skips_thread(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading") as mock_threading,
        ):
            main()
        mock_threading.Thread.assert_not_called()

    def test_reload_passed_to_uvicorn(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--reload"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
            patch("agentsuitelocal.cli.threading"),
        ):
            main()
        _, kwargs = uv.run.call_args
        assert kwargs["reload"] is True


class TestEnabledAgents:
    def test_cli_main_primes_enabled_agents_env(self, monkeypatch):
        """cli.main() must set AGENTSUITE_ENABLED_AGENTS to all seven agents."""
        monkeypatch.delenv("AGENTSUITE_ENABLED_AGENTS", raising=False)
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
        ):
            main()
        val = os.environ.get("AGENTSUITE_ENABLED_AGENTS", "")
        for agent in ("founder", "design", "product", "engineering", "marketing", "trust_risk", "cio"):
            assert agent in val, f"'{agent}' missing from AGENTSUITE_ENABLED_AGENTS={val!r}"

    def test_does_not_override_operator_env(self, monkeypatch):
        """cli.main() must not overwrite an operator-set AGENTSUITE_ENABLED_AGENTS."""
        monkeypatch.setenv("AGENTSUITE_ENABLED_AGENTS", "founder,design")
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
        ):
            main()
        assert os.environ["AGENTSUITE_ENABLED_AGENTS"] == "founder,design"


class TestUvicornMissing:
    def test_exits_1_when_uvicorn_not_importable(self):
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": None}),
            pytest.raises(SystemExit) as exc_info,
        ):
            main()
        assert exc_info.value.code == 1


class TestUrlConstruction:
    def test_url_printed_to_stdout(self, capsys):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--host", "127.0.0.1", "--port", "9999", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
        ):
            main()
        captured = capsys.readouterr()
        assert "http://127.0.0.1:9999" in captured.out

    def test_uvicorn_receives_app_string(self):
        uv = _mock_uvicorn()
        with (
            patch.object(sys, "argv", ["agentsuitelocal", "--no-browser"]),
            patch.dict(sys.modules, {"uvicorn": uv}),
        ):
            main()
        args, _ = uv.run.call_args
        assert args[0] == "agentsuitelocal.api.main:app"
