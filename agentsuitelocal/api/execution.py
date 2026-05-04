"""Run and pipeline execution engine."""

from __future__ import annotations

import asyncio
import collections
import json
import math
import os
import re
import threading
import time
from typing import Any
from uuid import uuid4

import httpx

from agentsuitelocal.api.config import (
    _TIER_MODEL_MAP,
    _load_settings,
    _log_telemetry,
    _send_notification,
)
from agentsuitelocal.api.schemas import RunRequest
from agentsuitelocal.api.state import (
    _SSE_BUFFER_SIZE,
    _pipelines,
    _run_event_buffers,
    _runs,
    _save_state,
)
from agentsuitelocal.api.workspace import _push_to_kernel_by_run_id, _workspace

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
            if isinstance(d.get("score"), int | float) and math.isfinite(float(d["score"]))
        ]
    return out


def _move_partial_artifacts(run: dict) -> None:
    """B2: Rename outputs/ → cancelled-outputs/ for cancelled runs."""
    import shutil
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


def _emit_pipeline(pipeline_id: str, event_type: str, **kwargs) -> None:
    _pipelines[pipeline_id]["events"].append({
        "type": event_type,
        "pipeline_id": pipeline_id,
        "ts": time.time(),
        **kwargs,
    })


def _resolve_llm(settings: dict) -> Any:
    """Build an LLM provider from persisted settings.

    G1: tier maps to concrete model name.
    G2: if api_key set AND model starts with 'claude-', use Anthropic.
    """
    api_key = settings.get("api_key")
    model_tier = settings.get("model_tier", "balanced")
    model_name = settings.get("model_name")

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


async def _execute_run(
    run_id: str, req: RunRequest, cancel_token: threading.Event | None = None
) -> None:
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

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()

        def _run_sync():
            if cancel_token is not None and cancel_token.is_set():
                raise RuntimeError("Run cancelled")

            from agentsuite.agents.registry import default_registry
            from agentsuite.kernel.schema import AgentRequest as _AgentRequest

            def progress_callback(event: dict) -> None:
                evt = dict(event)
                loop.call_soon_threadsafe(
                    lambda e=evt: emit("stage_update", **{k: v for k, v in e.items() if k != "type"})
                )

            agent_cls = default_registry().get_class(req.agent_id)
            agent = agent_cls(output_root=output_root, llm=llm)
            request = _AgentRequest(
                agent_name=req.agent_id,
                role_domain=req.agent_id,
                user_request=req.goal,
                business_goal=req.goal,
            )
            return agent.run(request=request, run_id=str(uuid4()), progress_callback=progress_callback)

        return await loop.run_in_executor(None, _run_sync)

    try:
        state = await asyncio.wait_for(_do_run(), timeout=timeout_secs)

        artifacts: list[str] = []
        qa_score: float | None = None
        qa_dimensions: list[dict] = []

        if state and state.run_id:
            run_dir = _workspace() / ".agentsuite" / "runs" / state.run_id
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

        run["agentsuite_run_id"] = state.run_id if state else None
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

    try:
        settings = _load_settings()
        llm = _resolve_llm(settings)

        output_root = _workspace() / ".agentsuite"
        loop = asyncio.get_running_loop()
        step_orch_id = f"{pipeline_id}-step{step_idx}"

        def _run_sync():
            from agentsuite.agents.registry import default_registry
            from agentsuite.kernel.schema import AgentRequest as _AgentRequest

            def progress_callback(event: dict) -> None:
                evt = dict(event)
                loop.call_soon_threadsafe(
                    lambda e=evt: _emit_pipeline(
                        pipeline_id, "stage_update",
                        step=step_idx,
                        **{k: v for k, v in e.items() if k != "type"},
                    )
                )

            agent_cls = default_registry().get_class(agent_id)
            agent = agent_cls(output_root=output_root, llm=llm)
            request = _AgentRequest(
                agent_name=agent_id,
                role_domain=agent_id,
                user_request=pipeline["goal"],
                business_goal=pipeline["goal"],
            )
            return agent.run(request=request, run_id=step_orch_id, progress_callback=progress_callback)

        result = await loop.run_in_executor(None, _run_sync)

        step["run_id"] = result.run_id if (result and result.run_id) else None

        if result and result.run_id:
            run_dir = output_root / "runs" / result.run_id
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
