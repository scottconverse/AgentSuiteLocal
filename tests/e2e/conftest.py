"""
Playwright E2E fixtures.

J3: Backend is started via subprocess (uvicorn in-process). The backend port is:
  1. Read from BASE_URL env var (set by CI).
  2. Derived from ~/.agentsuitelocal/launcher.log (A5 protocol).
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


def _read_launcher_port() -> int:
    """A5: Read the bound port from launcher.log, falling back to 8766."""
    log = pathlib.Path.home() / ".agentsuitelocal" / "launcher.log"
    if log.exists():
        try:
            return int(log.read_text().strip())
        except ValueError:
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
