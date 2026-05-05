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
            # CREATE_NO_WINDOW so the brief Ollama CLI invocation doesn't
            # flash a console window during uninstall (Windows --windowed
            # bundle has no parent console).
            _no_window = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            await asyncio.to_thread(
                subprocess.run,
                ["ollama", "rm", body.model_name],
                capture_output=True,
                timeout=30,
                creationflags=_no_window,
            )
        except Exception:
            pass
    if sys.platform == "win32":
        # Hardened path discovery — round-1 audit hit users whose Inno install
        # landed in (x86), per-user AppData, or a custom dir. Try several known
        # locations before giving up.
        candidates = [
            Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "AgentSuiteLocal" / "unins000.exe",
            Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "AgentSuiteLocal" / "unins000.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "AgentSuiteLocal" / "unins000.exe",
        ]
        # Also check the dir of our running .exe — covers the case where the
        # PyInstaller bundle was installed alongside unins000.exe by Inno.
        try:
            candidates.append(Path(sys.executable).parent / "unins000.exe")
        except Exception:
            pass
        inno_uninst = next((p for p in candidates if p.exists()), None)
        if inno_uninst is not None:
            # CREATE_NO_WINDOW so the brief Inno bootstrap doesn't flicker a
            # console window. /VERYSILENT and /SUPPRESSMSGBOXES are honored.
            subprocess.Popen(
                [str(inno_uninst), "/VERYSILENT", "/SUPPRESSMSGBOXES"],
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
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
