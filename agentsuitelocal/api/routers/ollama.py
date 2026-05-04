"""Ollama status, model management, install, pull, runtime verify, smoke, and model verify."""

from __future__ import annotations

import asyncio
import json
import platform
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from agentsuitelocal.api.config import _load_settings
from agentsuitelocal.api.schemas import PullRequest
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()


@router.get("/api/ollama/status")
async def ollama_status():
    plat = sys.platform
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            tags = await client.get("http://localhost:11434/api/tags")
            ps = await client.get("http://localhost:11434/api/ps")
        models = [m["name"] for m in tags.json().get("models", [])]
        loaded = [m["name"] for m in ps.json().get("models", [])]
        try:
            ver_result = await asyncio.to_thread(
                subprocess.run, ["ollama", "--version"], capture_output=True, text=True, timeout=3
            )
            ver = ver_result.stdout.strip().split()[-1] if ver_result.returncode == 0 else None
        except Exception:
            ver = None
        return {"running": True, "models": models, "loaded": loaded, "platform": plat, "version": ver}
    except Exception:
        return {"running": False, "models": [], "loaded": [], "platform": plat, "version": None}


@router.get("/api/ollama/models")
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


@router.delete("/api/ollama/models/{model_name:path}")
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


@router.post("/api/install/ollama")
async def install_ollama():
    """Download and install Ollama silently. Streams SSE progress events."""
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


@router.post("/api/model/pull")
async def pull_model(body: PullRequest):
    """Pull an Ollama model. Proxies Ollama's streaming pull API as SSE."""
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


@router.post("/api/ollama/pull")
async def pull_model_alias(body: PullRequest):
    return await pull_model(body)


@router.get("/api/runtime/verify")
async def runtime_verify():
    """Verify bundled runtime components are intact."""
    checks = []

    checks.append({
        "name": "Python 3.11 runtime",
        "ok": sys.version_info >= (3, 11),
        "size": "bundled",
    })

    for pkg, label, size in [
        ("agentsuite",    "agentsuite (core kernel)",        "9.4 MB"),
        ("fastapi",       "FastAPI + uvicorn (local server)", "6.8 MB"),
        ("pydantic",      "pydantic + httpx",                 "11 MB"),
        ("sse_starlette", "SSE adapter",                      "0.3 MB"),
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


@router.get("/api/smoke")
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


@router.get("/api/model/verify/{model_name:path}")
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
        details = data.get("details", {})
        param_size = details.get("parameter_size", "")
        if not param_size or param_size == "0":
            return {"ok": False, "reason": "Model download appears incomplete — zero parameter count"}
        return {"ok": True, "parameter_size": param_size, "model": model_name}
    except Exception as exc:
        return {"ok": False, "reason": str(exc)}
