# Architecture

AgentSuiteLocal is a thin local desktop shell around [AgentSuite](https://github.com/scottconverse/AgentSuite). The backend is a FastAPI app split across nine routers and a handful of support modules under `agentsuitelocal/api/`. The frontend is React + Vite. They speak REST + SSE. Everything runs on-device — no cloud required. An optional Anthropic API key enables cloud-model fallback.

> **A note on doc currency.** The CHANGELOG is the canonical source of truth for "what does this project actually do today". Where this document and the CHANGELOG disagree, trust the CHANGELOG and file an issue. As of v0.8.9 this document was reconciled against `App.jsx`, the `agentsuitelocal/api/` package, and the v0.8.0 → v0.8.9 changelog entries.

---

## System diagram

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite, :5173 dev / :8765 prod)                │
│                                                                 │
│  Installer wizard (6 screens)    Main app (12 screens)         │
│         │                               │                       │
│         └──── fetch /api/* ─────────────┘                      │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼───────────────────────────────────────┐
│  FastAPI backend  (uvicorn :8766 dev / :8765 prod)             │
│                                                                 │
│  agentsuitelocal/api/                                          │
│    main.py        app factory, middleware, error handlers      │
│    routers/       9 APIRouters (runs, pipelines, projects,     │
│                   ollama, settings, kernel, telemetry,         │
│                   crash-reports, version)                      │
│    config.py · execution.py · schemas.py · state.py · workspace │
│                                                                 │
│  state: SQLite (WAL) at ~/.agentsuitelocal/state.db            │
│         single-user; runs and pipelines are tables, not files  │
│         crash-recovery on startup: running → error             │
└────────────────────────┬───────────────────────────────────────┘
                         │ loop.run_in_executor (thread pool)
┌────────────────────────▼───────────────────────────────────────┐
│  AgentSuite engine                                             │
│                                                                 │
│  Single-agent runs   →  BaseAgent.run() (direct path)          │
│  Multi-agent pipelines → PipelineOrchestrator.run()            │
│                          (with _execute_pipeline_step_direct   │
│                           fallback for resume/recovery)        │
│                                                                 │
│  on_progress / kernel_progress_callback                        │
│      → SSE event queue → /api/run/{id}/stream                  │
│                                                                 │
│  Stages: intake → extract → spec → execute → QA                │
│  Artifacts: ~/AgentSuite/.agentsuite/runs/{run_id}/            │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP :11434
┌────────────────────────▼───────────────────────────────────────┐
│  Ollama  (local LLM daemon)                                    │
│                                                                 │
│  Tiers: Light    (gemma4:e2b)                                  │
│         Balanced (gemma4:e4b)  ← recommended                   │
│         Pro      (gemma4:26b)                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Backend — `agentsuitelocal/api/`

### Package layout

The original `main.py` monolith was split in v0.8.0 (CHANGELOG: "1343-statement monolith split into 14 modules — 9 APIRouters + 5 support files"). Today:

| Module | Responsibility |
|---|---|
| `main.py` | App factory, CORS, middleware, crash-report wrapper, lifespan hooks |
| `routers/` | One router per resource: runs, pipelines, projects, kernel, ollama, settings, telemetry, crash-reports, version |
| `config.py` | Settings loader, defaults, env-var overrides (`AGENTSUITE_WORKSPACE`, `AGENTSUITE_ENABLED_AGENTS`) |
| `execution.py` | `_execute_run`, `_execute_pipeline_step`, `_advance_pipeline`, `_execute_pipeline_step_direct` (legacy resume path) |
| `schemas.py` | Pydantic models — request/response shapes |
| `state.py` | SQLite open/close, schema, runs/pipelines table CRUD, crash recovery |
| `workspace.py` | Workspace path resolution, kernel paths |

### Run lifecycle

```
POST /api/run
  → state.create_run(run_id, status="running")
  → asyncio.create_task(_execute_run(run_id, req))
  → returns {run_id} immediately

_execute_run (background task)
  → emits agent_start event
  → BaseAgent.run(progress_callback=...) wrapped in
    asyncio.wait_for(timeout=run_timeout_seconds), via run_in_executor
  → progress_callback uses loop.call_soon_threadsafe to push
    stage_update SSE events from the executor thread
  → on completion: persists artifacts, qa_score, status="waiting"
  → emits agent_waiting
  → CancelledError: status="cancelled", saves partial artifacts
  → TimeoutError: status="timeout", saves partial artifacts

GET /api/run/{id}/stream  (SSE)
  → accepts ?since=<seq> — replays buffered events from that sequence
  → events buffered in collections.deque(maxlen=100) per run
  → terminates on terminal status

POST /api/run/{id}/cancel
  → cancels the asyncio task
  → returns 400 if run is not in "running" state

POST /api/run/{id}/approve
  → optionally accepts override: true to bypass the QA gate
  → copies run dir to ~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/{ts}/
  → sets status="approved"
```

### Pipeline lifecycle

Multi-agent pipelines route through `PipelineOrchestrator` (re-introduced in v0.8.7 — see CHANGELOG Issue #19):

```
_execute_pipeline_step (step 0)
  → PipelineOrchestrator.run() → emits agent_start/done/stage_update
  → on completion, awaits user approval at the gate

_advance_pipeline (subsequent steps)
  → PipelineOrchestrator.approve() promotes step N's artifacts and
    drives step N+1 with accumulated cross-stage context (K1)
  → falls back to _execute_pipeline_step_direct (legacy direct-agent
    path) when no orchestrator state is found on disk — typically
    the resume-from-error case
```

The single-agent `/api/run` path does not use the orchestrator (a single-agent run has no cross-stage context to accumulate). v0.8.0 removed the orchestrator entirely; v0.8.7 re-introduced it for the pipeline path only.

### Persistent state

Runs and pipelines live in a single SQLite database at `~/.agentsuitelocal/state.db` (WAL journal mode for concurrent reader/writer safety). The schema migration runs once on first startup — earlier versions used JSON sidecars (`runs.json`, `pipelines.json`) at the same path; the migration ports them in. Runs that were "running" at shutdown are repaired to "error" with the message "AgentSuiteLocal restarted while this run was in progress" on next startup.

The kernel (promoted artifacts on disk under `~/AgentSuite/.agentsuite/_kernel/`) is the canonical durable state. The SQLite database is a structured history; it can be deleted without losing approved artifacts.

### Thread model

The FastAPI event loop stays on one thread. `BaseAgent.run()` and `PipelineOrchestrator.run()` are synchronous, so they execute on the default thread pool via `loop.run_in_executor(None, _run_sync)`.

The `progress_callback` is invoked on the executor thread. It pushes updates to the event loop using `loop.call_soon_threadsafe(events.append, event)` — never mutating the event list from the executor thread. The SSE generator reads the event list exclusively on the event-loop thread.

`state.save_*` functions hold a `threading.Lock` for read-modify-write sequences against `state.db`.

---

## Frontend — `web/src/`

### Scene graph

```
App.jsx
  mode = "installer" | "app"
  setup-complete state stored in localStorage["agentsuite_setup_complete"]

  mode === "installer"  (6-screen flow, UX-1; smoke step re-introduced in v0.8.8)
      step 1  ScreenWelcome
      step 2  ScreenLicense        nextDisabled={!agreed}
      step 3  ScreenHardwareTier   hardware probe + tier auto-select
      step 4  ScreenOllamaModel    Ollama check + model pull (3-attempt retry)
      step 5  ScreenSmoke          Ollama / model / API / inference
      step 6  ScreenSuccess        Launch → mode="app"

      Legacy single-purpose screens (ScreenHardware, ScreenTier, ScreenOllama,
      ScreenModelDownload, ScreenPython, ScreenAgents, ScreenApiKey) still
      exist in src/components/installer/ but are not in the main flow.

  mode === "app"
    CrashBanner (F4 — shown if a crash report is newer than the dismissed token)
    Update banner (H2 — shown if /api/update/check returns has_update=true)
    Sidebar  (home | agents | runs | kernel | pipeline | projects | models | settings | manual)
    view === "home"     → Dashboard
    view === "agents"   → AgentsView
    scene === "newrun"  → NewRunView
    scene === "live"    → LiveRunView
    scene === "gate"    → ApprovalGateView
    view === "runs"     → RunsView
    view === "kernel"   → KernelView
    view === "pipeline" → PipelineView
    view === "projects" → ProjectsView
    view === "models"   → ModelView
    view === "settings" → SettingsView
    view === "manual"   → ManualView (in-app user manual; see ManualView.jsx)
```

### SSE bridge — `hooks/useSSE.js`

```
useSSE(runId)
  → opens EventSource to /api/run/{runId}/stream?since=<lastSeq>
  → tracks seqRef; on reconnect replays from last known sequence (B4)
  → exponential backoff, max 10 attempts, 30s cap (B4)
  → event types:
      agent_start    → status="running"
      stage_update   → updates stages[] progress
      agent_done     → stage marked complete
      agent_waiting  → status="waiting", triggers approval gate
      pipeline_step_done / pipeline_done → pipeline-specific
      error / timeout / cancelled → terminal failure modes
  → returns { events, status, error, cancel, reconnectAttempt }
  → closes EventSource on unmount or terminal state
```

### Shared SSE-stream helper — `utils/sseStream.js`

Four installer screens (`ScreenModelDownload`, `ScreenOllama`, two paths in `ScreenOllamaModel`) consume `fetch` + `ReadableStream` SSE streams (rather than `EventSource`, which doesn't support POST). v0.8.8 extracted the duplicated parser into `utils/sseStream.js` — an async generator that handles SSE comments (`: ping - N` keepalives), non-`data:` control frames, and unparseable payloads. See CHANGELOG v0.8.8 for the keepalive-comment fix that motivated the extraction.

### Vite proxy

The Vite dev server proxies `/api/*` to `:8766` via `vite.config.js`. In production, FastAPI serves the built frontend from `web/dist/` and handles `/api/*` natively — no proxy needed.

---

## Test pyramid

```
tests/
  test_api.py          ~110 unit tests — TestClient (in-process, no network)
                        covers cancel, export, kernel diff, crash reports,
                        telemetry, model verify, validate-path, project
                        mutations, keyring sentinel, tier map, etc.
  test_integration.py    ~10 integration — real uvicorn on a free port
  test_execution.py      ~15 execution-layer tests including
                          PipelineOrchestrator dispatch and
                          progress_callback wire-up regression guards
  test_launcher.py / test_cli.py — entry-point env-var regression guards
  test_ollama_live.py    6 live tests — real Ollama daemon required;
                                         auto-skip if daemon unreachable;
                                         pytest.mark.ollama
  e2e/
    conftest.py          session fixture — starts backend on :8766 if not up
    test_installer.py    E2E — full 6-step installer walk
    test_app.py          E2E — nav items + New Run + Approval Gate
                                pytest.mark.e2e
                                Note: CI workflow pulls gemma4:e4b
                                (matches _SETTINGS_DEFAULTS["model_name"];
                                smoke step verifies it's installed)
```

Backend test count grows over time as regression-guard tests are added. Approximate counts: v0.8.7 ~135, v0.8.8 ~150, v0.8.9 163+ passing + 1 documented xfail (test-fixture cascade from TEST-CRIT-001). The CI filter (`--ignore=tests/e2e -m "not ollama"`) deselects ~6 ollama-live tests. Coverage floor: 58% (`--cov-fail-under=58`). For the exact figure of any given release, see the corresponding CHANGELOG entry.

CI matrix: Python 3.11 and 3.12, Ubuntu. Ruff lint, unit + integration, and Vite build run on every push. macOS build job verifies the `.app` bundle. E2E runs in a separate job after `npm run build`. The lint job also runs `scripts/check_action_node_versions.py` to verify every SHA-pinned GitHub Action is on a supported Node.js runtime (closes Issue #16).

---

## Workspace layout

```
~/AgentSuite/                          (AGENTSUITE_WORKSPACE env var overrides)
  .agentsuite/
    runs/
      run-{hex6}/                       one dir per run
        *.md                            artifact files
        qa_scores.json                  QA rubric output
    _kernel/
      {project}/
        {agent}/
          {YYYY-MM-DD-HHMMSS}/          promoted on Approve
            *.md
```

The backend uses `agentsuite_run_id` (AgentSuite's internal ID) to find the run directory after the pipeline completes. If the upstream pipeline never assigned an ID, the local `run-{hex6}` is used as a fallback.

---

## Recently delivered

- **SQLite state store** (v0.8.0) — replaced JSON sidecars
- **Backend split** (v0.8.0) — single `main.py` → 9 routers + support modules
- **All seven agents enabled by default** (v0.8.1) — was `founder` only upstream
- **Dynamic version sourcing from `__version__.py`** (v0.8.3)
- **AgentSuite K1 cross-stage context** (v0.8.5) — intra-stage progress events
- **`PipelineOrchestrator` re-migration** (v0.8.7) — for the multi-agent path
- **Smoke test screen** (v0.8.8) — re-introduced as installer step 5; four sequential checks with fix cards
- **`launcher.port.json`** (v0.8.8) — replaces the legacy plaintext `launcher.log` as the canonical bound-port file; E2E conftest, the uninstaller, and CONTRIBUTING.md all read from it
- **`utils/sseStream.js`** (v0.8.8) — extracted shared SSE fetch+ReadableStream parser; eliminates duplicate code across four installer screens; handles `: ping` keepalive comments and unparseable payloads
- **QA score robustness** (v0.8.9) — `_first_defined()` helper replaces falsy or-chains that promoted score `0.0` to `None`; `json.JSONDecodeError` and `ValueError` now surface as `qa_status="failed"` with logging instead of being silently swallowed
- **`qa_status` field** (v0.8.9) — new run dict field (`"ok" | "failed" | "missing"`) exposed via `GET /api/run/{id}`; ApprovalGateView disables Approve and shows an amber warning banner when QA parsing failed or was absent
- **QA gate enforcement in approve_run** (v0.8.9) — `POST /api/run/{id}/approve` now checks `qa_score` against the configured `qa_gate_threshold` and returns HTTP 422 when below threshold unless `override=true`
- **Path traversal guard on kernel diff** (v0.8.9) — `kernel/diff` now validates requested paths using `p.is_relative_to(kernel_root)` scoped to `workspace/.agentsuite/_kernel/`, replacing the looser home-dir prefix check
- **SettingsPatch input bounds** (v0.8.9) — Pydantic `Field(ge=60, le=86400)` on `run_timeout_seconds`, `Field(ge=0.0, le=10.0)` on `qa_gate_threshold`; rejects unsafe values at the API layer
- **reject_run state guard** (v0.8.9) — `POST /api/run/{id}/reject` now returns HTTP 400 for runs not in `waiting` or `done` state
- **rename_project slug validation** (v0.8.9) — normalised slug validated against `_SLUG_RE` before storing; rejects names with invalid characters

## Roadmap

- **Tauri wrapper** — native window, tray icon, single-binary distribution
- **Go tray daemon** — background model, one-click launch from menu bar
- **Streaming artifact preview** — render markdown live during the run
- **Authenticode (Windows) and Apple Developer ID (macOS) signing** — eliminate SmartScreen / Gatekeeper warnings on first run
