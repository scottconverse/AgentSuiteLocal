# AgentSuiteLocal — Session Handoff
**Date:** 2026-05-03  
**Last commit:** `e9528c0` on `main`  
**Tests:** 98 backend (pytest) · 74 frontend (vitest) · all passing

---

## What was done this session

### Completed
- Browser-verified all 11 installer steps on the correct backend (port 8767 — stale WSL2 proxy on 8766 was pre-v0.7.0 code, unkillable, needs reboot to clear)
- Browser-verified ModelView, ProjectsView, KernelView all render
- Fixed `ModelView.jsx` crash: API returns `{name, size_gb, ...}` objects; component was calling `.startsWith()` on them as strings → TypeError. Fixed with normalisation pass. `ollamaOk` also fixed (reads `m.active` when `m.running` absent).
- Added `ModelView.test.jsx` (11 tests) and `ProjectsView.test.jsx` (11 tests)
- Committed and pushed brand assets (`brand/` — 63 files: logos, icons, .ico, React component)
- Wired `agentsuitelocal/assets/icon.ico` into Inno Setup `.iss` and PyInstaller `.spec`
- Added favicon to `web/index.html` and `web/favicon.png`
- Added `edit`, `trash`, `copy` icons to ICON_PATHS in `ui/index.jsx`
- Implemented installer session persistence: `localStorage.getItem("agentsuite_setup_complete")` on mount skips installer; set in `enterApp()`, cleared on uninstall phase 3
- Added weasyprint + C-extension chain to spec `hiddenimports`
- Upgraded agentsuite dependency from SHA pin `621e861` → tagged release `@v1.0.11` (7 commits ahead, K1/K2 included, 98 tests still pass)
- Confirmed `docs/architecture.md` port references already correct (v0.7.0 sprint fixed them)
- Confirmed `tests/e2e/conftest.py` CI comment already correct

### Key bugs found during this session (not yet fixed)
See "Open issues" below — the full audit surfaced 1 blocker, 3 criticals, and 9 majors that were NOT caught by previous audits.

---

## Why previous audits missed the current bugs

1. **Tests mock the API contract they should protect.** `ProjectsView.test.jsx` mocks fetch to return `ok: true` for any POST/DELETE. Tests verify UI behaviour given a working API — not that the API exists. 74 green ≠ feature works.

2. **Browser verification was shallow.** Confirmed views render; didn't click Rename/Archive/Delete/Pull in a live browser against a real backend.

3. **Audits read files in isolation.** C-2/C-3/M-1 require comparing field names across two files simultaneously. Each file looks internally consistent; the mismatch only appears when cross-referencing.

4. **The final comprehensive subagent audit** was explicitly tasked with cross-file contract verification — that's why it found things the prior passes missed.

---

## Open issues — prioritised fix list

### BLOCKER
**B-1 — Project mutations all 404**  
`ProjectsView.jsx:130,155,178` calls POST `.../rename`, POST `.../archive`, DELETE `.../projects/{slug}`.  
Only `GET /api/projects` exists (`main.py:1433`). Every Rename, Archive, Delete silently fails.  
Fix: implement all three endpoints in `main.py`.

---

### CRITICAL
**C-1 — Model pull completely broken**  
`ModelView.jsx:72` opens `new EventSource('/api/ollama/pull?model=...')` — EventSource is always GET.  
Backend endpoint is `@app.post("/api/ollama/pull")` (`main.py:767`). FastAPI returns 405. No model can ever be pulled from the UI.  
Fix: Change `ModelView.jsx` to use `fetch()` with a streaming reader, OR change the endpoint to GET.

**C-2 — Update banner never shows**  
`App.jsx:94` reads `d.update_available` and `d.latest_version`.  
`/api/update/check` (`main.py:482`) returns `has_update` and `latest`. Both reads are always `undefined`.  
Fix: align field names — change `App.jsx` to read `d.has_update` / `d.latest`, or change `main.py` to emit `update_available` / `latest_version`.

**C-3 — Tier selector sets wrong model**  
`_TIER_MODEL_MAP` (`main.py:128`): keys are `"fast"`, `"balanced"`, `"powerful"`.  
Frontend `data.js:48–60`: tier IDs are `"light"`, `"balanced"`, `"pro"`.  
`dict.get("light")` → `None` → falls back silently. Light and Pro tier selections are no-ops for model assignment.  
Fix: change map keys to `{"light": "gemma4:e2b", "balanced": "gemma4:e4b", "pro": "gemma4:26b-moe"}`.

---

### MAJOR
**M-1 — ProjectsView shows "0 runs" and no date for every project**  
`ProjectsView.jsx:118` reads `p.run_count` and `p.last_run_at`.  
API returns `runs` and `last_touch` (`main.py:1439,1448`).  
Fix: change `ProjectsView.jsx` to read `p.runs` and `p.last_touch`.

**M-2 — "Partial QA" warning fires on every normal run**  
`ApprovalGateView.jsx:51`: `EXPECTED_QA_DIMS = 5`. `data.js:107` defines 9 QA dimensions.  
Every run returns 9 dims; `9 < 5` is false but the warning fires because the condition is `< EXPECTED_QA_DIMS` which is 5, showing "9 of 5 dimensions" which is nonsensical.  
Fix: set `EXPECTED_QA_DIMS = 9`.

**M-3 — ModelView RECOMMENDED list disconnected from data.js MODELS**  
`ModelView.jsx` local RECOMMENDED: `gemma2:2b`, `gemma4:e4b`, `llama3.1:8b`, `qwen2.5:3b`, `mistral:7b`.  
`data.js` MODELS: `gemma4:e2b`, `gemma4:e4b`, `gemma4:26b-moe`.  
Different model universes, different size/RAM numbers for the same model.  
Fix: derive ModelView RECOMMENDED from the same source as data.js, or explicitly document the split.

**M-4 — Uninstall doesn't stop daemon on Windows**  
`main.py:1975`: `os.kill(os.getpid(), 15)`. On Windows, SIGTERM sent to self does not terminate uvicorn. Daemon keeps running after uninstall.  
Fix: use `os._exit(0)` on `sys.platform == "win32"`.

**M-5 — ZIP export leaks a temp file on every download**  
`main.py:1136`: `tempfile.mkstemp()` creates file, writes zip, returns `FileResponse(tmp_path)`. No cleanup.  
Fix: pass `background=BackgroundTask(os.unlink, tmp_path)` to `FileResponse`.

**M-6 — macOS bundle icon is .ico — needs .icns**  
`AgentSuiteLocal.spec:158` inside `BUNDLE()`: `icon=...icon.ico`. macOS requires `.icns`.  
Fix: generate `icon.icns` from the brand assets and reference it in `BUNDLE()` only. `EXE()` keeps `.ico`.

**M-7 — README claims main.py is ~440 lines**  
Actual: 2,014 lines. Off by 4.5×.  
Fix: update to `~2000 lines`.

**M-8 — Sidebar/TrayMenu show hardcoded engine stats**  
`shell/index.jsx:82`: displays `projectSlug || "myco-pivot"` — `"myco-pivot"` is a placeholder. Model/performance strings are hardcoded, never updated from live API.  
Fix: wire to `/api/settings` or `/api/status` for live model name; remove hardcoded perf stats or derive from `/api/hardware`.

**M-9 — CHANGELOG says SSE buffer maxlen=500, code says 100**  
`main.py` defines `_SSE_BUFFER_SIZE = 100`.  
Fix: correct CHANGELOG entry.

---

### MINOR
- **m-1** — Silent fetch failures (`.catch(() => {})`) in ProjectsView, PipelineView, RunsView — no user-visible error state
- **m-2** — `cancel_run`, `approve_run`, `reject_run` call `_save_state()` without `_state_write_lock` — concurrent corruption risk
- **m-3** — `NewRunView` `<label>` elements missing `htmlFor`; inputs missing `id` — accessibility gap
- **m-4** — `CFBundleShortVersionString` hardcoded `"0.7.0"` in spec — drifts on version bumps
- **m-5** — `test_version` asserts literal `"0.7.0"` — fails on every version bump; import from `__version__` instead
- **m-6** — No backend tests for `/api/update/check`, `/api/smoke`, `/api/model/verify`, `/api/ollama/pull`, project mutations
- **m-7** — No Vitest for `ApprovalGateView`, `KernelView`, `PipelineView`, `LiveRunView`, `Dashboard`, `ManualView`

### NITS
- **N-1** — `anthropic`, `openai`, `mcp` in spec hiddenimports not pinned in pyproject.toml
- **N-2** — No DPI-awareness manifest in spec — may render blurry on high-DPI Windows
- **N-3** — `apiKey` stays in React state after `enterApp()` PATCH — clear it immediately after
- **N-4** — Inno Setup `UninstallRun` silently skips cleanup if daemon already stopped

---

## Current state

| Area | State |
|---|---|
| Branch | `main`, clean, up to date with origin |
| Last commit | `e9528c0` — icon gaps, installer persistence, spec icon, agentsuite v1.0.11 |
| Backend tests | 98 passed |
| Frontend tests | 74 passed |
| Browser verified | Installer 11 steps ✓, ModelView ✓, ProjectsView ✓, KernelView ✓ |
| Stale process | PID on port 8766 (pre-v0.7.0 code, WSL2 proxy) — dies on reboot, no action needed |
| agentsuite dep | `@v1.0.11` (tagged, verified safe) |

## Recommended fix order for next session

1. **B-1** — Implement project mutation endpoints (rename, archive, delete) in `main.py`
2. **C-3** — Fix `_TIER_MODEL_MAP` keys (`"fast"/"powerful"` → `"light"/"pro"`)
3. **C-1** — Fix model pull (EventSource → fetch streaming, or endpoint → GET)
4. **C-2** — Fix update banner field names (`has_update`/`latest` → `update_available`/`latest_version` or vice versa)
5. **M-1** — Fix ProjectsView field names (`run_count`/`last_run_at` → `runs`/`last_touch`)
6. **M-2** — Fix `EXPECTED_QA_DIMS = 5` → `9`
7. **M-4** — Fix uninstall SIGTERM on Windows
8. **M-5** — Fix ZIP export temp file leak
9. **M-9** — Fix CHANGELOG SSE buffer size claim
10. After all code fixes: add backend tests for the 5 untested endpoints; add Vitest smoke tests for the 6 uncovered view components
11. M-7 (README line count), M-8 (hardcoded sidebar strings), remaining minors/nits

## Architecture notes for next session

- **main.py** is 2,014 lines, ~52 routes. Single file, intentional for this milestone.
- **Port split:** dev backend = `:8766`, distributable launcher = `:8765`. `vite.config.js` proxies to `:8766`. This is documented and correct.
- **State persistence:** `~/.agentsuitelocal/runs.json` and `pipelines.json`. In-memory during run, persisted at 5 lifecycle transitions. In-flight runs marked `"error"` on reload.
- **Thread model:** FastAPI event loop on one thread. PipelineOrchestrator runs in thread pool via `run_in_executor`. SSE events pushed via `call_soon_threadsafe`. `_state_write_lock` guards JSON writes (but NOT run mutation endpoints — see m-2).
- **agentsuite K1/K2:** cross-stage context accumulation and intra-stage progress events are in `@v1.0.11`. The `kernel_progress_callback` parameter threads through `PipelineOrchestrator.run()`.
