"""
AgentSuiteLocal — FastAPI backend  (v0.7.0)
"""

from __future__ import annotations

import asyncio
import collections
import difflib
import json
import math
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import psutil
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from pydantic import BaseModel, Field, model_validator
from sse_starlette.sse import EventSourceResponse

from agentsuitelocal.__version__ import __version__

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="AgentSuiteLocal", version=__version__)

app.add_middleware(
    CORSMiddleware,
    # A-2: Restricted to the Vite dev server and the production backend port.
    # NOT "*" — any browser tab on the machine could otherwise call destructive
    # endpoints (delete runs, archive projects) without the user clicking anything
    # in our UI. The production build is served by FastAPI itself (same origin),
    # so no CORS is needed there; this list covers the Vite dev server only.
    allow_origins=["http://localhost:5173", "http://localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory stores + JSON sidecar persistence
# ---------------------------------------------------------------------------

_runs: dict[str, dict[str, Any]] = {}
_pipelines: dict[str, dict[str, Any]] = {}

_state_write_lock = threading.RLock()   # RLock: callers may hold lock before calling _save_state()
_settings_lock = threading.RLock()

_RUNS_FILE = Path.home() / ".agentsuitelocal" / "runs.json"
_PIPELINES_FILE = Path.home() / ".agentsuitelocal" / "pipelines.json"
_MAX_RUNS = 50

# B4: per-run SSE event buffer (last 100 events per run)
_run_event_buffers: dict[str, collections.deque] = {}
_SSE_BUFFER_SIZE = 100

# B3: per-run asyncio Tasks (for cancel)
_run_tasks: dict[str, asyncio.Task] = {}


def _load_state() -> None:
    """Populate _runs and _pipelines from disk on startup. F1: repair running runs."""
    for path, store in ((_RUNS_FILE, _runs), (_PIPELINES_FILE, _pipelines)):
        if path.exists():
            try:
                data = json.loads(path.read_text())
                for k, v in data.items():
                    # F1: Crash recovery — running → error with clear message
                    if v.get("status") == "running":
                        v["status"] = "error"
                        v["error"] = "AgentSuiteLocal restarted while this run was in progress."
                        v["error_message"] = v["error"]
                        v["finished_at"] = time.time()
                    # F2: Pipeline orphan repair — pipelines stuck running → error
                    if store is _pipelines and v.get("status") == "running":
                        v["status"] = "error"
                        v["error_message"] = "AgentSuiteLocal restarted during pipeline execution."
                        v["updated_at"] = time.time()
                        for step in v.get("steps", []):
                            if step.get("status") == "running":
                                step["status"] = "error"
                    # Migration: scrub any non-finite floats
                    if v.get("qa_dimensions"):
                        v["qa_dimensions"] = [
                            d for d in v["qa_dimensions"]
                            if isinstance(d.get("score"), (int, float)) and math.isfinite(float(d["score"]))
                        ]
                    store[k] = v
            except Exception:
                pass


def _save_state() -> None:
    """Persist _runs and _pipelines to disk. Evicts oldest runs beyond _MAX_RUNS."""
    with _state_write_lock:
        _RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)
        if len(_runs) > _MAX_RUNS:
            sorted_ids = sorted(_runs, key=lambda r: _runs[r].get("started_at", 0))
            for rid in sorted_ids[: len(_runs) - _MAX_RUNS]:
                del _runs[rid]
        _RUNS_FILE.write_text(json.dumps(_runs, indent=2, default=str))
        _PIPELINES_FILE.write_text(json.dumps(_pipelines, indent=2, default=str))


_load_state()

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

_SETTINGS_FILE = Path.home() / ".agentsuitelocal" / "settings.json"

# G1: model tier → concrete model name mapping
# Keys MUST match frontend data.js tier IDs: "light", "balanced", "pro"
_TIER_MODEL_MAP = {
    "light":     "gemma4:e2b",
    "balanced":  "gemma4:e4b",
    "pro":       "gemma4:26b-moe",
}

_SETTINGS_DEFAULTS: dict[str, Any] = {
    "model_tier": "balanced",
    "model_name": "gemma4:e4b",
    "open_on_launch": True,
    "telemetry": False,
    "enabled_agents": ["founder", "design", "product", "engineering", "marketing", "trust", "cio"],
    "api_key": None,
    "cloud_model": "claude-3-5-haiku-20241022",
    "notifications": True,
    "run_timeout_seconds": 900,    # B3: watchdog default 15 min
    "qa_gate_threshold": 7.0,      # C1: configurable QA gate
    "dismissed_update_version": None,  # H2: track dismissed update banner
}


def _load_settings() -> dict[str, Any]:
    if _SETTINGS_FILE.exists():
        try:
            stored = json.loads(_SETTINGS_FILE.read_text())
            return {**_SETTINGS_DEFAULTS, **stored}
        except Exception:
            pass
    return dict(_SETTINGS_DEFAULTS)


def _save_settings(data: dict[str, Any]) -> None:
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(json.dumps(data, indent=2))


# ---------------------------------------------------------------------------
# Telemetry (J4 — local only, no network calls)
# ---------------------------------------------------------------------------

_TELEMETRY_FILE = Path.home() / ".agentsuitelocal" / "usage.jsonl"


def _log_telemetry(event_type: str, **kwargs) -> None:
    """Append one JSONL event to the telemetry file when telemetry is enabled."""
    try:
        settings = _load_settings()
        if not settings.get("telemetry"):
            return
        entry = {
            "ts": datetime.now(UTC).isoformat(),
            "event": event_type,
            **kwargs,
        }
        _TELEMETRY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_TELEMETRY_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    except Exception:
        pass  # telemetry must never crash the app


# ---------------------------------------------------------------------------
# Crash reporting (F4)
# ---------------------------------------------------------------------------

_CRASH_DIR = Path.home() / ".agentsuitelocal" / "crash-reports"


def _write_crash_report(exc: Exception, request_path: str = "") -> Path | None:
    """Write a crash report JSON to the crash-reports directory."""
    try:
        _CRASH_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        report = {
            "timestamp": ts,
            "version": __version__,
            "python_version": sys.version,
            "os": platform.platform(),
            "exception_type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
            "request_path": request_path,
            # No request body — no user data in crash reports
        }
        path = _CRASH_DIR / f"{ts}-crash.json"
        path.write_text(json.dumps(report, indent=2))
        return path
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Launcher port (A5)
# ---------------------------------------------------------------------------

_LAUNCHER_LOG = Path.home() / ".agentsuitelocal" / "launcher.log"


def _write_launcher_log(port: int) -> None:
    try:
        _LAUNCHER_LOG.parent.mkdir(parents=True, exist_ok=True)
        _LAUNCHER_LOG.write_text(json.dumps({"port": port, "ts": time.time()}))
    except Exception:
        pass


def _read_launcher_port(default: int = 8765) -> int:
    try:
        if _LAUNCHER_LOG.exists():
            data = json.loads(_LAUNCHER_LOG.read_text())
            return int(data.get("port", default))
    except Exception:
        pass
    return default


# ---------------------------------------------------------------------------
# Notifications (H1 — Windows via winotify, macOS via pync/terminal-notifier)
# ---------------------------------------------------------------------------


def _send_notification(title: str, body: str, action_url: str | None = None) -> None:
    """Send a desktop notification. Best-effort — never crashes the app."""
    try:
        settings = _load_settings()
        if not settings.get("notifications", True):
            return

        system = platform.system()
        if system == "Windows":
            try:
                from winotify import Notification, audio
                toast = Notification(
                    app_id="AgentSuiteLocal",
                    title=title,
                    msg=body,
                )
                if action_url:
                    toast.add_actions(label="Review now", launch=action_url)
                toast.set_audio(audio.Default, loop=False)
                toast.show()
            except ImportError:
                pass  # winotify not installed — silent
        elif system == "Darwin":
            try:
                import pync
                pync.notify(body, title=title)
            except ImportError:
                try:
                    subprocess.Popen(
                        ["terminal-notifier", "-title", title, "-message", body],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                except Exception:
                    pass
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_inputs_dir(raw: str) -> None:
    """Reject inputs_dir values that escape the user's home directory."""
    if len(raw) > 512:
        raise ValueError("inputs_dir path is too long (max 512 characters)")
    p = Path(raw).resolve()
    home = Path.home().resolve()
    if not p.is_relative_to(home):
        raise ValueError("inputs_dir must be within your home directory")
    if not p.exists() or not p.is_dir():
        raise ValueError("inputs_dir must be an existing directory")


class RunRequest(BaseModel):
    agent_id: str
    goal: str = Field(max_length=2000)
    project: str
    inputs_dir: str | None = None
    constraints: str | None = None

    @model_validator(mode="after")
    def validate_slugs_and_paths(self) -> RunRequest:
        if not _SLUG_RE.match(self.project):
            raise ValueError("project must contain only letters, numbers, hyphens, and underscores")
        if not _SLUG_RE.match(self.agent_id):
            raise ValueError("agent_id must contain only letters, numbers, hyphens, and underscores")
        if self.inputs_dir is not None:
            _validate_inputs_dir(self.inputs_dir)
        return self


class ApproveRequest(BaseModel):
    approver: str = "user"


class SettingsPatch(BaseModel):
    model_tier: str | None = None
    model_name: str | None = None
    open_on_launch: bool | None = None
    telemetry: bool | None = None
    enabled_agents: list[str] | None = None
    api_key: str | None = None
    cloud_model: str | None = None
    notifications: bool | None = None
    run_timeout_seconds: int | None = None
    qa_gate_threshold: float | None = None
    dismissed_update_version: str | None = None


class PullRequest(BaseModel):
    model: str


class PipelineRequest(BaseModel):
    name: str = Field(max_length=200)
    project: str
    goal: str = Field(max_length=2000)
    agents: list[str] = Field(min_length=1)
    inputs_dir: str | None = None
    auto_approve: bool = False

    @model_validator(mode="after")
    def validate_slugs_and_paths(self) -> PipelineRequest:
        if not _SLUG_RE.match(self.project):
            raise ValueError("project must contain only letters, numbers, hyphens, and underscores")
        for agent_id in self.agents:
            if not _SLUG_RE.match(agent_id):
                raise ValueError(f"agent id {agent_id!r} must contain only letters, numbers, hyphens, and underscores")
        if self.inputs_dir is not None:
            _validate_inputs_dir(self.inputs_dir)
        return self


class PathValidateRequest(BaseModel):
    path: str


class OpenFolderRequest(BaseModel):
    path: str


class OverrideApproveRequest(BaseModel):
    approver: str = "user"
    override: bool = False


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
# Health + hardware
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    ollama_ok = False
    model_loaded = None
    latency_ms = None
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
        latency_ms = round((time.monotonic() - t0) * 1000)
        if r.status_code == 200:
            ollama_ok = True
            tags = r.json().get("models", [])
            if tags:
                model_loaded = tags[0]["name"]
    except Exception:
        pass
    return {
        "ollama": ollama_ok,
        "model": model_loaded,
        "latency_ms": latency_ms,
        "status": "healthy" if ollama_ok else "no_daemon",
        "version": __version__,
    }


@app.get("/api/hardware")
async def hardware():
    cpu_count = psutil.cpu_count(logical=False) or psutil.cpu_count()
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage(str(Path.home()))
    ram_gb = round(ram.total / 1024**3, 1)
    ram_free_gb = round(ram.available / 1024**3, 1)
    disk_free_gb = round(disk.free / 1024**3)
    disk_total_gb = round(disk.total / 1024**3)
    if ram_gb >= 32:
        tier = "pro"
    elif ram_gb >= 16:
        tier = "balanced"
    else:
        tier = "light"
    return {
        "cpu": {"cores": cpu_count, "brand": _cpu_brand()},
        "ram": {"total_gb": ram_gb, "free_gb": ram_free_gb},
        "disk": {"free_gb": disk_free_gb, "total_gb": disk_total_gb},
        "recommended_tier": tier,
    }


def _cpu_brand() -> str:
    try:
        uname = platform.uname()
        return f"{uname.processor or uname.machine} · {uname.system}"
    except Exception:
        return "Unknown CPU"


# ---------------------------------------------------------------------------
# Version / update check endpoint (H2)
# ---------------------------------------------------------------------------


@app.get("/api/version")
async def get_version():
    return {"version": __version__}


@app.get("/api/update/check")
async def check_update():
    """Check latest GitHub release. Returns {latest, current, has_update}."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                "https://api.github.com/repos/scottconverse/AgentSuiteLocal/releases/latest",
                headers={"User-Agent": f"AgentSuiteLocal/{__version__}"},
            )
        if r.status_code == 200:
            data = r.json()
            latest = data.get("tag_name", "").lstrip("v")
            has_update = latest != __version__ and bool(latest)
            return {
                "current": __version__,
                "latest": latest,
                "has_update": has_update,
                "release_url": data.get("html_url", ""),
            }
    except Exception:
        pass
    return {"current": __version__, "latest": __version__, "has_update": False, "release_url": ""}


# ---------------------------------------------------------------------------
# Settings endpoints
# ---------------------------------------------------------------------------


@app.get("/api/settings")
async def get_settings():
    data = _load_settings()
    if data.get("api_key"):
        data["api_key"] = "****"
    return data


async def _apply_settings_patch(body: SettingsPatch) -> dict:
    """Shared logic for POST and PATCH /api/settings."""
    with _settings_lock:
        current = _load_settings()
        patch = body.model_dump(exclude_unset=True)
        # A-8: Sentinel guard — GET /api/settings redacts the key as "****".
        # If a client reads, changes an unrelated field, and re-POSTs the full
        # object, the sentinel would silently overwrite the real key with "****".
        # Drop any sentinel value so it is never persisted.
        if patch.get("api_key") in ("****", "***", ""):
            patch.pop("api_key", None)
        # G1: when tier changes, derive model_name from tier map unless explicitly overridden
        if "model_tier" in patch and "model_name" not in patch:
            patch["model_name"] = _TIER_MODEL_MAP.get(patch["model_tier"], patch.get("model_name", current.get("model_name")))
        current.update(patch)
        _save_settings(current)
        result = dict(current)
        if result.get("api_key"):
            result["api_key"] = "****"
        return result


@app.post("/api/settings")
async def save_settings(body: SettingsPatch):
    return await _apply_settings_patch(body)


@app.patch("/api/settings")
async def patch_settings(body: SettingsPatch):
    return await _apply_settings_patch(body)


# ---------------------------------------------------------------------------
# Telemetry summary endpoint (J4)
# ---------------------------------------------------------------------------


@app.get("/api/telemetry/summary")
async def telemetry_summary():
    """Aggregate local telemetry log and return event counts."""
    if not _TELEMETRY_FILE.exists():
        return {"enabled": False, "events": {}, "total": 0}
    settings = _load_settings()
    counts: dict[str, int] = {}
    try:
        lines = _TELEMETRY_FILE.read_text().strip().splitlines()
        for line in lines:
            try:
                entry = json.loads(line)
                ev = entry.get("event", "unknown")
                counts[ev] = counts.get(ev, 0) + 1
            except Exception:
                pass
    except Exception:
        pass
    return {
        "enabled": settings.get("telemetry", False),
        "events": counts,
        "total": sum(counts.values()),
    }


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------


@app.get("/api/ollama/status")
async def ollama_status():
    plat = sys.platform  # "win32" | "darwin" | "linux"
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            tags = await client.get("http://localhost:11434/api/tags")
            ps = await client.get("http://localhost:11434/api/ps")
        models = [m["name"] for m in tags.json().get("models", [])]
        loaded = [m["name"] for m in ps.json().get("models", [])]
        # A1: try to read version
        try:
            ver_result = subprocess.run(["ollama", "--version"], capture_output=True, text=True, timeout=3)
            ver = ver_result.stdout.strip().split()[-1] if ver_result.returncode == 0 else None
        except Exception:
            ver = None
        return {"running": True, "models": models, "loaded": loaded, "platform": plat, "version": ver}
    except Exception:
        return {"running": False, "models": [], "loaded": [], "platform": plat, "version": None}


@app.get("/api/ollama/models")
async def list_ollama_models():
    """G3: List installed Ollama models with metadata."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
        models = r.json().get("models", [])
        settings = _load_settings()
        active = settings.get("model_name", "")
        result = []
        for m in models:
            size_bytes = m.get("size", 0)
            result.append({
                "name": m["name"],
                "size_gb": round(size_bytes / 1024**3, 2),
                "modified_at": m.get("modified_at", ""),
                "is_active": m["name"] == active or m["name"].startswith(active.split(":")[0]),
            })
        return {"models": result, "active": active}
    except Exception:
        return {"models": [], "active": ""}


@app.delete("/api/ollama/models/{model_name:path}")
async def delete_ollama_model(model_name: str):
    """G3: Delete an Ollama model."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.delete(
                "http://localhost:11434/api/delete",
                json={"name": model_name},
            )
        if r.status_code in (200, 204):
            return {"deleted": model_name}
        raise HTTPException(status_code=r.status_code, detail=f"Ollama returned {r.status_code}")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Ollama install
# ---------------------------------------------------------------------------


@app.post("/api/install/ollama")
async def install_ollama():
    """
    Download and install Ollama silently. Streams SSE progress events.
    Event shape: {"type": "step"|"progress"|"done"|"error", "message": str, "pct": int}
    """
    async def generate():
        system = platform.system()

        def evt(type_: str, message: str, pct: int = 0) -> str:
            return json.dumps({"type": type_, "message": message, "pct": pct})

        if system not in ("Darwin", "Windows"):
            yield {"data": evt("error", f"Auto-install not supported on {system}. Install Ollama manually from ollama.ai.")}
            return

        if system == "Darwin":
            url = "https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip"
        else:
            url = "https://ollama.com/download/OllamaSetup.exe"

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp = Path(tmp_dir)

                yield {"data": evt("step", "Downloading Ollama (~280 MB)…", pct=0)}
                filename = "Ollama-darwin.zip" if system == "Darwin" else "OllamaSetup.exe"
                dest = tmp / filename

                async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
                    async with client.stream("GET", url) as r:
                        total = int(r.headers.get("content-length", 0))
                        downloaded = 0
                        last_speed_check = time.monotonic()
                        last_downloaded = 0
                        speed_mbs = 0.0
                        with open(dest, "wb") as fh:
                            async for chunk in r.aiter_bytes(65536):
                                fh.write(chunk)
                                downloaded += len(chunk)
                                now = time.monotonic()
                                dt = now - last_speed_check
                                if dt >= 1.0:
                                    speed_mbs = (downloaded - last_downloaded) / 1024 / 1024 / dt
                                    last_speed_check = now
                                    last_downloaded = downloaded
                                if total:
                                    pct = min(60, round(downloaded / total * 60))
                                    mb_done = downloaded / 1024 / 1024
                                    mb_total = total / 1024 / 1024
                                    msg = f"Downloading… {mb_done:.0f} / {mb_total:.0f} MB"
                                    if speed_mbs > 0:
                                        msg += f" · {speed_mbs:.1f} MB/s"
                                    yield {"data": evt("progress", msg, pct=pct)}

                if system == "Darwin":
                    yield {"data": evt("step", "Extracting…", pct=62)}
                    with zipfile.ZipFile(dest) as zf:
                        zf.extractall(tmp_dir)

                    yield {"data": evt("step", "Installing to /Applications…", pct=70)}
                    src_app = tmp / "Ollama.app"
                    dst_app = Path("/Applications/Ollama.app")
                    if dst_app.exists():
                        shutil.rmtree(dst_app)
                    shutil.copytree(src_app, dst_app)

                    yield {"data": evt("step", "Starting Ollama…", pct=80)}
                    subprocess.Popen(
                        ["open", "-a", "Ollama"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )

                else:
                    yield {"data": evt("step", "Running installer (silent)…", pct=65)}
                    flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                    proc = subprocess.Popen(
                        [str(dest), "/S"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=flags,
                    )
                    await asyncio.get_running_loop().run_in_executor(None, proc.wait)

                    yield {"data": evt("step", "Starting Ollama service…", pct=80)}
                    await asyncio.sleep(3)

                yield {"data": evt("step", "Waiting for daemon to start…", pct=85)}
                for i in range(30):
                    await asyncio.sleep(1)
                    try:
                        async with httpx.AsyncClient(timeout=2.0) as c:
                            resp = await c.get("http://localhost:11434/api/tags")
                            if resp.status_code == 200:
                                yield {"data": evt("done", "Ollama is running.", pct=100)}
                                return
                    except Exception:
                        pass
                    yield {"data": evt("progress", f"Waiting for daemon… {i+1}/30", pct=85 + i // 3)}

                yield {"data": evt("error", "Daemon did not start within 30 seconds. Try launching Ollama manually.")}

        except Exception as exc:
            yield {"data": evt("error", str(exc))}

    return EventSourceResponse(generate())


# ---------------------------------------------------------------------------
# Model pull (with SSE progress — G3)
# ---------------------------------------------------------------------------


@app.post("/api/model/pull")
async def pull_model(body: PullRequest):
    """
    Pull an Ollama model. Proxies Ollama's streaming pull API as SSE.
    """
    async def generate():
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    "http://localhost:11434/api/pull",
                    json={"name": body.model},
                ) as r:
                    async for line in r.aiter_lines():
                        if line.strip():
                            yield {"data": line}
        except Exception as exc:
            yield {"data": json.dumps({"type": "error", "message": str(exc)})}

    return EventSourceResponse(generate())


# Alias: /api/ollama/pull (G3 ModelView uses this path)
@app.post("/api/ollama/pull")
async def pull_model_alias(body: PullRequest):
    return await pull_model(body)


# ---------------------------------------------------------------------------
# Runtime verify
# ---------------------------------------------------------------------------


@app.get("/api/runtime/verify")
async def runtime_verify():
    """Verify bundled runtime components are intact."""
    checks = []

    checks.append({
        "name": "Python 3.11 runtime",
        "ok": sys.version_info >= (3, 11),
        "size": "bundled",
    })

    for pkg, label, size in [
        ("agentsuite",   "agentsuite (core kernel)",        "9.4 MB"),
        ("fastapi",      "FastAPI + uvicorn (local server)", "6.8 MB"),
        ("pydantic",     "pydantic + httpx",                 "11 MB"),
        ("sse_starlette", "SSE adapter",                     "0.3 MB"),
    ]:
        try:
            __import__(pkg)
            checks.append({"name": label, "ok": True, "size": size})
        except Exception as e:
            checks.append({"name": label, "ok": False, "size": size, "error": str(e)})

    workspace = _workspace()
    try:
        test_dir = workspace / ".agentsuite"
        test_dir.mkdir(parents=True, exist_ok=True)
        test_file = test_dir / "_write_test"
        test_file.write_text("ok")
        test_file.unlink()
        checks.append({"name": "Workspace writeable", "ok": True, "size": ""})
    except Exception:
        checks.append({"name": "Workspace writeable", "ok": False, "size": ""})

    return {"checks": checks, "all_ok": all(c["ok"] for c in checks)}


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------


@app.get("/api/smoke")
async def smoke():
    """Run a real 1-token probe against the loaded Ollama model."""
    settings = _load_settings()
    model = settings.get("model_name", "gemma4:e4b")
    steps = []

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
        if r.status_code != 200:
            raise ValueError(f"Ollama returned {r.status_code}")
        steps.append({"label": "Starting Ollama daemon", "ok": True})
    except Exception as exc:
        steps.append({"label": "Starting Ollama daemon", "ok": False, "error": str(exc),
                       "fix": "Ollama stopped — click 'Restart Ollama' or open the Ollama app"})
        return {"ok": False, "steps": steps}

    try:
        models = [m["name"] for m in r.json().get("models", [])]
        found = any(m.startswith(model.split(":")[0]) for m in models)
        if not found and models:
            model = models[0]
        steps.append({"label": f"Loading {model} into memory", "ok": True})
    except Exception as exc:
        steps.append({"label": "Loading model into memory", "ok": False, "error": str(exc),
                       "fix": "Model not found — go to Model Management to download it"})
        return {"ok": False, "steps": steps}

    latency_ms = None
    eval_count = 0
    try:
        t0 = time.monotonic()
        async with httpx.AsyncClient(timeout=60.0) as client:
            gr = await client.post(
                "http://localhost:11434/api/generate",
                json={"model": model, "prompt": "Hi", "stream": False, "options": {"num_predict": 1}},
            )
        latency_ms = round((time.monotonic() - t0) * 1000)
        eval_count = gr.json().get("eval_count", 1)
        steps.append({"label": "Pinging /api/generate", "ok": True})
        steps.append({"label": "Running 1-token reasoning probe", "ok": True})
    except Exception as exc:
        steps.append({"label": "Running 1-token reasoning probe", "ok": False, "error": str(exc),
                       "fix": "Model failed to respond — try restarting Ollama"})
        return {"ok": False, "steps": steps}

    try:
        ws = _workspace() / ".agentsuite"
        ws.mkdir(parents=True, exist_ok=True)
        test = ws / "_smoke_test"
        test.write_text("ok")
        test.unlink()
        steps.append({"label": "Verifying agent kernel can write to ~/.agentsuite", "ok": True})
    except Exception as exc:
        steps.append({"label": "Verifying agent kernel write access", "ok": False, "error": str(exc),
                       "fix": "Check disk space and permissions for your home directory"})
        return {"ok": False, "steps": steps}

    toks_per_sec = round(eval_count / max(latency_ms / 1000, 0.001)) if latency_ms else None

    return {
        "ok": True,
        "steps": steps,
        "latency_ms": latency_ms,
        "toks_per_sec": toks_per_sec,
        "model": model,
    }


# ---------------------------------------------------------------------------
# Path validation (B6)
# ---------------------------------------------------------------------------


@app.post("/api/validate-path")
async def validate_path(body: PathValidateRequest):
    """Validate an inputs directory path inline (B6)."""
    try:
        _validate_inputs_dir(body.path)
        return {"valid": True, "reason": ""}
    except ValueError as exc:
        return {"valid": False, "reason": str(exc)}


# ---------------------------------------------------------------------------
# Open folder in OS file manager (D1)
# ---------------------------------------------------------------------------


@app.post("/api/open-folder")
async def open_folder(body: OpenFolderRequest):
    """Open a local folder in the OS file manager."""
    import re as _re

    # Reject Windows-style absolute paths (e.g. C:\Windows) on non-Windows platforms.
    # Path.resolve() on Linux turns "C:\Windows\System32" into a relative-looking path
    # that can accidentally pass the home-prefix check below.
    if platform.system() != "Windows" and _re.match(r"^[A-Za-z]:\\", body.path):
        raise HTTPException(status_code=403, detail="Path outside allowed area")

    p = Path(body.path).resolve()
    # Security: only open paths inside the workspace or home
    home = Path.home().resolve()
    ws = _workspace().resolve()
    if not (str(p).startswith(str(home)) or str(p).startswith(str(ws))):
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


# ---------------------------------------------------------------------------
# Run management
# ---------------------------------------------------------------------------


@app.post("/api/run")
async def start_run(req: RunRequest):
    run_id = f"run-{uuid.uuid4().hex[:6]}"
    _runs[run_id] = {
        "id": run_id,
        "agent": req.agent_id,
        "project": req.project,
        "goal": req.goal,
        "inputs_dir": req.inputs_dir,
        "status": "running",
        "started_at": time.time(),
        "events": [],
        "artifacts": [],
        "qa_score": None,
        "qa_dimensions": [],
        "error": None,
        "partial_artifacts": False,
        "overridden": False,
    }
    _run_event_buffers[run_id] = collections.deque(maxlen=_SSE_BUFFER_SIZE)
    _save_state()
    task = asyncio.create_task(_execute_run(run_id, req))
    _run_tasks[run_id] = task
    _log_telemetry("run_started", agent=req.agent_id, project=req.project)
    return {"run_id": run_id}


@app.post("/api/run/{run_id}/cancel")
async def cancel_run(run_id: str):
    """B1: Cancel a running run by cancelling its asyncio Task."""
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        if run["status"] not in ("running",):
            raise HTTPException(status_code=400, detail=f"Cannot cancel run in state: {run['status']}")

    task = _run_tasks.get(run_id)
    if task and not task.done():
        task.cancel()
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=5.0)
        except (TimeoutError, asyncio.CancelledError):
            pass

    with _state_write_lock:
        run["status"] = "cancelled"
        run["cancelled_at"] = time.time()
        run["events"].append({"type": "cancelled", "run_id": run_id, "ts": time.time()})
        _save_state()

    # B2: move partial artifacts to cancelled-outputs/
    _move_partial_artifacts(run)
    _log_telemetry("run_cancelled", agent=run.get("agent", ""), project=run.get("project", ""))
    _send_notification(
        "AgentSuiteLocal",
        f"{run.get('agent', 'Agent')} run on {run.get('project', '')} was cancelled.",
    )
    return {"status": "cancelled", "run_id": run_id}


def _move_partial_artifacts(run: dict) -> None:
    """B2: Rename outputs/ → cancelled-outputs/ for cancelled runs."""
    try:
        as_run_id = run.get("agentsuite_run_id") or run["id"]
        run_dir = _workspace() / ".agentsuite" / "runs" / as_run_id
        outputs_dir = run_dir / "outputs"
        cancelled_dir = run_dir / "cancelled-outputs"
        if outputs_dir.exists():
            shutil.move(str(outputs_dir), str(cancelled_dir))
            run["partial_artifacts"] = True
            _save_state()
    except Exception:
        pass


@app.get("/api/run/{run_id}/stream")
async def stream_run(run_id: str, since: int = 0):
    """B4: SSE stream with ?since= parameter for reconnect replay."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        run = _runs[run_id]
        buf = _run_event_buffers.get(run_id)
        seen = since

        while True:
            events = run["events"]
            while seen < len(events):
                evt = events[seen]
                yield {"data": json.dumps(evt)}
                if buf is not None:
                    buf.append(evt)
                seen += 1
            if run["status"] in ("approved", "rejected", "error", "waiting", "cancelled", "timeout"):
                break
            await asyncio.sleep(0.2)

    return EventSourceResponse(generator())


@app.get("/api/run/{run_id}")
async def get_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return _scrub_nan_from_run(_runs[run_id])


@app.get("/api/run/{run_id}/artifact/{path:path}")
async def get_artifact(run_id: str, path: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    run_dir = (_workspace() / ".agentsuite" / "runs" / as_run_id).resolve()
    artifact_path = (run_dir / path).resolve()
    if not artifact_path.is_relative_to(run_dir):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not artifact_path.exists() or not artifact_path.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    try:
        content = artifact_path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    stat = artifact_path.stat()
    return {"path": path, "content": content, "size": stat.st_size}


@app.post("/api/run/{run_id}/approve")
async def approve_run(run_id: str, body: OverrideApproveRequest):
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        if run["status"] not in ("waiting", "done"):
            raise HTTPException(status_code=400, detail=f"Cannot approve run in state: {run['status']}")

        # D1: export to kernel with timestamp path
        export_path = _push_to_kernel(run)

        run["status"] = "approved"
        run["approver"] = body.approver
        run["approved_at"] = time.time()
        if body.override:
            run["overridden"] = True
        _save_state()
    _log_telemetry("run_approved", agent=run.get("agent", ""), project=run.get("project", ""))
    _send_notification(
        "AgentSuiteLocal",
        f"{run.get('agent', 'Agent')} run on {run.get('project', '')} approved.",
    )
    return {
        "status": "approved",
        "run_id": run_id,
        "export_path": str(export_path) if export_path else None,
    }


@app.post("/api/run/{run_id}/reject")
async def reject_run(run_id: str):
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        run["status"] = "rejected"
        _save_state()
    _log_telemetry("run_rejected", agent=run.get("agent", ""), project=run.get("project", ""))
    _send_notification(
        "AgentSuiteLocal",
        f"{run.get('agent', 'Agent')} run on {run.get('project', '')} rejected.",
    )
    return {"status": "rejected", "run_id": run_id}


@app.get("/api/runs")
async def list_runs():
    runs = sorted(_runs.values(), key=lambda r: r["started_at"], reverse=True)
    return {"runs": runs}


# ---------------------------------------------------------------------------
# D4: Export endpoints
# ---------------------------------------------------------------------------


@app.get("/api/run/{run_id}/export/zip")
async def export_run_zip(run_id: str):
    """D4: Export all artifacts as a ZIP file."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    outputs_dir = _workspace() / ".agentsuite" / "runs" / as_run_id

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
    os.close(tmp_fd)
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            if outputs_dir.exists():
                for f in outputs_dir.rglob("*"):
                    if f.is_file():
                        zf.write(f, f.relative_to(outputs_dir))
        return FileResponse(
            tmp_path,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={run_id}-artifacts.zip"},
            background=BackgroundTask(os.unlink, tmp_path),  # M-5: clean up temp file after response
        )
    except Exception as exc:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/run/{run_id}/export/markdown")
async def export_run_markdown(run_id: str):
    """D4: Export all artifacts as a single Markdown bundle."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    outputs_dir = _workspace() / ".agentsuite" / "runs" / as_run_id

    parts = [f"# {run_id} — Artifact Bundle\n\n"]
    if outputs_dir.exists():
        for f in sorted(outputs_dir.rglob("*")):
            if f.is_file():
                rel = f.relative_to(outputs_dir)
                try:
                    content = f.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    content = "(binary file — skipped)"
                parts.append(f"---\n\n## {rel}\n\n{content}\n\n")

    bundle = "".join(parts)
    return StreamingResponse(
        iter([bundle]),
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={run_id}-bundle.md"},
    )


@app.get("/api/run/{run_id}/export/pdf")
async def export_run_pdf(run_id: str):
    """D4: Export all artifacts as a PDF via weasyprint."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    outputs_dir = _workspace() / ".agentsuite" / "runs" / as_run_id

    # Build markdown, convert to HTML, then PDF
    md_parts = [f"<h1>{run_id} — Artifact Bundle</h1>"]
    if outputs_dir.exists():
        for f in sorted(outputs_dir.rglob("*")):
            if f.is_file():
                rel = f.relative_to(outputs_dir)
                try:
                    content = f.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    content = "(binary file)"
                md_parts.append(f"<hr><h2>{rel}</h2><pre>{content}</pre>")

    html_content = f"<html><body style='font-family:sans-serif'>{''.join(md_parts)}</body></html>"

    try:
        import weasyprint
        pdf_bytes = weasyprint.HTML(string=html_content).write_pdf()
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={run_id}-bundle.pdf"},
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="weasyprint is not installed. Install it with: pip install weasyprint")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# Crash reports (F4)
# ---------------------------------------------------------------------------


@app.get("/api/crash-reports/latest")
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


# ---------------------------------------------------------------------------
# Pipeline management
# ---------------------------------------------------------------------------


@app.post("/api/pipelines")
async def create_pipeline(req: PipelineRequest):
    pid = f"pipeline-{uuid.uuid4().hex[:6]}"
    _pipelines[pid] = {
        "id": pid,
        "name": req.name,
        "project": req.project,
        "goal": req.goal,
        "agents": req.agents,
        "status": "running",
        "current_step": 0,
        "steps": [
            {
                "agent": a,
                "status": "running" if i == 0 else "todo",
                "run_id": None,
                "qa_score": None,
                "qa_dimensions": [],
                "artifacts": [],
            }
            for i, a in enumerate(req.agents)
        ],
        "events": [],
        "auto_approve": req.auto_approve,
        "inputs_dir": req.inputs_dir,
        "started_at": time.time(),
        "updated_at": time.time(),
    }
    _save_state()
    asyncio.create_task(_execute_pipeline_step(pid, 0))
    return {"pipeline_id": pid}


@app.get("/api/pipelines")
async def list_pipelines():
    pipelines = sorted(_pipelines.values(), key=lambda p: p["started_at"], reverse=True)
    return {"pipelines": pipelines}


@app.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return _pipelines[pipeline_id]


@app.get("/api/pipelines/{pipeline_id}/stream")
async def stream_pipeline(pipeline_id: str):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    async def generator():
        pipeline = _pipelines[pipeline_id]
        seen = 0
        while True:
            events = pipeline["events"]
            while seen < len(events):
                yield {"data": json.dumps(events[seen])}
                seen += 1
            if pipeline["status"] in ("done", "error", "awaiting_approval", "rejected"):
                break
            await asyncio.sleep(0.3)

    return EventSourceResponse(generator())


@app.post("/api/pipelines/{pipeline_id}/approve")
async def approve_pipeline_step(pipeline_id: str, body: ApproveRequest):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipelines[pipeline_id]
    if pipeline["status"] != "awaiting_approval":
        raise HTTPException(status_code=400, detail=f"Pipeline is {pipeline['status']}, not awaiting_approval")
    step_idx = pipeline["current_step"]
    if step_idx >= len(pipeline["steps"]):
        raise HTTPException(status_code=400, detail="No active step to approve")
    step = pipeline["steps"][step_idx]
    if step["run_id"]:
        _push_to_kernel_by_run_id(step["run_id"], pipeline["project"], step["agent"])
    step["status"] = "done"
    _save_state()
    asyncio.create_task(_advance_pipeline(pipeline_id, step_idx))
    return {"status": "approved", "pipeline_id": pipeline_id, "step": step_idx}


@app.post("/api/pipelines/{pipeline_id}/reject")
async def reject_pipeline_step(pipeline_id: str):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipelines[pipeline_id]
    step_idx = pipeline["current_step"]
    if step_idx >= len(pipeline["steps"]):
        raise HTTPException(status_code=400, detail="No active step to reject")
    pipeline["steps"][step_idx]["status"] = "rejected"
    pipeline["status"] = "rejected"
    pipeline["updated_at"] = time.time()
    _pipelines[pipeline_id]["events"].append({
        "type": "pipeline_rejected",
        "pipeline_id": pipeline_id,
        "step": step_idx,
        "ts": time.time(),
    })
    _save_state()
    return {"status": "rejected", "pipeline_id": pipeline_id}


@app.post("/api/pipelines/{pipeline_id}/resume")
async def resume_pipeline(pipeline_id: str):
    """F3: Resume a pipeline from its first pending step."""
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipelines[pipeline_id]
    if pipeline["status"] not in ("error",):
        raise HTTPException(status_code=400, detail=f"Pipeline is {pipeline['status']} — only 'error' pipelines can be resumed")

    # Find first pending step
    resume_idx = None
    for i, step in enumerate(pipeline["steps"]):
        if step["status"] in ("pending", "todo"):
            resume_idx = i
            break

    if resume_idx is None:
        raise HTTPException(status_code=400, detail="No pending steps to resume from")

    pipeline["status"] = "running"
    pipeline["current_step"] = resume_idx
    pipeline["steps"][resume_idx]["status"] = "running"
    pipeline["updated_at"] = time.time()
    _save_state()
    asyncio.create_task(_execute_pipeline_step(pipeline_id, resume_idx))
    return {"status": "resuming", "pipeline_id": pipeline_id, "from_step": resume_idx}


# ---------------------------------------------------------------------------
# Kernel
# ---------------------------------------------------------------------------


@app.get("/api/kernel")
async def kernel_artifacts():
    workspace = _workspace()
    kernel_root = workspace / ".agentsuite" / "_kernel"
    if not kernel_root.exists():
        return {"projects": {}}
    result: dict[str, Any] = {}
    for proj in kernel_root.iterdir():
        if proj.is_dir():
            agents: dict[str, list[str]] = {}
            for agent_dir in proj.iterdir():
                if agent_dir.is_dir():
                    agents[agent_dir.name] = [
                        str(f.relative_to(agent_dir))
                        for f in agent_dir.rglob("*") if f.is_file()
                    ]
            result[proj.name] = agents
    return {"projects": result}


@app.get("/api/kernel/diff")
async def kernel_diff(a: str, b: str):
    """D3: Return unified diff between two kernel artifact paths."""
    workspace = _workspace().resolve()
    home = Path.home().resolve()

    def safe_read(p_str: str) -> str:
        p = Path(p_str).resolve()
        if not (str(p).startswith(str(workspace)) or str(p).startswith(str(home))):
            raise HTTPException(status_code=403, detail=f"Path not allowed: {p_str}")
        if not p.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {p_str}")
        return p.read_text(encoding="utf-8", errors="replace")

    text_a = safe_read(a)
    text_b = safe_read(b)
    diff_lines = list(difflib.unified_diff(
        text_a.splitlines(keepends=True),
        text_b.splitlines(keepends=True),
        fromfile=Path(a).name,
        tofile=Path(b).name,
    ))
    return {"diff": "".join(diff_lines), "lines": len(diff_lines)}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@app.get("/api/projects")
async def list_projects():
    seen: dict[str, dict] = {}
    for run in _runs.values():
        slug = run["project"]
        if slug not in seen:
            seen[slug] = {"slug": slug, "runs": 0, "agents": set(), "last_touch": 0}
        seen[slug]["runs"] += 1
        seen[slug]["agents"].add(run["agent"])
        seen[slug]["last_touch"] = max(seen[slug]["last_touch"], run["started_at"])
    projects = [
        {
            "slug": p["slug"],
            "runs": p["runs"],
            "agents": len(p["agents"]),
            "last_touch": p["last_touch"],
        }
        for p in seen.values()
    ]
    return {"projects": sorted(projects, key=lambda p: p["last_touch"], reverse=True)}


# ---------------------------------------------------------------------------
# Project mutations (B-1)
# ---------------------------------------------------------------------------


class RenameProjectRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=200)


@app.post("/api/projects/{slug}/rename")
async def rename_project(slug: str, body: RenameProjectRequest):
    """B-1: Rename all runs belonging to a project slug."""
    new_slug = body.new_name.strip().lower().replace(" ", "-")
    if not new_slug:
        raise HTTPException(status_code=422, detail="new_name must be non-empty after normalisation")
    with _state_write_lock:
        matched = [r for r in _runs.values() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for run in matched:
            run["project"] = new_slug
        _save_state()
    return {"slug": new_slug, "previous_slug": slug, "runs_updated": len(matched)}


@app.post("/api/projects/{slug}/archive")
async def archive_project(slug: str):
    """B-1: Mark all runs in a project as archived."""
    with _state_write_lock:
        matched = [r for r in _runs.values() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for run in matched:
            run["archived"] = True
        _save_state()
    return {"slug": slug, "archived": True, "runs_updated": len(matched)}


@app.delete("/api/projects/{slug}")
async def delete_project(slug: str):
    """B-1: Delete all runs and artifacts for a project."""
    with _state_write_lock:
        matched = [rid for rid, r in _runs.items() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for rid in matched:
            run = _runs.pop(rid)
            as_run_id = run.get("agentsuite_run_id") or rid
            artifacts_dir = _workspace() / ".agentsuite" / "runs" / as_run_id
            if artifacts_dir.exists():
                import shutil
                shutil.rmtree(artifacts_dir, ignore_errors=True)
        _save_state()
    return {"slug": slug, "deleted": True, "runs_deleted": len(matched)}


# ---------------------------------------------------------------------------
# Ollama model verification (A3)
# ---------------------------------------------------------------------------


@app.get("/api/model/verify/{model_name:path}")
async def verify_model(model_name: str):
    """A3: Verify a model is not corrupt by checking its parameter count via ollama show."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                "http://localhost:11434/api/show",
                json={"name": model_name},
            )
        if r.status_code != 200:
            return {"ok": False, "reason": f"ollama show returned {r.status_code}"}
        data = r.json()
        # Check for non-zero parameter count in model details
        details = data.get("details", {})
        param_size = details.get("parameter_size", "")
        if not param_size or param_size == "0":
            return {"ok": False, "reason": "Model download appears incomplete — zero parameter count"}
        return {"ok": True, "parameter_size": param_size, "model": model_name}
    except Exception as exc:
        return {"ok": False, "reason": str(exc)}


# ---------------------------------------------------------------------------
# LLM resolver + error helpers
# ---------------------------------------------------------------------------


def _resolve_llm(settings: dict) -> Any:
    """Build an LLM provider from persisted settings.

    G1: tier maps to concrete model name.
    G2: if api_key set AND model starts with 'claude-', use Anthropic.
    """
    api_key = settings.get("api_key")
    model_tier = settings.get("model_tier", "balanced")
    model_name = settings.get("model_name")

    # G1: if model_name is not explicitly set or matches tier default, derive from tier
    if not model_name or model_name == _TIER_MODEL_MAP.get(model_tier, model_name):
        model_name = _TIER_MODEL_MAP.get(model_tier, "gemma4:e4b")

    is_anthropic_model = model_name.startswith("claude-")

    if api_key and is_anthropic_model:
        os.environ["ANTHROPIC_API_KEY"] = api_key
        try:
            from agentsuite.llm.resolver import resolve_provider
            return resolve_provider(name=model_name)
        except Exception:
            pass

    try:
        from agentsuite.llm.ollama import OllamaProvider
        return OllamaProvider(model=model_name)
    except Exception:
        return None


def _friendly_error(raw: str) -> str:
    msg = raw.lower()
    if "connecterror" in msg or "connection refused" in msg or "connect" in msg:
        return "Ollama is not running. Open Ollama and try again."
    if "noproviderconfigured" in msg or "no provider" in msg:
        return "No AI model configured. Open Settings and enter your API key, or start Ollama."
    if "api_key" in msg or "authentication" in msg or "unauthorized" in msg or "403" in msg:
        return "Invalid API key. Check your key in Settings."
    if "model" in msg and ("not found" in msg or "does not exist" in msg):
        return "Model not found. Open Settings and verify your model selection, then try again."
    if "interrupted" in msg or "cancelled" in msg:
        return raw
    if "timed out" in msg:
        return raw
    return f"Something went wrong. Check Settings and try again. ({raw[:120]})"


# ---------------------------------------------------------------------------
# Background run executor (with B3 watchdog, B4 buffer)
# ---------------------------------------------------------------------------


async def _execute_run(run_id: str, req: RunRequest) -> None:
    run = _runs[run_id]
    settings = _load_settings()
    timeout_secs = int(settings.get("run_timeout_seconds", 900))
    buf = _run_event_buffers.setdefault(run_id, collections.deque(maxlen=_SSE_BUFFER_SIZE))

    def emit(event_type: str, **kwargs):
        evt = {"type": event_type, "run_id": run_id, "ts": time.time(), **kwargs}
        run["events"].append(evt)
        buf.append(evt)

    emit("agent_start", agent=req.agent_id, project=req.project)

    async def _do_run():
        llm = _resolve_llm(settings)

        if not settings.get("api_key"):
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    await client.get("http://localhost:11434/api/tags")
            except Exception:
                raise RuntimeError("Ollama is not running. Open Ollama and try again.")

        from agentsuite.pipeline.orchestrator import PipelineOrchestrator

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()

        def _run_sync():
            def on_progress(event: str, step, pipeline):
                evt_dict = {
                    "type": "stage_update" if event not in ("agent_start", "agent_done", "agent_waiting") else event,
                    "run_id": run_id,
                    "stage": event,
                    "agent": step.agent,
                    "ts": time.time(),
                }
                loop.call_soon_threadsafe(run["events"].append, evt_dict)
                loop.call_soon_threadsafe(buf.append, evt_dict)

            def kernel_progress_callback(event: dict) -> None:
                """K1/K2: Forward BaseAgent intra-stage events to SSE stream."""
                evt_dict = {**event, "run_id": run_id, "ts": time.time()}
                loop.call_soon_threadsafe(run["events"].append, evt_dict)
                loop.call_soon_threadsafe(buf.append, evt_dict)

            orch = PipelineOrchestrator(output_root=output_root)
            return orch.run(
                agents=[req.agent_id],
                project_slug=req.project,
                business_goal=req.goal,
                inputs_dir=Path(req.inputs_dir) if req.inputs_dir else None,
                llm=llm,
                on_progress=on_progress,
                kernel_progress_callback=kernel_progress_callback,
            )

        return await loop.run_in_executor(None, _run_sync)

    try:
        # B3: watchdog — cancel after timeout_secs
        pipeline = await asyncio.wait_for(_do_run(), timeout=timeout_secs)

        step = pipeline.steps[0] if pipeline.steps else None
        artifacts: list[str] = []
        qa_score: float | None = None
        qa_dimensions: list[dict] = []

        if step and step.run_id:
            run_dir = _workspace() / ".agentsuite" / "runs" / step.run_id
            if run_dir.exists():
                artifacts = [
                    str(f.relative_to(run_dir))
                    for f in run_dir.rglob("*")
                    if f.is_file() and not f.name.startswith("_")
                ]
                qa_file = run_dir / "qa_scores.json"
                if qa_file.exists():
                    try:
                        qa_data = json.loads(qa_file.read_text())
                        qa_score = (
                            qa_data.get("weighted_score")
                            or qa_data.get("overall_score")
                            or qa_data.get("score")
                            or qa_data.get("overall")
                        )
                        dims = qa_data.get("dimensions") or qa_data.get("scores") or {}
                        if isinstance(dims, dict):
                            qa_dimensions = _sanitize_qa_dimensions(dims)
                        elif isinstance(dims, list):
                            qa_dimensions = dims
                    except Exception:
                        pass

        run["agentsuite_run_id"] = step.run_id if step else None
        run["artifacts"] = artifacts
        run["qa_score"] = qa_score
        run["qa_dimensions"] = qa_dimensions
        run["status"] = "waiting"
        emit("agent_waiting", qa_score=qa_score, artifacts=artifacts)
        _save_state()
        _log_telemetry("run_completed", agent=req.agent_id, project=req.project,
                       duration=time.time() - run["started_at"])
        _send_notification(
            "AgentSuiteLocal",
            f"{req.agent_id} run on {req.project} is ready for review.",
            action_url="http://localhost:8765",
        )

    except TimeoutError:
        timeout_msg = f"Run timed out after {timeout_secs // 60} minutes"
        run["status"] = "error"
        run["error"] = timeout_msg
        run["error_message"] = timeout_msg
        run["finished_at"] = time.time()
        emit("timeout", message=timeout_msg)
        _save_state()
        _log_telemetry("run_errored", agent=req.agent_id, project=req.project, error="timeout")
        _send_notification("AgentSuiteLocal", f"{req.agent_id} run timed out after {timeout_secs // 60} min.")

    except asyncio.CancelledError:
        # Cancellation handled by cancel_run endpoint — just ensure state is set
        if run["status"] == "running":
            run["status"] = "cancelled"
            run["cancelled_at"] = time.time()
        _save_state()

    except Exception as exc:
        friendly = _friendly_error(str(exc))
        run["status"] = "error"
        run["error"] = friendly
        run["error_message"] = friendly
        run["finished_at"] = time.time()
        emit("error", message=friendly)
        _save_state()
        _log_telemetry("run_errored", agent=req.agent_id, project=req.project, error=friendly[:100])
        _send_notification("AgentSuiteLocal", f"{req.agent_id} run on {req.project} errored.")


# ---------------------------------------------------------------------------
# Pipeline background helpers
# ---------------------------------------------------------------------------

_QA_KEY_RE = re.compile(r"[./]")


def _sanitize_qa_dimensions(dims: dict) -> list[dict]:
    result = []
    for k, v in dims.items():
        if not isinstance(k, str):
            continue
        if len(k) > 60 or _QA_KEY_RE.search(k):
            continue
        try:
            score = float(v)
            if not math.isfinite(score):
                continue
            result.append({"name": k, "score": score})
        except (TypeError, ValueError):
            pass
    return result


def _scrub_nan_from_run(run: dict) -> dict:
    out = dict(run)
    if isinstance(out.get("qa_score"), float) and not math.isfinite(out["qa_score"]):
        out["qa_score"] = None
    if out.get("qa_dimensions"):
        out["qa_dimensions"] = [
            d for d in out["qa_dimensions"]
            if isinstance(d.get("score"), (int, float)) and math.isfinite(float(d["score"]))
        ]
    return out


def _emit_pipeline(pipeline_id: str, event_type: str, **kwargs) -> None:
    _pipelines[pipeline_id]["events"].append({
        "type": event_type,
        "pipeline_id": pipeline_id,
        "ts": time.time(),
        **kwargs,
    })


async def _execute_pipeline_step(pipeline_id: str, step_idx: int) -> None:
    pipeline = _pipelines[pipeline_id]
    if step_idx >= len(pipeline["steps"]):
        pipeline["status"] = "error"
        pipeline["updated_at"] = time.time()
        _emit_pipeline(pipeline_id, "pipeline_error", error="step index out of range", step=step_idx)
        _save_state()
        return
    step = pipeline["steps"][step_idx]
    agent_id = step["agent"]

    pipeline["status"] = "running"
    pipeline["updated_at"] = time.time()
    _emit_pipeline(pipeline_id, "agent_start", agent=agent_id, step=step_idx)

    # F2: wrap in try/except — never leave a pipeline in running after exception
    try:
        settings = _load_settings()
        llm = _resolve_llm(settings)

        from agentsuite.pipeline.orchestrator import PipelineOrchestrator

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()
        step_orch_id = f"{pipeline_id}-step{step_idx}"

        def _run_sync():
            def on_progress(event: str, step_state, _pipeline_state):
                event_dict = {
                    "type": "stage_update" if event not in ("agent_start", "agent_done", "agent_waiting") else event,
                    "pipeline_id": pipeline_id,
                    "stage": event,
                    "agent": step_state.agent,
                    "step": step_idx,
                    "ts": time.time(),
                }
                loop.call_soon_threadsafe(_pipelines[pipeline_id]["events"].append, event_dict)

            orch = PipelineOrchestrator(output_root=output_root)
            return orch.run(
                agents=[agent_id],
                project_slug=pipeline["project"],
                business_goal=pipeline["goal"],
                pipeline_id=step_orch_id,
                inputs_dir=Path(pipeline["inputs_dir"]) if pipeline["inputs_dir"] else None,
                llm=llm,
                on_progress=on_progress,
            )

        result = await loop.run_in_executor(None, _run_sync)
        result_step = result.steps[0] if result.steps else None

        step["run_id"] = result_step.run_id if (result_step and result_step.run_id) else None

        if result_step and result_step.run_id:
            run_dir = output_root / "runs" / result_step.run_id
            if run_dir.exists():
                step["artifacts"] = [
                    str(f.relative_to(run_dir))
                    for f in run_dir.rglob("*")
                    if f.is_file() and not f.name.startswith("_")
                ]
                qa_file = run_dir / "qa_scores.json"
                if qa_file.exists():
                    try:
                        qa_data = json.loads(qa_file.read_text())
                        step["qa_score"] = (
                            qa_data.get("weighted_score")
                            or qa_data.get("overall_score")
                            or qa_data.get("score")
                            or qa_data.get("overall")
                        )
                        dims = qa_data.get("dimensions") or qa_data.get("scores") or {}
                        if isinstance(dims, dict):
                            step["qa_dimensions"] = _sanitize_qa_dimensions(dims)
                        elif isinstance(dims, list):
                            step["qa_dimensions"] = dims
                    except Exception:
                        pass

        if pipeline["auto_approve"]:
            if step["run_id"]:
                _push_to_kernel_by_run_id(step["run_id"], pipeline["project"], agent_id)
            step["status"] = "done"
            await _advance_pipeline(pipeline_id, step_idx)
        else:
            step["status"] = "awaiting_approval"
            pipeline["status"] = "awaiting_approval"
            pipeline["updated_at"] = time.time()
            _emit_pipeline(pipeline_id, "agent_waiting", agent=agent_id, step=step_idx, qa_score=step["qa_score"])
            _save_state()

    except Exception as exc:
        # F2: always set error state — never leave pipeline stuck in running
        step["status"] = "error"
        pipeline["status"] = "error"
        pipeline["updated_at"] = time.time()
        pipeline["error_message"] = str(exc)
        _emit_pipeline(pipeline_id, "pipeline_error", error=str(exc), step=step_idx)
        _save_state()


async def _advance_pipeline(pipeline_id: str, approved_step_idx: int) -> None:
    pipeline = _pipelines[pipeline_id]
    if approved_step_idx >= len(pipeline["steps"]):
        pipeline["status"] = "error"
        pipeline["updated_at"] = time.time()
        _emit_pipeline(pipeline_id, "pipeline_error", error="approved step index out of range", step=approved_step_idx)
        _save_state()
        return
    step = pipeline["steps"][approved_step_idx]
    step["status"] = "done"
    _emit_pipeline(pipeline_id, "agent_done", agent=step["agent"], step=approved_step_idx, qa_score=step["qa_score"])

    next_idx = approved_step_idx + 1
    pipeline["current_step"] = next_idx

    if next_idx >= len(pipeline["steps"]):
        pipeline["status"] = "done"
        pipeline["updated_at"] = time.time()
        _emit_pipeline(pipeline_id, "pipeline_done")
        _save_state()
        return

    pipeline["steps"][next_idx]["status"] = "running"
    pipeline["status"] = "running"
    pipeline["updated_at"] = time.time()
    _save_state()
    asyncio.create_task(_execute_pipeline_step(pipeline_id, next_idx))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _workspace() -> Path:
    return Path(os.environ.get("AGENTSUITE_WORKSPACE", Path.home() / "AgentSuite"))


def _push_to_kernel(run: dict) -> Path | None:
    """D1: Push run outputs to kernel with timestamp-based path. Returns export_path."""
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    export_path = _push_to_kernel_by_run_id(
        as_run_id, run["project"], run["agent"], timestamp=timestamp
    )
    return export_path


def _push_to_kernel_by_run_id(run_id: str, project: str, agent: str, timestamp: str | None = None) -> Path | None:
    """Copy run outputs to kernel directory. Returns the kernel export path."""
    if not _SLUG_RE.match(project):
        raise ValueError(f"Invalid project slug: {project!r}")
    if not _SLUG_RE.match(agent):
        raise ValueError(f"Invalid agent slug: {agent!r}")
    workspace = _workspace()
    kernel_root = (workspace / ".agentsuite" / "_kernel").resolve()

    if timestamp:
        kernel_dir = workspace / ".agentsuite" / "_kernel" / project / agent / timestamp
    else:
        kernel_dir = workspace / ".agentsuite" / "_kernel" / project / agent

    if not str(kernel_dir.resolve()).startswith(str(kernel_root)):
        raise ValueError("Path traversal blocked")
    kernel_dir.mkdir(parents=True, exist_ok=True)
    run_dir = workspace / ".agentsuite" / "runs" / run_id
    if run_dir.exists():
        for f in run_dir.rglob("*"):
            if f.is_file():
                dest = kernel_dir / f.relative_to(run_dir)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)
    return kernel_dir


# ---------------------------------------------------------------------------
# A6: Uninstall endpoints
# ---------------------------------------------------------------------------


class UninstallPhase2Request(BaseModel):
    delete_workspace: bool = False


class UninstallPhase3Request(BaseModel):
    delete_model: bool = False
    model_name: str = ""


@app.get("/api/uninstall/workspace-info")
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


@app.post("/api/uninstall/phase2")
async def uninstall_phase2(body: UninstallPhase2Request):
    """A6 Phase 2: Optionally delete workspace data."""
    workspace = _workspace()
    agentsuite_dir = workspace / ".agentsuite"
    agentsuitelocal_dir = Path.home() / ".agentsuitelocal"

    if body.delete_workspace:
        if agentsuite_dir.exists():
            shutil.rmtree(agentsuite_dir, ignore_errors=True)
        if agentsuitelocal_dir.exists():
            shutil.rmtree(agentsuitelocal_dir, ignore_errors=True)
    return {"deleted": body.delete_workspace}


@app.post("/api/uninstall/phase3")
async def uninstall_phase3(body: UninstallPhase3Request):
    """A6 Phase 3: Optionally delete the Ollama model."""
    if body.delete_model and body.model_name:
        try:
            subprocess.run(
                ["ollama", "rm", body.model_name],
                capture_output=True,
                timeout=30,
            )
        except Exception:
            pass
    # If installed via Inno Setup, trigger the uninstaller to clean Add/Remove Programs
    if sys.platform == "win32":
        inno_uninst = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "AgentSuiteLocal" / "unins000.exe"
        if inno_uninst.exists():
            subprocess.Popen([str(inno_uninst), "/VERYSILENT", "/SUPPRESSMSGBOXES"])
    return {"uninstall_complete": True}


@app.post("/api/uninstall")
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


# ---------------------------------------------------------------------------
# A5: Launcher port endpoint
# ---------------------------------------------------------------------------


@app.get("/api/launcher/port")
async def get_launcher_port():
    """A5: Return the actual bound port (from launcher.log)."""
    port = _read_launcher_port()
    return {"port": port}


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
