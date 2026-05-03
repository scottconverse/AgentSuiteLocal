# Changelog

All notable changes to AgentSuiteLocal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

_Nothing pending._

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
