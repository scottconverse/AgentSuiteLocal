"""Pydantic request/response schemas and shared validators."""

from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel, Field, model_validator

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


class RunRequest(BaseModel):
    agent_id: str
    goal: str = Field(max_length=2000)
    project: str
    inputs_dir: str | None = None
    constraints: str | None = None

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
    run_timeout_seconds: int | None = None
    qa_gate_threshold: float | None = None
    dismissed_update_version: str | None = None


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
