# Sprint B B7 — DI refactor design (mocking audit closure)

**Status:** design (locked before code edits per orchestrator dispatch)
**Date:** 2026-05-08
**Branch:** `release/v0.9.0`
**Scope:** close the 9 INTERNAL-SUSPECT-REFACTOR sites in `docs/MOCKING_AUDIT.md`.

## Goal

Convert 9 test sites from `unittest.mock.patch("agentsuitelocal.api.execution._save_state")` (and siblings) to passing fake callables through a function parameter. Tests substitute boundary impls instead of patching internal module attributes. The audit calls this out as the single highest-leverage Sprint B improvement.

## Constraint

Per orchestrator dispatch:

> If the design changes the public API surface in a meaningful way, STOP and surface to Scott — that may exceed Sprint B scope.

Constraint honoured: **no public HTTP route shape, no schema change, no dependency change**. Only internal call signatures change, and only by adding optional keyword arguments with defaults that preserve existing behaviour.

## Approach

**Optional-default-callable injection on `_execute_run` and `_execute_pipeline_step`.** Three new keyword arguments per function:

```python
async def _execute_run(
    run_id: str,
    req: RunRequest,
    cancel_token: threading.Event,
    *,
    save_state: Callable[[], None] = _save_state,
    log_telemetry: Callable[..., None] = _log_telemetry,
    load_settings: Callable[[], dict] = _load_settings,
) -> None: ...
```

Inside the body, every `_save_state()` becomes `save_state()`, every `_log_telemetry(...)` becomes `log_telemetry(...)`, every `_load_settings()` becomes `load_settings()`. Production callers (`routers/runs.py::start_run`, the retry handler) never pass the kwargs; defaults preserve current behaviour.

The same pattern applies to `_execute_pipeline_step` (and `_advance_pipeline` if it touches these helpers — verify in implementation).

`_send_notification` is reclassified BOUNDARY-OK by the audit (it wraps OS-level toast/balloon primitives) and is **not** part of this refactor.

## Why this approach over the alternatives

The dispatch listed three options:

- **(a) FastAPI `Depends` injection.** Fits route handlers but `_execute_run` is a background task started by `asyncio.create_task` from `start_run`. Threading `Depends` through to a background task requires extra plumbing (resolve dependencies in the route handler, pass them as ordinary args). It works, but it's larger blast radius than (c).
- **(b) `RuntimeEnv` / `AppContext` dataclass.** Cleanest long-term shape but introduces a new module-level type and touches every call site whether or not it's currently mocked. Outside Sprint B's "minimum viable B7" scope.
- **(c) Optional params with default fallbacks.** Smallest possible diff. The defaults are exactly the existing module-level functions; production callers continue to call `_execute_run(run_id, req, cancel_token)` with no behavioural change. Only tests need to update — and they shrink because `with patch(...)` boilerplate goes away.

(c) is selected. (b) becomes a v1.1 candidate if the surface keeps growing.

## Files affected

### Production
- `agentsuitelocal/api/execution.py` — add three kwargs to `_execute_run`, `_execute_pipeline_step` (verify), and `_advance_pipeline` (verify). Replace `_save_state()` → `save_state()`, `_log_telemetry(...)` → `log_telemetry(...)`, `_load_settings()` → `load_settings()` only inside these functions' bodies. Helper functions called from these (e.g. `_collect_step_artifacts`) do NOT touch these helpers, so they need no change.

The module-level imports at the top of `execution.py` continue to import the canonical helpers from `state.py` and `config.py`. These imports are now only used as the defaults for the new kwargs.

### Tests
- `tests/test_execution_state_machine.py` — 5 tests change. Each `with patch("agentsuitelocal.api.execution._save_state"), patch(..., "_log_telemetry"), patch(..., "_load_settings"):` block becomes argument substitution at the call site:

  ```python
  await _execute_run(
      run_id, req, cancel_token=threading.Event(),
      save_state=lambda: None,
      log_telemetry=lambda *a, **kw: None,
      load_settings=lambda: {"qa_gate_threshold": 7.0, "telemetry": False, "notifications": False},
  )
  ```

The other patches in those tests (`_resolve_llm`, the agent class, `_send_notification`, `_workspace`) stay as-is — they are INTERNAL-JUSTIFIED or BOUNDARY-OK per the audit.

### Documentation
- `docs/MOCKING_AUDIT.md` — update the 9 sites' status from `INTERNAL-SUSPECT-REFACTOR` to `REFACTORED-CLOSED` with the commit SHA. Update the cross-cutting recommendations section.

## Acceptance criteria (lifted from RELEASE_PLAN B7)

- All 9 sites move from INTERNAL-SUSPECT-REFACTOR to BOUNDARY-OK or REFACTORED-CLOSED.
- All non-deleted tests still pass.
- CI green on the resulting commit.
- `docs/MOCKING_AUDIT.md` updated.
- VERIFICATION_LOG entry: per-site closure evidence.

## Blast radius

**Production:** zero observable change. Production callers don't pass the new kwargs. Defaults bind to the existing module-level functions at function-definition time; if `_save_state` etc. are imported from `state.py` and `config.py` (they are), the defaults are stable and immutable references.

**Tests:** 5 tests in `tests/test_execution_state_machine.py` change to use kwarg substitution instead of `with patch(...)`. The new code is shorter and clearer (no MagicMock returns, no patch context-manager nesting).

**Public HTTP surface:** untouched.

**Schema/Pydantic:** untouched.

**Migration:** none — defaults preserve current behaviour for any external caller (there are none — these are private helpers).

## Risks and mitigations

- **Risk:** A test passes a `load_settings` lambda that returns a settings dict missing keys the production code reads. Mitigation: review each test's settings access against `_execute_run`'s call sites to `load_settings` and supply the keys it actually reads (`qa_gate_threshold`, `run_timeout_seconds`, `telemetry`, `notifications`).
- **Risk:** Default-arg captures the function reference at module import time. If `_save_state` were ever monkeypatched at the module level for other tests, the kwarg default would NOT pick up the patch. Mitigation: tests that need the new behaviour use kwarg substitution; tests that still want module-level patching can do that and the kwarg default reads it dynamically by calling the module attribute. To preserve the "patch the module" path as a fallback, defaults are wrapped: `save_state=None` then `(save_state or _save_state)()` inside the body. **Decision: keep the wrapper to maximize forward compat with any remaining `patch(...)` callers.**

## Default-wrapper pattern (final)

```python
async def _execute_run(
    run_id: str,
    req: RunRequest,
    cancel_token: threading.Event,
    *,
    save_state: Callable[[], None] | None = None,
    log_telemetry: Callable[..., None] | None = None,
    load_settings: Callable[[], dict] | None = None,
) -> None:
    save_state = save_state or _save_state
    log_telemetry = log_telemetry or _log_telemetry
    load_settings = load_settings or _load_settings
    # ... body uses the local names ...
```

This pattern:

- Defaults to the module-level helper at CALL time, so `unittest.mock.patch` against the module attribute still works during the call.
- Lets tests pass a lambda to bypass the module-level lookup entirely (the audit's preferred shape).
- Adds zero overhead to the production path (one `or` per kwarg per call).

## Out of scope for this sprint

- Folding `test_execute_run_completes_without_module_not_found_error` into `test_execute_run_emits_progress_events` (audit recommendation #2). Sprint C or v1.1.
- Converting `_send_notification` to DI — already BOUNDARY-OK.
- Touching the routers' direct calls to `_save_state` / `_log_telemetry` / `_send_notification` / `_load_settings`. Those are FastAPI route handlers; they remain module-level calls. They are NOT among the 9 INTERNAL-SUSPECT-REFACTOR sites.

## Sign-off

After implementation:
1. Run `python -m pytest tests/test_execution_state_machine.py -v` — all tests green.
2. Run `python -m pytest tests/ -m "not real_ollama and not e2e" -q` — full backend suite green.
3. Run `python -m ruff check agentsuitelocal/ tests/` — clean.
4. Update `docs/MOCKING_AUDIT.md` with REFACTORED-CLOSED markers.
5. Commit + push; await CI green.
