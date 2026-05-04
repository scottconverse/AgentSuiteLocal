"""Uninstall flow endpoints (A6)."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter

from agentsuitelocal.api.schemas import UninstallPhase2Request, UninstallPhase3Request
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()


@router.get("/api/uninstall/workspace-info")
async def uninstall_workspace_info():
    """A6 Phase 2: Return workspace size for uninstall confirmation."""
    workspace = _workspace()
    agentsuite_dir = workspace / ".agentsuite"
    agentsuitelocal_dir = Path.home() / ".agentsuitelocal"

    def _dir_size(p: Path) -> int:
        if not p.exists():
            return 0
        return sum(f.stat().st_size for f in p.rglob("*") if f.is_file())

    return {
        "workspace_path": str(agentsuite_dir),
        "workspace_size_bytes": _dir_size(agentsuite_dir),
        "config_path": str(agentsuitelocal_dir),
        "config_size_bytes": _dir_size(agentsuitelocal_dir),
    }


@router.post("/api/uninstall/phase2")
async def uninstall_phase2(body: UninstallPhase2Request):
    """A6 Phase 2: Optionally delete workspace data."""
    import shutil
    workspace = _workspace()
    agentsuite_dir = workspace / ".agentsuite"
    agentsuitelocal_dir = Path.home() / ".agentsuitelocal"

    if body.delete_workspace:
        if agentsuite_dir.exists():
            shutil.rmtree(agentsuite_dir, ignore_errors=True)
        if agentsuitelocal_dir.exists():
            shutil.rmtree(agentsuitelocal_dir, ignore_errors=True)
    return {"deleted": body.delete_workspace}


@router.post("/api/uninstall/phase3")
async def uninstall_phase3(body: UninstallPhase3Request):
    """A6 Phase 3: Optionally delete the Ollama model."""
    if body.delete_model and body.model_name:
        try:
            await asyncio.to_thread(
                subprocess.run,
                ["ollama", "rm", body.model_name],
                capture_output=True,
                timeout=30,
            )
        except Exception:
            pass
    if sys.platform == "win32":
        inno_uninst = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "AgentSuiteLocal" / "unins000.exe"
        if inno_uninst.exists():
            subprocess.Popen([str(inno_uninst), "/VERYSILENT", "/SUPPRESSMSGBOXES"])
    return {"uninstall_complete": True}


@router.post("/api/uninstall")
async def uninstall_hook():
    """A6 / I1: Called by Inno Setup [UninstallRun] to gracefully stop the backend."""
    async def _shutdown():
        await asyncio.sleep(1.0)
        # M-4: On Windows, SIGTERM sent to self is a no-op. Use os._exit(0) instead.
        if sys.platform == "win32":
            os._exit(0)
        else:
            os.kill(os.getpid(), 15)  # SIGTERM — uvicorn handles graceful shutdown on POSIX

    asyncio.create_task(_shutdown())
    return {"message": "Shutting down"}
