# AgentSuiteLocal

**v0.7.1** — Desktop UI for [AgentSuite](https://github.com/scottconverse/AgentSuite), running 100% local via Ollama. Built for non-technical founders — no CLI, no API key, no cloud required.

Seven specialist agents (Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO) walk a five-stage pipeline and write a structured artifact library to your disk. You review, approve, and promote outputs into a persistent kernel that feeds every future run.

**New in v0.7.0:** run cancellation, timeout watchdog, QA gate enforcement with override, markdown artifact preview, run export (ZIP/Markdown/PDF), cloud model fallback (Claude Haiku/Sonnet/Opus), desktop notifications, auto-update check, local telemetry, crash recovery, Model Management panel, Projects view, and a Windows Inno Setup installer.

**Patched in v0.7.1:** 30+ bug fixes including project mutation endpoints (rename/archive/delete were 404), ModelView pull (was GET not POST), tier model map, update banner field names, optimistic approve/reject UI, 5-screen installer, KernelView artifact preview, skeleton loading states, OS keychain for API key, supply-chain hardening (SHA-pinned CI actions, pinned PyInstaller, release CI gate), and blocking subprocess.run → asyncio.to_thread.

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

**Non-technical users:** download `AgentSuiteLocal-0.7.1-setup.exe` from the [Releases](https://github.com/scottconverse/AgentSuiteLocal/releases) page and run it. The Inno Setup installer handles installation to Program Files and optionally adds a desktop shortcut. The in-app installer then handles Ollama, model download, and smoke test — no terminal required.

**Developers:** see [Development mode](#development-mode) below.

### Windows SmartScreen warning

Because the distributable is unsigned, Windows may show a SmartScreen popup ("Windows protected your PC") the first time you run it. To proceed:

1. Click **More info** (below the warning text).
2. Click **Run anyway**.

You will only see this once per machine. If you prefer to verify the binary before running, check the SHA-256 hash in the release notes against the file you downloaded:

```powershell
Get-FileHash .\AgentSuiteLocal.exe -Algorithm SHA256
```

### macOS Gatekeeper warning

Because the DMG is unsigned, macOS may show "AgentSuiteLocal cannot be opened because it is from an unidentified developer." To open it:

1. In Finder, **right-click** (or Control-click) the app icon inside the mounted DMG.
2. Choose **Open** from the context menu.
3. Click **Open** in the warning dialog.

You will only need to do this once. If the app is already blocked (quarantine flag set), go to **System Settings → Privacy & Security** → scroll down to the blocked app entry → click **Open Anyway**.

---

## Building the distributable

```bash
# Requires Python ≥ 3.11, Node.js ≥ 18, pyinstaller, and (Windows) Inno Setup 6
pip install -e ".[dev]" pyinstaller

make dist              # auto-detects OS — builds frontend then runs PyInstaller
# or explicitly:
make build-mac         # → dist/AgentSuiteLocal.app  (macOS)
make build-win         # → dist/AgentSuiteLocal/     (Windows onedir)
make build-installer   # → dist/AgentSuiteLocal-0.7.1-setup.exe  (Windows only, requires Inno Setup)
```

The onedir output is self-contained — no Python or Node required on the target machine. `build-installer` wraps the onedir into a standard Windows installer with uninstall support.

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
    main.py         FastAPI app — REST + SSE, ~2000 lines, 48 routes

web/
  src/
    App.jsx                  Router + scene switching
    data.js                  Static agent/model/stage definitions
    hooks/
      useSSE.js              SSE → React state bridge
    components/
      installer/             5-screen setup wizard
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
      app/                   12 main app screens
        Dashboard.jsx        Overview + pending approvals
        AgentsView.jsx       Agent roster
        NewRunView.jsx       Goal input + launch (B6 path validation)
        LiveRunView.jsx      SSE-driven pipeline progress (B1/B3/B4/E2)
        ApprovalGateView.jsx Artifact review + QA scores (C1/C2/C3/D1/D4)
        KernelView.jsx       Approved artifact library (H4)
        ModelView.jsx        Ollama model management + pull (G3)
        PipelineView.jsx     Multi-agent chain builder
        ProjectsView.jsx     Project cards (rename/archive/delete) (H5)
        RunsView.jsx         Full run history + inline detail (H3/B5/E1)
        SettingsView.jsx     Model, behavior, cloud, workspace (G1/G2/B3/C1)
        ManualView.jsx       In-app user guide
        CrashBanner.jsx      Crash report banner (F4)
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
| GET | `/api/settings` | Current settings — API key redacted |
| POST | `/api/settings` | Replace settings (full object) |
| PATCH | `/api/settings` | Partial update |
| POST | `/api/run/{id}/cancel` | Cancel a running run; saves partial artifacts |
| GET | `/api/run/{id}/export/{format}` | Export run as `zip`, `markdown`, or `pdf` |
| POST | `/api/open-folder` | Open export folder in Explorer/Finder |
| GET | `/api/kernel/diff` | Unified diff between two kernel files |
| POST | `/api/validate-path` | Validate an inputs_dir path |
| GET | `/api/ollama/models` | List installed Ollama models |
| POST | `/api/ollama/pull` | Pull a model (SSE progress stream) |
| DELETE | `/api/ollama/models/{name}` | Delete an installed model |
| GET | `/api/model/verify/{name}` | Verify model is functional |
| GET | `/api/update/check` | Check for a newer GitHub release |
| GET | `/api/version` | Return current version, e.g. `{"version": "0.7.1"}` |
| GET | `/api/crash-reports/latest` | Most recent crash report |
| GET | `/api/telemetry/summary` | Local usage event counts |
| GET | `/api/launcher/port` | Port read from `~/.agentsuitelocal/launcher.log` |
| POST | `/api/pipelines/{id}/resume` | Resume an errored pipeline step |
| GET | `/api/projects` | All projects |
| POST | `/api/projects/{slug}/rename` | Rename a project |
| POST | `/api/projects/{slug}/archive` | Archive a project |
| DELETE | `/api/projects/{slug}` | Delete a project and its runs |
| GET | `/api/runtime/verify` | Bundle integrity check |

SSE event types: `agent_start` · `stage_update` · `agent_done` · `agent_waiting` · `pipeline_step_done` · `pipeline_done` · `error` · `timeout` · `cancelled`

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

## Troubleshooting

### Antivirus flagging the installer or executable

Some antivirus tools flag PyInstaller-bundled executables as suspicious. This is a known false positive with self-contained Python apps — the binary contains a Python interpreter, which some heuristic scanners misclassify.

**Windows Security:** Settings → Virus & threat protection → Manage settings → Add or remove exclusions → Add an exclusion for the `AgentSuiteLocal` install folder (default: `C:\Program Files\AgentSuiteLocal`).

**VirusTotal:** If you want to verify the binary independently, upload `AgentSuiteLocal.exe` to [virustotal.com](https://virustotal.com). A handful of low-reputation engine detections is normal for PyInstaller onedir bundles and does not indicate malware.

---

## Privacy

All data stays on your machine. No telemetry is sent to any server.

When the **Usage telemetry** toggle is enabled in Settings, AgentSuiteLocal writes a local log (`~/.agentsuitelocal/usage.jsonl`) that counts run starts, model used, and QA pass/fail scores. This file never leaves your machine. Disable the toggle to stop all logging.

Your cloud API key (if configured) is stored in the OS credential store — Windows Credential Manager on Windows, Keychain on macOS, Secret Service on Linux. It is never written to `settings.json` or any other file on disk.

---

## Known issues (v0.7.1)

- **PDF export requires GTK/Cairo on Windows.** The PDF export feature uses WeasyPrint, which requires the GTK+ runtime (libcairo, libpango, libgdk-pixbuf). The PyInstaller bundle includes WeasyPrint's Python code but not the native GTK DLLs. If PDF export returns a 501 error, install the [GTK3 runtime for Windows](https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases) separately. ZIP and Markdown export work without any additional runtime.
- **macOS DMG is unsigned.** See the [Gatekeeper guidance](#macos-gatekeeper-warning) above. Apple Developer ID codesigning is on the roadmap.
- K1/K2 (cross-stage context passing and intra-stage progress events) are not yet merged upstream to `scottconverse/AgentSuite`. The `pyproject.toml` pin still points to the v0.1.2 commit SHA until the upstream PR lands.
- E2E test suite uses `gemma2:2b` (Gemma 2 family), not a Gemma 4 model. Tests exercise the API surface but not the model architecture used in production. This is documented in `tests/e2e/conftest.py`.
- E2E test suite requires a running Vite dev server (`:5173`) or built frontend; the backend on `:8766` is auto-started by `tests/e2e/conftest.py`.

---

## License

MIT — see [LICENSE](LICENSE).  
The bundled Gemma 4 model carries [Google's open-weight license](https://ai.google.dev/gemma/terms).
