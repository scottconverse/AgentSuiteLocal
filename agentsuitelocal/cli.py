"""
CLI entry point for AgentSuiteLocal.

Usage:
    agentsuitelocal                   # starts on :8765, opens browser
    agentsuitelocal --port 9000
    agentsuitelocal --no-browser
    agentsuitelocal --reload          # dev mode
"""

from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import webbrowser


def main() -> None:
    os.environ.setdefault(
        "AGENTSUITE_ENABLED_AGENTS",
        "founder,design,product,engineering,marketing,trust_risk,cio",
    )
    parser = argparse.ArgumentParser(
        prog="agentsuitelocal",
        description="AgentSuiteLocal — local AI workspace for non-technical founders",
    )
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="Bind port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Don't open browser on start")
    parser.add_argument("--reload", action="store_true", help="Auto-reload on code changes (dev)")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}"

    print(f"AgentSuiteLocal  →  {url}")
    print("Press Ctrl+C to stop.\n")

    if not args.no_browser:
        def _open_browser():
            time.sleep(1.5)
            webbrowser.open(url)

        threading.Thread(target=_open_browser, daemon=True).start()

    try:
        import uvicorn
    except ImportError:
        print("uvicorn not found. Run: pip install agentsuitelocal", file=sys.stderr)
        sys.exit(1)

    uvicorn.run(
        "agentsuitelocal.api.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
