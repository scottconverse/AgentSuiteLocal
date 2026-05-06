# Changelog

All notable changes to AgentSuiteLocal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Fixed

- **QA-DD-001 (Critical) — Trust/Risk agent slug drift fixed.** v0.8.8 advertised seven agents in the picker but `web/src/data.js` used `id: "trust"` while `launcher.py` / `cli.py` used `trust_risk`. The kernel registry only knows `trust_risk`, so every Trust/Risk run errored 3 s after launch with `Agent 'trust' is not enabled or not registered`. Fixed by aligning `data.js` (id and mock-run reference) and the `_SETTINGS_DEFAULTS["enabled_agents"]` default in `agentsuitelocal/api/config.py` to the canonical `trust_risk`.

- **QA-DD-002 (Critical) — Pro-tier model name fixed.** `_TIER_MODEL_MAP["pro"]` was `gemma4:26b-moe`, which 404s from `https://registry.ollama.ai/v2/library/gemma4/manifests/26b-moe`. Fresh installs that selected the Pro tier failed to pull. Replaced with `gemma3:27b` (real, dense 27 B, similar resource profile). The `gemma4:e2b` and `gemma4:e4b` entries — flagged by the audit as also missing — actually do exist on the registry; left unchanged. Fanned out to `web/src/data.js`, `docs/user-manual.md`, `docs/architecture.md`, README, both discussion seeds, `ManualView.jsx`, and `ModelView.test.jsx`.

### Added

- **`tests/test_agent_slugs.py`**: regression test for QA-DD-001's bug class. Asserts the four sources of truth for the enabled-agent set (launcher.py env default, cli.py env default, `_SETTINGS_DEFAULTS["enabled_agents"]`, `web/src/data.js` AGENTS list) agree on the same seven slugs. Re-introducing slug drift in any one of those four files now fails CI at the lint/test gate before merge.
- **`tests/test_tier_models_resolve.py`**: regression test for QA-DD-002's bug class. Each entry in `_TIER_MODEL_MAP` plus `_SETTINGS_DEFAULTS["model_name"]` is HEAD-checked against the Ollama OCI registry manifest endpoint that `ollama pull` queries internally. A 404 fails the test; a network error skips (so offline runners don't go red). Catches "named-but-nonexistent model" before it ships.

## [0.8.8] — 2026-05-05

This release started life as a CHANGELOG-correction patch and grew into a substantial bug-fix release. Three audit rounds produced 28 Critical/Major fixes plus the v0.8.7 broken-bundle remediation. All fixes were authored, reviewed, and validated within a single sprint window; per-finding detail lives in `audit-AgentSuiteLocal-2026-05-05/`.

### Fixed (broken-v0.8.7-bundle remediation, `bf74eb3`)

- **`ollama` SDK was missing from runtime dependencies** (`57ab097`): SDK was assumed-imported in installer/model-management code paths but never declared in `pyproject.toml`'s runtime deps, so wheel installs and frozen builds failed on first `import ollama` outside the dev environment. This is the headline regression — every other remediation in this round exists because v0.8.7's structural gaps allowed it to ship.
- **Installer flow re-adds Smoke as Step 5** (was dead code in v0.8.7): `web/src/App.jsx` `TOTAL_STEPS` 5→6; `STEP_FIX_MAP` keys re-aligned to the labels actually emitted by `/api/smoke` (old keys were stale, so failed users saw no fix guidance). E2E walks all 6 steps.
- **Smoke now exercises the real Python kernel path**: `/api/smoke` constructs an `OllamaProvider` via the same `_resolve_llm` New Run uses, then issues a 1-token completion via `provider.complete`. Until v0.8.7 the smoke test verified the *environment* (Ollama daemon healthy) but never the *app* (Python bundle can resolve and call a provider) — exactly why a build with a missing `ollama` SDK passed install and broke on first New Run.
- **Ollama install starts the daemon explicitly + 90s wait + actionable error**: the Windows installer auto-launches a desktop GUI but does not reliably start the API daemon. We now `Popen` `ollama serve` ourselves, then poll for 90s (was 30s — too tight on first boot with AV scan + GPU detection + tray handshake). Failure message points to the exact PowerShell command instead of a vague "Try launching Ollama manually."
- **WeasyPrint PDF export: graceful "PDF unavailable in this build"**: the bundled distributable doesn't ship GTK runtime libs (cairo/pango/gdk-pixbuf). Telling end users to `pip install weasyprint` is advice they can't act on (no `pip` in a PyInstaller bundle, and the native libs are still missing). Now returns a clear "use ZIP/Markdown instead" error, with both `ImportError` and `OSError` (missing native libs) branches handled.
- **Resolver stops swallowing real failures into silent `None`**: `_resolve_llm` previously had `except Exception: return None`, which hid both the missing-`ollama`-SDK bug AND a separate `OllamaProvider(model=…)` → `OllamaProvider(default_model=…)` kwarg mismatch. Now logs the failure (traceback at ERROR level) and stores it in a module-level snapshot retrievable via `get_last_resolver_error()`.
- **SSE keepalive comments no longer break installer fetch-stream parsers** (`b5fc36b`): four installer screens (`ScreenModelDownload`, `ScreenOllama`, two paths in `ScreenOllamaModel`) consume server-sent-event streams via `fetch` + `ReadableStream`. `sse-starlette` periodically emits `: ping - N` keepalive comments, which the hand-rolled parsers were treating as malformed event data. Fixed by skipping any line beginning with `:` (per the SSE spec for comments).

### Fixed (audit round 1 — 12 Criticals + 8 Majors, `7d3a24a`)

- **UX-001:** strip CLI exposure from macOS install fallback copy. `ScreenOllama.jsx` and `ScreenOllamaModel.jsx` no longer tell Mac users to run `brew install ollama` in Terminal. Both screens now route to the same osascript-with-admin install path used by the Windows .exe runner. User-manual / FAQ / architecture docs rewritten in the same pass.
- **DOC-001 / DOC-002 / DOC-004 / DOC-005:** replace stale 11-step / 5-step installer descriptions with the actual 6-step flow. `ManualView.jsx`, `docs/user-manual.md`, `docs/architecture.md`, `docs/FAQ.md` all updated to match `App.jsx TOTAL_STEPS=6`. ManualView trailing note now points to Settings for cloud key / agent selection.
- **DOC-003:** rewrite `SECURITY.md` to reflect OS-keychain reality. Old doc claimed API keys live in `settings.json` — they have actually been stored in Windows Credential Manager / macOS Keychain / Secret Service since v0.7.1.
- **TEST-002:** document cleanroom proxy limitation in `start.sh` so future maintainers know cold-pull / SSE-keepalive bug classes are architecturally invisible to cleanroom.
- **TEST-003:** new `tests/e2e/test_new_run.py` walks 6-step installer → Dashboard → New Run → asserts orchestrator dispatches without immediate failure. Honors `AGENTSUITE_LLM_PROVIDER_FACTORY` for mock injection. Closes the gap where the agent code path was untested at the UI level — exactly what the v0.8.7 missing-SDK bug crashed.
- **QA-001:** stop hardcoding port 8765 in places the launcher's free-port fallback breaks. `launcher.py` writes `~/.agentsuitelocal/launcher.port.json` (single-purpose JSON, separate from the plaintext log being corrupted by overlapping writes). Inno uninstall hook reads it via PowerShell instead of POSTing to a hardcoded `:8765/api/uninstall`. `execution.py` notification `action_url` uses `_read_launcher_port()`.
- Plus 12 additional Critical/Major findings closed in this round; full IDs in `audit-AgentSuiteLocal-2026-05-05/`.

### Fixed (audit round 2 — 5 Criticals + 8 Majors, `2445268`)

- **Major — Windows console-flicker bug:** `subprocess.run(["ollama", "--version"])` from `/api/ollama/status` flashed a console window on every poll because the `--windowed` PyInstaller bundle has no parent console. Frontend polls every few seconds. Added `creationflags=CREATE_NO_WINDOW` to that call and to the uninstall `ollama rm` call. Indistinguishable from malware to non-technical users.
- **In-app uninstall discoverability:** added "Uninstall" entry to sidebar with red treatment, scrolls Settings to Danger zone on click. Settings panel was already correct — users couldn't find it without scrolling.
- **QA-202: Inno `[UninstallRun]` dead-socket:** `InitializeUninstall` was killing the process before the hook fired. Reordered so the hook POSTs graceful-shutdown first, waits 3s, then force-kills as fallback. Workspace cleanup now actually runs.
- **Inno `unins000.exe` path discovery:** also checks Program Files (x86), LocalAppData\Programs, and the running .exe's dir.
- **ENG-R2-001:** `/api/run/{id}/retry` state-guarded — only retryable from `error/timeout/cancelled/failed`.
- **ENG-R2-002:** E2E conftest reads the structured `launcher.port.json` (was reading legacy plaintext `launcher.log`).
- **ENG-R2-003:** `AGENTSUITE_LLM_PROVIDER_FACTORY` restricted to `tests.*` / `agentsuite.testing.*` / `agentsuite.llm.mock` prefixes — closes RCE-via-env-var primitive.
- **ENG-R2-005:** `launcher.port.json` written atomically (`os.replace`) AFTER server bind.
- **QA-201:** LiveRunView Retry / Open Settings now use proper `setView` callbacks (App.jsx has no hash router; the buttons were dead).
- **QA-203:** `/api/smoke` calls `raise_for_status()` after `/api/generate` — a 5xx no longer marks probes green.
- **QA-204:** "Open Ollama" button checks `response.ok` — 404 (Ollama not installed) no longer treated as success.
- **QA-205:** `_resolve_llm` serialized via `_resolver_lock` — concurrent callers can't race on scoped env restoration.
- **TEST2-001:** mock-factory env vars set in conftest before backend import + in CI workflow Start-backend step. New sentinel-file assertion in `test_new_run.py` proves mock ran in CI.
- **UX2-001:** added `<Icon name="open" />` definition. Mac smoke recovery button no longer has phantom gap.
- **UX-004:** Live Run no longer fakes a token counter (was `setTokens(t => t + 18)` per `stage_update`). Cost line is "Local — no cloud cost".
- **UX-005:** Run-failed dead-end replaced with Retry / Open Settings / Diagnostic / Back. Retry uses the new state-guarded endpoint.
- **DOC2-001:** `docs/user-manual.md` tier→model table was wrong (`gemma2:2b` / `llama3.1:8b`); aligned to canonical map (`gemma4:e2b` / `gemma4:e4b` / `gemma4:26b-moe`).
- **DOC2-003 / DOC2-004:** README architecture section updated — `main.py` no longer described as 2000-line monolith; installer screens reflect 6-screen active flow.
- **CLI exposure removed from `user-manual.md`:** "pull custom models from the terminal" rewritten — regression from round-1 doc rewrite.

### Fixed (audit round 3 — 3 Criticals + 5 Majors, `1a433ec`)

- **ENG-R3-001 (Critical) — `threading.Lock` in async event loop:** the QA-205 lock was acquired sync from inside 5 async route handlers and 1 async smoke endpoint — a contended sync lock blocks the FastAPI event loop while one resolver waits on another. Converted `_resolve_llm` to async, replaced `threading.Lock` with `asyncio.Lock`, ran the sync constructor body in a threadpool via `asyncio.to_thread`. All 5 call sites in `execution.py` + 1 in `routers/ollama.py` updated to `await`.
- **DOC3-001 (Critical) — tier→model fan-out:** DOC2-001 only landed in `docs/user-manual.md`. Searched the whole repo for `gemma2:2b` / `llama3.1:8b` — found 13 references. Updated `docs/architecture.md` tier diagram, both discussion seeds, the ManualView recommended-models table, and the SettingsView uninstall-path fallback. CI workflow / CONTRIBUTING / known-issues notes left alone (legitimate test references).
- **QA3-301 (Critical) — in-app uninstall now re-elevates:** `/api/uninstall/phase3` was launching `unins000.exe` via plain `subprocess.Popen`, inheriting the backend's non-admin token, so the uninstaller silently failed to remove Program Files entries and registry keys. Now uses `ctypes ShellExecuteW` with the `runas` verb to prompt UAC. Falls back to plain `Popen` for LocalAppData installs where elevation isn't required.
- **UX3-001 (Major) — `retryError` state set but never rendered:** QA-201 added 3 `setRetryError()` branches with no JSX referencing them — silent failure on 409 / non-OK HTTP / network errors. Inline error display added.
- **ENG-R3-002 (Major) — factory allowlist segment-boundary:** ENG-R2-003 used string-prefix match. That accepts e.g. `agentsuite.llm.mock_evil`. Replaced with segment-boundary match: `module_name == m or module_name.startswith(m + ".")`.
- **ENG-R3-003 (Major) — `os.replace` Windows share-violation:** ENG-R2-005's atomic write failed with `PermissionError` when the destination was held open by a concurrent reader. Added a 5-attempt retry loop (≤500ms total) before giving up; cleans up the `.tmp` on final failure rather than leaving a torn artifact.
- **ENG-R3-004 / QA3-302 (Major) — retry endpoint snapshot + ValidationError:** `/api/run/{id}/retry` was reading individual fields from `_runs[id]` one at a time — concurrent `/cancel` could mutate state mid-handler producing a torn view. Snapshot the run dict at the top of the handler. Also catches `pydantic.ValidationError` so legacy run records with stale shapes return 422 with a clear message instead of crashing with 500.

### Added

- **Bundle-dependency CI guard** (`c349453`, `tests/test_dependencies.py`): catches missing-runtime-dependency bugs (like the `ollama` SDK fix above) at CI time rather than first user run. Inspects `pyproject.toml` and verifies every top-level `import` outside the test tree resolves to a declared dependency. Plus four hot-path import tests that exercise the real `OllamaProvider` constructor and `_resolve_llm` path with no patching — closing the gap where execution-test mocking masked the original missing-SDK bug.
- **Installer Ollama-window UX warning** (`1622157`): `ScreenOllama` warns users that the Ollama desktop window may open during install/launch and is safe to close — closing it does not affect the daemon, which keeps running in the background.
- Sidebar **Uninstall** nav entry (red treatment, scrolls Settings to Danger zone).
- `_LAST_CLOUD_FALLBACK_REASON` snapshot in `execution.py`, surfaced via `/api/health` so cloud-key misconfiguration is no longer silent.
- Sentinel-file mechanism in `tests/e2e/test_new_run.py` proving the mock factory was actually invoked in CI rather than silently falling back to real Ollama.

### Changed

- **Shared SSE parser helper** (`be967de`): the four duplicated fetch-stream parsers extracted into `web/src/utils/sseStream.js` (an async generator that consumes a `ReadableStream` reader and yields parsed event objects, skipping comments, non-`data:` control frames, and unparseable payloads). New regression test `web/src/utils/sseStream.test.js` exercises the keepalive-ping case directly — a path neither cleanroom nor CI hits naturally because cached Ollama pulls finish before `sse-starlette`'s first ping. Net −68 lines across the four installer screens.
- **Top-of-README installer banner** (`b6df837`): redirects users away from the green "Code → Download ZIP" button toward the Releases page, with the current `.exe` and `.dmg` filenames called out.
- Lint cleanup commits (`5c59243`, `6e51c2c`, `5dc067b`, `59a9e25`) chase ruff E402/I001/UP036/F841 across the audit-fix landings; one of them carries the `noqa: E402` on `tests/e2e/conftest.py` because the env-var setup must precede the backend import.

### Documentation

- **Backfill v0.8.7 CHANGELOG with Issue #16 CI lint gate details**: the v0.8.7 entry now documents `scripts/check_action_node_versions.py`, the CI lint step that invokes it, and the exact SHA-pin checking logic that closes Issue #16.
- **Corrected v0.8.7 test metrics**: the "135 → 129" apparent decrease was a filter difference, not test removal. v0.8.6 reported the filtered count but labelled it as "135 passing" — that was a reporting error. The v0.8.7 entry now includes an explicit note clarifying the discrepancy.
- **Landing page (`docs/index.html`) refreshed to v0.8.8**: hero badge, nav download button, download CTA section, .exe/.dmg release URLs, footer version label, and "Release notes" link all updated from the stale v0.7.1 references. SHA256 inline checksums replaced with a link to the release page (which carries the canonical hashes for the current build).
- **Discussion seeds refreshed**: `docs/community/github-discussions-welcome.md` reflects v0.8.8 as current and v0.7.0 as historical context. `docs/community/reddit-localllama-launch.md` reframed from a v0.7.0 launch announcement into an evergreen r/LocalLLaMA intro post; download filename and current-version reference both bumped to 0.8.8.
- **`docs/user-manual.md` heading and a v0.7.0-qualified UI behaviour note updated** — manual heading is now v0.8.8.
- **`docs/architecture.md` version qualifier removed** — the "as of v0.7.1" markers next to the route count and the `test_api.py` description are now timeless.

> Commit `fe6be9c` (docs: backfill v0.8.7 CHANGELOG with Issue #16 material and test-metrics correction) was already on `main` before this version bump. This release formalises that commit under v0.8.8 and bundles all of the above.

## [0.8.7] — 2026-05-05

Two changes shipped in this tag: Issue #16 (CI lint gate, chore-only, PR #21 / merge `71c9474`) and Issue #19 (PipelineOrchestrator migration, PR #22 / merge `6db68c9`). Both are documented below.

### Added (Issue #16 — CI lint gate for node20 SHA-pinned actions, PR #21)

- **`scripts/check_action_node_versions.py`**: Python script run in the CI lint job. Walks `.github/workflows/*.yml`, extracts every `uses: owner/repo@<40-char-sha>` pin, fetches the corresponding `action.yml` via `gh api` at that exact SHA, and checks `runs.using` for `node16` or `node20`. Exits 1 if any match is found; exits 0 if all pins are `node24+`. Catches the class of supply-chain drift where an action is re-pinned to a newer SHA that silently downgrades its Node.js runtime.
- **CI step added to lint job** (`ci.yml`): runs `python scripts/check_action_node_versions.py` after ruff, with `GH_TOKEN: ${{ github.token }}` injected so the GitHub API calls succeed. Any future PR that introduces a node20-or-older SHA-pinned action will fail at lint before merging.
- **Closes [Issue #16](https://github.com/scottconverse/AgentSuiteLocal/issues/16).**
- Merge SHA: `71c9474`. No version bump; CI-infrastructure change only.

### Changed (Issue #19 — PipelineOrchestrator migration, PR #22)

- **`_execute_pipeline_step` (step 0) now routes through `PipelineOrchestrator.run()`**: each agent receives `StageContext.cross_stage_context` from all preceding stages. The old direct `BaseAgent.run()` path is preserved as a fallback for the resume-from-error flow (`step_idx > 0`).
- **`_advance_pipeline` now routes through `PipelineOrchestrator.approve()`**: approval promotes artifacts at the kernel level and drives the next step with accumulated context. Falls back to direct execution if no orchestrator state is found on disk (resume/recovery path).
- **Extracted `_collect_step_artifacts(run_id, output_root)`**: eliminates duplicated artifact + QA-score collection that was copy-pasted in `_execute_run`, `_execute_pipeline_step`, and `_advance_pipeline`.
- **`on_progress` / `kernel_progress_callback` forwarded**: `agent_start`, `agent_done`, and `stage_update` SSE events are emitted through the orchestrator's callback hooks, preserving real-time stream behavior.
- **Closes [Issue #19](https://github.com/scottconverse/AgentSuiteLocal/issues/19).**

### Added (Issue #19)

- **`_execute_pipeline_step_direct`**: extracted legacy direct-agent path for resume; keeps the recovery flow working without requiring orchestrator state on disk.

### Test changes (Issue #19)

- `test_execute_pipeline_step_dispatches_non_founder_agent`: updated to mock `PipelineOrchestrator.run` instead of `DesignAgent.run`. Verifies `step["run_id"]` and `step["status"] == "awaiting_approval"` via the orchestrator code path.
- `test_execute_pipeline_step_emits_progress_events`: updated to verify `kernel_progress_callback` is wired through `orch.run()`, not `agent.run()` directly.

### Test metrics (v0.8.7)

- **Full suite** (`tests/`, no filter): **135 passing**, 49 warnings
- **CI filter** (`--ignore=tests/e2e -m "not ollama"`): **129 passing**, 6 deselected (the 6 deselected tests require a live Ollama daemon and are covered by the E2E job)
- The "135 → 129" apparent decrease vs v0.8.6's "135 passing" is a filter difference, not test removal. v0.8.6 reported the filtered count under the same CI flags but labelled it as "135 passing" — that was a reporting error in the v0.8.6 entry. The actual suite size is unchanged at 135.
- `execution.py` coverage: **62%** (was 72% in v0.8.6; −10pp. The new orchestrator primary path, `_execute_pipeline_step_direct` legacy path, and `_advance_pipeline` orchestrator/fallback branches add ~120 statements that are not exercised by the unit test suite — they require a live orchestrator. The regression-guard tests from v0.8.6 still pass.)
- Repo-wide coverage: **65%** (floor 58%)

## [0.8.6] — 2026-05-04

Sprint 2 close-out — regression-guard tests for `progress_callback` wire-up; fix `step` key collision in pipeline SSE events.

### Added
- **`test_execute_run_emits_progress_events`**: regression guard that turns red if `progress_callback=progress_callback` is removed from `agent.run()` in `_execute_run`. Uses `side_effect` to invoke the callback synchronously from the executor thread; `await asyncio.sleep(0)` flushes the `call_soon_threadsafe` queue before asserting on `run["events"]`.
- **`test_execute_pipeline_step_emits_progress_events`**: same guard for the `_execute_pipeline_step` path. Asserts ≥1 `stage_update` event in `pipeline["events"]` and that `step` carries the pipeline step index (not the AgentSuite internal stage step).
- **Issue [#19](https://github.com/scottconverse/AgentSuiteLocal/issues/19)** filed: migrate `_execute_pipeline_step` to `PipelineOrchestrator` to enable K1 cross-stage context accumulation (currently bypassed; each pipeline step runs as an isolated single-agent call).

### Fixed
- **`step` key collision in pipeline `progress_callback`**: `stage_progress` events emitted by `BaseAgent.run()` include a `"step"` field (intra-stage step counter). Forwarding the full dict while also passing `step=step_idx` to `_emit_pipeline` caused `TypeError: got multiple values for keyword argument 'step'` at runtime, silently swallowing all pipeline `stage_update` events. Now strips `"step"` from the forwarded payload; `step=step_idx` (pipeline step index) is authoritative.

### Test metrics (v0.8.6)
- Backend tests: **135 passing** (was 127 in v0.8.5; +8 net including 2 new progress-event guards)
- `execution.py` coverage: **72%** (was 70% against v0.8.5 tests; +2pp, covers `progress_callback` closure bodies)
- Repo-wide coverage: **67%** (floor 60%)

## [0.8.5] — 2026-05-04

Sprint 2 — wire AgentSuite v1.1.0 intra-stage progress events to SSE stream.

### Changed
- **AgentSuite pin bumped `@v1.0.11` → `@v1.1.0`**: brings in K1 cross-stage context accumulator and K2 intra-stage progress callbacks (`BaseAgent.run(progress_callback=...)` + `PipelineOrchestrator(kernel_progress_callback=...)`).
- **Real `progress_callback` wired in `_execute_run`**: replaces no-op stubs. Uses `loop.call_soon_threadsafe` to safely push `stage_update` SSE events from the thread-pool executor thread to the asyncio event loop. The frontend `LiveRunView.jsx` already handles `stage_update` events.
- **Real `progress_callback` wired in `_execute_pipeline_step`**: same pattern; events arrive as `stage_update` with an additional `step` field carrying the pipeline step index.

### Fixed
- Closes [Issue #10](https://github.com/scottconverse/AgentSuiteLocal/issues/10) — intra-stage SSE events were blocked on AgentSuite v1.1.0 shipping `PipelineOrchestrator`. That work is now tagged and the no-op stubs are removed.

## [0.8.4] — 2026-05-04

### Fixed
- **`softprops/action-gh-release` node24 migration**: `release.yml` was pinned to `3bb12739` (v2, node20). Updated to `b4309332` (v3.0.0, node24). This completes the Sprint 0 node24 migration — all five `actions/*` pins were already on node24; this was the one missed action.
- **SHA-pins comment block**: updated to `@v3` notation and added `(node24)` annotation to every entry so future audits can verify compatibility without an API call.

> **Note:** Sprint 0 was declared complete after migrating `actions/checkout`, `actions/setup-python`, `actions/setup-node`, `actions/upload-artifact`, and `actions/download-artifact`. `softprops/action-gh-release` was listed in the same comment block but its pinned SHA was not checked for node20/24 status. The deprecation warning appeared on the v0.8.3 release run. Node.js 20 forced-default deadline: 2026-06-02. Node.js 20 hard-removal from runners: 2026-09-16.

## [0.8.3] — 2026-05-04

### Added
- `tests/test_launcher.py` — two tests: `test_primes_enabled_agents_env` and `test_does_not_override_operator_env`. Regression guard: removing the `setdefault` from `launcher.main()` causes these to fail immediately.
- `TestEnabledAgents` class in `tests/test_cli.py` — same two assertions for `cli.main()`.

### Changed
- `pyproject.toml`: replaced static `version = "0.8.2"` with `dynamic = ["version"]` + `[tool.setuptools.dynamic]` pointing to `agentsuitelocal.__version__.__version__`. `__version__.py` is now the single source of truth; `pyproject.toml` has no independent version string that can drift.
- `tests/test_execution.py`: removed inline `os.environ.setdefault(...)` calls from `test_execute_run_dispatches_non_founder_agent` and `test_execute_pipeline_step_dispatches_non_founder_agent`. Replaced with `_all_agents_enabled` pytest fixture (uses `monkeypatch`). Failure signals are now clean: entry-point tests fail for entry-point regressions; execution tests fail for execution regressions.
- `README.md`: bumped version header to `v0.8.2`, updated installer filename references, updated `/api/version` example, updated data-flow description (PipelineOrchestrator → BaseAgent.run()), updated Known Issues header, removed stale v0.1.2 commit-SHA bullet, added Recent releases table.

## [0.8.2] — 2026-05-04

### Fixed
- **Version metadata**: `pyproject.toml` and `agentsuitelocal/__version__.py` bumped to `0.8.2`. v0.8.0 and v0.8.1 shipped with version `0.7.1` in package metadata — `pip show` and `/api/version` reported the wrong value. Fixed going forward; see note below.
- **CI version gate**: `release.yml` `verify-ci` job now checks that the package version in `__version__.py` matches the git tag before any build starts. Prevents this class of drift from recurrence.

> **Note:** v0.8.0 and v0.8.1 wheels report version `0.7.1` from `pip show` due to the metadata bump being missed in those releases. The git tags and release assets are unaffected. v0.8.2 fixes this and adds CI enforcement to prevent recurrence.

## [0.8.1] — 2026-05-04

### Fixed
- **All 7 agents enabled at launch**: `launcher.py` and `cli.py` now call `os.environ.setdefault("AGENTSUITE_ENABLED_AGENTS", "founder,design,product,engineering,marketing,trust_risk,cio")` at startup. Without this, AgentSuite `DEFAULT_ENABLED = "founder"` caused `UnknownAgent` to be raised for any non-Founder agent selection, silently landing every Design/Product/Engineering/Marketing/Trust_Risk/CIO run in `status="error"`.

### Added
- Integration tests `test_execute_run_dispatches_non_founder_agent` and `test_execute_pipeline_step_dispatches_non_founder_agent` — regression guards for the above footgun. The pipeline-step test is also the first test of the `_execute_pipeline_step` code path.

> **Note:** This release ships with package version `0.7.1` in wheel metadata due to a missed bump. Fixed in v0.8.2.

## [0.8.0] — 2026-05-04

### Fixed
- **PipelineOrchestrator shim**: `agentsuite.pipeline.orchestrator` does not exist in v1.0.11. Both `_execute_run` and `_execute_pipeline_step` were failing at the deferred import on every run. Replaced with direct `BaseAgent.run()` calls via `default_registry().get_class(agent_id)`. `on_progress` and `kernel_progress_callback` preserved as no-op stubs pending AgentSuite v1.1.0 ([Issue #10](https://github.com/scottconverse/AgentSuiteLocal/issues/10)).

### Changed
- **SQLite state storage**: `runs.json` and `pipelines.json` replaced by a single WAL-mode SQLite database at `~/.agentsuitelocal/state.db`. One-time migration runs on first startup. Crash recovery (`running → error`) and pipeline orphan repair retained.
- **main.py split**: 1343-statement monolith split into 14 modules (9 APIRouters + 5 support files) under `agentsuitelocal/api/`.
- **CI: node20 → node24**: All five pinned GitHub Actions updated to node24-compatible versions before the 2026-06-02 deprecation deadline.

### Added
- Integration test `test_execute_run_completes_without_module_not_found_error` — end-to-end test for `_execute_run` with a mocked LLM.
- Cross-repo tracking: [AgentSuiteLocal #10](https://github.com/scottconverse/AgentSuiteLocal/issues/10) and [AgentSuite #41](https://github.com/scottconverse/AgentSuite/issues/41) opened for the `PipelineOrchestrator` work.

> **Note:** This release ships with package version `0.7.1` in wheel metadata due to a missed bump. Fixed in v0.8.2.

## [0.7.1] — 2026-05-03

### Fixed (post-v0.7.0 hardening sprint)

**Phase 1 — Blockers / Critical / Major**
- **B-1 — Project mutation endpoints**: `POST /api/projects/{slug}/rename`, `POST /api/projects/{slug}/archive`, and `DELETE /api/projects/{slug}` now exist and function. Previously all three silently 404'd, making every Rename/Archive/Delete button in ProjectsView a no-op.
- **C-1 — ModelView pull uses POST stream**: `pullModel` now uses `fetch()` + `response.body` reader instead of `new EventSource(...)`. EventSource is always GET; the endpoint is POST — the pull had never worked.
- **C-2 — Update banner field names**: `App.jsx` reads `has_update`/`latest` from `/api/update/check`, not the non-existent `update_available`/`latest_version`. The banner had never fired.
- **C-3 — Tier model map keys corrected**: `_TIER_MODEL_MAP` now uses `"light"/"balanced"/"pro"` to match the frontend tier IDs sent from the installer. Previously used `"fast"/"balanced"/"powerful"` — light and pro tier selections silently mapped to `None`.
- **M-1 — ProjectsView field names**: Reads `runs`/`last_touch` (API shape), not `run_count`/`last_run_at`. Project cards had always shown "0 runs, no date."
- **M-2 — Partial QA warning**: `EXPECTED_QA_DIMS` corrected from 5 to 9 to match actual backend dimension count. Previously showed a spurious "9 of 5 dimensions" warning on every normal run.
- **M-3 — ModelView RECOMMENDED list**: Now imports from `data.js` MODELS instead of a local hardcoded list with wrong tier labels and model names.
- **M-4 — Uninstall SIGTERM on Windows**: Uses `os._exit(0)` on Windows where SIGTERM-to-self is a no-op; POSIX path unchanged.
- **M-5 — ZIP export temp file leak**: `FileResponse` now carries a `BackgroundTask(os.unlink, tmp_path)` so the temp file is removed after the download completes.
- **M-6 — macOS .app icon format**: `AgentSuiteLocal.spec` BUNDLE now references `icon.icns` (macOS requires `.icns`; `.ico` produced no dock icon).
- **M-7 — README main.py line count**: Corrected from "~440 lines" to "~2000 lines, 48 routes."
- **M-8 — Sidebar live model name**: Sidebar footer now shows the real `model_name` from `/api/settings` (fetched once on app entry) instead of a hardcoded "gemma4:e4b" string.
- **M-9 — CHANGELOG SSE buffer size**: Corrected from `maxlen=500` to `maxlen=100` to match the actual `_SSE_BUFFER_SIZE` constant.

**Phase 2 — Minor fixes + test coverage**
- **m-1 — Error states on fetch failures**: `ProjectsView`, `RunsView`, and `PipelineView` now show an inline error card with a Retry button instead of silently swallowing `.catch(() => {})`.
- **m-2 — State lock on run mutations**: `cancel_run`, `approve_run`, `reject_run` now hold `_state_write_lock` before calling `_save_state()`.
- **m-3 — NewRunView label/input association**: All `<label>` elements now have `htmlFor`; all inputs have matching `id` attributes. Clicking a label now focuses the input; screen readers can associate them.
- **m-4 — CFBundleShortVersionString dynamic**: PyInstaller spec now reads `_APP_VERSION` from `agentsuitelocal.__version__` — no longer a hardcoded string that drifts on every release.
- **m-5 — test_version uses __version__**: Test no longer asserts a literal `"0.7.0"` — imports from `__version__.py` so it doesn't break on every version bump.
- **m-6 — New endpoint response-shape tests**: `/api/update/check`, `/api/smoke`, `/api/model/verify`, `/api/ollama/pull` (method-not-allowed test), and all 3 project mutation endpoints now have test coverage.

**Phase 3 — Nits**
- **N-1 — anthropic/openai/mcp pinned**: Added `anthropic>=0.49.0`, `openai>=1.76.0`, `mcp>=1.9.0` to `pyproject.toml` (were hiddenimports in spec but undeclared dependencies).
- **N-2 — DPI-awareness manifest**: `agentsuitelocal/assets/dpi_aware.manifest` created; wired into `EXE()` in the spec — prevents blurry rendering on high-DPI Windows.
- **N-3 — API key cleared after installer**: `setApiKey("")` called immediately after the key is persisted to the backend. Key no longer lingers in React state / DevTools.
- **N-4 — Inno Setup uninstall silent failure**: UninstallRun PowerShell call now uses `try/catch` so a stopped daemon returns exit 0 rather than failing the uninstall.

**Phase 4 — Architecture hardening**
- **A-2 — CORS documented**: Verified CORS is already restricted to `localhost:5173/8765`; added explanatory comment; documented in CONTRIBUTING.md.
- **A-5 — ErrorBoundary**: `ErrorBoundary` React class component wraps every main view — unhandled exceptions now show a recoverable error card instead of a blank screen.
- **A-7 — Optimistic approve/reject**: `handleApprove` and `handleReject` in `ApprovalGateView` now track loading/error state; buttons show "Approving…"/"Rejecting…" and disable during the POST; errors surface inline.
- **A-8 — API key sentinel guard**: Settings write path ignores `"***"` sentinel — reading settings, changing an unrelated field, and re-POSTing no longer overwrites the real API key.

**Phase 5 — Security hardening**
- **S-1 — open-folder path containment**: `open_folder` endpoint now uses `is_relative_to()` instead of `str.startswith()` to prevent sibling-directory bypass attacks.
- **S-2 — API key in OS keychain**: `keyring>=25.0` added. API key stored via Windows Credential Manager / macOS Keychain / Linux Secret Service. Plain-text key migrated out of `settings.json` on first load. Falls back to JSON if `keyring` unavailable (CI).
- **S-3 — Telemetry disclosure**: SettingsView telemetry toggle sub-text now specifies the file path and confirms data is never transmitted. README Privacy section added.

**Phase 6 — UX improvements**
- **UX-1 — 5-screen installer**: Installer compressed from 11 screens to 5. `ScreenHardwareTier` combines hardware scan + tier auto-selection. `ScreenOllamaModel` combines Ollama runtime check + model download with retry loop and progress bar. Agent/API key/Python setup moved to Settings.
- **UX-2 — Tier consequence copy**: Each tier card in installer and Settings now shows a plain-English consequence sentence explaining output quality tradeoff.
- **UX-3 — RunsView: waiting first + human labels**: "Waiting for your review" runs float to the top. Status strings replaced with plain-English labels (`waiting → "Waiting for your review"`, etc.).
- **UX-4 — KernelView artifact preview**: Clicking any artifact filename opens an inline slide-in preview panel with the file content rendered as markdown. Uses `GET /api/kernel/{project}/{agent}/{path}` endpoint (new).
- **UX-5 — Skeleton loading states**: `SkeletonCard` component added to `ui/index.jsx`. `RunsView`, `ProjectsView`, and `KernelView` show skeleton cards while fetching instead of blank panels.

**Phase 7 — Distribution & CI hardening**
- **D-1 — macOS CI build job**: `build-macos` job added to CI — runs on `macos-latest`, builds frontend, runs PyInstaller, verifies `.app` bundle exists. Triggers on `main` + version tags only.
- **D-2 — AV false-positive guidance**: README Troubleshooting section added with Windows Security exclusion steps. README Privacy section added with keychain and telemetry disclosure.
- **D-3 — Ollama health-check replaces sleep**: E2E CI job now polls `/api/tags` in a loop (30 × 0.5s) instead of `sleep 3` — prevents flaky failures on slow runners.
- **D-4 — Coverage threshold enforced**: `--cov-fail-under=58` added to CI test step (baseline 58.59%). Raise by 5% each sprint.

### Added (post-v0.7.0 hardening sprint)
- `GET /api/kernel/{project}/{agent}/{path}` — read individual kernel artifact file content. Path containment verified with `is_relative_to()`.
- `SkeletonCard` component exported from `web/src/components/ui/index.jsx`.
- `ErrorBoundary` component at `web/src/components/app/ErrorBoundary.jsx`.

### Tests
- Backend: 92 → 108 tests (16 new — project mutation endpoints, update check shape, smoke, tier map, model verify, open-folder path rejection, kernel artifact, keyring sentinel).
- Frontend: 74 → 93 tests (19 new — Dashboard, LiveRunView, PipelineView, ManualView, KernelView added; ApprovalGateView, ProjectsView, ModelView, RunsView expanded).

## [0.7.0] — 2026-05-03

### Added

**Backend**
- Run watchdog: `asyncio.wait_for` enforces `run_timeout_seconds` (60–3600s, default 900). Timeout sends `status: timeout` and saves partial artifacts (B3).
- SSE event buffer: `collections.deque(maxlen=100)` per run. Clients reconnect with `?since=<seq>` to replay missed events (B4).
- Cancel endpoint: `POST /api/run/{id}/cancel` — signals asyncio task, saves partial artifacts to `cancelled-outputs/`, returns 400 on wrong state (B1/B2).
- QA gate override: `POST /api/run/{id}/approve` accepts `override: true`; stored on the run record (C1).
- Kernel diff: `GET /api/kernel/diff?a=&b=` — `difflib.unified_diff` between two kernel files (D3).
- Run export: `GET /api/run/{id}/export/zip|markdown|pdf` — ZIP of artifacts, Markdown summary, or PDF via weasyprint (D4).
- Open folder: `POST /api/open-folder` — opens the run export path in Explorer/Finder (D1).
- Pipeline resume: `POST /api/pipelines/{id}/resume` — re-queues next pending step after an error state (F3).
- Crash recovery: on startup, running runs are set to `error: "AgentSuiteLocal restarted"` (F1); pipeline steps likewise (F2).
- Crash reports: unhandled exceptions write timestamped JSON to `~/.agentsuitelocal/crash-reports/`; `GET /api/crash-reports/latest` returns the most recent report (F4).
- Cloud model routing: `model_name` starting with `claude-` routes to Anthropic provider with the stored API key (G2).
- Tier model map: `fast → gemma2:2b`, `balanced → gemma4:e4b`, `powerful → llama3.1:8b` stored in `_TIER_MODEL_MAP` (G1).
- Ollama model management: `GET /api/ollama/models`, `POST /api/ollama/pull` (SSE), `DELETE /api/ollama/models/{name}` (G3).
- Model verify endpoint: `GET /api/model/verify/{name}` — runs a short inference ping before advancing the installer (A3).
- Desktop notifications: `winotify` (Windows) / `pync` (macOS) triggered on run approval or error (H1).
- Auto-update check: `GET /api/update/check` — compares `__version__` against the latest GitHub release tag (H2).
- Local telemetry: run events appended to `~/.agentsuitelocal/usage.jsonl`; `GET /api/telemetry/summary` returns counts. Data never leaves the machine (J4).
- Path validation: `POST /api/validate-path` — rejects system paths, non-existent directories, paths > 512 chars (B6).
- Dynamic port: `GET /api/launcher/port` reads the stored port from `~/.agentsuitelocal/launcher.log` (A5).
- Projects API: `GET /api/projects`, `POST /api/projects/{slug}/rename`, `POST /api/projects/{slug}/archive`, `DELETE /api/projects/{slug}` (H5).
- Settings fields added: `cloud_model`, `notifications`, `run_timeout_seconds`, `qa_gate_threshold`, `dismissed_update_version` (B3, C1, G2, H1).
- HTTP crash-reporting middleware wraps all requests; writes JSON report and re-raises.
- `GET /api/version` returns current `__version__`.

**Frontend**
- `ModelView.jsx` (G3): installed model list with set-active / delete / confirm-delete; recommended model list with SSE pull progress bar.
- `ProjectsView.jsx` (H5): project cards with inline rename, archive, confirm-delete.
- `CrashBanner.jsx` (F4): polls `/api/crash-reports/latest` on mount; dismissable banner with clipboard copy.
- `SettingsView.jsx` upgrades: tier model warning (G1), cloud model selector + persistent cost warning (G2), notifications toggle (H1), local-only telemetry toggle (J4), run timeout input (B3), QA gate threshold input (C1).
- `LiveRunView.jsx` upgrades: cancel button with "Cancelling…" state (B1), timeout distinct state (B3), SSE reconnect banner with attempt count (B4), per-stage elapsed timer (E2).
- `ApprovalGateView.jsx` upgrades: QA gate threshold enforcement with override modal (C1), markdown rendering via react-markdown + remark-gfm with graceful fallback (C2), partial QA notice (C3), post-approve export path + open folder button (D1), export dropdown ZIP/Markdown/PDF (D4).
- `RunsView.jsx` upgrades: debounced search + status filter (H3), `RunDetailView` inline component for terminal-state runs (B5), retry button on error/rejected/cancelled rows (E1).
- `KernelView.jsx` upgrades: debounced search + project filter (H4), empty-state guidance.
- `NewRunView.jsx` upgrades: B6 path validation on blur; E1 retry pre-population via `initialGoal`/`initialProject` props.
- `App.jsx` upgrades: Models and Projects nav items; H2 update banner; F4 CrashBanner; E1 retry pre-population flow.
- `Sidebar` updated with Models and Projects nav items.
- `useSSE.js` upgrades: sequence tracking + `?since=` reconnect (B4), 10 retry max with 30s backoff cap, `reconnectAttempt` state.

**Installer**
- `ScreenOllama.jsx`: shows detected Ollama version string when already installed (A1).
- `ScreenModelDownload.jsx`: 3-attempt retry loop with 5s backoff and countdown display (A2); model verify call before advancing (A3).
- `ScreenSmoke.jsx`: per-check fix cards with action buttons; "Skip smoke test" escape hatch with confirmation warning (A4).

**Infrastructure**
- `.github/workflows/ci.yml` updated: ruff lint job added; frontend build smoke added; `release/**` branch trigger added (J1).
- `.github/workflows/release.yml` created: `v*` tag trigger; Windows + macOS parallel builds; Inno Setup installer; GitHub release creation with CHANGELOG notes (J2).
- `installer/AgentSuiteLocal.iss` — Inno Setup 6 script; installs PyInstaller onedir output to Program Files; optional desktop icon and startup entry; graceful backend shutdown on uninstall (I1).
- `Makefile`: `build-installer` target added (calls `iscc`) (I1).
- `weasyprint>=62.0` and `winotify>=1.1.0 (Windows)` added to `pyproject.toml` dependencies.
- `react-markdown ^9.0.1` and `remark-gfm ^4.0.0` added to `web/package.json` dependencies.

### Changed
- Version bumped 0.1.2 → 0.7.0 in `agentsuitelocal/__version__.py`, `pyproject.toml`, `AgentSuiteLocal.spec`, `web/package.json`.
- `_load_state()` repairs `running` runs to `error` on startup (crash recovery).

## [0.1.2] — 2026-05-02

### Fixed

- **`GET /api/run/{id}` 500 on non-finite floats** (ENG-NEW-004): `_scrub_nan_from_run` now scrubs `qa_score` at the top level in addition to `qa_dimensions` entries, and correctly passes through integer scores (previously dropped by `isinstance(score, float)` guard).
- **Path traversal test reliability** (QA-FIX): Rewrote `test_get_artifact_rejects_path_traversal` to use `pathlib.Path.is_relative_to()` directly instead of HTTP URL encoding — HTTP layer normalises `%2E%2E` before the guard fires, making the prior test a false pass.
- **Toast animation and color** (UX-FIX): Rejection toast now uses `var(--bad)` (red) instead of `var(--warn)` (amber) and gains the `.fade-up` CSS class so it slides in like other transient notifications.
- **`auto_approve_threshold` dead field removed**: Field was stored and returned by the settings API but never consumed by any pipeline or run logic. Removed from `SettingsPatch` and `_SETTINGS_DEFAULTS` to prevent silent misconfiguration.

## [0.1.1] — 2026-05-02

### Fixed

- **Security — `inputs_dir` path traversal** (ENG-002): `RunRequest` and `PipelineRequest` now validate `inputs_dir` via `_validate_inputs_dir()` — rejects paths outside `Path.home()`, non-existent directories, and paths > 512 chars. Previously accepted arbitrary filesystem paths including `C:\Windows\System32`.
- **Thread safety — `on_progress` callback** (ENG-001): Mutations to `_runs` / `_pipelines` event lists from thread-pool executor callbacks now go through `loop.call_soon_threadsafe()` instead of mutating the list directly from a non-event-loop thread.
- **Thread safety — disk writes** (ENG-003): `_save_state` and `_apply_settings_patch` now hold `threading.Lock` guards to prevent concurrent read-modify-write races.
- **Accessibility — keyboard operability** (UX-001): Replaced `all: "unset"` inline style on all interactive card buttons with `.btn-card` CSS class. `all: "unset"` destroyed focus rings and font inheritance; `.btn-card` clears platform button chrome only.
- **Accessibility — ARIA labels** (UX-002): `Icon` component now accepts `aria-label` prop; decorative icons get `aria-hidden={true}`. `Toggle` component uses `role="switch"` + `aria-checked`.
- **Reduced motion** (UX-003): `@media (prefers-reduced-motion: reduce)` disables `.spin`, `.pulse-dot`, `.fade-up`, and `.shimmer` animations.
- **Hardware screen fake specs** (UX-006): `ScreenHardware` `.catch()` fallback no longer shows hardcoded Apple M2 Pro specs. Shows "Unable to detect" with warning status instead.
- **Manual screen stub** (DOC-003): `ManualView` replaced 350-word placeholder with full in-app manual — installer walkthrough table, screen guide, kernel explainer, tips, troubleshooting, and FAQ sections.
- **Input length limits** (QA-NEW-002): `goal` field capped at 2000 chars; pipeline `name` capped at 200 chars via pydantic `Field(max_length=...)`.

### Added

- **Pipeline state machine tests** (TEST-001): 8 new tests covering `_advance_pipeline`, approve/reject endpoints, 404 handling, step status propagation, and done-state completion.
- **Pipeline SSE stream tests** (TEST-002): 3 new tests covering 200 response, 404 for unknown, and buffered event content emission.
- **`inputs_dir` validation tests** (QA-NEW-001): 7 new tests covering Windows system path rejection, traversal rejection, `None` acceptance, and pipeline-level validation.
- Backend test suite: 25 → 43 tests.
- `cleanroom-docker/` — Linux Docker cleanroom: `python:3.12-slim` image, installs all deps from scratch, runs `uvicorn` with socat proxy to host Ollama; validates the API layer outside of any Windows dev environment.
- `scripts/cleanroom.ps1` — isolated Windows distributable test; copies dist to temp dir, strips Python/Node from PATH, asserts 7 API checks, cleans up (`make cleanroom`).

## [0.1.0] — 2026-05-02

### Fixed

- `agentsuite` dependency pinned to commit SHA `17fda3140087ef85f3a72ca48a05551fce983740` (was `@main`); builds are now reproducible.
- `_resolve_llm()` passed `model=` keyword to `resolve_provider()` which accepts `name=`; kwarg mismatch silently forced Ollama fallback even when env-var providers were configured. Corrected to `name=model_name`.

### Known issues

- Pipeline runs do not yet persist across backend restarts if state is lost before the JSON sidecar writes.
- E2E tests require a running Vite dev server and backend to be started manually before the suite runs.

### Added
- PyInstaller Windows distributable — self-contained, no Python or Node required on the target machine
- FastAPI + uvicorn backend bundled in-process; launcher finds a free port and writes it to `~/.agentsuitelocal/launcher.log`
- SSE streaming endpoint mapping AgentSuite `ProgressCallback` events to the frontend
- Hardware probe API (CPU, RAM, disk, Ollama status)
- React + Vite frontend — 11 installer screens + 9 main app screens
- Full installer flow: hardware check, model tier picker, Ollama auto-install, model download, smoke test
- Dashboard, Agents, New Run, Live Run, Approval Gate, Kernel, Settings, Manual, Runs
- Pipelines view — multi-agent chain builder wired to real backend; `POST /api/pipelines` executes agents in sequence through `PipelineOrchestrator` with per-step approval gates
- Three-pane approval gate: file tree / artifact preview / QA scores
- Pipeline endpoints: `GET/POST /api/pipelines`, `GET /api/pipelines/{id}`, `POST /api/pipelines/{id}/approve`, `POST /api/pipelines/{id}/reject`, `GET /api/pipelines/{id}/stream`
- Dark mode support via `[data-theme="dark"]` CSS attribute
- Design token system: warm neutrals, terracotta accent, Fraunces + Inter Tight + JetBrains Mono
