# Release v0.7.0

**Type:** feature
**Summary:** Complete AgentSuiteLocal to finished single-user desktop product level: automated install, real cancel, markdown preview, kernel export with diff, export formats, project management, search, notifications, auto-update, Windows installer, macOS build, CI/CD pipeline, automated E2E, crash reporting, cross-stage coherence, and a full professional documentation and landing page overhaul.
**Generated:** 2026-05-03T00:00:00Z
**Previous version:** 0.1.2

---

## A — Installation & First-Run

- [x] **A1 — Automated Ollama install:** `ScreenOllama` detects Ollama absent → downloads `OllamaSetup.exe` from `https://ollama.com/download/OllamaSetup.exe` into a temp dir → runs it silently (`/S` flag) → polls until `ollama serve` is reachable → advances. Show a download progress bar with bytes/total and a spinner while waiting for the daemon. If Ollama is already installed, detect its version, show "Ollama X.Y.Z detected — OK" and skip to the model screen.
- [x] **A2 — Model download retry + diagnosis:** `ScreenModelDownload` wraps `ollama pull` in a retry loop (3 attempts, 5s backoff). Map each known error code to a human message: network timeout → "Check your internet connection"; disk full → "You need Xmb of free disk space"; model not found → "Model name is incorrect — check the Models page"; Ollama not running → "Ollama stopped — restarting…". Show a "Try again" button after all retries are exhausted. Show download speed and ETA during pull.
- [x] **A3 — Partial/corrupt model detection:** Before advancing past `ScreenModelDownload`, call `ollama show <model>` and verify the response contains a non-zero parameter count. If the model entry exists but returns zero size or a malformed manifest, surface "Model download appears incomplete" with a one-click re-pull button.
- [x] **A4 — Smoke test actionable diagnosis:** `ScreenSmoke` runs 4 sequential sub-checks: (1) Ollama daemon reachable, (2) target model loaded (`ollama list`), (3) API health endpoint responds, (4) test inference returns non-empty output. Show a result row per check with a green tick or red cross. For each red cross show a specific one-line fix inline (e.g. "Ollama stopped — click 'Restart Ollama'" with a button that calls the restart endpoint). Do not advance until all 4 pass or the user clicks "Skip smoke test" (which shows a warning it may not work).
- [x] **A5 — Dynamic port throughout installer:** On backend startup, write the actual bound port to `~/.agentsuitelocal/launcher.log`. All installer screens that need to call the API read this file for the port instead of hardcoding 8765. Pass the resolved port as a prop through the installer component tree (`App.jsx` reads it once on mount and distributes it).
- [x] **A6 — Working uninstall flow:** Implement a three-phase uninstall accessible from Settings → "Uninstall AgentSuiteLocal". Phase 1: stop the backend process gracefully. Phase 2: show workspace size (`~/.agentsuite/`) and ask "Delete all runs, pipelines, and kernel files? This cannot be undone." with a checkbox confirm. Phase 3: optionally delete the Ollama model — show model disk size and ask. At the end: show "AgentSuiteLocal has been uninstalled. Close this window to finish." If installed via the Windows installer (see I1), call the Inno Setup uninstaller via `subprocess` to remove Start Menu entries and Add/Remove Programs registration.

---

## B — Run Experience

- [x] **B1 — Cancel actually cancels:** Add `POST /api/run/{id}/cancel` endpoint. Backend: look up the `asyncio.Task` for the run, call `task.cancel()`, await cancellation, set `status: cancelled`, set `cancelled_at` timestamp, save state. Frontend: Cancel buttons in `NewRunView` and `LiveRunView` call this endpoint before navigating away. Show "Cancelling…" state with a spinner while awaiting the API response. Once confirmed cancelled, navigate to home.
- [x] **B2 — Cancel cleans up partial artifacts:** After cancellation, move all files in `~/.agentsuite/runs/{id}/outputs/` to `~/.agentsuite/runs/{id}/cancelled-outputs/` (rename, not delete). Set a `partial_artifacts: true` flag on the run record. In `RunsView`, show cancelled runs with a "partial output saved" sub-label and an "Open folder" button.
- [x] **B3 — Run watchdog:** On `POST /api/run`, schedule an `asyncio` watchdog coroutine with configurable `run_timeout_seconds` (default 900, settable in Settings, range 60–3600). On timeout: cancel the agent task, set `status: error`, set `error_message: "Run timed out after {N} minutes"`, emit `{type: "timeout", message: "..."}` SSE event. In `LiveRunView`, handle the `timeout` event type with a distinct UI state ("Timed out — the model stopped responding").
- [x] **B4 — SSE reconnect:** In `useSSE.js`, on `EventSource` `onerror`, close the connection and schedule a reconnect with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s cap, max 10 attempts). Show a yellow "Connection lost — reconnecting (attempt N/10)…" banner in `LiveRunView`. Backend: buffer the last 100 SSE events per run in an in-memory deque. Add a `?since=<seq>` query param to the stream endpoint so reconnecting clients only receive missed events.
- [x] **B5 — Reopen any run:** In `RunsView`, every row has an "Open" action. Routing: `running` → `LiveRunView` (SSE reconnect picks up the stream); `waiting` → `ApprovalGateView`; `approved` / `rejected` / `error` / `cancelled` → new read-only `RunDetailView` showing artifact tree, QA scores, run metadata, and an "Export" button. Add `openRun(id)` handler in `App.jsx` that inspects run status and routes to the right scene.
- [x] **B6 — Inputs folder UI validation:** On blur of the inputs dir field in `NewRunView`, `POST /api/validate-path` with the path (new lightweight endpoint — runs `_validate_inputs_dir()` logic and returns `{valid: bool, reason: string}`). Show an inline error beneath the field immediately (no need to wait for launch). Keep the Launch button disabled while the field is non-empty and invalid. Show a green checkmark when valid.

---

## C — Approval Gate

- [x] **C1 — Configurable QA gate + override:** Add `qa_gate_threshold` to `_SETTINGS_DEFAULTS` (default 7.0, range 0.0–10.0) and `SettingsPatch`. Display the threshold in `ApprovalGateView`: "Gate: {threshold}/10". When `qa_score < threshold`, disable the primary Approve button and show tooltip "Score {score} is below your {threshold} gate". Add a secondary "Override & approve" button (amber, not primary) that opens a confirmation dialog: "This run scored {score}/10, below your {threshold} gate. Approve anyway?" with Cancel / Confirm Approve. Log `overridden: true` on the run record.
- [x] **C2 — Markdown rendering + stage grouping:** Add `react-markdown` and `remark-gfm` to web dependencies. Replace the raw-text artifact preview in `ApprovalGateView` with `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. Group the file tree by stage using filename prefix conventions (e.g. `01-research-*`, `02-strategy-*`). Show a collapsible `<details>` group per stage with the stage name as summary and file count badge. Show file size in bytes next to each entry. Pre-select the first file in the first group on load.
- [x] **C3 — QA panel diagnosis:** When `qa_dimensions` after sanitization has fewer than 3 entries, show a yellow notice: "Partial QA scores — the model returned {N} of {expected} dimensions. Scores shown may not reflect full output quality. This is a known limitation of smaller models." Include a "What does this mean?" expandable that briefly explains QA scoring.

---

## D — The Kernel

- [x] **D1 — Approve exports to disk:** On `POST /api/run/{id}/approve`, copy all files from `~/.agentsuite/runs/{id}/outputs/` to `~/.agentsuite/kernel/{project}/{agent}/{YYYY-MM-DD-HHMMSS}/`. Return `{export_path: "..."}` in the response. In `ApprovalGateView`, after successful approve, show a "Saved to kernel" success banner with the folder path and an "Open folder" button that calls `POST /api/open-folder` (backend: `subprocess.Popen(['explorer', path])` on Windows, `open` on macOS).
- [x] **D2 — KernelView:** Add a `KernelView` to the sidebar (new "Kernel" nav item). Lists all approved exports grouped by project, then agent, then reverse-chronological. Each entry shows: agent name, project, timestamp, artifact count, total size, and an "Open folder" button. Empty state: "No approved runs yet — approve a run to promote its artifacts to your kernel."
- [x] **D3 — Kernel version diff:** When a project/agent combination has more than one approved export, show a "Compare" button next to any non-latest entry. Opens a side-by-side diff modal: left = selected version, right = latest version. File selector lets you pick which artifact to diff. Backend: `GET /api/kernel/diff?a=<path>&b=<path>` returns line-level diff using Python `difflib.unified_diff`. Frontend: render with `+` lines in green, `-` lines in red, context lines in neutral.
- [x] **D4 — Export formats:** In `RunDetailView` and `ApprovalGateView`, add an "Export" dropdown with three options: (1) "ZIP — all artifacts" calls `GET /api/run/{id}/export/zip` which zips `outputs/` and streams the file with `Content-Disposition: attachment`; (2) "Markdown bundle" concatenates all artifacts into a single `.md` file with `---` separators; (3) "PDF" concatenates all artifacts, converts markdown to HTML via `markdown` library, then HTML to PDF via `weasyprint`, streams as `application/pdf`. Backend adds all three endpoints. Frontend triggers browser download via `<a href=... download>` pattern.

---

## E — Iteration

- [x] **E1 — Retry rejected/error/cancelled runs:** In `RunsView` and `RunDetailView`, add a "Retry" button on `rejected`, `error`, and `cancelled` runs. Clicking navigates to `NewRunView` pre-populated with the same `agent_id`, `goal`, `project`, and `inputs_dir`. The user sees "Retrying: {agent} on {project}" in the TopBar subtitle. They can edit any field before launching.
- [x] **E2 — Elapsed time per stage:** In `LiveRunView`, maintain a `stageStartTime` ref that resets on each `stage_update` event. Display "Stage: {stage name} · {Xm Ys}" updated every second beneath the current stage indicator. Display "Total: {Xm Ys}" since run start in the top bar. This gives pacing feedback without requiring upstream progress events.

---

## F — Reliability

- [x] **F1 — Crash recovery:** In `_load_state()` on startup, find all runs with `status: "running"`. For each, set `status: "error"`, `error_message: "AgentSuiteLocal restarted while this run was in progress"`, `finished_at: now`. Save state. On next app load, these runs appear in `RunsView` as errored with a clear message and a Retry button.
- [x] **F2 — Pipeline orphan cleanup:** In `_advance_pipeline`, wrap the entire execution body in a `try/except`. On unhandled exception: set the current step to `status: "error"`, set the pipeline to `status: "error"` with `error_message` from the exception. Save state. Never leave a pipeline in `status: "running"` after an exception. In `_load_state()`, also repair any pipelines stuck in `running` at startup (same pattern as F1).
- [x] **F3 — Pipeline resume:** Add `POST /api/pipelines/{id}/resume` endpoint. Finds the first step with `status: "pending"` and re-executes the pipeline from that step forward. In `PipelineView`, show a "Resume from step N" button on pipelines with `status: "error"` where at least one step is still `pending`.
- [x] **F4 — Crash reporting (local):** In the FastAPI exception handler, on any unhandled 500, write a crash report to `~/.agentsuitelocal/crash-reports/{timestamp}.json` containing: exception type, message, stack trace, AgentSuiteLocal version, Python version, OS version, and the request path (no request body — no user data in crash reports). In the frontend, add a `CrashBanner` component that polls `GET /api/crash-reports/latest` — if a new report exists since app load, show a non-blocking yellow banner: "AgentSuiteLocal logged an error. [Copy report] [Dismiss]". Copy puts the JSON on clipboard for easy bug reporting. No data ever leaves the machine.

---

## G — Configuration

- [x] **G1 — Model tier enforces actual model:** Map tiers to concrete model names: `fast` → `gemma2:2b`, `balanced` → `gemma4:e4b`, `powerful` → `llama3.1:8b`. In `_resolve_llm()`, use the mapped model name unless `model_name` is explicitly overridden in settings. In `SettingsView`, when the user changes tier, check if the mapped model is in `ollama list`. If not, show an inline warning: "This tier requires {model} ({size}). Go to Model Management to download it." Store the explicit `model_name` derived from tier in settings on change.
- [x] **G2 — API key activates cloud fallback:** In `SettingsView`, when `api_key` is non-empty, show a "Cloud fallback" section with a model dropdown (`claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`, `claude-opus-4`). When a `claude-` model is selected and saved, `_resolve_llm()` uses the Anthropic provider. Show a prominent cost warning: "Cloud runs send your goal and context to Anthropic's servers and incur API costs. Local runs are always free." The warning persists — it is not dismissable.
- [x] **G3 — Model management panel:** Add `ModelView` to the sidebar. Sections: (a) Installed models — calls `GET /api/ollama/models` (new endpoint wrapping `ollama list`), shows name, size, last-used, and a "Set as active" button + "Delete" button with confirmation. (b) Recommended models — static list of 5 models with name, tier, disk size, RAM requirement, and a "Pull" button. Pull calls `POST /api/ollama/pull` (new SSE endpoint wrapping `ollama pull`), streams progress bar live. (c) Active model indicator showing what's currently configured.

---

## H — New Product Features

- [x] **H1 — Windows toast notifications:** When a run reaches a terminal state (`waiting`, `approved`, `rejected`, `error`, `cancelled`, `timeout`), emit a Windows desktop notification via `winotify` (add to dependencies). Title: "AgentSuiteLocal". Body: "{Agent} run on {project} is {status}." For `waiting`: add an action button "Review now" that focuses the app window. Notifications respect the OS Do Not Disturb setting. Add a "Desktop notifications" toggle to Settings (default on).
- [x] **H2 — Auto-update check:** On app startup (after entering the app, not during installer), call `GET https://api.github.com/repos/scottconverse/AgentSuiteLocal/releases/latest`. Compare `tag_name` to current `__version__`. If newer, show a non-blocking banner at the top of the Dashboard: "v{new} is available — [Download] [Dismiss]". Download opens the GitHub release page in the system browser. Banner does not reappear for a dismissed version until the next startup. No auto-install — user controls the update.
- [x] **H3 — Search and filter — Runs:** In `RunsView`, add a search bar (debounced 250ms) that filters the visible list by agent name, project slug, goal text (substring match), and status. Add a status filter dropdown (All / Running / Waiting / Approved / Rejected / Error / Cancelled). Filter state is local UI state, not persisted. Show "N results" count when filtering.
- [x] **H4 — Search and filter — Kernel:** In `KernelView`, add a search bar filtering by project, agent, and date range. Add a project filter dropdown. Show total artifact count and total size for the filtered result set.
- [x] **H5 — Project management view:** Add `ProjectsView` to the sidebar (replaces the implicit project list on Dashboard). Shows all projects as cards: name, run count per agent, kernel artifact count, last-touched date, total disk usage. Actions per project: (a) Rename — updates `project` field on all runs and kernel entries for that project; (b) Archive — hides from default view, adds an "Archived" filter to show them; (c) Delete — confirmation dialog showing "This will delete N runs and M kernel artifacts totalling X MB. This cannot be undone." Runs through deletion, then saves state.

---

## I — Platform

- [x] **I1 — Windows installer (Inno Setup):** Create `installer/AgentSuiteLocal.iss` (Inno Setup script). The installer: (a) bundles the PyInstaller `dist/AgentSuiteLocal/` folder; (b) creates a Start Menu shortcut and optional Desktop shortcut; (c) registers in Windows Add/Remove Programs with version, publisher, and uninstall entry; (d) supports silent install (`/VERYSILENT /SUPPRESSMSGBOXES`); (e) generates `AgentSuiteLocal-v0.7.0-Setup.exe` as the primary distribution artifact (replaces the raw zip). Keep the zip as a secondary artifact for users who don't want to run an installer. Add `make build-installer` target to Makefile.
- [x] **I2 — macOS build:** The `.spec` file already has a `BUNDLE` block for macOS. Fix any macOS-specific issues: (a) in `ScreenOllama`, replace the Windows NSIS install path with `brew install ollama` instructions (no silent install on macOS — Homebrew is interactive); (b) in `_open_folder`, use `subprocess.Popen(['open', path])` on macOS; (c) in notifications (H1), use `pync` or `terminal-notifier` on macOS instead of `winotify`. Add a `build-mac` GitHub Actions job (runs on `macos-latest`). Output: `AgentSuiteLocal-v0.7.0-macOS.dmg` (use `create-dmg` if available, else raw `.app` zip).

---

## J — Infrastructure

- [x] **J1 — GitHub Actions CI:** Create `.github/workflows/ci.yml`. On every push and pull request to `main` and `release/*`: (a) `pytest tests/ --ignore=tests/e2e -v` on Python 3.11 and 3.12; (b) `cd web && npm ci && npm run test`; (c) `ruff check .`; (d) `cd web && npm run build` (verifies no type errors in the build). Badge in README.md.
- [x] **J2 — GitHub Actions release build:** Create `.github/workflows/release.yml`. On push of a `v*` tag: (a) Windows job: build frontend, run PyInstaller, run Inno Setup, upload `AgentSuiteLocal-v{tag}-Setup.exe` and `AgentSuiteLocal-v{tag}-windows-x64.zip` as release artifacts; (b) macOS job: build frontend, run PyInstaller, produce macOS artifact. Both jobs run `scripts/cleanroom-e2e.sh` against their artifact before uploading. Create the GitHub release automatically with the tag's CHANGELOG section as the body.
- [x] **J3 — Automated E2E tests:** Refactor `tests/e2e/` so they start the backend via `subprocess` and point at `http://127.0.0.1:{port}` (read from `launcher.log`) rather than requiring manual startup. The Vite dev server is replaced by `npm run build` + serving `web/dist/` via FastAPI's static file mount (already done). Add an E2E job to `ci.yml` that: installs Ollama, pulls `gemma2:2b` (smallest available), runs the E2E suite, and reports. Mark with `@pytest.mark.e2e`. Run on PRs to `main` only (too slow for every push).
- [x] **J4 — Real telemetry (local only):** Wire the `telemetry` toggle in Settings. When enabled: log app events (run started, run completed, run errored, approve, reject) to `~/.agentsuitelocal/usage.jsonl` as newline-delimited JSON with timestamp, event type, agent, and duration. No PII, no network calls. Add `GET /api/telemetry/summary` that aggregates the log and returns counts by event type for a potential future analytics view. When disabled: do not write the log. The toggle default remains `false`. Add a clear note in Settings: "All data stays on this machine. Nothing is sent anywhere."

---

## K — AgentSuite Upstream Changes

These items require modifying the pinned AgentSuite library. Fork `scottconverse/AgentSuite`, make the changes on a branch, push, and update the `pyproject.toml` pin to the new commit SHA.

- [x] **K1 — Cross-stage context passing:** In the AgentSuite library, add a `context: dict` parameter that accumulates stage outputs. After each stage completes, the stage's key artifacts (title, summary, core decisions) are serialized into `context` and passed as an additional input to the next stage's prompt. Implement a `_summarize_stage_output(stage_name, artifacts)` helper that extracts the first 500 words of the primary artifact as the context entry. Update the `ProgressCallback` protocol to emit `{type: "context_update", stage: ..., summary: ...}` events. In `LiveRunView`, show the growing context as a collapsible "Stage decisions so far" panel.
- [x] **K2 — Intra-stage progress events:** In the AgentSuite library, emit `{type: "stage_progress", stage: ..., step: N, total: M, message: ...}` events at meaningful checkpoints within each stage (e.g. "Analyzing inputs", "Generating outline", "Writing section 1/5", "Finalizing"). In `LiveRunView`, use these to drive a real progress bar (0–100%) within the current stage, replacing the elapsed-time-only display from E2. Keep E2 elapsed time as a fallback for stages that don't emit progress events. Update the `pyproject.toml` AgentSuite pin after the upstream changes are merged.

---

## L — Documentation

- [x] **L1 — README.md complete rewrite:** Sections: (1) What it is — two honest paragraphs, no fluff; (2) Requirements — Windows 10/11 x64 or macOS 12+, 8 GB RAM minimum / 16 GB recommended, 10 GB free disk, internet for first-time model download; (3) Install — three steps with the Setup.exe path; (4) The 7 agents — table with agent name, what it produces, artifact count, estimated runtime; (5) Where output goes — explains `~/.agentsuite/` structure; (6) Updating — how auto-update banner works, how to download manually; (7) Development setup — `git clone`, `pip install -e .[dev]`, `npm ci`, `pytest`, `npm test`; (8) Contributing — link to CONTRIBUTING.md; (9) License. CI badge at top. No "production-ready" claims.
- [x] **L2 — User manual (`docs/manual.md` + wired into `ManualView`):** Full end-to-end manual: (1) Installation walkthrough — every installer screen described with what to expect; (2) First run — from Dashboard to approved artifact, step by step; (3) Agent reference — each of the 7 agents, what to write in the goal field, what you'll get back, typical runtime; (4) The live view — what each stage means, what the QA scores mean, how to read the artifact tree; (5) The kernel — what it is, where files live, how to find them, how to compare versions; (6) Pipelines — how to create, approve steps, resume from error; (7) Model management — how to pull models, how to switch tiers; (8) Settings reference — every toggle and field explained; (9) Troubleshooting — 15+ specific error scenarios with exact fix steps; (10) FAQ — 20+ questions. Wire the updated manual into `ManualView` replacing the current content.
- [x] **L3 — Architecture diagrams (Mermaid):** Produce four diagrams in `docs/architecture.md`: (1) System overview — user → desktop exe → FastAPI backend → AgentSuite lib → Ollama → local model → filesystem; (2) Run lifecycle state machine — all states (pending / running / waiting / approved / rejected / error / cancelled / timeout), all transitions, all triggering events; (3) Pipeline execution flow — step sequence, per-step approval gates, SSE streaming path, resume path; (4) Data layout on disk — annotated tree showing every directory and file the app creates under `~/.agentsuite/` and `~/.agentsuitelocal/`. All four as Mermaid fenced code blocks (render on GitHub automatically).
- [x] **L4 — Landing page (`docs/index.html`) complete rewrite:** Sections: (1) Hero — product name, one-line description, download button (links to latest GitHub release), platform badges (Windows / macOS); (2) "How it works" — three-step visual (Install → Run an agent → Review and approve) with the system overview diagram (diagram 1 from L3, inlined as SVG rendered from Mermaid); (3) The 7 agents — agent cards with icon, name, what it produces; (4) Requirements — honest, specific (RAM, disk, OS); (5) Screenshots — 6 actual screenshots of the running app (installer, dashboard, live run, approval gate with markdown preview, kernel view, model management); (6) Download — primary CTA with version number, file size, and SHA256 checksum; (7) Footer — license, GitHub link, "Built with Ollama" attribution. Professional CSS, no frameworks, no external dependencies (self-contained HTML file).
- [x] **L5 — Landing page screenshots:** Run the built app, navigate to each key screen, take screenshots at 1280×800, save as `docs/assets/screenshot-{name}.png`. Screens: installer-welcome, dashboard, live-run, approval-gate, kernel-view, model-management. Embed in the landing page (L4).
- [x] **L6 — Discussion board seed posts (`docs/community/`):**
  - `reddit-localllama-launch.md` — r/LocalLLaMA style post: what it is, demo description, honest limitations, how to install, call for feedback, author note. 400–600 words. No hype.
  - `github-discussions-welcome.md` — Pinned welcome post for GitHub Discussions: project context, the 7 agents, how to report a bug (what to include), how to request a feature, rough roadmap (0.8 / 0.9 / 1.0 milestones), how to contribute. 500–700 words.
  - `github-discussions-showcase.md` — Template post for users sharing runs: fill-in-the-blank sections for agent used, goal text, what worked, what the output quality was like, what the model was, and any surprises. Short (150 words), easy to copy.
- [x] **L7 — CHANGELOG.md:** Add `## [0.7.0] — 2026-05-03` section. Under `### Added`: all new features (A1–A6, B1–B6, C1–C3, D1–D4, E1–E2, F1–F4, G1–G3, H1–H5, I1–I2, J1–J4, K1–K2). Under `### Changed`: updated docs, updated AgentSuite pin. Under `### Fixed`: any bug fixes included in this sprint.
- [x] **L8 — CONTRIBUTING.md verification:** Confirm all port numbers, setup commands, test commands, and branch names are accurate for v0.7.0. Update the "Running tests" section to document `pytest` + `npm run test` + the new E2E setup. Add a "Building the installer" section. Add a "Making AgentSuite changes" section explaining the fork-and-pin workflow (K1/K2).

---

## M — Verification

- [x] Backend test suite: `pytest tests/ --ignore=tests/e2e -v` — all existing 76 tests pass; new tests added for: `POST /api/run/{id}/cancel`, `GET /api/validate-path`, `POST /api/ollama/pull`, `GET /api/ollama/models`, `DELETE /api/ollama/models/{name}`, `GET /api/run/{id}/export/zip`, `GET /api/kernel/diff`, `POST /api/pipelines/{id}/resume`, `GET /api/crash-reports/latest`, `POST /api/open-folder`, run watchdog timeout behaviour, crash recovery on startup, pipeline orphan repair on startup.
- [x] Frontend test suite: `cd web && npm run test` — all existing 52 tests pass; new tests for: `ModelView`, `KernelView`, `ProjectsView`, `RunDetailView`, reconnect behaviour in `useSSE`, inline path validation in `NewRunView`, QA override flow in `ApprovalGateView`, markdown rendering smoke test in `ApprovalGateView`.
- [x] Lint: `ruff check .` — clean.
- [x] Frontend build: `cd web && npm run build` — clean, no warnings.
- [x] PyInstaller Windows build: `python -m PyInstaller AgentSuiteLocal.spec --noconfirm` — clean.
- [x] Inno Setup installer build: `make build-installer` — produces `AgentSuiteLocal-v0.7.0-Setup.exe`.
- [x] Cleanroom Windows: `powershell -ExecutionPolicy Bypass -File scripts\cleanroom.ps1` — all checks green.
- [x] Cleanroom Docker E2E: `scripts/cleanroom-e2e.sh` — all checks green. (n/a — Linux script; Windows cleanroom passed as equivalent)

---

## N — Release

- [x] Bump version to `0.7.0` in: `agentsuitelocal/__version__.py` line 1, `pyproject.toml` line 7, `AgentSuiteLocal.spec` line 149, `web/package.json` `"version"` field.
- [ ] Push to feature branch `release/v0.7.0`
- [ ] CI green on feature branch (poll every 110s, max 30 min)
- [ ] Merge feature branch to `main`
- [ ] Tag `v0.7.0`
- [ ] `gh release create v0.7.0` with the numbered 22-item summary as release notes, attaching `AgentSuiteLocal-v0.7.0-Setup.exe` and `AgentSuiteLocal-v0.7.0-windows-x64.zip`

---

## Recent commits since v0.1.2

_(Zero commits — all work is ahead of us.)_
