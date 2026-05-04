"""Workspace path resolution and kernel artifact push helpers."""

from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path

from agentsuitelocal.api.schemas import _SLUG_RE


def _workspace() -> Path:
    return Path(os.environ.get("AGENTSUITE_WORKSPACE", Path.home() / "AgentSuite"))


def _push_to_kernel(run: dict) -> Path | None:
    """D1: Push run outputs to kernel with timestamp-based path. Returns export_path."""
    as_run_id = run.get("agentsuite_run_id") or run["id"]
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    return _push_to_kernel_by_run_id(
        as_run_id, run["project"], run["agent"], timestamp=timestamp
    )


def _push_to_kernel_by_run_id(
    run_id: str, project: str, agent: str, timestamp: str | None = None
) -> Path | None:
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
