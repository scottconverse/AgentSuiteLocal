"""Uninstall flow endpoints."""

from __future__ import annotations

import asyncio
import base64
import os
import subprocess
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException

from agentsuitelocal.api.schemas import UninstallPhase2Request, UninstallPhase3Request
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()
_LAUNCHER_PORT_FILE = Path.home() / ".agentsuitelocal" / "launcher.port.json"


def _windows_uninstaller_candidates() -> list[Path]:
    candidates = [
        Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "AgentSuiteLocal" / "unins000.exe",
        Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "AgentSuiteLocal" / "unins000.exe",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "AgentSuiteLocal" / "unins000.exe",
    ]
    try:
        candidates.append(Path(sys.executable).parent / "unins000.exe")
    except Exception:
        pass
    return candidates


def _shell_execute_runas(file: str, parameters: str, show: int = 1) -> int:
    import ctypes

    return int(ctypes.windll.shell32.ShellExecuteW(None, "runas", file, parameters, None, show))


def _launch_visible_windows_uninstaller(uninstaller: Path) -> bool:
    """Run Inno uninstall in a visible elevated progress window."""
    uninstaller_path = str(uninstaller).replace("'", "''")
    install_dir = str(uninstaller.parent).replace("'", "''")
    log_path = str(Path(os.environ.get("TEMP", ".")) / "AgentSuiteLocal-uninstall.log").replace("'", "''")
    script = f"""
$ErrorActionPreference = 'Continue'
$Host.UI.RawUI.WindowTitle = 'AgentSuiteLocal uninstall progress'
$uninstaller = '{uninstaller_path}'
$installDir = '{install_dir}'
$log = '{log_path}'
Write-Host ''
Write-Host 'AgentSuiteLocal uninstall is starting...'
Write-Host 'A progress indicator will stay visible until removal is done.'
Write-Host ''
Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Status 'Starting Windows uninstaller...' -PercentComplete 5
try {{
  $args = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=$log")
  $proc = Start-Process -FilePath $uninstaller -ArgumentList $args -PassThru -WindowStyle Hidden
  $tick = 0
  while (-not $proc.HasExited) {{
    $tick += 1
    $pct = [Math]::Min(90, 10 + ($tick * 3))
    Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Status 'Stopping app and removing files...' -PercentComplete $pct
    Start-Sleep -Seconds 1
    $proc.Refresh()
  }}
  Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Status 'Verifying cleanup...' -PercentComplete 95
  Start-Sleep -Seconds 2
  $running = @(Get-Process -Name AgentSuiteLocal -ErrorAction SilentlyContinue)
  $remainingFiles = @()
  if (Test-Path $installDir) {{
    $remainingFiles = @(Get-ChildItem -LiteralPath $installDir -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {{ -not $_.PSIsContainer }})
  }}
  if ($proc.ExitCode -eq 0 -and $running.Count -eq 0 -and $remainingFiles.Count -eq 0) {{
    Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Completed
    Write-Host ''
    Write-Host 'Done: AgentSuiteLocal was removed.' -ForegroundColor Green
    Write-Host "Log: $log"
  }} else {{
    Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Completed
    Write-Host ''
    Write-Host 'Uninstall needs attention.' -ForegroundColor Yellow
    Write-Host "Exit code: $($proc.ExitCode)"
    Write-Host "Running AgentSuiteLocal processes: $($running.Count)"
    Write-Host "Remaining files in install folder: $($remainingFiles.Count)"
    Write-Host "Log: $log"
  }}
}} catch {{
  Write-Progress -Activity 'Uninstalling AgentSuiteLocal' -Completed
  Write-Host ''
  Write-Host 'Uninstall failed to start.' -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "Log: $log"
}}
Write-Host ''
Write-Host 'You can close this window.'
"""
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    rc = _shell_execute_runas(
        "powershell.exe",
        f"-NoProfile -ExecutionPolicy Bypass -NoExit -EncodedCommand {encoded}",
        show=1,
    )
    return rc > 32


def _launch_broken_windows_install_cleanup() -> bool:
    """Last-resort cleanup for malformed installs that have no unins000.exe."""
    install_dir = Path(sys.executable).resolve().parent
    if install_dir.name != "AgentSuiteLocal" or not install_dir.exists():
        return False

    install_path = str(install_dir).replace("'", "''")
    script = f"""
$ErrorActionPreference = 'SilentlyContinue'
Write-Host 'AgentSuiteLocal cleanup is running...'
Write-Host 'Stopping AgentSuiteLocal...'
Get-Process -Name AgentSuiteLocal -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Write-Host 'Removing application files...'
Remove-Item -LiteralPath '{install_path}' -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'Removing shortcuts and startup entry...'
Remove-Item -LiteralPath "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\AgentSuiteLocal" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$env:PUBLIC\\Desktop\\AgentSuiteLocal.lnk" -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "$env:USERPROFILE\\Desktop\\AgentSuiteLocal.lnk" -Force -ErrorAction SilentlyContinue
Remove-ItemProperty -Path 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'AgentSuiteLocal' -ErrorAction SilentlyContinue
Write-Host ''
Write-Host 'Cleanup finished. You can close this window.'
"""
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    rc = _shell_execute_runas(
        "powershell.exe",
        f"-NoProfile -ExecutionPolicy Bypass -NoExit -EncodedCommand {encoded}",
        show=1,
    )
    return rc > 32


@router.get("/api/uninstall/workspace-info")
async def uninstall_workspace_info():
    """Return workspace/config size for uninstall confirmation."""
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
    """Optionally delete local workspace/config data."""
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
    """Optionally delete the Ollama model, then open the OS uninstaller visibly."""
    if body.delete_model and body.model_name:
        try:
            no_window = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
            await asyncio.to_thread(
                subprocess.run,
                ["ollama", "rm", body.model_name],
                capture_output=True,
                timeout=30,
                creationflags=no_window,
            )
        except Exception:
            pass

    if sys.platform == "win32":
        inno_uninst = next((p for p in _windows_uninstaller_candidates() if p.exists()), None)
        if inno_uninst is not None:
            try:
                if not _launch_visible_windows_uninstaller(inno_uninst):
                    raise RuntimeError("Could not open the visible uninstall progress window")
            except Exception as exc:
                try:
                    subprocess.Popen([str(inno_uninst), "/NORESTART"])
                except Exception as fallback_exc:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not open the Windows uninstaller: {fallback_exc}",
                    ) from exc
            return {
                "uninstaller_launched": True,
                "progress_window_launched": True,
                "path": str(inno_uninst),
                "message": "A visible uninstall progress window was opened.",
            }

        if _launch_broken_windows_install_cleanup():
            return {
                "fallback_cleanup_launched": True,
                "message": "No Windows uninstaller was found, so a repair cleanup PowerShell window was opened.",
            }

        raise HTTPException(
            status_code=404,
            detail="Could not find the Windows uninstaller for AgentSuiteLocal.",
        )

    return {
        "uninstaller_launched": False,
        "message": "Automatic app removal is only available from the Windows installer build.",
    }


@router.post("/api/uninstall")
async def uninstall_hook():
    """Called by Inno Setup to gracefully stop the backend during uninstall."""
    _LAUNCHER_PORT_FILE.unlink(missing_ok=True)

    async def _shutdown():
        await asyncio.sleep(1.0)
        if sys.platform == "win32":
            os._exit(0)
        else:
            os.kill(os.getpid(), 15)

    asyncio.create_task(_shutdown())
    return {"message": "Shutting down"}
