"""
AgentSuiteLocal launcher — entry point for the frozen distributable.

Starts uvicorn in a background thread (no subprocess, no terminal window),
polls until the server is ready, then opens the app in the user's default browser.
The process stays alive until the user closes it (Ctrl-C on the CLI, or
the OS kills the process when the user closes the app).

PyInstaller uses this file as the script target.  The --windowed flag in the
.spec suppresses the console on Windows so the user never sees a terminal.
"""

from __future__ import annotations

import socket
import sys
import threading
import time
import webbrowser

HOST = "127.0.0.1"
PORT = 8765
URL = f"http://{HOST}:{PORT}"


def _find_free_port(preferred: int) -> int:
    """Return preferred port if free, else let the OS pick one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((HOST, preferred))
            return preferred
        except OSError:
            s.bind((HOST, 0))
            return s.getsockname()[1]


def _wait_for_server(host: str, port: int, timeout: float = 15.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.2):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def _log(msg: str) -> None:
    import os
    log_path = os.path.join(os.path.expanduser("~"), ".agentsuitelocal", "launcher.log")
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a") as f:
        f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")


def _start_server(port: int) -> None:
    import traceback
    import uvicorn
    try:
        from agentsuitelocal.api.main import app
        _log(f"app imported ok, starting uvicorn on port {port}")
        # log_config=None disables uvicorn's logging setup entirely; required
        # in windowed (no-console) mode where sys.stdout is None and the
        # default formatter crashes trying to call stream.isatty().
        config = uvicorn.Config(
            app,
            host=HOST,
            port=port,
            log_config=None,
        )
        server = uvicorn.Server(config)
        server.run()
        _log("uvicorn exited normally")
    except Exception as e:
        _log(f"_start_server CRASHED: {e}\n{traceback.format_exc()}")


def main() -> None:
    _log("launcher main() starting")
    port = _find_free_port(PORT)
    _log(f"using port {port}")
    url = f"http://{HOST}:{port}"

    thread = threading.Thread(target=_start_server, args=(port,), daemon=True)
    thread.start()

    ready = _wait_for_server(HOST, port, timeout=15.0)
    if not ready:
        _log(f"server failed to start on port {port} (timeout)")
        print(f"AgentSuiteLocal failed to start on port {port}.", file=sys.stderr)
        sys.exit(1)

    _log(f"server ready on port {port}, opening browser")
    webbrowser.open(url)

    # Keep the main thread alive; daemon thread dies when main exits.
    try:
        thread.join()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
