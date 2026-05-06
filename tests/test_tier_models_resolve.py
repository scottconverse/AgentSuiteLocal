"""
Regression test for QA-DD-002 (audit-AgentSuiteLocal-2026-05-05-v088).

Class of bug: a model name in `_TIER_MODEL_MAP` (or in the `model_name`
default) that *claims* to identify an Ollama model but returns 404 from
the registry. Fresh installs default to a model the Pull endpoint
cannot retrieve.

In v0.8.8 the `pro` tier mapped to `gemma4:26b-moe`, which 404s on
`https://registry.ollama.ai/v2/library/gemma4/manifests/26b-moe`.

This test queries the OCI manifest endpoint that `ollama pull` uses
internally. Network-flake-tolerant: a connection failure skips the
test (so an offline laptop CI runner doesn't go red); a 404 fails it
(so the bug class can't slip through).
"""
from __future__ import annotations

import urllib.error
import urllib.request

import pytest

from agentsuitelocal.api.config import _SETTINGS_DEFAULTS, _TIER_MODEL_MAP

REGISTRY_URL = "https://registry.ollama.ai/v2/library/{name}/manifests/{tag}"


def _candidate_model_names() -> set[str]:
    """Every model name that needs to resolve against Ollama's registry."""
    names = set(_TIER_MODEL_MAP.values())
    default = _SETTINGS_DEFAULTS.get("model_name")
    if default:
        names.add(default)
    return names


def _resolves(model_spec: str) -> tuple[bool, int | str]:
    """Query the OCI manifest endpoint. Returns (ok, status-or-error)."""
    if ":" in model_spec:
        name, tag = model_spec.split(":", 1)
    else:
        name, tag = model_spec, "latest"
    url = REGISTRY_URL.format(name=name, tag=tag)
    req = urllib.request.Request(url, method="HEAD")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return (200 <= resp.status < 400, resp.status)
    except urllib.error.HTTPError as exc:
        return (False, exc.code)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        # Network-level failure — skip the test rather than flake CI.
        pytest.skip(f"Ollama registry unreachable for {model_spec}: {exc}")


@pytest.mark.parametrize("model_spec", sorted(_candidate_model_names()))
def test_tier_model_resolves_against_ollama_registry(model_spec: str) -> None:
    """Every model in _TIER_MODEL_MAP and the default model_name must
    resolve against Ollama's OCI registry. A 404 here means a fresh
    install will fail to pull on first run."""
    ok, status = _resolves(model_spec)
    assert ok, (
        f"Model `{model_spec}` returned HTTP {status} from "
        f"https://registry.ollama.ai/v2/library/<name>/manifests/<tag>. "
        f"Fresh installs that select this model will fail to pull. "
        f"Either pick a model name that resolves (verify with "
        f"`curl -I https://registry.ollama.ai/v2/library/<name>/manifests/<tag>`), "
        f"or remove the entry from _TIER_MODEL_MAP."
    )
