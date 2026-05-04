"""Pipeline lifecycle, SSE stream, approval, reject, and resume endpoints."""

from __future__ import annotations

import asyncio
import json
import time
import uuid

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from agentsuitelocal.api.execution import (
    _advance_pipeline,
    _execute_pipeline_step,
)
from agentsuitelocal.api.schemas import ApproveRequest, PipelineRequest
from agentsuitelocal.api.state import _pipelines, _save_state
from agentsuitelocal.api.workspace import _push_to_kernel_by_run_id

router = APIRouter()


@router.post("/api/pipelines")
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


@router.get("/api/pipelines")
async def list_pipelines():
    pipelines = sorted(_pipelines.values(), key=lambda p: p["started_at"], reverse=True)
    return {"pipelines": pipelines}


@router.get("/api/pipelines/{pipeline_id}")
async def get_pipeline(pipeline_id: str):
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return _pipelines[pipeline_id]


@router.get("/api/pipelines/{pipeline_id}/stream")
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


@router.post("/api/pipelines/{pipeline_id}/approve")
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


@router.post("/api/pipelines/{pipeline_id}/reject")
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


@router.post("/api/pipelines/{pipeline_id}/resume")
async def resume_pipeline(pipeline_id: str):
    """F3: Resume a pipeline from its first pending step."""
    if pipeline_id not in _pipelines:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline = _pipelines[pipeline_id]
    if pipeline["status"] not in ("error",):
        raise HTTPException(status_code=400, detail=f"Pipeline is {pipeline['status']} — only 'error' pipelines can be resumed")

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
