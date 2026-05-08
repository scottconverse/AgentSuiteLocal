# next-cleanup.md

Items collected by the layered-audit overflow rule (Minor / Nit /
Critical-deferred-as-too-big). Burn down at the next sprint's audit-lite
or the v1.0 ship sprint.

---

## v1.0 Sprint B candidates (queued from Sprint A)

### MOCKING_AUDIT — INTERNAL-SUSPECT-REFACTOR (9 sites)

Source: `docs/MOCKING_AUDIT.md` (A4 classification). 9 internal-mock-suspect
test sites identified during Sprint A's classification pass. Refactor
recommendation per audit doc: convert `_save_state`, `_log_telemetry`,
`_send_notification`, `_load_settings` from module-level functions to
dependency injection so tests can substitute boundary implementations
instead of mock-patching internal AgentSuiteLocal callables.

**Scope:** ~9 test sites in `tests/test_execution_state_machine.py` and
sibling files. See `docs/MOCKING_AUDIT.md` for the full per-site list
and recommendations.

### ~~Mock LLM contract gap~~ → CLOSED in Sprint A loose-end batch (`d218c0e`)

`tests/e2e/test_new_run.py::test_new_run_dispatches_orchestrator_with_mock_llm`
xfail removed. The mock factory now returns valid JSON for stages that
parse JSON (extract, spec consistency, qa) and prose for stages that
don't (intake, per-artifact spec, execute). CI Playwright E2E job is
green on `d218c0e`. No longer Sprint B work.

---

## Items added by Sprint A audit-lite (3743937)

### ~~Pre-existing test-isolation pollution~~ → CLOSED in Sprint A loose-end batch (`6b9c604`)

Root cause was `tests/e2e/conftest.py` setting `AGENTSUITE_LLM_PROVIDER_FACTORY`
and `AGENTSUITE_ALLOW_MOCK_FACTORY` at module-import time via
`os.environ.setdefault`. Pytest imports the conftest during collection
(even when the marker filter deselects the e2e tests), so the env vars
leaked into test_dependencies' `_resolve_llm` calls — which then
dispatched to the mock factory and returned `MockLLMProvider` instead
of `OllamaProvider`. The conftest's "must set at import time" comment
was stale; `_resolve_llm` reads env vars at CALL time, not import time.

Fix: replaced module-level setdefault with a session-scoped autouse
fixture (`_e2e_mock_factory_env`) that scopes to e2e tests only via
pytest fixture-scoping rules. `pytest -m "not real_ollama and not e2e"`:
187 passed, 0 failed (was: 185 passed, 2 failed).

### PipelineCard React key prop warning

`web/src/components/app/PipelineView.jsx:344` — `<PipelineCard>` map
without a unique `key` prop. Pre-existing vitest warning — not introduced
by Sprint A. Easy fix in Sprint B.

### Move next-cleanup.md to docs/

All other plan/audit docs live under `docs/`. `next-cleanup.md` is at
repo root for now. Sprint B kickoff: `git mv next-cleanup.md docs/`.

## Items deferred from Sprint B audit-team pass (B1)

### ENG-B-004 — SSE busy-wait at 200ms in stream_run

`agentsuitelocal/api/routers/runs.py:179-187` polls `run["events"]` length
every 200ms. Replace with `asyncio.Event` per run; producer wakes consumer
directly. Tiny CPU cost today; relevant under multi-SSE concurrency. v1.1
performance sprint.

### ENG-B-005 — `_LAUNCHER_LOG` alias retained for back-compat

`agentsuitelocal/api/config.py:40-41` keeps `_LAUNCHER_LOG = _LAUNCHER_PORT_FILE`
as a soft-deprecation alias from the QA-001 fix. New code uses the function,
not the alias. Sweep when renaming `_write_launcher_log` to
`_write_launcher_port_file`. Nit.

### UX-B-002 — Cancel-button confirmation on Live Run

`LiveRunView.jsx` Cancel button has no confirmation modal. For a 9–16-minute
run, a stray click loses partial work (though `_move_partial_artifacts` does
preserve outputs as `cancelled-outputs/`). v1.1 UX polish.

### TEST-B-003 — Frontend coverage tooling not configured

`web/vitest.config.js` does not configure coverage; no `npm run test:coverage`
script. Backend has `pytest --cov`; frontend is dark. Add `@vitest/coverage-v8`
in v1.1.

## Items deferred from earlier audits (carried)

(none currently — fresh ledger)
