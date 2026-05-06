"""Settings, keyring, telemetry, crash reports, launcher port, and notifications."""

from __future__ import annotations

import json
import platform
import subprocess
import sys
import time
import traceback
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agentsuitelocal.__version__ import __version__

# S-2: OS keychain for API key storage
try:
    import keyring as _keyring
    _KEYRING_AVAILABLE = True
except ImportError:
    _keyring = None  # type: ignore[assignment]
    _KEYRING_AVAILABLE = False

_SETTINGS_FILE = Path.home() / ".agentsuitelocal" / "settings.json"

# S-2: OS keychain constants
_KEYRING_SERVICE = "agentsuitelocal"
_KEYRING_USERNAME = "api_key"

# In-memory fallback for environments where keyring is importable but has no
# usable backend at runtime (e.g. Linux CI without a D-Bus secret service).
_API_KEY_MEM: str | None = None

_TELEMETRY_FILE = Path.home() / ".agentsuitelocal" / "usage.jsonl"
_CRASH_DIR = Path.home() / ".agentsuitelocal" / "crash-reports"
# QA-001 fix: launcher.log is plaintext appended to by launcher.py; if config.py
# wrote port JSON to the same path, the two would corrupt each other (last writer
# wins). Use a separate single-purpose file for the structured port snapshot.
_LAUNCHER_PORT_FILE = Path.home() / ".agentsuitelocal" / "launcher.port.json"
_LAUNCHER_LOG = _LAUNCHER_PORT_FILE  # back-compat alias; prefer _LAUNCHER_PORT_FILE

# G1: model tier → concrete model name mapping
# Keys MUST match frontend data.js tier IDs: "light", "balanced", "pro"
_TIER_MODEL_MAP = {
    "light":     "gemma4:e2b",
    "balanced":  "gemma4:e4b",
    "pro":       "gemma4:26b-moe",
}

_SETTINGS_DEFAULTS: dict[str, Any] = {
    "model_tier": "balanced",
    "model_name": "gemma4:e4b",
    "open_on_launch": True,
    "telemetry": False,
    "enabled_agents": ["founder", "design", "product", "engineering", "marketing", "trust_risk", "cio"],
    # S-2: api_key is NOT stored in settings.json — it lives in the OS keychain.
    "cloud_model": "claude-3-5-haiku-20241022",
    "notifications": True,
    "run_timeout_seconds": 900,    # B3: watchdog default 15 min
    "qa_gate_threshold": 7.0,      # C1: configurable QA gate
    "dismissed_update_version": None,  # H2: track dismissed update banner
}


def _load_api_key() -> str | None:
    """Load API key from OS keychain (preferred) with in-memory and JSON fallbacks."""
    if _KEYRING_AVAILABLE:
        try:
            val = _keyring.get_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
            if val:
                return val
        except Exception:
            pass
    if _API_KEY_MEM:
        return _API_KEY_MEM
    # JSON fallback: migration path for keys stored before keychain support
    if _SETTINGS_FILE.exists():
        try:
            stored = json.loads(_SETTINGS_FILE.read_text())
            key = stored.get("api_key")
            if key:
                _save_api_key(key)
                stored.pop("api_key")
                _SETTINGS_FILE.write_text(json.dumps(stored, indent=2))
                return key
        except Exception:
            pass
    return None


def _save_api_key(key: str | None) -> None:
    """Store API key in OS keychain with in-memory fallback for CI/no-backend envs."""
    global _API_KEY_MEM
    if not _KEYRING_AVAILABLE:
        _API_KEY_MEM = key or None
        return
    try:
        if key:
            _keyring.set_password(_KEYRING_SERVICE, _KEYRING_USERNAME, key)
        else:
            try:
                _keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USERNAME)
            except Exception:
                pass
        _API_KEY_MEM = None
    except Exception:
        # Keyring importable but no runtime backend (e.g. Linux without D-Bus).
        _API_KEY_MEM = key or None


def _load_settings() -> dict[str, Any]:
    result = dict(_SETTINGS_DEFAULTS)
    if _SETTINGS_FILE.exists():
        try:
            stored = json.loads(_SETTINGS_FILE.read_text())
            result.update(stored)
        except Exception:
            pass
    # S-2: inject api_key from OS keychain (never from JSON file)
    result["api_key"] = _load_api_key()
    return result


def _save_settings(data: dict[str, Any]) -> None:
    # S-2: strip api_key before writing to JSON
    safe = {k: v for k, v in data.items() if k != "api_key"}
    _SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    _SETTINGS_FILE.write_text(json.dumps(safe, indent=2))


def _log_telemetry(event_type: str, **kwargs) -> None:
    """Append one JSONL event to the telemetry file when telemetry is enabled."""
    try:
        settings = _load_settings()
        if not settings.get("telemetry"):
            return
        entry = {
            "ts": datetime.now(UTC).isoformat(),
            "event": event_type,
            **kwargs,
        }
        _TELEMETRY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(_TELEMETRY_FILE, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry) + "\n")
    except Exception:
        pass  # telemetry must never crash the app


def _write_crash_report(exc: Exception, request_path: str = "") -> Path | None:
    """Write a crash report JSON to the crash-reports directory."""
    try:
        _CRASH_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        report = {
            "timestamp": ts,
            "version": __version__,
            "python_version": sys.version,
            "os": platform.platform(),
            "exception_type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
            "request_path": request_path,
        }
        path = _CRASH_DIR / f"{ts}-crash.json"
        path.write_text(json.dumps(report, indent=2))
        return path
    except Exception:
        return None


def _write_launcher_log(port: int) -> None:
    try:
        _LAUNCHER_LOG.parent.mkdir(parents=True, exist_ok=True)
        _LAUNCHER_LOG.write_text(json.dumps({"port": port, "ts": time.time()}))
    except Exception:
        pass


def _read_launcher_port(default: int = 8765) -> int:
    try:
        if _LAUNCHER_LOG.exists():
            data = json.loads(_LAUNCHER_LOG.read_text())
            return int(data.get("port", default))
    except Exception:
        pass
    return default


def _send_notification(title: str, body: str, action_url: str | None = None) -> None:
    """Send a desktop notification. Best-effort — never crashes the app."""
    try:
        settings = _load_settings()
        if not settings.get("notifications", True):
            return

        system = platform.system()
        if system == "Windows":
            try:
                from winotify import Notification, audio
                toast = Notification(
                    app_id="AgentSuiteLocal",
                    title=title,
                    msg=body,
                )
                if action_url:
                    toast.add_actions(label="Review now", launch=action_url)
                toast.set_audio(audio.Default, loop=False)
                toast.show()
            except ImportError:
                pass
        elif system == "Darwin":
            try:
                import pync
                pync.notify(body, title=title)
            except ImportError:
                try:
                    subprocess.Popen(
                        ["terminal-notifier", "-title", title, "-message", body],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                except Exception:
                    pass
    except Exception:
        pass
