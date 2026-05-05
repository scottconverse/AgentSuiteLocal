"""Path validation, open-folder, crash reports, and launcher port endpoints."""

from __future__ import annotations

import json
import platform
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException

from agentsuitelocal.api.config import _CRASH_DIR, _read_launcher_port
from agentsuitelocal.api.schemas import OpenFolderRequest, PathValidateRequest, _validate_inputs_dir
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()


@router.post("/api/validate-path")
async def validate_path(body: PathValidateRequest):
    """Validate an inputs directory path inline (B6)."""
    try:
        _validate_inputs_dir(body.path)
        return {"valid": True, "reason": ""}
    except ValueError as exc:
        return {"valid": False, "reason": str(exc)}


@router.post("/api/open-folder")
async def open_folder(body: OpenFolderRequest):
    """Open a local folder in the OS file manager."""
    import re as _re

    if platform.system() != "Windows" and _re.match(r"^[A-Za-z]:\\", body.path):
        raise HTTPException(status_code=403, detail="Path outside allowed area")

    p = Path(body.path).resolve()
    home = Path.home().resolve()
    ws = _workspace().resolve()
    if not (p.is_relative_to(home) or p.is_relative_to(ws)):
        raise HTTPException(status_code=403, detail="Path outside allowed area")
    if not p.exists():
        raise HTTPException(status_code=404, detail="Path does not exist")
    try:
        system = platform.system()
        if system == "Windows":
            subprocess.Popen(["explorer", str(p)], creationflags=subprocess.CREATE_NO_WINDOW)
        elif system == "Darwin":
            subprocess.Popen(["open", str(p)])
        else:
            subprocess.Popen(["xdg-open", str(p)])
        return {"opened": str(p)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


_ALLOWED_OPEN_APPS = {"Ollama"}


@router.post("/api/system/open-app")
async def open_app(body: dict):
    """QA-002: Launch a known external app (Ollama) so Mac users without
    Terminal access can start the daemon from inside the installer.

    The allowlist is intentional — this endpoint never executes arbitrary
    user input. Anything outside _ALLOWED_OPEN_APPS is rejected.
    """
    app_name = body.get("app", "").strip()
    if app_name not in _ALLOWED_OPEN_APPS:
        raise HTTPException(status_code=400, detail=f"App '{app_name}' is not in the open-app allowlist")
    system = platform.system()
    try:
        if system == "Darwin":
            subprocess.Popen(["open", "-a", app_name])
        elif system == "Windows":
            # On Windows the Ollama installer registers a Start-menu entry;
            # `start` resolves it via the App Path lookup.
            subprocess.Popen(["cmd", "/c", "start", "", app_name],
                             creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            # Linux — try a desktop launcher; not commonly needed.
            subprocess.Popen([app_name.lower()])
        return {"launched": app_name}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"{app_name} is not installed")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/crash-reports/latest")
async def latest_crash_report():
    """F4: Return the most recent crash report if any exist."""
    if not _CRASH_DIR.exists():
        return {"has_report": False}
    reports = sorted(_CRASH_DIR.glob("*.json"), reverse=True)
    if not reports:
        return {"has_report": False}
    latest = reports[0]
    try:
        data = json.loads(latest.read_text())
        return {"has_report": True, "report": data, "path": str(latest)}
    except Exception:
        return {"has_report": False}


@router.get("/api/launcher/port")
async def get_launcher_port():
    """A5: Return the actual bound port (from launcher.log)."""
    port = _read_launcher_port()
    return {"port": port}
