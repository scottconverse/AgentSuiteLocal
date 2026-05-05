"""
Class-of-bug test: every package declared in [project.dependencies] of
pyproject.toml MUST be importable in the active environment, AND every
runtime hot-path import in the codebase MUST correspond to a declared
dependency.

Why this exists: in v0.8.7, `ollama` was missing from pyproject.toml
even though `agentsuitelocal` and `agentsuite` both import it on the
hot path. The PyInstaller spec listed `ollama` as a hiddenimport, but
hiddenimports only bundle what's installed during the build — and pip
doesn't install undeclared deps. Result: the shipped distributable was
missing the entire Ollama SDK; first-run runs crashed with
"Ollama SDK not installed. Run: pip install agentsuite[ollama]" — advice
end users couldn't act on. The cleanroom and CI E2E suites missed it
because they (a) install `[dev]` extras (everything), (b) only walk the
installer screens (which never trigger the agent code path), and (c)
proxy to a host-cached Ollama so the pull always succeeds before the
real bug surfaces.

This test catches the class directly: if pyproject.toml claims a
package, importing it must succeed.
"""
from __future__ import annotations

import importlib
import sys
import tomllib
from pathlib import Path

import pytest

# Map distribution name (what's in pyproject.toml) → import name.
# Most are identical; these are the ones that diverge.
_DIST_TO_IMPORT = {
    "uvicorn[standard]": "uvicorn",
    "sse-starlette":     "sse_starlette",
    "winotify":          "winotify",
    "pync":              "pync",
}


def _declared_deps() -> list[str]:
    """Read [project.dependencies] from pyproject.toml and return import names."""
    pp = Path(__file__).resolve().parents[1] / "pyproject.toml"
    data = tomllib.loads(pp.read_text())
    raw_deps = data["project"]["dependencies"]
    imports: list[str] = []
    for spec in raw_deps:
        # Strip everything after the first space, semicolon, version operator,
        # or @ (URL form like 'agentsuite @ git+https://...').
        name = spec
        for sep in (";", " ", ">=", "==", "<=", "!=", ">", "<", "@", "~="):
            if sep in name:
                name = name.split(sep, 1)[0]
        name = name.strip()
        if not name:
            continue
        # Skip platform-gated deps that legitimately won't import on this OS.
        if "sys_platform" in spec:
            if "win32" in spec and not sys.platform.startswith("win"):
                continue
            if "darwin" in spec and sys.platform != "darwin":
                continue
        imports.append(_DIST_TO_IMPORT.get(name, name).replace("-", "_"))
    return imports


@pytest.mark.parametrize("module", _declared_deps())
def test_declared_dependency_is_importable(module: str) -> None:
    """Every package in pyproject.toml [project.dependencies] must import."""
    try:
        importlib.import_module(module)
    except ImportError as exc:
        pytest.fail(
            f"Declared dependency '{module}' is not importable: {exc}\n"
            f"This means pyproject.toml lists it but it isn't actually "
            f"available — either pip didn't install it, or the package "
            f"name in _DIST_TO_IMPORT is wrong."
        )


# Hot-path imports the runtime depends on but which aren't always direct
# top-level deps (some are pulled transitively by agentsuite). If any of
# these stop importing, the first user-triggered run will crash even if
# every direct dep in pyproject.toml is fine.
_HOT_PATH_IMPORTS = [
    "agentsuite.kernel.base_agent",
    "agentsuite.pipeline.orchestrator",
    "agentsuite.llm.ollama",
    "agentsuite.llm.resolver",
    "ollama",  # the SDK that agentsuite.llm.ollama wraps
]


@pytest.mark.parametrize("module", _HOT_PATH_IMPORTS)
def test_runtime_hot_path_import(module: str) -> None:
    """Modules invoked during a New Run must all import without errors."""
    importlib.import_module(module)


def test_runtime_verify_endpoint_lists_every_declared_dep() -> None:
    """The /api/runtime/verify endpoint must check every declared dep so
    end users see a clear ❌ on first run if a build is missing one."""
    from agentsuitelocal.api.routers import ollama as ollama_router

    src = Path(ollama_router.__file__).read_text()
    # The endpoint reports a curated subset; require at minimum that the
    # ones most likely to break first runs are checked.
    must_check = {"agentsuite", "ollama", "anthropic", "openai", "mcp", "keyring"}
    missing = [name for name in must_check if f'"{name}"' not in src]
    assert not missing, (
        f"runtime_verify() does not check these critical deps: {missing}. "
        f"Add them to the loop in agentsuitelocal/api/routers/ollama.py "
        f"so missing-bundle bugs surface in the in-app integrity check."
    )


def test_ollama_provider_constructs_without_patching() -> None:
    """Construct OllamaProvider via the real code path — no mocks.

    The existing execution tests patch out _resolve_llm wholesale, which
    is why the missing-ollama-SDK bug shipped: nothing exercised the real
    constructor. If the `ollama` Python SDK isn't installed, OllamaProvider
    raises ProviderNotInstalled here — caught by CI, not by end users
    on first run.
    """
    from agentsuite.llm.ollama import OllamaProvider

    # No-arg construction triggers `import ollama` inside __init__.
    # If the SDK is missing, this raises ProviderNotInstalled.
    provider = OllamaProvider()
    assert provider is not None
    assert provider.name == "ollama"


async def test_resolve_llm_returns_provider_for_default_settings() -> None:
    """End-to-end test of the real _resolve_llm path with no patching.

    Existing execution tests patch _resolve_llm out, so the swallowed
    `except Exception: return None` path was masking BOTH a missing
    `ollama` dep AND a constructor kwarg mismatch. This test catches
    either by demanding a real provider object back.

    ENG-R3-001: _resolve_llm is async since round-3 (asyncio.Lock instead
    of threading.Lock). Test is async; pytest-asyncio with asyncio_mode=auto
    handles it. await is required.
    """
    from agentsuitelocal.api.execution import _resolve_llm, get_last_resolver_error

    provider = await _resolve_llm({"model_tier": "balanced"})
    assert provider is not None, (
        f"_resolve_llm returned None for a default Ollama config. "
        f"Recorded error: {get_last_resolver_error()}\n"
        "Likely causes: (a) `ollama` Python SDK not installed, "
        "(b) OllamaProvider constructor signature changed and the call "
        "site wasn't updated, (c) agentsuite.llm.ollama import error."
    )
    assert provider.__class__.__name__ == "OllamaProvider"
    # On success, the error snapshot must be cleared so /api/runtime/verify
    # doesn't keep reporting a stale failure.
    assert get_last_resolver_error() is None


async def test_resolve_llm_records_error_on_failure() -> None:
    """When _resolve_llm fails, the error must be retrievable via
    get_last_resolver_error() so the smoke screen and /api/runtime/verify
    can surface WHY local LLM resolution failed instead of returning a
    silent None."""
    from unittest.mock import patch

    from agentsuitelocal.api.execution import _resolve_llm, get_last_resolver_error

    # Force the OllamaProvider import to raise a deterministic error.
    sentinel = ImportError("ollama: simulated missing SDK for test")
    with patch("agentsuite.llm.ollama.OllamaProvider", side_effect=sentinel):
        provider = await _resolve_llm({"model_tier": "balanced"})
    assert provider is None
    err = get_last_resolver_error()
    assert err is not None
    assert "simulated missing SDK" in err
