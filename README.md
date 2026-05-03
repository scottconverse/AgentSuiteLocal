# AgentSuiteLocal

Desktop UI for [AgentSuite](https://github.com/scottconverse/AgentSuite), running 100% local via Ollama. Built for non-technical founders — no CLI, no API key, no cloud required.

Seven specialist agents (Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO) walk a five-stage pipeline and write a structured artifact library to your disk. You review, approve, and promote outputs into a persistent kernel that feeds every future run.

---

## Requirements

**Distributable users** (download from Releases — no Python or Node needed):

| | Minimum | Recommended |
|---|---|---|
| OS | Windows 10 64-bit | Windows 11 |
| RAM | 8 GB (Light tier) | 16 GB (Balanced) |
| Disk | 10 GB free | 20 GB free |
| [Ollama](https://ollama.ai) | any | latest |

**Developers** (building from source):

| | Minimum |
|---|---|
| Python | 3.11 |
| Node.js | 20 |

Supported models: `gemma4:e2b` (8 GB), `gemma4:e4b` (16 GB, recommended), `gemma4:26b-moe` (32 GB).  
Runs entirely on-device — no internet connection required after setup.

---

## Install

**Non-technical users:** download the distributable from the [Releases](https://github.com/scottconverse/AgentSuiteLocal/releases) page, unzip, and double-click `AgentSuiteLocal.exe`. The in-app installer handles everything else — no terminal required.

**Developers:** see [Development mode](#development-mode) below.

### Windows SmartScreen warning

Because the distributable is unsigned, Windows may show a SmartScreen popup ("Windows protected your PC") the first time you run it. To proceed:

1. Click **More info** (below the warning text).
2. Click **Run anyway**.

You will only see this once per machine. If you prefer to verify the binary before running, check the SHA-256 hash in the release notes against the file you downloaded:

```powershell
Get-FileHash .\AgentSuiteLocal.exe -Algorithm SHA256
```

---

## Building the distributable

```bash
# Requires Python ≥ 3.11, Node.js ≥ 18, and pyinstaller in your virtualenv
pip install -e ".[dev]" pyinstaller

make dist          # auto-detects OS — builds frontend then runs PyInstaller
# or explicitly:
make build-mac     # → dist/AgentSuiteLocal.app  (macOS)
make build-win     # → dist/AgentSuiteLocal/     (Windows)
```

The output is a self-contained directory (or `.app` bundle on macOS). The launcher starts the backend silently in-process — no terminal window ever appears. Drop the folder into a zip and it's the release artifact.

---

## Development mode

For iterating on the source, run two terminals:

```bash
# Terminal 1 — backend (auto-reload on save)
uvicorn agentsuitelocal.api.main:app --reload --port 8766

# Terminal 2 — frontend with HMR
cd web && npm run dev
```

Vite proxies `/api/*` to `:8766`. Open **http://localhost:5173** (or whichever port Vite prints).

---

## Architecture

```
agentsuitelocal/
  api/
    main.py         FastAPI app — REST + SSE, ~440 lines

web/
  src/
    App.jsx                  Router + scene switching
    data.js                  Static agent/model/stage definitions
    hooks/
      useSSE.js              SSE → React state bridge
    components/
      installer/             11-screen setup wizard
        InstallerShell.jsx   Chrome (header, nav, progress)
        ScreenWelcome.jsx    Step 1 — splash
        ScreenLicense.jsx    Step 2 — license gate
        ScreenHardware.jsx   Step 3 — hardware probe
        ScreenTier.jsx       Step 4 — model picker
        ScreenOllama.jsx     Step 5 — Ollama runtime check
        ScreenModelDownload.jsx  Step 6 — model pull
        ScreenPython.jsx     Step 7 — Python env setup
        ScreenAgents.jsx     Step 8 — agent selection
        ScreenApiKey.jsx     Step 9 — cloud fallback
        ScreenSmoke.jsx      Step 10 — smoke test
        ScreenSuccess.jsx    Step 11 — launch
      app/                   9 main app screens
        Dashboard.jsx        Overview + pending approvals
        AgentsView.jsx       Agent roster
        NewRunView.jsx       Goal input + launch
        LiveRunView.jsx      SSE-driven pipeline progress
        ApprovalGateView.jsx Artifact review + QA scores
        KernelView.jsx       Approved artifact library
        PipelineView.jsx     Multi-agent chain builder
        RunsView.jsx         Full run history
        SettingsView.jsx     Model, behavior, workspace
        ManualView.jsx       In-app user guide
      shell/
        index.jsx            Sidebar, TopBar, TrayMenu
      ui/
        index.jsx            Icon, MetricCard, ProgressBar, Toggle
```

**Data flow:** `POST /api/run` starts a background task that wraps AgentSuite's `PipelineOrchestrator`. The frontend subscribes to `GET /api/run/{id}/stream` (SSE) and renders progress in real time. When the pipeline finishes, the run enters `waiting` state and the approval gate becomes available. Approving promotes artifacts to `~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/`.

See [docs/architecture.md](docs/architecture.md) for the full design doc.

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Ollama daemon + model status |
| GET | `/api/hardware` | CPU, RAM, disk probe |
| GET | `/api/ollama/status` | Detailed Ollama status |
| POST | `/api/run` | Start a run, returns `run_id` |
| GET | `/api/run/{id}/stream` | SSE — live pipeline events |
| GET | `/api/run/{id}` | Run status + artifacts + QA score |
| POST | `/api/run/{id}/approve` | Promote artifacts to kernel |
| POST | `/api/run/{id}/reject` | Reject without promoting |
| GET | `/api/runs` | All runs, newest first |
| GET | `/api/kernel` | All kernel artifacts by project |
| GET | `/api/projects` | Project list derived from runs |
| POST | `/api/pipelines` | Create and start a multi-agent pipeline |
| GET | `/api/pipelines` | All pipelines, newest first |
| GET | `/api/pipelines/{id}` | Pipeline status + step results |
| GET | `/api/pipelines/{id}/stream` | SSE — live pipeline step events |
| POST | `/api/pipelines/{id}/approve` | Approve current step, advance to next |
| POST | `/api/pipelines/{id}/reject` | Reject current step, halt pipeline |
| GET | `/api/settings` | Current settings (model tier, etc.) — API key redacted |
| POST | `/api/settings` | Replace settings (full object) |
| PATCH | `/api/settings` | Partial update — only provided fields are written |
| GET | `/api/runtime/verify` | Bundle integrity check (all 6 checks) |

SSE event types: `agent_start` · `stage_update` · `agent_done` · `agent_waiting` · `pipeline_step_done` · `pipeline_done` · `error`

---

## Testing

```bash
pip install -e ".[dev]"
playwright install chromium

# Unit + integration (no browser, no Ollama required)
pytest tests/test_api.py tests/test_integration.py -v

# Live Ollama tests (requires Ollama running with a model loaded)
pytest tests/test_ollama_live.py -v -m ollama

# E2E browser tests (local dev):
#   Vite dev server must be running on :5173 (npm run dev)
#   Backend is auto-started on :8766 by conftest if not already up
pytest tests/e2e/ -v -m e2e
```

CI runs Python unit + integration tests and Vitest frontend tests on every push (Ubuntu, Python 3.11 + 3.12 matrix). E2E runs in a separate job after a production build — the CI E2E job starts the backend on `:8765` and sets `BASE_URL=http://localhost:8765`, testing against the built frontend served by FastAPI rather than the Vite dev server. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI · uvicorn · sse-starlette · httpx · psutil |
| Frontend | React 18 · Vite · vanilla CSS |
| LLM runtime | Ollama (local, no cloud) |
| Agent engine | [AgentSuite](https://github.com/scottconverse/AgentSuite) |
| Tests | pytest · pytest-playwright · Playwright (Chromium) |
| CI | GitHub Actions |

---

## Workspace layout

Runs and kernel artifacts are written to `~/AgentSuite/` by default. Override with `AGENTSUITE_WORKSPACE=/your/path`.

```
~/AgentSuite/
  .agentsuite/
    runs/
      run-abc123/         one directory per run
        brand-system.md
        qa_scores.json
        ...
    _kernel/
      myco-pivot/
        founder/          promoted artifacts feed future runs
          brand-system.md
          ...
```

---

## Known issues (v0.1.1)

- Run and pipeline state is held in memory + JSON sidecars under `~/.agentsuitelocal/`; a backend restart before a run completes may lose in-flight state.
- E2E test suite requires a running Vite dev server (`:5173`); the backend on `:8766` is auto-started by `tests/e2e/conftest.py`.

Security, thread-safety, and accessibility issues from the v0.1.0 audit were resolved in v0.1.1. See [CHANGELOG](CHANGELOG.md) for details.

---

## License

MIT — see [LICENSE](LICENSE).  
The bundled Gemma 4 model carries [Google's open-weight license](https://ai.google.dev/gemma/terms).
