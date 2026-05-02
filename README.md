# AgentSuiteLocal

Desktop UI for [AgentSuite](https://github.com/scottconverse/AgentSuite), running 100% local via Ollama. Built for non-technical founders — no CLI, no API key, no cloud required.

Seven specialist agents (Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO) walk a five-stage pipeline and write a structured artifact library to your disk. You review, approve, and promote outputs into a persistent kernel that feeds every future run.

---

## Requirements

| | Minimum | Recommended |
|---|---|---|
| Python | 3.11 | 3.12 |
| Node.js | 20 | 22 |
| RAM | 8 GB (Light tier) | 16 GB (Balanced) |
| Disk | 10 GB free | 20 GB free |
| [Ollama](https://ollama.ai) | any | latest |

Supported models: `gemma4:e2b` (8 GB), `gemma4:e4b` (16 GB, recommended), `gemma4:26b-moe` (32 GB).  
Runs entirely on-device — no internet connection required after setup.

---

## Quick start

```bash
# 1. Pull the model (one-time, ~5 GB)
ollama pull gemma4:e4b

# 2. Clone and install the backend
git clone https://github.com/scottconverse/AgentSuiteLocal
cd AgentSuiteLocal
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .

# 3. Build and serve
cd web && npm install && npm run build && cd ..
uvicorn agentsuitelocal.api.main:app --port 8765
```

Open **http://localhost:8765** — the in-app installer walks you through the rest.

---

## Development mode

Two terminals:

```bash
# Terminal 1 — backend (auto-reload on save)
uvicorn agentsuitelocal.api.main:app --reload --port 8765

# Terminal 2 — frontend with HMR
cd web && npm run dev
```

Vite proxies `/api/*` to `:8765`. Open **http://localhost:5173** (or whichever port Vite prints).

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

SSE event types: `agent_start` · `stage_update` · `agent_done` · `agent_waiting` · `error`

---

## Testing

```bash
pip install -e ".[dev]"
playwright install chromium

# Unit + integration (no browser, no Ollama required)
pytest tests/test_api.py tests/test_integration.py -v

# Live Ollama tests (requires Ollama running with a model loaded)
pytest tests/test_ollama_live.py -v -m ollama

# E2E browser tests (requires Vite dev server on :5175 and backend on :8765)
pytest tests/e2e/ -v -m e2e
```

CI runs unit + integration on every push (Ubuntu, Python 3.11 + 3.12 matrix). E2E runs in a separate job after a production build. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

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

## License

MIT — see [LICENSE](LICENSE).  
The bundled Gemma 4 model carries [Google's open-weight license](https://ai.google.dev/gemma/terms).
