# Architecture

AgentSuiteLocal is a thin local desktop shell around [AgentSuite](https://github.com/scottconverse/AgentSuite). The backend is a FastAPI app (~2000 lines, ~50 routes). The frontend is React + Vite. They talk REST + SSE. Everything runs on-device — no cloud required. An optional Anthropic API key enables cloud model fallback.

---

## System diagram

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite, :5173 dev / :8765 prod)                │
│                                                                  │
│  Installer wizard (5 screens)    Main app (12 screens)          │
│         │                               │                        │
│         └──── fetch /api/* ─────────────┘                       │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP / SSE
┌────────────────────────▼───────────────────────────────────────┐
│  FastAPI backend  (uvicorn :8766 dev / :8765 prod)              │
│                                                                  │
│  /api/health        /api/hardware                               │
│  /api/ollama/status                                             │
│  /api/run  (POST)   /api/run/{id}/stream  (SSE GET)            │
│  /api/run/{id}      /api/run/{id}/approve  /api/run/{id}/reject │
│  /api/runs          /api/kernel   /api/projects                 │
│                                                                  │
│  _runs: dict[str, RunDict]   ← in-memory, single-user          │
│         │                                                        │
│         └── asyncio.create_task(_execute_run(...))              │
└────────────────────────┬───────────────────────────────────────┘
                         │ loop.run_in_executor (thread pool)
┌────────────────────────▼───────────────────────────────────────┐
│  AgentSuite  (PipelineOrchestrator)                             │
│                                                                  │
│  agents=[agent_id]   project_slug   business_goal               │
│  on_progress callback → SSE event queue                         │
│                                                                  │
│  Stages: intake → extract → spec → execute → QA                 │
│  Writes artifacts to ~/AgentSuite/.agentsuite/runs/{run_id}/    │
└────────────────────────┬───────────────────────────────────────┘
                         │ HTTP  :11434
┌────────────────────────▼───────────────────────────────────────┐
│  Ollama  (local LLM daemon)                                     │
│                                                                  │
│  Models: gemma4:e2b · gemma4:e4b · gemma4:26b-moe              │
└────────────────────────────────────────────────────────────────┘
```

---

## Backend — `agentsuitelocal/api/main.py`

### Run lifecycle

```
POST /api/run
  → creates _runs[run_id] with status="running"
  → asyncio.create_task(_execute_run(run_id, req))
  → returns {run_id} immediately

_execute_run (background task)
  → emits agent_start event
  → wraps PipelineOrchestrator.run() in asyncio.wait_for(timeout=run_timeout_seconds)
     (run_in_executor so async loop stays unblocked)
  → on_progress callback pushes stage_update events to collections.deque
  → on completion: sets artifacts, qa_score, status="waiting"
  → emits agent_waiting
  → CancelledError: status="cancelled", saves partial artifacts
  → TimeoutError: status="timeout", saves partial artifacts

GET /api/run/{id}/stream  (SSE)
  → accepts ?since=<seq> — replays buffered events from that sequence number
  → generator polls _run_event_buffers[id] every 200ms
  → terminates on status in {approved, rejected, error, waiting, cancelled, timeout}

POST /api/run/{id}/cancel
  → calls _run_tasks[id].cancel()
  → returns 400 if run is not in "running" state

POST /api/run/{id}/approve
  → calls _push_to_kernel(run)
  → copies run dir to ~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/
  → sets status="approved"
```

### In-memory store

`_runs` and `_pipelines` are plain dicts — sufficient for a local single-user app. Both are persisted to JSON sidecars (`~/.agentsuitelocal/runs.json`, `~/.agentsuitelocal/pipelines.json`) at every state transition and reloaded on startup. Runs that were in-flight at shutdown are marked as `"error"` on reload. The kernel (promoted artifacts) is the canonical durable state; the JSON sidecars are a best-effort history.

### Thread model

The FastAPI event loop stays on one thread. `PipelineOrchestrator.run()` is synchronous (AgentSuite v0.1), so it runs in the default thread pool via `loop.run_in_executor(None, _run_sync)`.

The `on_progress` callback is invoked on the thread-pool thread. It pushes updates to the event-loop thread using `loop.call_soon_threadsafe(events.append, event)` — never mutating the event list directly from a non-event-loop thread. The SSE generator reads the event list exclusively on the event-loop thread.

`_save_state` and `_apply_settings_patch` hold a `threading.Lock` guard for their read-modify-write sequences to prevent concurrent corruption of the JSON sidecars.

> **v0.1.1 note:** Prior to v0.1.1, the `on_progress` callback appended directly to the list from the thread-pool thread. This was fixed (ENG-001, ENG-003) in v0.1.1 with `call_soon_threadsafe` and locking.

---

## Frontend — `web/src/`

### Scene graph

```
App.jsx
  scene = "installer" | "app"

  scene === "installer"                      (5-screen flow, UX-1)
      step 1  ScreenWelcome
      step 2  ScreenLicense         nextDisabled={!agreed}
      step 3  ScreenHardwareTier    hardware probe + tier auto-select; nextDisabled while scanning
      step 4  ScreenOllamaModel     Ollama install + model pull with retry; nextDisabled until done
      step 5  ScreenSuccess         "Launch" → mode="app"
      (Agent selection, API key, Python setup moved to Settings)

  scene === "app"
    CrashBanner (F4 — shown if crash report newer than session dismissal)
    H2 update banner (shown if /api/update/check returns has_update=true)
    Sidebar  (nav: home | agents | runs | kernel | pipeline | projects | models | settings | manual)
    view === "home"     → Dashboard
    view === "agents"   → AgentsView
    scene === "newrun"  → NewRunView     (hides Sidebar; E1 initialGoal/initialProject)
    scene === "live"    → LiveRunView    (hides Sidebar, uses useSSE; B1/B3/B4/E2)
    scene === "gate"    → ApprovalGateView (hides Sidebar; C1/C2/C3/D1/D4)
    view === "runs"     → RunsView (H3 search/filter; B5 detail view; E1 retry)
    view === "kernel"   → KernelView (H4 search/filter)
    view === "pipeline" → PipelineView
    view === "projects" → ProjectsView (H5 rename/archive/delete)
    view === "models"   → ModelView (G3 pull/delete/set-active)
    view === "settings" → SettingsView (G1/G2/B3/C1/H1/J4)
    view === "manual"   → ManualView
```

### SSE bridge — `hooks/useSSE.js`

```
useSSE(runId)
  → opens EventSource to /api/run/{runId}/stream?since=<lastSeq>
  → B4: tracks seqRef; on reconnect replays from last known sequence
  → B4: exponential backoff, max 10 attempts, cap 30s
  → event types:
      agent_start    → status="running"
      stage_update   → updates stages[] progress
      agent_done     → stage marked complete
      agent_waiting  → status="waiting", triggers approval gate
      error          → status="error"
      timeout        → status="timeout"
      cancelled      → status="cancelled"
  → returns { events, status, error, cancel, reconnectAttempt }
  → closes EventSource on unmount or terminal state
```

### Installer gating

Each screen with a `nextDisabled` gate follows the same pattern:

```jsx
const [ready, setReady] = useState(false);

useEffect(() => {
  fetch("/api/some/check")
    .then(r => r.json())
    .then(data => { if (data.ok) setReady(true); })
    .catch(() => setReady(false));
}, []);

// In InstallerShell: nextDisabled={!ready}
```

The Vite dev server proxies `/api/*` to `:8766` via `vite.config.js`. In production, FastAPI serves the built frontend from `web/dist/` and handles `/api/*` natively — no proxy needed.

---

## Test pyramid

```
tests/
  test_api.py          102 unit tests — TestClient (in-process, no network)
                        covers cancel, export, kernel diff,
                        crash reports, telemetry, model verify, validate-path,
                        project mutations, keyring sentinel, tier map, etc.
  test_integration.py    6 integration — real uvicorn on a free port, real httpx
  test_ollama_live.py    6 live tests  — real Ollama daemon required
                                         auto-skip if daemon unreachable
                                         pytest.mark.ollama
  e2e/
    conftest.py          session fixture — starts backend on :8766 if not up
    test_installer.py    2 E2E — full 5-step installer walk
    test_app.py         10 E2E — all 7 nav items + New Run + Approval Gate
                                  pytest.mark.e2e
                                  Note: uses gemma2:2b (Gemma 2 family), not gemma4
```

CI matrix: Python 3.11 and 3.12, Ubuntu. Ruff lint, unit + integration, and Vite build run on every push. E2E runs in a separate job after `npm run build`.

---

## Workspace layout

```
~/AgentSuite/              (AGENTSUITE_WORKSPACE env var overrides)
  .agentsuite/
    runs/
      run-{hex6}/          one dir per run (AgentSuite's internal run_id)
        *.md               artifact files
        qa_scores.json     QA rubric output
    _kernel/
      {project}/
        {agent}/           promoted on Approve
          *.md
```

The backend uses `agentsuite_run_id` (AgentSuite's internal ID, not our `run-{hex6}`) to find the run directory after the pipeline completes. If the pipeline never assigned an ID, we fall back to our own ID.

---

## Phase 2 roadmap

- **Tauri wrapper** — native window, tray icon, single-binary distribution
- **Go tray daemon** — background model, one-click launch from menu bar
- **Persistent run store** — SQLite so runs survive restarts
- **Streaming artifact preview** — render markdown live during the run
- **K1/K2 upstream** — cross-stage context passing and intra-stage progress events in AgentSuite (pending PR)
