"""Pydantic request/response schemas and shared validators."""

from __future__ import annotations

import re
import os
from pathlib import Path

from pydantic import BaseModel, Field, field_validator, model_validator

_SLUG_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def _validate_inputs_dir(raw: str) -> None:
    """Reject inputs_dir values that escape the user's home directory."""
    if len(raw) > 512:
        raise ValueError("inputs_dir path is too long (max 512 characters)")
    p = Path(raw).resolve()
    home = Path.home().resolve()
    if not p.is_relative_to(home):
        raise ValueError("inputs_dir must be within your home directory")
    if not p.exists() or not p.is_dir():
        raise ValueError("inputs_dir must be an existing directory")


def _validate_workspace_path(raw: str) -> str:
    if len(raw) > 512:
        raise ValueError("workspace_path path is too long (max 512 characters)")
    p = Path(raw).expanduser()
    if not p.is_absolute():
        raise ValueError("workspace_path must be an absolute path")
    resolved = p.resolve(strict=False)
    if resolved.parent == resolved:
        raise ValueError("workspace_path cannot be a drive or filesystem root")
    if resolved.exists() and not resolved.is_dir():
        raise ValueError("workspace_path must be a folder")

    parent = resolved if resolved.exists() else resolved.parent
    if not parent.exists() or not parent.is_dir():
        raise ValueError("workspace_path parent folder does not exist")

    protected_roots = [
        os.environ.get("SystemRoot"),
        os.environ.get("ProgramFiles"),
        os.environ.get("ProgramFiles(x86)"),
        "/bin",
        "/etc",
        "/sbin",
        "/usr",
    ]
    for root in protected_roots:
        if not root:
            continue
        try:
            if resolved.is_relative_to(Path(root).resolve(strict=False)):
                raise ValueError("workspace_path cannot be inside a system or application folder")
        except OSError:
            continue
    return str(resolved)


class RunRequest(BaseModel):
    agent_id: str
    goal: str = Field(max_length=2000)
    project: str
    inputs_dir: str | None = None

    @model_validator(mode="after")
    def validate_slugs_and_paths(self) -> RunRequest:
        if not _SLUG_RE.match(self.project):
            raise ValueError("project must contain only letters, numbers, hyphens, and underscores")
        if not _SLUG_RE.match(self.agent_id):
            raise ValueError("agent_id must contain only letters, numbers, hyphens, and underscores")
        if self.inputs_dir is not None:
            _validate_inputs_dir(self.inputs_dir)
        return self


class ApproveRequest(BaseModel):
    approver: str = "user"


class SettingsPatch(BaseModel):
    model_tier: str | None = None
    model_name: str | None = None
    open_on_launch: bool | None = None
    telemetry: bool | None = None
    enabled_agents: list[str] | None = None
    api_key: str | None = None
    cloud_model: str | None = None
    notifications: bool | None = None
    # QA-003: bounds validation — prevents negative timeout (crashes asyncio.wait_for)
    # and out-of-range threshold (makes approval impossible or always-pass).
    run_timeout_seconds: int | None = Field(None, ge=60, le=86400)
    qa_gate_threshold: float | None = Field(None, ge=0.0, le=10.0)
    dismissed_update_version: str | None = None
    workspace_path: str | None = None
    setup_complete: bool | None = None

    @field_validator("workspace_path")
    @classmethod
    def validate_workspace_path(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return _validate_workspace_path(value)


class PullRequest(BaseModel):
    model: str


class PipelineRequest(BaseModel):
    name: str = Field(max_length=200)
    project: str
    goal: str = Field(max_length=2000)
    agents: list[str] = Field(min_length=1)
    inputs_dir: str | None = None
    auto_approve: bool = False

    @model_validator(mode="after")
    def validate_slugs_and_paths(self) -> PipelineRequest:
        if not _SLUG_RE.match(self.project):
            raise ValueError("project must contain only letters, numbers, hyphens, and underscores")
        for agent_id in self.agents:
            if not _SLUG_RE.match(agent_id):
                raise ValueError(f"agent id {agent_id!r} must contain only letters, numbers, hyphens, and underscores")
        if self.inputs_dir is not None:
            _validate_inputs_dir(self.inputs_dir)
        return self


class PathValidateRequest(BaseModel):
    path: str


class OpenFolderRequest(BaseModel):
    path: str


class OverrideApproveRequest(BaseModel):
    approver: str = "user"
    override: bool = False


class RenameProjectRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=200)


class UninstallPhase2Request(BaseModel):
    delete_workspace: bool = False


class UninstallPhase3Request(BaseModel):
    delete_model: bool = False
    model_name: str = ""
