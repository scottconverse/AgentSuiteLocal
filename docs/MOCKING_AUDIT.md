# Mocking Audit — `tests/`

**Sprint A4 (v0.9.0).** Classification-only pass per Q1=(b) two-phase. Sprint B will action the recommendations; this doc does **not** modify any tests.

- HEAD at audit: `fb503fc` (`fix(execution): read qa_score from agentsuite QAReport.average (V4)`).
- Scope: every `patch(`, `Mock(`, `MagicMock(`, `AsyncMock(` call site in `tests/`.
- Excluded: `client.patch("/api/...")` calls in `tests/test_api.py` (HTTP verb on FastAPI `TestClient`, not `unittest.mock.patch`). 8 occurrences in `tests/test_api.py` lines 238–273 fall in this bucket and are not real mocks.

## Categories

- **BOUNDARY-OK** — mocks a true external boundary (HTTP / filesystem / subprocess / OS notification / third-party SDK). Keep.
- **INTERNAL-JUSTIFIED** — mocks an internal AgentSuiteLocal/agentsuite class or function with a defensible reason (e.g. avoiding live LLM I/O for fast unit coverage of a wiring contract). Keep, but document the contract under test.
- **INTERNAL-SUSPECT-REFACTOR** — mocks an internal symbol; recommend Sprint B refactor toward a real-resolver path or smaller seam.
- **INTERNAL-SUSPECT-DELETE** — mocks an internal symbol; the real path is already covered by `tests/test_real_founder_run.py` or another live test, making this site redundant. Recommend Sprint B delete.

## Summary

| Category | Count |
| --- | --: |
| Total real mock call sites | 48 |
| BOUNDARY-OK | 23 |
| INTERNAL-JUSTIFIED | 16 |
| INTERNAL-SUSPECT-REFACTOR | 9 |
| INTERNAL-SUSPECT-DELETE | 0 (1 deferred candidate — see below) |

(8 additional `client.patch("/api/...")` HTTP-verb calls in `tests/test_api.py` are not mocks and are excluded from the count.)

## Per call site

### `tests/test_launcher.py` (5 sites — all BOUNDARY-OK)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_launcher.py:23` | `launcher._find_free_port` | Boundary (OS socket) | BOUNDARY-OK | Keep — frozen-launcher entry-point unit test, must not bind a real port. |
| `tests/test_launcher.py:24` | `launcher._wait_for_server` | Boundary (HTTP poll) | BOUNDARY-OK | Keep — avoids live HTTP loop in unit. |
| `tests/test_launcher.py:25` | `launcher.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep — prevents background thread from being spawned during test. |
| `tests/test_launcher.py:26` | `launcher.webbrowser` | Boundary (OS browser launch) | BOUNDARY-OK | Keep — would otherwise pop a browser window. |
| `tests/test_launcher.py:27` | `launcher._log` | Boundary (filesystem log writes) | BOUNDARY-OK | Keep — silences log writes during unit. |

### `tests/test_cli.py` (9 sites — all BOUNDARY-OK)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_cli.py:19` | `MagicMock()` (uvicorn stand-in) | Boundary (uvicorn third-party SDK) | BOUNDARY-OK | Keep — `_mock_uvicorn` substitutes the third-party server at the import seam; required to test arg parsing without binding a port. |
| `tests/test_cli.py:20` | `MagicMock()` for `mock.run` | Boundary (uvicorn) | BOUNDARY-OK | Keep — same rationale, attaches `.run` to the uvicorn stand-in. |
| `tests/test_cli.py:30` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep — blocks browser-thread spawn. |
| `tests/test_cli.py:42` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep. |
| `tests/test_cli.py:53` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep — assertion target for `Thread.assert_called_once`. |
| `tests/test_cli.py:66` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep. |
| `tests/test_cli.py:77` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep. |
| `tests/test_cli.py:88` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep — `--no-browser` regression test asserts `Thread.assert_not_called`. |
| `tests/test_cli.py:98` | `agentsuitelocal.cli.threading` | Boundary (OS thread) | BOUNDARY-OK | Keep. |

(The `patch.object(sys, "argv", ...)` and `patch.dict(sys.modules, ...)` calls in this file use `unittest.mock.patch` against process-global state. They are also boundary-style and out of scope for the regex but worth noting as legitimate.)

### `tests/test_dependencies.py` (1 site — BOUNDARY-OK)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_dependencies.py:215` | `agentsuite.llm.ollama.OllamaProvider` | Boundary (third-party Ollama SDK constructor) | BOUNDARY-OK | Keep — the test deliberately forces an `ImportError` from the SDK seam to verify `_resolve_llm` records the failure into `get_last_resolver_error()`. This is a contract test on the resolver's error-capture path; mocking the SDK constructor is the only honest way to inject a deterministic ImportError. |

### `tests/test_api.py` (1 real mock site — INTERNAL-JUSTIFIED)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_api.py:1030` | `agentsuitelocal.api.state._DB_FILE` | Internal (module-level path constant) | INTERNAL-JUSTIFIED | Keep — F1 crash-recovery test redirects the SQLite DB path to a tmpfile. Patching the module constant is a standard, low-blast-radius seam (could be argued as a pseudo-boundary since the underlying SQLite is a filesystem boundary). Document under `# F1/F2` block already does this. No action. |

### `tests/test_execution_state_machine.py` (32 sites — mixed)

This is the heaviest patching file. The module docstring already acknowledges TEST-CRIT-001 (v0.8.7's missing-`ollama` regression slipped past because every test here mocks `_resolve_llm`) and explicitly delegates the resolver-path coverage to `tests/test_dependencies.py`, `tests/test_execution_integration.py`, and the new real-e2e `tests/test_real_founder_run.py`.

The file's contract under test is the **state-machine wiring** between routes, executor, and state — not the LLM or agent internals. Mocking the agent class and `_resolve_llm` is therefore *justified for that contract*, not redundant. However, several patches are `_save_state` / `_log_telemetry` / `_send_notification` / `_workspace`, which are internal AgentSuiteLocal helpers; these are seam mocks rather than boundary mocks and are candidates for refactor (e.g. inject via dependency, or move to a fixture).

#### `test_execute_run_completes_without_module_not_found_error` (lines 92–117)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_execution_state_machine.py:100` | `MagicMock()` for `mock_llm` | Internal (LLM provider stand-in) | INTERNAL-JUSTIFIED | Keep — state-machine test, not LLM test. Real path covered by `test_real_founder_run.py`. |
| `tests/test_execution_state_machine.py:103` | `agentsuitelocal.api.execution._resolve_llm` | Internal | INTERNAL-JUSTIFIED | Keep — see file docstring; resolver path covered elsewhere. |
| `tests/test_execution_state_machine.py:104` | `agentsuite.agents.founder.agent.FounderAgent.run` | Internal (agentsuite agent) | INTERNAL-JUSTIFIED | Keep — wiring contract test; real-e2e covers the agent. |
| `tests/test_execution_state_machine.py:105` | `agentsuitelocal.api.execution._save_state` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B: extract `_save_state` injection into a fixture or pass through DI so tests don't reach into module internals. |
| `tests/test_execution_state_machine.py:106` | `agentsuitelocal.api.execution._log_telemetry` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B: same — convert to injected dependency. |
| `tests/test_execution_state_machine.py:107` | `agentsuitelocal.api.execution._send_notification` | Internal (wraps OS notification) | BOUNDARY-OK | Keep — wraps an OS-level notification primitive (toast/balloon). Boundary by transitive ownership; safe to keep. |
| `tests/test_execution_state_machine.py:108` | `agentsuitelocal.api.execution._workspace` | Internal (filesystem path resolver) | BOUNDARY-OK | Keep — redirects filesystem writes to `/tmp`; canonical filesystem-boundary mock. |

#### `test_execute_run_dispatches_non_founder_agent` (lines 120–150)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_execution_state_machine.py:136` | `agentsuitelocal.api.execution._resolve_llm` | Internal | INTERNAL-JUSTIFIED | Keep. |
| `tests/test_execution_state_machine.py:137` | `agentsuite.agents.design.agent.DesignAgent.run` | Internal | INTERNAL-JUSTIFIED | Keep — guards the AGENTSUITE_ENABLED_AGENTS footgun for non-founder agents. |
| `tests/test_execution_state_machine.py:138` | `_save_state` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor (same as above). |
| `tests/test_execution_state_machine.py:139` | `_log_telemetry` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor. |
| `tests/test_execution_state_machine.py:140` | `_send_notification` | Internal/Boundary | BOUNDARY-OK | Keep. |
| `tests/test_execution_state_machine.py:141` | `_workspace` | Boundary (filesystem) | BOUNDARY-OK | Keep. |

#### `test_execute_pipeline_step_dispatches_non_founder_agent` (lines 153–211)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_execution_state_machine.py:198` | `_resolve_llm` | Internal | INTERNAL-JUSTIFIED | Keep. |
| `tests/test_execution_state_machine.py:199` | `agentsuite.pipeline.orchestrator.PipelineOrchestrator.run` | Internal | INTERNAL-JUSTIFIED | Keep — orchestrator wiring contract; real-e2e covers the live orchestrator path. |
| `tests/test_execution_state_machine.py:200` | `_save_state` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor. |
| `tests/test_execution_state_machine.py:201` | `_workspace` | Boundary (filesystem) | BOUNDARY-OK | Keep. |

#### `test_execute_run_emits_progress_events` (lines 214–255)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_execution_state_machine.py:236` | `_load_settings` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B: settings should be injectable; mocking the module-level loader is brittle. |
| `tests/test_execution_state_machine.py:237` | `_resolve_llm` | Internal | INTERNAL-JUSTIFIED | Keep. |
| `tests/test_execution_state_machine.py:238` | `FounderAgent.run` | Internal | INTERNAL-JUSTIFIED | Keep — `progress_callback=` wiring contract. Real-e2e covers the agent. |
| `tests/test_execution_state_machine.py:239` | `_save_state` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor. |
| `tests/test_execution_state_machine.py:240` | `_log_telemetry` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor. |
| `tests/test_execution_state_machine.py:241` | `_send_notification` | Internal/Boundary | BOUNDARY-OK | Keep. |
| `tests/test_execution_state_machine.py:242` | `_workspace` | Boundary (filesystem) | BOUNDARY-OK | Keep. |

#### `test_execute_pipeline_step_emits_progress_events` (lines 258–323)

| File:line | Target | Boundary/Internal | Status | Recommendation |
| --- | --- | --- | --- | --- |
| `tests/test_execution_state_machine.py:304` | `_resolve_llm` | Internal | INTERNAL-JUSTIFIED | Keep. |
| `tests/test_execution_state_machine.py:305` | `PipelineOrchestrator.run` | Internal | INTERNAL-JUSTIFIED | Keep — `kernel_progress_callback=` wiring contract. |
| `tests/test_execution_state_machine.py:306` | `_save_state` | Internal | INTERNAL-SUSPECT-REFACTOR | Sprint B refactor. |
| `tests/test_execution_state_machine.py:307` | `_workspace` | Boundary (filesystem) | BOUNDARY-OK | Keep. |

#### Module-scope `MagicMock()` constructors (lines 100/133/177/227/281)

These are the same `mock_llm = MagicMock()` pattern repeated per test. Already counted under each test above. No additional action.

#### `INTERNAL-SUSPECT-DELETE` candidate

After reviewing `tests/test_real_founder_run.py`, the only state-machine assertion it duplicates with `tests/test_execution_state_machine.py` is `assert run["status"] == "waiting"` after a successful founder run. Crucially:

- `test_real_founder_run.py` is **opt-in** (`real_ollama` marker), excluded from default `pytest tests/`.
- The default suite still needs a fast, deterministic regression guard for the founder happy path.

Therefore `test_execute_run_completes_without_module_not_found_error` is **not** redundant with the real-e2e — it is the only fast regression guard for the wiring. **No DELETE candidates from this file.**

#### Possible single-test `INTERNAL-SUSPECT-DELETE` (defer to Sprint B)

If, after Sprint B, the `_save_state` / `_log_telemetry` / `_send_notification` patches are all replaced with DI fixtures, and `tests/test_real_founder_run.py` is moved into the default suite (or a `--with-real-ollama` flag is added that runs it whenever Ollama is detected), then the wiring tests for the founder happy path could collapse into a single state-machine spec test. Mark for Sprint B review, not delete now.

**Deferred DELETE candidate (not actioned):** `test_execute_run_completes_without_module_not_found_error` (lines 92–117) overlaps in scope with `test_execute_run_emits_progress_events` (lines 214–255), which exercises the same `_resolve_llm` + `FounderAgent.run` wiring with stronger assertions (progress events). Sprint B should consider folding the two. Not classified as DELETE today because the simpler test is a useful regression guard for the original ModuleNotFoundError that motivated v0.8.7 fixes; folding requires test design judgement that belongs in Sprint B.

## Cross-cutting Sprint B recommendations

1. **DI seam for `_save_state` / `_log_telemetry` / `_send_notification` / `_load_settings`.** These are imported and called as module-level functions in `agentsuitelocal/api/execution.py`. Converting them to constructor-injected dependencies (or a small `ExecutionContext` dataclass) lets tests pass fakes through arguments instead of patching module attributes. Eliminates 6 INTERNAL-SUSPECT-REFACTOR sites.
2. **Fold redundant founder-happy-path wiring test.** Once `test_execute_run_emits_progress_events` is hardened (it already covers the same `FounderAgent.run` patch path with progress assertions), `test_execute_run_completes_without_module_not_found_error` can be removed. 1 INTERNAL-SUSPECT-DELETE.
3. **Document the file contract.** `tests/test_execution_state_machine.py` already has a strong module docstring explaining its scope. After Sprint B, add a brief note that `_save_state` / `_log_telemetry` / `_send_notification` are injected, not patched.
4. **No changes recommended for `tests/test_launcher.py`, `tests/test_cli.py`, `tests/test_dependencies.py`, or `tests/test_api.py`.** All real mock sites in those files are boundary mocks (OS socket, OS thread, OS browser, third-party SDK, filesystem path constant) and are correctly used.

## Out of scope (this audit)

- Refactoring any test (Sprint B work, per Q1=(b)).
- The `e2e/` subdirectory's `conftest.py` factory mock plumbing (browser/SSE e2e — separate concern).
- `MockLLMProvider` substring routing (raised in A2 CI failure on `108b322`); separately tracked as A4 follow-up evidence.
