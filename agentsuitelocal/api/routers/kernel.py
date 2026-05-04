"""Kernel artifact listing, retrieval, and diff endpoints."""

from __future__ import annotations

import difflib
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from agentsuitelocal.api.schemas import _SLUG_RE
from agentsuitelocal.api.workspace import _workspace

router = APIRouter()


@router.get("/api/kernel")
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


@router.get("/api/kernel/{project}/{agent}/{path:path}")
async def get_kernel_artifact(project: str, agent: str, path: str):
    """UX-4: Read a single kernel artifact for inline preview."""
    if not _SLUG_RE.match(project) or not _SLUG_RE.match(agent):
        raise HTTPException(status_code=422, detail="Invalid project or agent slug")
    kernel_root = (_workspace() / ".agentsuite" / "_kernel").resolve()
    target = (kernel_root / project / agent / path).resolve()
    if not target.is_relative_to(kernel_root):
        raise HTTPException(status_code=403, detail="Path outside kernel root")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")
    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        return {"content": content, "path": str(target)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/api/kernel/diff")
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
