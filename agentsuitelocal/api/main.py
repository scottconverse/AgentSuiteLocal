"""
AgentSuiteLocal — FastAPI backend entry point.

App wiring only: creates the FastAPI instance, attaches middleware, includes
all domain routers, and mounts the static frontend. Business logic lives in
the routers/ package and supporting modules (state, config, schemas, etc.).
"""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from agentsuitelocal.__version__ import __version__
from agentsuitelocal.api.config import _write_crash_report
from agentsuitelocal.api.routers import (
    health,
    kernel,
    ollama,
    pipelines,
    projects,
    runs,
    settings,
    system,
    uninstall,
)

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="AgentSuiteLocal", version=__version__)

app.add_middleware(
    CORSMiddleware,
    # A-2: Restricted to the Vite dev server and the production backend port.
    allow_origins=["http://localhost:5173", "http://localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handler (F4)
# ---------------------------------------------------------------------------


@app.middleware("http")
async def crash_reporting_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        _write_crash_report(exc, request.url.path)
        raise


# ---------------------------------------------------------------------------
# Domain routers
# ---------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(settings.router)
app.include_router(ollama.router)
app.include_router(system.router)
app.include_router(runs.router)
app.include_router(pipelines.router)
app.include_router(kernel.router)
app.include_router(projects.router)
app.include_router(uninstall.router)

# ---------------------------------------------------------------------------
# Serve built frontend (production)
# ---------------------------------------------------------------------------


def _find_web_dist() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "web" / "dist"
    return Path(__file__).parent.parent.parent / "web" / "dist"


_WEB_DIST = _find_web_dist()

if _WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        index = _WEB_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
