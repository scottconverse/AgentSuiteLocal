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

# TEST2-001 fix: mock-factory env var must be set BEFORE the backend module
# is imported, otherwise _resolve_llm closes over an unset value at import
# time. Conftest is the earliest hook that runs before the test module body,
# so set it here. Tests that don't need the mock just don't reference it.
# E402 noqa intentional — the import order is the fix; reordering breaks it.
os.environ.setdefault(
    "AGENTSUITE_LLM_PROVIDER_FACTORY",
    "tests.e2e.test_new_run:_mock_provider_factory",
)
os.environ.setdefault("AGENTSUITE_ALLOW_MOCK_FACTORY", "1")

import pytest  # noqa: E402
import uvicorn  # noqa: E402

from agentsuitelocal.api.main import app  # noqa: E402


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
