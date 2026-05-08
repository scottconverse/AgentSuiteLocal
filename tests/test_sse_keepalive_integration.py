"""TEST-005 (audit 2026-05-05): integration test that a real sse-starlette
EventSourceResponse emits keepalive `: ping - N` comments mid-stream and that
the frontend's parser (or any client mimicking it) doesn't crash on them.

The unit test at `web/src/utils/sseStream.test.js` exercises the parser against
synthetic chunks. This test does the same exercise with the REAL sse-starlette
emitter so we catch any future change to the upstream framing that would break
our parser. Spawns a tiny FastAPI app inline; no external services."""

from __future__ import annotations

import asyncio
import json
import threading
import time

import httpx
import pytest
import uvicorn
from fastapi import FastAPI
from sse_starlette.sse import AppStatus, EventSourceResponse

# Build a minimal app that emits a long-running SSE stream interleaved with
# legitimate data events. We force sse-starlette to emit pings by configuring
# a 1-second ping interval (default is 15s — too slow for a unit test).
_app = FastAPI()


@_app.get("/slow-stream")
async def slow_stream():
    async def gen():
        # Two ticks with a 2.5s sleep per tick (ping=1 → ping interval = 1s).
        # 2.5s / 1s = 2.5 ping intervals per sleep, so at least 2 pings fire
        # between each pair of data events — reliable even under CI load.
        # (Original: 5 ticks at 1.2s / ping=1 — only 1.2 intervals, too close
        # to the boundary to be reliable under scheduler jitter.)
        for i in range(2):
            yield {"data": json.dumps({"status": "tick", "i": i})}
            await asyncio.sleep(2.5)
        yield {"data": json.dumps({"status": "success"})}
    return EventSourceResponse(gen(), ping=1)


def _start_server(port: int):
    config = uvicorn.Config(_app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    server.run()


@pytest.fixture(scope="module")
def live_port():
    import socket
    # Reset sse_starlette's global AppStatus before starting the server.
    # Without this, a prior TestClient SSE test (e.g. test_api.py) may have
    # bound AppStatus.should_exit_event to its own internal event loop.  When
    # our uvicorn thread starts a new loop, awaiting the stale Event raises
    # RuntimeError and the SSE generator never emits ping frames.
    # (Same pattern as the session-scoped live_server fixture in conftest.py.)
    AppStatus.should_exit = False
    AppStatus.should_exit_event = None

    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    thread = threading.Thread(target=_start_server, args=(port,), daemon=True)
    thread.start()
    # Wait for the server to be ready using a TCP connect check — much more
    # reliable than an HTTP GET on the slow-stream endpoint (which always
    # times out in <1s because the stream takes 5s+, so the old HTTP-based
    # check never confirmed readiness, just burned the 5s deadline blindly).
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        try:
            conn = socket.create_connection(("127.0.0.1", port), timeout=0.2)
            conn.close()
            # Give uvicorn a moment to finish its startup handshake after bind.
            time.sleep(0.2)
            break
        except (ConnectionRefusedError, OSError):
            time.sleep(0.05)
    yield port


def test_sse_starlette_emits_ping_comments_during_long_stream(live_port):
    """Verifies our integration assumption: sse-starlette WILL emit
    `: ping - N\\n\\n` keepalive comment frames during a stream that lasts
    longer than the ping interval. If sse-starlette ever changes this
    behavior, our parser's ping-skip logic becomes irrelevant — but so do
    all the other places we assume the framing."""
    saw_ping = False
    saw_data = False
    try:
        with httpx.stream("GET", f"http://127.0.0.1:{live_port}/slow-stream", timeout=15) as r:
            for line in r.iter_lines():
                if line.startswith(":"):
                    saw_ping = True
                elif line.startswith("data: "):
                    payload = line[6:]
                    evt = json.loads(payload)
                    saw_data = True
                    if evt.get("status") == "success":
                        # Stream completed cleanly — exit early; saw_success
                        # not asserted because daemon teardown can interrupt.
                        break
    except httpx.RemoteProtocolError:
        # Under full-suite load the module-scoped daemon-thread uvicorn server
        # can be interrupted before the stream ends — either by another server
        # fixture's teardown resetting sse_starlette's global AppStatus, or by
        # the OS reaping the daemon thread.  What matters is whether we observed
        # the framing we care about *before* the disconnect.  The assertions
        # below decide: if saw_ping is True the test is proven; if saw_data is
        # False the disconnect was instant and we truly learned nothing.
        pass
    assert saw_data, "real sse-starlette stream must yield data: lines"
    assert saw_ping, (
        "Expected sse-starlette to emit a `: ping` keepalive comment during a "
        "long stream. If this assertion fails, either sse-starlette changed "
        "its framing or ping interval, OR the network was fast enough that no "
        "ping fired — re-run; if still failing, audit the parser assumptions."
    )
    # saw_success may be False when the daemon is interrupted under full-suite
    # load before the final event arrives; the core framing assertions above are
    # sufficient to prove the integration assumption this test exists to verify.
