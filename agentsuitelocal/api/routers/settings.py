"""Settings CRUD and telemetry summary endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException

from agentsuitelocal.api.config import (
    _TELEMETRY_FILE,
    _TIER_MODEL_MAP,
    _load_api_key,
    _load_settings,
    _save_api_key,
    _save_settings,
)
from agentsuitelocal.api.schemas import SettingsPatch
from agentsuitelocal.api.state import _settings_lock

router = APIRouter()


@router.get("/api/settings")
async def get_settings():
    data = _load_settings()
    if data.get("api_key"):
        data["api_key"] = "****"
    return data


async def _apply_settings_patch(body: SettingsPatch) -> dict:
    """Shared logic for POST and PATCH /api/settings."""
    with _settings_lock:
        current = _load_settings()
        patch = body.model_dump(exclude_unset=True)
        # A-8: drop sentinel so it is never persisted
        if patch.get("api_key") in ("****", "***", ""):
            patch.pop("api_key", None)
        # S-2: persist api_key to OS keychain before stripping from patch dict
        if "api_key" in patch:
            _save_api_key(patch.pop("api_key"))
        # G1: when tier changes, derive model_name from tier map unless explicitly overridden
        if "model_tier" in patch and "model_name" not in patch:
            patch["model_name"] = _TIER_MODEL_MAP.get(patch["model_tier"], patch.get("model_name", current.get("model_name")))
        if "workspace_path" in patch:
            try:
                Path(patch["workspace_path"]).mkdir(parents=True, exist_ok=True)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Could not create workspace folder: {exc}") from exc
        current.update(patch)
        _save_settings(current)
        result = dict(current)
        result["api_key"] = _load_api_key()
        if result.get("api_key"):
            result["api_key"] = "****"
        return result


@router.post("/api/settings")
async def save_settings(body: SettingsPatch):
    return await _apply_settings_patch(body)


@router.patch("/api/settings")
async def patch_settings(body: SettingsPatch):
    return await _apply_settings_patch(body)


@router.get("/api/telemetry/summary")
async def telemetry_summary():
    """Aggregate local telemetry log and return event counts."""
    if not _TELEMETRY_FILE.exists():
        return {"enabled": False, "events": {}, "total": 0}
    settings = _load_settings()
    counts: dict[str, int] = {}
    try:
        lines = _TELEMETRY_FILE.read_text().strip().splitlines()
        for line in lines:
            try:
                entry = json.loads(line)
                ev = entry.get("event", "unknown")
                counts[ev] = counts.get(ev, 0) + 1
            except Exception:
                pass
    except Exception:
        pass
    return {
        "enabled": settings.get("telemetry", False),
        "events": counts,
        "total": sum(counts.values()),
    }
