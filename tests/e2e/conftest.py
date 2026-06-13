"""
Playwright E2E fixtures.

Backend is started in-process. The test port is:
  1. Read from BASE_URL when explicitly provided.
  2. Otherwise 8766 for local dev.

Do not read ~/.agentsuitelocal/launcher.port.json here. That file belongs to
the installed launcher and can point repo tests at a stale or unrelated backend.
"""

from __future__ import annotations

import os
import socket
import threading
import time

import pytest
import uvicorn

from agentsuitelocal.api.main import app

# Mock-factory env vars are set only for the e2e session, then restored.
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


def _test_port() -> int:
    raw_base_url = os.environ.get("BASE_URL")
    if raw_base_url:
        try:
            return int(raw_base_url.rsplit(":", 1)[1].rstrip("/"))
        except (IndexError, ValueError):
            pass
    return 8766


@pytest.fixture(scope="session", autouse=True)
def backend_server():
    """Start FastAPI backend automatically so E2E suite needs no manual startup."""
    port = _test_port()
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
    port = _test_port()
    default = f"http://localhost:{port}"
    return os.environ.get("BASE_URL", default)
