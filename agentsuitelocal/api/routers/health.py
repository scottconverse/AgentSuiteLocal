"""Health, hardware, version, and update-check endpoints."""

from __future__ import annotations

import platform
import time
from pathlib import Path

import httpx
import psutil
from fastapi import APIRouter

from agentsuitelocal.__version__ import __version__

router = APIRouter()


@router.get("/api/health")
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


@router.get("/api/hardware")
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


@router.get("/api/version")
async def get_version():
    return {"version": __version__}


@router.get("/api/update/check")
async def check_update():
    """Check latest GitHub release. Returns {current, latest, has_update, status, error}.

    Status values:
      - "ok"          — query succeeded; has_update is meaningful
      - "rate_limited"— GitHub returned 403/429 (anonymous quota exhausted)
      - "unreachable" — network/DNS/timeout
      - "error"       — anything else (malformed JSON, 5xx, etc.)

    The previous implementation collapsed every failure into a silent
    'has_update: False', so users with a stale install never knew the
    update check itself was broken. Front end can now show 'Couldn't
    check for updates: <reason>' and let the user retry.
    """
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
                "status": "ok",
                "error": None,
            }
        if r.status_code in (403, 429):
            return {
                "current": __version__, "latest": __version__, "has_update": False,
                "release_url": "",
                "status": "rate_limited",
                "error": f"GitHub returned {r.status_code} (rate limit). Try again later.",
            }
        return {
            "current": __version__, "latest": __version__, "has_update": False,
            "release_url": "",
            "status": "error",
            "error": f"GitHub returned HTTP {r.status_code}",
        }
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as exc:
        return {
            "current": __version__, "latest": __version__, "has_update": False,
            "release_url": "",
            "status": "unreachable",
            "error": f"Could not reach GitHub: {exc}",
        }
    except Exception as exc:
        return {
            "current": __version__, "latest": __version__, "has_update": False,
            "release_url": "",
            "status": "error",
            "error": f"{exc.__class__.__name__}: {exc}",
        }
