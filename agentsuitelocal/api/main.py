"""
AgentSuiteLocal — FastAPI backend
"""

from __future__ import annotations

import asyncio
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any

import httpx
import psutil
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------

app = FastAPI(title="AgentSuiteLocal", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8765"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

_runs: dict[str, dict[str, Any]] = {}
_pipelines: dict[str, dict[str, Any]] = {}

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

_SETTINGS_FILE = Path.home() / ".agentsuitelocal" / "settings.json"
_SETTINGS_DEFAULTS: dict[str, Any] = {
    "model_tier": "balanced",
    "model_name": "gemma4:e4b",
    "auto_approve_threshold": None,
    "open_on_launch": True,
    "telemetry": False,
    "enabled_agents": ["founder", "design", "product", "engineering", "marketing", "trust", "cio"],
    "api_key": None,
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
# Schemas
# ---------------------------------------------------------------------------


class RunRequest(BaseModel):
    agent_id: str
    goal: str
    project: str
    inputs_dir: str | None = None
    constraints: str | None = None


class ApproveRequest(BaseModel):
    approver: str = "user"


class SettingsPatch(BaseModel):
    model_tier: str | None = None
    model_name: str | None = None
    auto_approve_threshold: float | None = None
    open_on_launch: bool | None = None
    telemetry: bool | None = None
    enabled_agents: list[str] | None = None
    api_key: str | None = None


class PullRequest(BaseModel):
    model: str


class PipelineRequest(BaseModel):
    name: str
    project: str
    goal: str
    agents: list[str]
    inputs_dir: str | None = None
    auto_approve: bool = False


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
# Settings endpoints
# ---------------------------------------------------------------------------


@app.get("/api/settings")
async def get_settings():
    return _load_settings()


@app.post("/api/settings")
async def save_settings(body: SettingsPatch):
    current = _load_settings()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    current.update(patch)
    _save_settings(current)
    return current


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------


@app.get("/api/ollama/status")
async def ollama_status():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            tags = await client.get("http://localhost:11434/api/tags")
            ps = await client.get("http://localhost:11434/api/ps")
        models = [m["name"] for m in tags.json().get("models", [])]
        loaded = [m["name"] for m in ps.json().get("models", [])]
        return {"running": True, "models": models, "loaded": loaded}
    except Exception:
        return {"running": False, "models": [], "loaded": []}


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

        # Choose download URL
        if system == "Darwin":
            url = "https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip"
        else:
            url = "https://github.com/ollama/ollama/releases/latest/download/OllamaSetup.exe"

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp = Path(tmp_dir)

                # --- Download ---
                yield {"data": evt("step", "Downloading Ollama (~280 MB)…", pct=0)}
                filename = "Ollama-darwin.zip" if system == "Darwin" else "OllamaSetup.exe"
                dest = tmp / filename

                async with httpx.AsyncClient(timeout=600.0, follow_redirects=True) as client:
                    async with client.stream("GET", url) as r:
                        total = int(r.headers.get("content-length", 0))
                        downloaded = 0
                        with open(dest, "wb") as fh:
                            async for chunk in r.aiter_bytes(65536):
                                fh.write(chunk)
                                downloaded += len(chunk)
                                if total:
                                    pct = min(60, round(downloaded / total * 60))
                                    yield {"data": evt("progress", f"Downloading… {pct}%", pct=pct)}

                # --- Install ---
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

                else:  # Windows
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
                    # On Windows, OllamaSetup starts the service automatically.
                    # Give it a moment.
                    await asyncio.sleep(3)

                # --- Wait for daemon ---
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
# Model pull
# ---------------------------------------------------------------------------


@app.post("/api/model/pull")
async def pull_model(body: PullRequest):
    """
    Pull an Ollama model. Proxies Ollama's streaming pull API as SSE.
    Event shape: raw JSON lines from Ollama, plus {"type":"error","message":str} on failure.
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
        ("agentsuite",  "agentsuite (core kernel)",        "9.4 MB"),
        ("fastapi",     "FastAPI + uvicorn (local server)", "6.8 MB"),
        ("pydantic",    "pydantic + httpx",                 "11 MB"),
        ("sse_starlette","SSE adapter",                     "0.3 MB"),
    ]:
        try:
            __import__(pkg)
            checks.append({"name": label, "ok": True, "size": size})
        except Exception as e:
            checks.append({"name": label, "ok": False, "size": size, "error": str(e)})

    # Workspace writable
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

    # Step 1: daemon reachable
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
        if r.status_code != 200:
            raise ValueError(f"Ollama returned {r.status_code}")
        steps.append({"label": "Starting Ollama daemon", "ok": True})
    except Exception as exc:
        steps.append({"label": "Starting Ollama daemon", "ok": False, "error": str(exc)})
        return {"ok": False, "steps": steps}

    # Step 2: model present
    try:
        models = [m["name"] for m in r.json().get("models", [])]
        # Accept prefix match (e.g. "gemma4:e4b" matches "gemma4:e4b-...")
        found = any(m.startswith(model.split(":")[0]) for m in models)
        if not found and models:
            model = models[0]  # fall back to whatever is available
        steps.append({"label": f"Loading {model} into memory", "ok": True})
    except Exception as exc:
        steps.append({"label": "Loading model into memory", "ok": False, "error": str(exc)})
        return {"ok": False, "steps": steps}

    # Step 3: generate probe
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
        steps.append({"label": "Running 1-token reasoning probe", "ok": False, "error": str(exc)})
        return {"ok": False, "steps": steps}

    # Step 4: workspace
    try:
        ws = _workspace() / ".agentsuite"
        ws.mkdir(parents=True, exist_ok=True)
        test = ws / "_smoke_test"
        test.write_text("ok")
        test.unlink()
        steps.append({"label": "Verifying agent kernel can write to ~/.agentsuite", "ok": True})
    except Exception as exc:
        steps.append({"label": "Verifying agent kernel write access", "ok": False, "error": str(exc)})
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
        "status": "running",
        "started_at": time.time(),
        "events": [],
        "artifacts": [],
        "qa_score": None,
        "qa_dimensions": [],
        "error": None,
    }
    asyncio.create_task(_execute_run(run_id, req))
    return {"run_id": run_id}


@app.get("/api/run/{run_id}/stream")
async def stream_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        run = _runs[run_id]
        seen = 0
        while True:
            events = run["events"]
            while seen < len(events):
                yield {"data": json.dumps(events[seen])}
                seen += 1
            if run["status"] in ("approved", "rejected", "error", "waiting"):
                if run["status"] == "waiting":
                    yield {"data": json.dumps({"type": "agent_waiting", "run_id": run_id})}
                break
            await asyncio.sleep(0.2)

    return EventSourceResponse(generator())


@app.get("/api/run/{run_id}")
async def get_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return _runs[run_id]


@app.get("/api/run/{run_id}/artifact/{path:path}")
async def get_artifact(run_id: str, path: str):
    """Return the text content of a single artifact file."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    run_dir = (_workspace() / ".agentsuite" / "runs" / as_run_id).resolve()
    artifact_path = (run_dir / path).resolve()
    # Prevent path traversal
    if not str(artifact_path).startswith(str(run_dir)):
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
async def approve_run(run_id: str, body: ApproveRequest):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    if run["status"] not in ("waiting", "done"):
        raise HTTPException(status_code=400, detail=f"Cannot approve run in state: {run['status']}")
    _push_to_kernel(run)
    run["status"] = "approved"
    run["approver"] = body.approver
    run["approved_at"] = time.time()
    return {"status": "approved", "run_id": run_id}


@app.post("/api/run/{run_id}/reject")
async def reject_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    _runs[run_id]["status"] = "rejected"
    return {"status": "rejected", "run_id": run_id}


@app.get("/api/runs")
async def list_runs():
    runs = sorted(_runs.values(), key=lambda r: r["started_at"], reverse=True)
    return {"runs": runs}


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
    step = pipeline["steps"][step_idx]
    if step["run_id"]:
        _push_to_kernel_by_run_id(step["run_id"], pipeline["project"], step["agent"])
    step["status"] = "done"
    asyncio.create_task(_advance_pipeline(pipeline_id, step_idx))
    return {"status": "approved", "pipeline_id": pipeline_id, "step": step_idx}


@app.post("/api/pipelines/{pipeline_id}/reject")
async def reject_pipeline_step(pipeline_id: str):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipelines[pipeline_id]
    step_idx = pipeline["current_step"]
    pipeline["steps"][step_idx]["status"] = "rejected"
    pipeline["status"] = "rejected"
    pipeline["updated_at"] = time.time()
    _pipelines[pipeline_id]["events"].append({
        "type": "pipeline_rejected",
        "pipeline_id": pipeline_id,
        "step": step_idx,
        "ts": time.time(),
    })
    return {"status": "rejected", "pipeline_id": pipeline_id}


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
# Background run executor
# ---------------------------------------------------------------------------


async def _execute_run(run_id: str, req: RunRequest) -> None:
    run = _runs[run_id]

    def emit(event_type: str, **kwargs):
        run["events"].append({"type": event_type, "run_id": run_id, "ts": time.time(), **kwargs})

    emit("agent_start", agent=req.agent_id, project=req.project)

    try:
        from agentsuite.pipeline.orchestrator import PipelineOrchestrator

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()

        def _run_sync():
            def on_progress(event: str, step, pipeline):
                evt = event if event in ("agent_start", "agent_done", "agent_waiting") else "stage_update"
                run["events"].append({
                    "type": evt,
                    "run_id": run_id,
                    "stage": event,
                    "agent": step.agent,
                    "ts": time.time(),
                })

            orch = PipelineOrchestrator(output_root=output_root)
            return orch.run(
                agents=[req.agent_id],
                project_slug=req.project,
                business_goal=req.goal,
                inputs_dir=Path(req.inputs_dir) if req.inputs_dir else None,
                on_progress=on_progress,
            )

        pipeline = await loop.run_in_executor(None, _run_sync)

        step = pipeline.steps[0] if pipeline.steps else None
        artifacts: list[str] = []
        qa_score: float | None = None
        qa_dimensions: list[dict] = []

        if step and step.run_id:
            run_dir = output_root / "runs" / step.run_id
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
                        # Extract per-dimension scores
                        dims = qa_data.get("dimensions") or qa_data.get("scores") or {}
                        if isinstance(dims, dict):
                            qa_dimensions = [
                                {"name": k, "score": float(v)}
                                for k, v in dims.items()
                            ]
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

    except Exception as exc:
        run["status"] = "error"
        run["error"] = str(exc)
        run["events"].append(
            {"type": "error", "run_id": run_id, "message": str(exc), "ts": time.time()}
        )


# ---------------------------------------------------------------------------
# Pipeline background helpers
# ---------------------------------------------------------------------------


def _emit_pipeline(pipeline_id: str, event_type: str, **kwargs) -> None:
    _pipelines[pipeline_id]["events"].append({
        "type": event_type,
        "pipeline_id": pipeline_id,
        "ts": time.time(),
        **kwargs,
    })


async def _execute_pipeline_step(pipeline_id: str, step_idx: int) -> None:
    pipeline = _pipelines[pipeline_id]
    step = pipeline["steps"][step_idx]
    agent_id = step["agent"]

    pipeline["status"] = "running"
    pipeline["updated_at"] = time.time()
    _emit_pipeline(pipeline_id, "agent_start", agent=agent_id, step=step_idx)

    try:
        from agentsuite.pipeline.orchestrator import PipelineOrchestrator

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()
        step_orch_id = f"{pipeline_id}-step{step_idx}"

        def _run_sync():
            def on_progress(event: str, step_state, _pipeline_state):
                _pipelines[pipeline_id]["events"].append({
                    "type": "stage_update" if event not in ("agent_start", "agent_done", "agent_waiting") else event,
                    "pipeline_id": pipeline_id,
                    "stage": event,
                    "agent": step_state.agent,
                    "step": step_idx,
                    "ts": time.time(),
                })

            orch = PipelineOrchestrator(output_root=output_root)
            return orch.run(
                agents=[agent_id],
                project_slug=pipeline["project"],
                business_goal=pipeline["goal"],
                pipeline_id=step_orch_id,
                inputs_dir=Path(pipeline["inputs_dir"]) if pipeline["inputs_dir"] else None,
                on_progress=on_progress,
            )

        result = await loop.run_in_executor(None, _run_sync)
        result_step = result.steps[0] if result.steps else None

        actual_run_id = f"{step_orch_id}-{agent_id}"
        step["run_id"] = actual_run_id

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
                    except Exception:
                        pass

        if pipeline["auto_approve"]:
            _push_to_kernel_by_run_id(actual_run_id, pipeline["project"], agent_id)
            step["status"] = "done"
            await _advance_pipeline(pipeline_id, step_idx)
        else:
            step["status"] = "awaiting_approval"
            pipeline["status"] = "awaiting_approval"
            pipeline["updated_at"] = time.time()
            _emit_pipeline(pipeline_id, "agent_waiting", agent=agent_id, step=step_idx, qa_score=step["qa_score"])

    except Exception as exc:
        step["status"] = "error"
        pipeline["status"] = "error"
        pipeline["updated_at"] = time.time()
        _emit_pipeline(pipeline_id, "pipeline_error", error=str(exc), step=step_idx)


async def _advance_pipeline(pipeline_id: str, approved_step_idx: int) -> None:
    pipeline = _pipelines[pipeline_id]
    step = pipeline["steps"][approved_step_idx]
    step["status"] = "done"
    _emit_pipeline(pipeline_id, "agent_done", agent=step["agent"], step=approved_step_idx, qa_score=step["qa_score"])

    next_idx = approved_step_idx + 1
    pipeline["current_step"] = next_idx

    if next_idx >= len(pipeline["steps"]):
        pipeline["status"] = "done"
        pipeline["updated_at"] = time.time()
        _emit_pipeline(pipeline_id, "pipeline_done")
        return

    pipeline["steps"][next_idx]["status"] = "running"
    pipeline["status"] = "running"
    pipeline["updated_at"] = time.time()
    asyncio.create_task(_execute_pipeline_step(pipeline_id, next_idx))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _workspace() -> Path:
    return Path(os.environ.get("AGENTSUITE_WORKSPACE", Path.home() / "AgentSuite"))


def _push_to_kernel(run: dict) -> None:
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    _push_to_kernel_by_run_id(as_run_id, run["project"], run["agent"])


def _push_to_kernel_by_run_id(run_id: str, project: str, agent: str) -> None:
    workspace = _workspace()
    run_dir = workspace / ".agentsuite" / "runs" / run_id
    kernel_dir = workspace / ".agentsuite" / "_kernel" / project / agent
    kernel_dir.mkdir(parents=True, exist_ok=True)
    if run_dir.exists():
        for f in run_dir.rglob("*"):
            if f.is_file():
                dest = kernel_dir / f.relative_to(run_dir)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)


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
