"""
AgentSuiteLocal — FastAPI backend

Thin wrapper around AgentSuite's PipelineOrchestrator.
SSE events map directly to ProgressCallback:
  agent_start | stage_update | agent_done | agent_waiting
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
import uuid
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
# In-memory run store (sufficient for local single-user)
# ---------------------------------------------------------------------------

_runs: dict[str, dict[str, Any]] = {}

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


# ---------------------------------------------------------------------------
# Health + hardware
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    """Check Ollama daemon and model status."""
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
    """Probe CPU, RAM, disk for the installer hardware-check screen."""
    cpu_count = psutil.cpu_count(logical=False) or psutil.cpu_count()
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage(Path.home())

    ram_gb = round(ram.total / 1024**3, 1)
    ram_free_gb = round(ram.available / 1024**3, 1)
    disk_free_gb = round(disk.free / 1024**3)
    disk_total_gb = round(disk.total / 1024**3)

    # Recommend a model tier based on available RAM
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
        import platform

        uname = platform.uname()
        return f"{uname.processor or uname.machine} · {uname.system}"
    except Exception:
        return "Unknown CPU"


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------


@app.get("/api/ollama/status")
async def ollama_status():
    """Detailed Ollama status: running, models, loaded model."""
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
# Run management
# ---------------------------------------------------------------------------


@app.post("/api/run")
async def start_run(req: RunRequest):
    """
    Start a new agent run. Returns run_id immediately; progress via SSE.
    The actual pipeline executes in a background asyncio task.
    """
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
        "error": None,
    }
    asyncio.create_task(_execute_run(run_id, req))
    return {"run_id": run_id}


@app.get("/api/run/{run_id}/stream")
async def stream_run(run_id: str):
    """
    SSE endpoint — streams run progress events.
    Events: agent_start | stage_update | agent_done | agent_waiting | error
    """
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
    """Run status, artifacts list, and QA score."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return _runs[run_id]


@app.post("/api/run/{run_id}/approve")
async def approve_run(run_id: str, body: ApproveRequest):
    """Promote artifacts to kernel and mark run approved."""
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
    """Mark run rejected (artifacts stay on disk, not promoted)."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    _runs[run_id]["status"] = "rejected"
    return {"status": "rejected", "run_id": run_id}


@app.get("/api/runs")
async def list_runs():
    """All runs, sorted newest first."""
    runs = sorted(_runs.values(), key=lambda r: r["started_at"], reverse=True)
    return {"runs": runs}


# ---------------------------------------------------------------------------
# Kernel
# ---------------------------------------------------------------------------


@app.get("/api/kernel")
async def kernel_artifacts():
    """List artifacts currently in the kernel for all projects."""
    workspace = _workspace()
    kernel_root = workspace / ".agentsuite" / "_kernel"
    if not kernel_root.exists():
        return {"projects": {}}
    result: dict[str, list[str]] = {}
    for proj in kernel_root.iterdir():
        if proj.is_dir():
            result[proj.name] = [
                str(f.relative_to(proj)) for f in proj.rglob("*") if f.is_file()
            ]
    return {"projects": result}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@app.get("/api/projects")
async def list_projects():
    """Derive project list from runs store."""
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
    """
    Execute the AgentSuite pipeline in a thread pool.
    Emits SSE-compatible events into _runs[run_id]["events"].
    """
    run = _runs[run_id]

    def emit(event_type: str, **kwargs):
        run["events"].append({"type": event_type, "run_id": run_id, "ts": time.time(), **kwargs})

    try:
        from agentsuite.agents import get_agent_class
        from agentsuite.pipeline.orchestrator import PipelineOrchestrator

        workspace = _workspace()
        project_dir = workspace / req.project

        emit("agent_start", agent=req.agent_id, project=req.project)

        loop = asyncio.get_running_loop()

        def _run_sync():
            def progress(stage: str, message: str, **kw):
                run["events"].append(
                    {
                        "type": "stage_update",
                        "run_id": run_id,
                        "stage": stage,
                        "message": message,
                        "ts": time.time(),
                        **kw,
                    }
                )

            agent_cls = get_agent_class(req.agent_id)
            agent = agent_cls(
                project_dir=project_dir,
                goal=req.goal,
                progress_callback=progress,
            )
            result = agent.run()
            return result

        result = await loop.run_in_executor(None, _run_sync)

        run["artifacts"] = result.get("artifacts", [])
        run["qa_score"] = result.get("qa_score")
        run["status"] = "waiting"
        emit("agent_waiting", qa_score=run["qa_score"], artifacts=run["artifacts"])

    except Exception as exc:
        run["status"] = "error"
        run["error"] = str(exc)
        run["events"].append(
            {"type": "error", "run_id": run_id, "message": str(exc), "ts": time.time()}
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _workspace() -> Path:
    """Returns ~/AgentSuite, honouring AGENTSUITE_WORKSPACE env var."""
    return Path(os.environ.get("AGENTSUITE_WORKSPACE", Path.home() / "AgentSuite"))


def _push_to_kernel(run: dict) -> None:
    """
    Promote run artifacts to the project kernel directory.
    Mirrors AgentSuite's approve_run logic for local use.
    """
    workspace = _workspace()
    project = run["project"]
    agent = run["agent"]
    run_dir = workspace / ".agentsuite" / "runs" / run["id"]
    kernel_dir = workspace / ".agentsuite" / "_kernel" / project / agent
    kernel_dir.mkdir(parents=True, exist_ok=True)

    if run_dir.exists():
        import shutil

        for f in run_dir.rglob("*"):
            if f.is_file():
                dest = kernel_dir / f.relative_to(run_dir)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)


# ---------------------------------------------------------------------------
# Serve built frontend (production)
# ---------------------------------------------------------------------------

_WEB_DIST = Path(__file__).parent.parent.parent / "web" / "dist"

if _WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        index = _WEB_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend not built")
