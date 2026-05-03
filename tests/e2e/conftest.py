"""
Playwright E2E fixtures.

BASE_URL defaults to http://localhost:5175 (Vite dev server default when 5173
is already taken). In CI, BASE_URL=http://localhost:8765 — the e2e job builds
the frontend and serves it via FastAPI on :8765, not the Vite dev server.
See .github/workflows/ci.yml.
"""

import os
import socket
import threading
import time

import pytest
import uvicorn

from agentsuitelocal.api.main import app


@pytest.fixture(scope="session", autouse=True)
def backend_server():
    """Start FastAPI backend on 8766 so Vite proxy /api/* calls work.

    Skips startup if something is already listening on 8766 (e.g. a dev
    backend started manually before running the suite).
    """
    already_up = False
    try:
        with socket.create_connection(("127.0.0.1", 8766), timeout=0.5):
            already_up = True
    except OSError:
        pass

    server = None
    thread = None
    if not already_up:
        config = uvicorn.Config(app, host="127.0.0.1", port=8766, log_level="error")
        server = uvicorn.Server(config)
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                with socket.create_connection(("127.0.0.1", 8766), timeout=0.1):
                    break
            except OSError:
                time.sleep(0.05)

    yield

    if server is not None:
        server.should_exit = True
    if thread is not None:
        thread.join(timeout=3)


@pytest.fixture(scope="session")
def base_url() -> str:
    return os.environ.get("BASE_URL", "http://localhost:5175")
