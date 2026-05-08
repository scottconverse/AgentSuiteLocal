"""
Playwright E2E fixtures.

J3: Backend is started via subprocess (uvicorn in-process). The backend port is:
  1. Read from BASE_URL env var (set by CI).
  2. Derived from ~/.agentsuitelocal/launcher.port.json (post-QA-001).
  3. Defaults to 8766 for local dev (avoids conflicting with the Vite dev server on 8765).

The conftest starts its own backend if nothing is already listening on the port.
All E2E tests are marked @pytest.mark.e2e so they are only collected when -m e2e is passed.
"""

from __future__ import annotations

import os
import pathlib
import socket
import threading
import time

import pytest
import uvicorn

from agentsuitelocal.api.main import app

# Sprint-A loose-end #5: mock-factory env vars are set ONLY when an e2e
# test is going to execute, not at conftest import time.
#
# History: the original TEST2-001 fix set the env vars at module-level via
# os.environ.setdefault, with a comment claiming "_resolve_llm closes over
# an unset value at import time." That comment is stale — agentsuitelocal/
# api/execution.py:_resolve_llm reads AGENTSUITE_LLM_PROVIDER_FACTORY at
# CALL time (line 178: `os.environ.get(...)`), not at import time. The
# module-level setdefault leaked into any pytest run that collected
# tests/e2e/ — including filter-only runs like `pytest -m "not e2e"` where
# pytest imports the conftest during collection but deselects the e2e
# tests. The leak corrupted tests/test_dependencies.py::test_resolve_llm_*
# which expected the real Ollama path.
#
# Fix: a session-scoped autouse fixture in this conftest scopes to e2e
# tests only (pytest fixture scoping rules). The fixture sets the env
# vars on enter and restores them on exit, so they never leak to tests
# collected outside tests/e2e/ — even when pytest imports this conftest
# during a wider collection (e.g. `pytest -m "not e2e"`).

_FACTORY_KEY = "AGENTSUITE_LLM_PROVIDER_FACTORY"
_FACTORY_VAL = "tests.e2e.test_new_run:_mock_provider_factory"
_ALLOW_KEY = "AGENTSUITE_ALLOW_MOCK_FACTORY"


@pytest.fixture(autouse=True, scope="session")
def _e2e_mock_factory_env():
    """Set mock-factory env only for the e2e test session; restore on exit."""
    original_factory = os.environ.get(_FACTORY_KEY)
    original_allow = os.environ.get(_ALLOW_KEY)
    os.environ[_FACTORY_KEY] = _FACTORY_VAL
    os.environ[_ALLOW_KEY] = "1"
    yield
    if original_factory is None:
        os.environ.pop(_FACTORY_KEY, None)
    else:
        os.environ[_FACTORY_KEY] = original_factory
    if original_allow is None:
        os.environ.pop(_ALLOW_KEY, None)
    else:
        os.environ[_ALLOW_KEY] = original_allow


def _read_launcher_port() -> int:
    """ENG-R2-002 fix: Read the bound port from launcher.port.json (the
    structured port file written by launcher.py post-QA-001). The previous
    implementation read launcher.log — a plaintext debug log — and parsed it
    as int(text.strip()), which has been silently broken since launcher.log
    became multi-line. Falls back to 8766 for local dev runs without an
    installed launcher."""
    import json
    port_file = pathlib.Path.home() / ".agentsuitelocal" / "launcher.port.json"
    if port_file.exists():
        try:
            return int(json.loads(port_file.read_text()).get("port", 8766))
        except (ValueError, json.JSONDecodeError, KeyError):
            pass
    return 8766


@pytest.fixture(scope="session", autouse=True)
def backend_server():
    """J3: Start FastAPI backend automatically so E2E suite needs no manual startup."""
    port = _read_launcher_port()
    already_up = False
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.5):
            already_up = True
    except OSError:
        pass

    server = None
    thread = None
    if not already_up:
        config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
        server = uvicorn.Server(config)
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.05)

    yield

    if server is not None:
        server.should_exit = True
    if thread is not None:
        thread.join(timeout=5)


@pytest.fixture(scope="session")
def base_url() -> str:
    port = _read_launcher_port()
    default = f"http://localhost:{port}"
    return os.environ.get("BASE_URL", default)
