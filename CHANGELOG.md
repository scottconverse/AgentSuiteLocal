# Changelog

All notable changes to AgentSuiteLocal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

_Nothing pending._

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
