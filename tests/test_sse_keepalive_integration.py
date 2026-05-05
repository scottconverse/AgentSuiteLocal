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
from sse_starlette.sse import EventSourceResponse

# Build a minimal app that emits a long-running SSE stream interleaved with
# legitimate data events. We force sse-starlette to emit pings by configuring
# a 1-second ping interval (default is 15s — too slow for a unit test).
_app = FastAPI()


@_app.get("/slow-stream")
async def slow_stream():
    async def gen():
        for i in range(5):
            yield {"data": json.dumps({"status": "tick", "i": i})}
            await asyncio.sleep(1.2)  # > ping_interval, forces a keepalive
        yield {"data": json.dumps({"status": "success"})}
    return EventSourceResponse(gen(), ping=1)


def _start_server(port: int):
    config = uvicorn.Config(_app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    server.run()


@pytest.fixture(scope="module")
def live_port():
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    thread = threading.Thread(target=_start_server, args=(port,), daemon=True)
    thread.start()
    # Wait for bind
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        try:
            httpx.get(f"http://127.0.0.1:{port}/slow-stream", timeout=0.2)
            break
        except Exception:
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
    saw_success = False
    with httpx.stream("GET", f"http://127.0.0.1:{live_port}/slow-stream", timeout=20) as r:
        for line in r.iter_lines():
            if line.startswith(":"):
                saw_ping = True
            elif line.startswith("data: "):
                payload = line[6:]
                evt = json.loads(payload)
                saw_data = True
                if evt.get("status") == "success":
                    saw_success = True
                    break
    assert saw_data, "real sse-starlette stream must yield data: lines"
    assert saw_ping, (
        "Expected sse-starlette to emit a `: ping` keepalive comment during a "
        "long stream. If this assertion fails, either sse-starlette changed "
        "its framing or ping interval, OR the network was fast enough that no "
        "ping fired — re-run; if still failing, audit the parser assumptions."
    )
    assert saw_success, "stream must terminate with the success event"
