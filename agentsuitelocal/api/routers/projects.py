"""Project listing, rename, archive, and delete endpoints."""

from __future__ import annotations

import shutil

from fastapi import APIRouter, HTTPException

from agentsuitelocal.api.schemas import _SLUG_RE, RenameProjectRequest
from agentsuitelocal.api.state import _runs, _save_state, _state_write_lock
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()


@router.get("/api/projects")
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


@router.post("/api/projects/{slug}/rename")
async def rename_project(slug: str, body: RenameProjectRequest):
    """B-1: Rename all runs belonging to a project slug."""
    new_slug = body.new_name.strip().lower().replace(" ", "-")
    if not new_slug:
        raise HTTPException(status_code=422, detail="new_name must be non-empty after normalisation")
    # ENG-0907-003: validate slug after normalisation — a name like "my!project"
    # survives the strip/lower/replace pass and would corrupt the approve_run
    # path which does a filesystem lookup by slug.
    if not _SLUG_RE.match(new_slug):
        raise HTTPException(
            status_code=422,
            detail=f"Normalised project name '{new_slug}' contains invalid characters. "
                   "Use only letters, numbers, hyphens, and underscores.",
        )
    with _state_write_lock:
        matched = [r for r in _runs.values() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for run in matched:
            run["project"] = new_slug
        _save_state()
    return {"slug": new_slug, "previous_slug": slug, "runs_updated": len(matched)}


@router.post("/api/projects/{slug}/archive")
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


@router.delete("/api/projects/{slug}")
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
                shutil.rmtree(artifacts_dir, ignore_errors=True)
        _save_state()
    return {"slug": slug, "deleted": True, "runs_deleted": len(matched)}
