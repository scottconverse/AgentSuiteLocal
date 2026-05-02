"""
Session-scoped fixtures shared across integration and live Ollama tests.

A single uvicorn server starts once per pytest session, preventing the
asyncio loop rebinding issue that causes failures when both test_integration.py
and test_ollama_live.py run together.

Root cause (Python 3.14): sse_starlette uses a global AppStatus.should_exit_event
(anyio.Event) that binds to the first event loop that initializes it. When
TestClient (in test_api.py) triggers an SSE endpoint before the uvicorn server
starts, the Event binds to TestClient's internal loop. Uvicorn then creates its
own loop in a thread; the SSE generator awaits the stale Event → RuntimeError.

Fix: reset AppStatus.should_exit_event = None in an autouse session fixture that
runs before any uvicorn server is started. Uvicorn re-initializes the event on
its own loop when it first handles an SSE request.
"""

from __future__ import annotations

import socket
import threading
import time

import pytest
import uvicorn
from sse_starlette.sse import AppStatus

from agentsuitelocal.api.main import app


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def live_server():
    """Start one real uvicorn server for the whole pytest session.

    Reset AppStatus here (not in a session-start autouse fixture) so the reset
    happens just before uvicorn starts, after any TestClient SSE tests in
    test_api.py that may have re-bound AppStatus.should_exit_event to their
    own internal event loop.
    """
    AppStatus.should_exit = False
    AppStatus.should_exit_event = None

    port = _free_port()
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                break
        except OSError:
            time.sleep(0.05)
    else:
        raise RuntimeError("Server did not start within 5 seconds")

    yield f"http://127.0.0.1:{port}"

    server.should_exit = True
    thread.join(timeout=3)
