"""Run lifecycle, SSE stream, approval, export, and listing endpoints."""

from __future__ import annotations

import asyncio
import html
import io
import json
import os
import tempfile
import threading
import time
import uuid
import zipfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import ValidationError
from sse_starlette.sse import EventSourceResponse
from starlette.background import BackgroundTask

from agentsuitelocal.api.config import _load_settings, _log_telemetry, _send_notification
from agentsuitelocal.api.execution import (
    _execute_run,
    _move_partial_artifacts,
    _scrub_nan_from_run,
)
from agentsuitelocal.api.schemas import OverrideApproveRequest, RunRequest
from agentsuitelocal.api.state import (
    _append_event,
    _run_cancel_tokens,
    _run_tasks,
    _runs,
    _save_state,
    _state_write_lock,
)
from agentsuitelocal.api.workspace import _push_to_kernel, _workspace

router = APIRouter()


@router.post("/api/run")
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
        "qa_status": "missing",   # "ok" | "failed" | "missing" — set by _execute_run
        "error": None,
        "partial_artifacts": False,
        "overridden": False,
    }
    _save_state()
    cancel_token = threading.Event()
    _run_cancel_tokens[run_id] = cancel_token
    task = asyncio.create_task(_execute_run(run_id, req, cancel_token))
    _run_tasks[run_id] = task
    _log_telemetry("run_started", agent=req.agent_id, project=req.project)
    return {"run_id": run_id}


_RETRYABLE_STATES = {"error", "timeout", "cancelled", "failed"}


@router.post("/api/run/{run_id}/retry")
async def retry_run(run_id: str):
    """UX-005 / ENG-R2-001 / QA3-302 / ENG-R3-004: Re-submit a failed/timed-out
    /cancelled run with the same parameters. The original run record is
    preserved for history.

    State guard prevents retry-storms: only runs that have actually concluded
    in a non-success terminal state are retryable. Calling retry on a running
    or waiting run is rejected with 409 — otherwise double-clicks would spawn
    duplicate concurrent runs sharing the same project workspace and FIFO-
    evict legitimate run history.

    QA3-302: take an immutable snapshot of the source run's fields BEFORE
    constructing the RunRequest. /api/run/{run_id}/cancel and other handlers
    can mutate _runs[run_id] concurrently; reading individual fields
    one-at-a-time can produce a torn view.

    ENG-R3-004: catch pydantic ValidationError. Legacy run records may have
    stale shapes (missing inputs_dir, non-slug projects). Surface 422 with
    the underlying error rather than crashing with 500.
    """
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")

    # Snapshot first — read all needed fields under a single dict-copy so a
    # concurrent /cancel can't tear the view between reads.
    snap = dict(_runs[run_id])
    status = snap.get("status", "")
    if status not in _RETRYABLE_STATES:
        raise HTTPException(
            status_code=409,
            detail=f"Run is in state '{status}'; retry is only permitted from {sorted(_RETRYABLE_STATES)}.",
        )

    try:
        req = RunRequest(
            agent_id=snap.get("agent"),
            project=snap.get("project"),
            goal=snap.get("goal"),
            inputs_dir=snap.get("inputs_dir"),
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Source run record is incompatible with current RunRequest schema: {exc}",
        )
    return await start_run(req)


@router.post("/api/run/{run_id}/cancel")
async def cancel_run(run_id: str):
    """B1: Cancel a running run by cancelling its asyncio Task."""
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        if run["status"] not in ("running",):
            raise HTTPException(status_code=400, detail=f"Cannot cancel run in state: {run['status']}")

    # B3: set the thread-level token first so the executor thread stops cooperatively
    token = _run_cancel_tokens.get(run_id)
    if token:
        token.set()

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
        _append_event(run, {"type": "cancelled", "run_id": run_id, "ts": time.time()})
        _save_state()

    _move_partial_artifacts(run)
    _log_telemetry("run_cancelled", agent=run.get("agent", ""), project=run.get("project", ""))
    _send_notification(
        "AgentSuiteLocal",
        f"{run.get('agent', 'Agent')} run on {run.get('project', '')} was cancelled.",
    )
    return {"status": "cancelled", "run_id": run_id}


@router.get("/api/run/{run_id}/stream")
async def stream_run(run_id: str, since: int = 0):
    """B4: SSE stream with ?since= parameter for reconnect replay.

    Replay window is bounded by ``_MAX_EVENTS_PER_RUN`` (see state.py).
    Reconnects with ``since`` lower than the FIFO-eviction floor will
    receive only the still-buffered tail; the stream still progresses
    correctly, but very early events from a long-running pipeline may
    be missing. Lifecycle markers (agent_start, agent_done, approval,
    error) are well within the cap.
    """
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        run = _runs[run_id]
        seen = since

        while True:
            events = run["events"]
            while seen < len(events):
                evt = events[seen]
                yield {"data": json.dumps(evt)}
                seen += 1
            if run["status"] in ("approved", "rejected", "error", "waiting", "cancelled", "timeout"):
                break
            await asyncio.sleep(0.2)

    return EventSourceResponse(generator())


@router.get("/api/run/{run_id}")
async def get_run(run_id: str):
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return _scrub_nan_from_run(_runs[run_id])


@router.get("/api/run/{run_id}/artifact/{path:path}")
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


@router.post("/api/run/{run_id}/approve")
async def approve_run(run_id: str, body: OverrideApproveRequest):
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        if run["status"] != "waiting":
            raise HTTPException(status_code=400, detail=f"Cannot approve run in state: {run['status']}")

        # QA-005: enforce qa_gate_threshold — gate is not purely cosmetic.
        # Only enforce when: (a) qa_score is present (not None) AND (b) override
        # flag is not set. A missing score (qa_status="missing"/"failed") never
        # auto-approves — the frontend should also block it, but belt-and-suspenders.
        if not body.override:
            settings = _load_settings()
            threshold = settings.get("qa_gate_threshold", 7.0)
            qa_score = run.get("qa_score")
            if qa_score is not None and qa_score < threshold:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"QA score {qa_score:.1f} is below the configured gate threshold "
                        f"{threshold:.1f}. Use Override & approve to bypass with confirmation."
                    ),
                )

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


@router.post("/api/run/{run_id}/reject")
async def reject_run(run_id: str):
    with _state_write_lock:
        if run_id not in _runs:
            raise HTTPException(status_code=404, detail="Run not found")
        run = _runs[run_id]
        # QA-002: state guard — symmetric with approve_run.
        # Reject is only meaningful when the run is at the approval gate ("waiting").
        # Rejecting a running/cancelled/error/approved run corrupts the record.
        if run["status"] != "waiting":
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reject run in state: {run['status']}",
            )
        run["status"] = "rejected"
        _save_state()
    _log_telemetry("run_rejected", agent=run.get("agent", ""), project=run.get("project", ""))
    _send_notification(
        "AgentSuiteLocal",
        f"{run.get('agent', 'Agent')} run on {run.get('project', '')} rejected.",
    )
    return {"status": "rejected", "run_id": run_id}


@router.get("/api/runs")
async def list_runs():
    runs = sorted(_runs.values(), key=lambda r: r["started_at"], reverse=True)
    return {"runs": runs}


@router.get("/api/run/{run_id}/export/zip")
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
            background=BackgroundTask(os.unlink, tmp_path),
        )
    except Exception as exc:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/run/{run_id}/export/markdown")
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


def _build_pdf_html(run_id: str, outputs_dir) -> str:
    """Build an HTML document of all run artifacts.

    Maintained as the HTML-escape regression fixture for ENG-088-001 — the
    class of bug where LLM-produced artifact content containing `<`, `>`,
    `&`, or literal `</pre>` sequences (markdown-with-embedded-HTML, code
    blocks) corrupts an HTML-based renderer or injects content.

    The live PDF rendering path now uses ``_build_pdf_bytes`` (reportlab),
    which does not interpret artifact text as markup. This function is kept
    so ``tests/test_pdf_export_escape.py`` can verify the HTML-escape
    contract in isolation without a PDF engine dependency.
    """
    md_parts = [f"<h1>{html.escape(run_id)} — Artifact Bundle</h1>"]
    if outputs_dir.exists():
        for f in sorted(outputs_dir.rglob("*")):
            if f.is_file():
                rel = f.relative_to(outputs_dir)
                try:
                    content = f.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    content = "(binary file)"
                md_parts.append(
                    f"<hr><h2>{html.escape(str(rel))}</h2>"
                    f"<pre>{html.escape(content)}</pre>"
                )
    return f"<html><body style='font-family:sans-serif'>{''.join(md_parts)}</body></html>"


def _build_pdf_bytes(run_id: str, outputs_dir) -> bytes:
    """Render all run artifacts to a PDF using reportlab (pure Python, no GTK).

    reportlab's ``Preformatted`` flowable treats artifact text as literal
    characters — no HTML parsing, no injection surface. The run_id and
    file-path strings go through reportlab's ``Paragraph`` flowable, which
    interprets a small XML-like subset, so they are HTML-escaped to prevent
    any embedded `<` / `>` / `&` from being mis-parsed as markup.
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        HRFlowable,
        Paragraph,
        Preformatted,
        SimpleDocTemplate,
        Spacer,
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )
    styles = getSampleStyleSheet()
    code_style = ParagraphStyle(
        "ArtifactCode",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=10,
    )

    # Paragraph parses reportlab XML — escape & < > in values going into it.
    story = [Paragraph(html.escape(f"{run_id} — Artifact Bundle"), styles["Title"])]

    if outputs_dir.exists():
        for f in sorted(outputs_dir.rglob("*")):
            if f.is_file():
                rel = f.relative_to(outputs_dir)
                try:
                    content = f.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    content = "(binary file)"
                story.extend([
                    HRFlowable(width="100%"),
                    Spacer(1, 6),
                    Paragraph(html.escape(str(rel)), styles["Heading2"]),
                    # Preformatted: text is inserted literally — no XML parsing.
                    Preformatted(content, code_style),
                ])

    doc.build(story)
    return buf.getvalue()


@router.get("/api/run/{run_id}/export/pdf")
async def export_run_pdf(run_id: str):
    """D4: Export all artifacts as a PDF via reportlab (pure Python, no GTK)."""
    if run_id not in _runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = _runs[run_id]
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    outputs_dir = _workspace() / ".agentsuite" / "runs" / as_run_id

    try:
        pdf_bytes = _build_pdf_bytes(run_id, outputs_dir)
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={run_id}-bundle.pdf"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
