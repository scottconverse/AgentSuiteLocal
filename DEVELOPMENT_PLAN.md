# AgentSuiteLocal — Development & Implementation Plan

**Generated:** 2026-05-03  
**Baseline commit:** `171e8ff` on `main`  
**Test baseline:** 92 backend (pytest, excluding e2e/live) · 74 frontend (vitest)  
**State:** `main.py` 2,014 lines · 48 routes · one stash (partial C-3/B-1 work)

---

## How to read this document

Each item has:
- **What** — the problem in one sentence
- **Where** — exact file(s) and line(s)
- **How** — the specific code change required
- **Verify** — how to confirm it's done correctly
- **Blast radius** — what else might break when you land this

Items are ordered by execution priority within each phase. Phases are ordered by risk/impact. Do not start Phase 2 until Phase 1 is complete and tests pass. Do not start Phase 3 until Phase 2 is committed.

---

## Phase 1 — Blocker + Critical + Major bug fixes

These are observable, shipping-blocking defects in the current codebase.

---

### B-1 — Project mutation endpoints (BLOCKER)

**What:** `POST /api/projects/{slug}/rename`, `POST /api/projects/{slug}/archive`, and `DELETE /api/projects/{slug}` do not exist. Every Rename, Archive, and Delete button in ProjectsView silently 404s.

**Where:**
- `agentsuitelocal/api/main.py` after line 1453 (after `list_projects`)
- `web/src/components/app/ProjectsView.jsx:35,47,54` (the fetch calls are already correct)

**How — backend (`main.py`):**

Add a request model immediately after the `list_projects` function:

```python
class RenameProjectRequest(BaseModel):
    new_name: str = Field(..., min_length=1, max_length=200)


@app.post("/api/projects/{slug}/rename")
async def rename_project(slug: str, body: RenameProjectRequest):
    """B-1: Rename all runs belonging to a project slug."""
    new_slug = body.new_name.strip().lower().replace(" ", "-")
    if not new_slug:
        raise HTTPException(status_code=422, detail="new_name must be non-empty")
    with _state_write_lock:
        matched = [r for r in _runs.values() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for run in matched:
            run["project"] = new_slug
        _save_state()
    return {"slug": new_slug, "previous_slug": slug, "runs_updated": len(matched)}


@app.post("/api/projects/{slug}/archive")
async def archive_project(slug: str):
    """B-1: Mark all runs in a project as archived."""
    with _state_write_lock:
        matched = [r for r in _runs.values() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for run in matched:
            run["archived"] = True
        _save_state()
    return {"slug": slug, "archived": True, "runs_updated": len(matched)}


@app.delete("/api/projects/{slug}")
async def delete_project(slug: str):
    """B-1: Delete all runs and artifacts for a project."""
    import shutil
    with _state_write_lock:
        matched = [rid for rid, r in _runs.items() if r.get("project") == slug]
        if not matched:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found")
        for rid in matched:
            run = _runs.pop(rid)
            as_run_id = run.get("agentsuite_run_id") or rid
            artifacts_dir = _workspace() / ".agentsuite" / "runs" / as_run_id
            if artifacts_dir.exists():
                shutil.rmtree(artifacts_dir, ignore_errors=True)
        _save_state()
    return {"slug": slug, "deleted": True, "runs_deleted": len(matched)}
```

**Note on `_save_state()`:** The current `_save_state()` acquires `_state_write_lock` internally at line ~109. Since these new endpoints also acquire the lock *before* calling `_save_state()`, that creates a deadlock. Fix: make `_save_state()` not acquire the lock, and have all callers acquire it externally. Audit all existing `_save_state()` callers during this change.

**How — verify lock pattern:**

Check all existing `_save_state()` callers:
```bash
grep -n "_save_state()" agentsuitelocal/api/main.py
```
For each: ensure the caller holds the lock before calling. If `_save_state()` internally acquires the lock, refactor it to a lockless `_save_state_unsafe()` and update all call sites.

**Verify:**
1. `curl -X POST http://localhost:8767/api/projects/test-project/rename -H "Content-Type: application/json" -d '{"new_name":"renamed-project"}' ` → 200 or 404 (not 405)
2. `curl -X POST http://localhost:8767/api/projects/test-project/archive` → 200 or 404
3. `curl -X DELETE http://localhost:8767/api/projects/test-project` → 200 or 404
4. Create a run, navigate to ProjectsView, click Rename — confirm the new name persists after page refresh

**Tests to add (`tests/test_api.py`):**
```python
def test_rename_project_404_for_missing(client):
    r = client.post("/api/projects/nonexistent/rename", json={"new_name": "new"})
    assert r.status_code == 404

def test_archive_project_404_for_missing(client):
    r = client.post("/api/projects/nonexistent/archive")
    assert r.status_code == 404

def test_delete_project_404_for_missing(client):
    r = client.delete("/api/projects/nonexistent")
    assert r.status_code == 404

def test_project_lifecycle(client, sample_run_payload):
    # create a run → list projects → rename → verify → archive → verify → delete → verify
    ...
```

**Blast radius:** `_save_state()` locking change touches every state mutation in the app. Run full pytest suite after.

---

### C-1 — Model pull broken (EventSource vs POST) (CRITICAL)

**What:** `ModelView.jsx:72` uses `new EventSource(...)` which is always GET. The backend endpoint at `main.py:767` is `@app.post`. FastAPI returns 405. No model can ever be pulled.

**Where:**
- `web/src/components/app/ModelView.jsx:68–104` (the entire `pullModel` function)
- `agentsuitelocal/api/main.py:766–769` (the `/api/ollama/pull` alias)

**How — frontend (`ModelView.jsx`):**

Replace the `pullModel` function. Remove `EventSource` entirely; use `fetch()` with `response.body` streaming:

```js
const pullModel = async (modelId) => {
  if (pulling[modelId]?.active) return;
  setPulling(prev => ({ ...prev, [modelId]: { active: true, progress: 0, status: "Starting…", done: false, error: null } }));

  try {
    const resp = await fetch("/api/ollama/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId }),
    });

    if (!resp.ok) {
      throw new Error(`Server returned ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        try {
          const d = JSON.parse(trimmed.slice(5).trim());
          if (d.status === "success") {
            setPulling(prev => ({ ...prev, [modelId]: { active: false, progress: 100, status: "Done", done: true, error: null } }));
            fetchModels();
            return;
          }
          const pct = d.total && d.completed ? Math.round((d.completed / d.total) * 100) : 0;
          setPulling(prev => ({ ...prev, [modelId]: { active: true, progress: pct, status: d.status || "Pulling…", done: false, error: null } }));
        } catch { /* skip malformed lines */ }
      }
    }

    // Stream ended without success event — still mark done
    setPulling(prev => ({ ...prev, [modelId]: { active: false, progress: 100, status: "Done", done: true, error: null } }));
    fetchModels();

  } catch (err) {
    setPulling(prev => ({ ...prev, [modelId]: { active: false, progress: 0, status: "", done: false, error: err.message } }));
  }
};
```

Remove the `pullAborts` ref (was `es.close()`) — replace with an `AbortController` if cancel-mid-pull is desired. For now, remove the abort mechanism (it wasn't wired to UI anyway).

**How — backend (`main.py`):**

The existing `POST /api/ollama/pull` alias (line 767) and the primary `POST /api/model/pull` (line 744) are both correct. The backend does not need to change.

**Verify:**
1. Click Pull on any model in ModelView
2. The progress bar should advance, not immediately show error
3. Network tab in DevTools: confirm a POST to `/api/ollama/pull` with 200 response, not a GET with 405

**Tests to update (`ModelView.test.jsx`):**

The existing `FakeEventSource` stub must be replaced. Mock `fetch` to return a streaming response:
```js
// Replace FakeEventSource stub with:
vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
  if (url === "/api/ollama/pull" && opts?.method === "POST") {
    const body = 'data: {"status":"success"}\n';
    return { ok: true, body: { getReader: () => ({ 
      read: vi.fn()
        .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(body) })
        .mockResolvedValueOnce({ done: true }),
    })}, status: 200 };
  }
  // ...other mocks
}));
```

**Blast radius:** ModelView pull tests all need updating. No backend change needed.

---

### C-2 — Update banner never shows (CRITICAL)

**What:** `App.jsx:94` reads `d.update_available` and `d.latest_version`. API returns `has_update` and `latest`. Both reads are always `undefined`.

**Where:**
- `web/src/App.jsx:94` (the `.then()` callback for `/api/update/check`)

**How — frontend (`App.jsx`):**

Line 94, change:
```js
// BEFORE:
.then(d => { if (d.update_available) setUpdateInfo({ version: d.latest_version, url: d.release_url }); })

// AFTER:
.then(d => { if (d.has_update) setUpdateInfo({ version: d.latest, url: d.release_url }); })
```

**Verify:**
1. Temporarily modify `_version.py` to set `__version__ = "0.0.1"` (so any real release looks newer)
2. Run the backend and enter the app
3. Confirm the update banner appears with the correct version

**Tests to add (`tests/test_api.py`):**
```python
def test_update_check_response_shape(client):
    """C-2: Ensure /api/update/check returns has_update and latest, not update_available/latest_version."""
    r = client.get("/api/update/check")
    assert r.status_code == 200
    data = r.json()
    assert "has_update" in data
    assert "latest" in data
    assert "current" in data
    # These wrong field names must NOT be present
    assert "update_available" not in data
    assert "latest_version" not in data
```

**Blast radius:** None — this is a read-only change to how one field is consumed.

---

### C-3 — Tier selector sets wrong model (CRITICAL)

**What:** `_TIER_MODEL_MAP` keys are `"fast"`, `"balanced"`, `"powerful"`. Frontend sends `"light"`, `"balanced"`, `"pro"`. `dict.get("light")` → `None`. Light and Pro tier selections silently don't change the model.

**Where:**
- `agentsuitelocal/api/main.py:128–132` (`_TIER_MODEL_MAP`)
- Secondary: `web/src/components/app/ModelView.jsx:52` (`setActiveModel` uses `rec?.tier || "powerful"` from the local RECOMMENDED list that also has wrong tier strings)

**How — backend (`main.py`):**

```python
# BEFORE:
_TIER_MODEL_MAP = {
    "fast":      "gemma2:2b",
    "balanced":  "gemma4:e4b",
    "powerful":  "llama3.1:8b",
}

# AFTER:
# Keys match frontend data.js tier IDs: "light", "balanced", "pro"
_TIER_MODEL_MAP = {
    "light":     "gemma4:e2b",
    "balanced":  "gemma4:e4b",
    "pro":       "gemma4:26b-moe",
}
```

**How — frontend (`ModelView.jsx`):**

The local `RECOMMENDED` array at lines 6–12 uses the old tier strings (`"fast"`, `"balanced"`, `"powerful"`) and has different models. Replace it to source from `data.js` MODELS instead:

```js
// BEFORE: local RECOMMENDED array (lines 6–12)
const RECOMMENDED = [
  { id: "gemma2:2b", tier: "fast", ... },
  ...
];

// AFTER: import and use data.js directly
import { MODELS } from "../../data.js";

// Map data.js MODELS to the local shape ModelView expects
const RECOMMENDED = MODELS.map(m => ({
  id: m.model,
  tier: m.id,        // "light" | "balanced" | "pro"
  size: m.size,
  ram: m.ram,
  label: `${m.tier} — ${m.model}`,
}));
```

Also fix `setActiveModel` (line 52) which falls back to `"powerful"` — change to `"pro"`:
```js
// BEFORE:
const tier = rec?.tier || "powerful";

// AFTER:
const tier = rec?.tier || "pro";
```

And remove `TIER_COLORS` (line 14) which references old strings; update to match new tier IDs:
```js
const TIER_COLORS = { light: "var(--good)", balanced: "var(--accent)", pro: "var(--warn)" };
```

**Verify:**
1. In Settings, select "Light" tier → PATCH to `/api/settings` with `model_tier: "light"` → backend now maps to `"gemma4:e2b"` (not None)
2. `GET /api/settings` → confirm `model_name` changed to `"gemma4:e2b"`

**Tests to add:**
```python
def test_tier_map_light_resolves_to_correct_model(client):
    r = client.patch("/api/settings", json={"model_tier": "light"})
    assert r.status_code == 200
    r2 = client.get("/api/settings")
    assert r2.json()["model_name"] == "gemma4:e2b"

def test_tier_map_pro_resolves_to_correct_model(client):
    r = client.patch("/api/settings", json={"model_tier": "pro"})
    assert r.status_code == 200
    r2 = client.get("/api/settings")
    assert r2.json()["model_name"] == "gemma4:26b-moe"
```

**Blast radius:** Any existing test that passes `"fast"` or `"powerful"` as a tier will silently stop working. Search: `grep -rn '"fast"\|"powerful"' tests/`.

---

### M-1 — ProjectsView shows 0 runs and no date (MAJOR)

**What:** `ProjectsView.jsx:118–119` reads `p.run_count` and `p.last_run_at`. API returns `runs` and `last_touch`. Both are always `undefined`.

**Where:** `web/src/components/app/ProjectsView.jsx:118–119`

**How:**
```jsx
// BEFORE:
{p.run_count ?? 0} run{p.run_count !== 1 ? "s" : ""}
{p.last_run_at ? ` · last run ${new Date(p.last_run_at * 1000).toLocaleDateString()}` : ""}

// AFTER:
{p.runs ?? 0} run{p.runs !== 1 ? "s" : ""}
{p.last_touch ? ` · last run ${new Date(p.last_touch * 1000).toLocaleDateString()}` : ""}
```

**Verify:** Navigate to ProjectsView with existing runs — project cards should show non-zero run counts and dates.

**Tests to update (`ProjectsView.test.jsx`):** The mock payload for `GET /api/projects` should return `runs` and `last_touch` (not `run_count` / `last_run_at`). Update the mock fixture.

**Blast radius:** None outside ProjectsView.

---

### M-2 — Partial QA warning fires on every normal run (MAJOR)

**What:** `ApprovalGateView.jsx:51`: `EXPECTED_QA_DIMS = 5`. Backend returns 9 dimensions. Condition `qaDims.length < EXPECTED_QA_DIMS` with value 5 means any run returning 6–9 dimensions shows "9 of 5 dimensions" — nonsensical.

**Where:** `web/src/components/app/ApprovalGateView.jsx:51`

**How:**
```js
// BEFORE:
const EXPECTED_QA_DIMS = 5;

// AFTER:
const EXPECTED_QA_DIMS = 9; // matches data.js QA_DIMENSIONS count
```

**Verify:** Open the approval gate for any completed run — the partial QA warning should NOT appear for a run that returned all 9 dimensions. It should only appear when `qaDims.length < 9`.

**Tests to add (`ApprovalGateView.test.jsx`):**
```js
it('does not show partial QA warning when all 9 dimensions present', async () => {
  // mock /api/run/:id to return 9 qa_dimensions
  // render ApprovalGateView
  // assert "Partial QA" text is NOT in document
});
it('shows partial QA warning when fewer than 9 dimensions returned', async () => {
  // mock with 5 dimensions
  // assert warning IS shown with correct count
});
```

**Blast radius:** None. One-line change.

---

### M-3 — ModelView RECOMMENDED disconnected from data.js (MAJOR)

**What:** ModelView has its own hardcoded model list with different models, different sizes, and wrong tier labels vs `data.js`. Covered under C-3 fix above (replacing RECOMMENDED with `import { MODELS } from "../../data.js"`). No additional change needed beyond C-3.

**Verify:** After C-3 fix, ModelView should show the same 3 models as the installer tier selector: `gemma4:e2b`, `gemma4:e4b`, `gemma4:26b-moe`.

---

### M-4 — Uninstall SIGTERM fails on Windows (MAJOR)

**What:** `main.py:1975` sends `os.kill(os.getpid(), 15)` (SIGTERM). On Windows, Python only honors SIGTERM from external processes; sending it to self does nothing. The daemon keeps running after uninstall.

**Where:** `agentsuitelocal/api/main.py:1975`

**How:**
```python
# BEFORE:
os.kill(os.getpid(), 15)  # SIGTERM — uvicorn handles graceful shutdown

# AFTER:
if sys.platform == "win32":
    os._exit(0)  # Windows: SIGTERM to self is a no-op; _exit() terminates the process
else:
    os.kill(os.getpid(), 15)  # POSIX: SIGTERM triggers uvicorn graceful shutdown
```

**Verify:** On Windows, trigger uninstall via Settings → Uninstall → confirm daemon stops. Check with `netstat -an | findstr :8765`.

**Blast radius:** None. Platform-conditional path, guarded by `sys.platform`.

---

### M-5 — ZIP export leaks temp file (MAJOR)

**What:** `main.py:1136–1148`: `tempfile.mkstemp()` creates a file, writes zip, returns `FileResponse(tmp_path)` with no cleanup. Every export leaves an orphan in `%TEMP%`.

**Where:** `agentsuitelocal/api/main.py:1144–1148`

**How:**

Add `BackgroundTask` import (already in starlette via fastapi) and wire cleanup:

```python
from starlette.background import BackgroundTask

# ...existing export_run_zip function, change the return:

# BEFORE:
return FileResponse(
    tmp_path,
    media_type="application/zip",
    headers={"Content-Disposition": f"attachment; filename={run_id}-artifacts.zip"},
)

# AFTER:
return FileResponse(
    tmp_path,
    media_type="application/zip",
    headers={"Content-Disposition": f"attachment; filename={run_id}-artifacts.zip"},
    background=BackgroundTask(os.unlink, tmp_path),
)
```

**Verify:** Export a run, then check `%TEMP%` — no `.zip` file should remain after the download completes.

**Blast radius:** None. `BackgroundTask` runs after the response is sent.

---

### M-6 — macOS bundle icon is .ico (MAJOR)

**What:** `AgentSuiteLocal.spec:158` uses `icon.ico` in `BUNDLE()`. macOS requires `.icns`. App will have no dock icon.

**Where:** `AgentSuiteLocal.spec:155–166`

**How:**

1. Generate `icon.icns` from the existing brand assets. If Pillow is available:
   ```python
   # scripts/generate_icns.py
   from PIL import Image
   import subprocess, pathlib
   
   src = pathlib.Path("brand/png/icon-1024.png")
   iconset = pathlib.Path("agentsuitelocal/assets/icon.iconset")
   iconset.mkdir(exist_ok=True)
   sizes = [16, 32, 64, 128, 256, 512, 1024]
   for s in sizes:
       img = Image.open(src).resize((s, s), Image.LANCZOS)
       img.save(iconset / f"icon_{s}x{s}.png")
       if s <= 512:
           img2x = Image.open(src).resize((s*2, s*2), Image.LANCZOS)
           img2x.save(iconset / f"icon_{s}x{s}@2x.png")
   subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", "agentsuitelocal/assets/icon.icns"])
   ```
   This runs on macOS only (iconutil is macOS-specific). The CI macOS runner should generate this artifact.

2. Update `AgentSuiteLocal.spec`:
   ```python
   # BEFORE:
   app = BUNDLE(
       coll,
       name="AgentSuiteLocal.app",
       icon=str(ROOT / "agentsuitelocal" / "assets" / "icon.ico"),
       ...
   
   # AFTER:
   app = BUNDLE(
       coll,
       name="AgentSuiteLocal.app",
       icon=str(ROOT / "agentsuitelocal" / "assets" / "icon.icns"),
       ...
   ```

**Note:** `EXE()` stays on `icon.ico` — `.ico` is Windows-only and correct there.

**Verify:** Build on macOS (`pyinstaller AgentSuiteLocal.spec`) → the `.app` bundle should show the correct dock icon.

**Blast radius:** macOS build only. Windows build unaffected.

---

### M-7 — README claims ~440 lines for main.py (MAJOR)

**What:** `README.md:93` says `main.py — FastAPI app — REST + SSE, ~440 lines`. Actual: 2,014 lines.

**Where:** `README.md:93`

**How:**
```markdown
# BEFORE:
main.py         FastAPI app — REST + SSE, ~440 lines

# AFTER:
main.py         FastAPI app — REST + SSE, ~2000 lines, 48 routes
```

**Verify:** Read the line. No test needed.

---

### M-8 — Sidebar shows hardcoded engine stats (MAJOR)

**What:** `shell/index.jsx:123` hardcodes `gemma4:e4b` and `18.4 tok/s · 7.2 GB`. These never update from the actual running model or live performance.

**Where:** `web/src/components/shell/index.jsx:117–125`

**How:**

The `Sidebar` component already receives `projectSlug` as a prop. Add a `model` prop:

```jsx
// App.jsx: fetch settings once on app entry and pass model to Sidebar
// In App state:
const [liveModel, setLiveModel] = useState(null);

// In the mode==="app" useEffect (or a new one):
useEffect(() => {
  if (mode !== "app") return;
  fetch("/api/settings").then(r => r.json()).then(s => setLiveModel(s.model_name || null)).catch(() => {});
}, [mode]);

// Pass to Sidebar:
<Sidebar view={view} setView={navTo} projectSlug="agentsuitelocal" waitingCount={waitingCount} model={liveModel} />
```

In `Sidebar`:
```jsx
export const Sidebar = ({ view, setView, projectSlug, waitingCount, model }) => {
  // ...
  // Replace hardcoded block:
  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}>
    {model || "—"}<br />Local engine
  </div>
```

Remove the hardcoded `18.4 tok/s · 7.2 GB` (performance cannot be known without a live benchmark endpoint, which doesn't exist — remove rather than fake).

Also fix the hardcoded `"myco-pivot"` fallback:
```jsx
// BEFORE:
<span style={{ flex: 1 }}>{projectSlug || "myco-pivot"}</span>

// AFTER:
<span style={{ flex: 1 }}>{projectSlug || "—"}</span>
```

**Verify:** Open the app after selecting a model — sidebar footer should reflect the actual model name from settings.

---

### M-9 — CHANGELOG SSE buffer claim wrong (MAJOR)

**What:** `CHANGELOG.md:18` says `maxlen=500`. Code at `main.py:69` is `_SSE_BUFFER_SIZE = 100`.

**Where:** `CHANGELOG.md:18`

**How:**
```markdown
# BEFORE:
SSE event buffer: `collections.deque(maxlen=500)` per run.

# AFTER:
SSE event buffer: `collections.deque(maxlen=100)` per run.
```

---

## Phase 2 — Minor fixes + test coverage

Complete all Phase 1 items and verify tests pass before starting Phase 2.

---

### m-1 — Silent fetch failures (MINOR)

**What:** `.catch(() => {})` in `ProjectsView`, `PipelineView`, `RunsView` swallows errors invisibly.

**Where:**
- `web/src/components/app/ProjectsView.jsx:24` (fetchProjects catch)
- `web/src/components/app/PipelineView.jsx` (fetch calls)
- `web/src/components/app/RunsView.jsx` (fetch calls)

**How:** Add an error state and display it:

```jsx
// Pattern to apply in each component:
const [error, setError] = useState(null);

// In fetch:
.catch(err => { setError("Failed to load. Check that the backend is running."); setLoading(false); });

// In render, above the data section:
{error && (
  <div className="card" style={{ padding: 16, color: "var(--bad)", fontSize: 13 }}>
    {error}
    <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={() => { setError(null); fetchData(); }}>
      Retry
    </button>
  </div>
)}
```

Apply this pattern consistently to: `ProjectsView.fetchProjects`, `RunsView` initial fetch, `PipelineView` initial fetch.

---

### m-2 — Run mutations don't hold state lock (MINOR)

**What:** `cancel_run`, `approve_run`, `reject_run` call `_save_state()` without holding `_state_write_lock`. Concurrent calls can corrupt the JSON sidecars.

**Where:** `agentsuitelocal/api/main.py` — search for these endpoint functions.

**How:** Wrap all direct `_run` mutations and `_save_state()` calls in these functions with `with _state_write_lock:`. After the B-1 locking refactor (which renames `_save_state` to be lock-free internally), this is straightforward.

**Verify:** Run concurrent approve/reject requests (e.g. `ab -n 10 -c 5`) against a waiting run — no JSONDecodeError on disk.

---

### m-3 — NewRunView label/input not associated (MINOR)

**What:** `<label>` elements in `NewRunView.jsx` have no `htmlFor`; inputs have no `id`. Screen readers cannot associate them; clicking the label doesn't focus the input.

**Where:** `web/src/components/app/NewRunView.jsx:92,98`

**How:**
```jsx
// Business goal label/input:
<label htmlFor="nr-goal" style={...}>Business goal</label>
<textarea id="nr-goal" ... />

// Project slug label/input:
<label htmlFor="nr-project" style={...}>Project slug</label>
<input id="nr-project" ... />
```

Apply to all label/input pairs in the component.

---

### m-4 — CFBundleShortVersionString hardcoded (MINOR)

**What:** `AgentSuiteLocal.spec:161` has `"CFBundleShortVersionString": "0.7.0"` — will drift on every version bump.

**Where:** `AgentSuiteLocal.spec:161`

**How:**

At the top of the spec, import the version:
```python
import sys
sys.path.insert(0, str(ROOT))
from agentsuitelocal.__version__ import __version__ as _APP_VERSION
```

Then use it:
```python
"CFBundleShortVersionString": _APP_VERSION,
```

**Verify:** Change `__version__.py` to `"0.8.0"`, run `pyinstaller AgentSuiteLocal.spec --dry-run`, confirm the plist uses the new value.

---

### m-5 — test_version asserts literal "0.7.0" (MINOR)

**What:** `tests/test_api.py:985`: `assert r.json()["version"] == "0.7.0"`. Will fail on every version bump.

**Where:** `tests/test_api.py:985`

**How:**
```python
# BEFORE:
assert r.json()["version"] == "0.7.0"

# AFTER:
from agentsuitelocal.__version__ import __version__
assert r.json()["version"] == __version__
```

---

### m-6 — No tests for 5 untested endpoints (MINOR)

**What:** `/api/update/check`, `/api/smoke`, `/api/model/verify/{model}`, `/api/ollama/pull`, and all 3 project mutation endpoints (added in B-1) have no tests. C-2 would have been caught by a response-shape test.

**Where:** `tests/test_api.py` (add new test functions)

**Tests to add:**

```python
# /api/update/check
def test_update_check_response_shape(client):
    r = client.get("/api/update/check")
    assert r.status_code == 200
    data = r.json()
    assert "has_update" in data  # not "update_available"
    assert "latest" in data       # not "latest_version"
    assert "current" in data
    assert "release_url" in data

# /api/smoke
def test_smoke_returns_ok(client):
    r = client.get("/api/smoke")
    assert r.status_code == 200
    assert r.json().get("ok") is True

# /api/model/verify
def test_model_verify_returns_shape(client):
    r = client.get("/api/model/verify/somemodel")
    assert r.status_code in (200, 404, 503)
    if r.status_code == 200:
        assert "ok" in r.json()

# /api/ollama/pull — shape test only (don't actually pull)
def test_pull_model_post_not_get(client):
    """C-1: endpoint must be POST, not GET."""
    r = client.get("/api/ollama/pull")
    assert r.status_code == 405  # Method Not Allowed — proves it's POST

def test_pull_model_post_accepted(client):
    r = client.post("/api/ollama/pull", json={"model": "test:latest"})
    # Will fail to actually pull (no Ollama), but must not 405
    assert r.status_code != 405

# Project mutations (B-1 coverage)
# ... (as specified in B-1 section above)
```

---

### m-7 — No Vitest for 6 view components (MINOR)

**What:** `ApprovalGateView`, `KernelView`, `PipelineView`, `LiveRunView`, `Dashboard`, `ManualView` have no Vitest coverage. B-1, C-1, M-1, M-2 are all in untested components.

**Where:** `web/src/components/app/` — create new `.test.jsx` files

**Minimum smoke test per component:**

```jsx
// Template (apply to each untested component):
import { render, screen } from "@testing-library/react";
import { ComponentName } from "./ComponentName.jsx";

vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));

describe("ComponentName", () => {
  it("renders without crashing", () => {
    render(<ComponentName />);
    // Verify at least one landmark element or heading is present
  });
  
  it("shows loading state initially", () => {
    render(<ComponentName />);
    // Check for loading indicator or skeleton
  });
  
  it("handles fetch error gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network error"))));
    render(<ComponentName />);
    // Should not throw; error state should appear
  });
});
```

**Components and minimum test counts:**
- `ApprovalGateView.test.jsx` — already exists; add the partial-QA warning tests (from M-2)
- `KernelView.test.jsx` — new; 3 smoke tests
- `PipelineView.test.jsx` — new; 3 smoke tests
- `LiveRunView.test.jsx` — new; 3 smoke tests (mock useSSE hook)
- `Dashboard.test.jsx` — new; 3 smoke tests
- `ManualView.test.jsx` — new; 2 smoke tests (static content)

Target: +20 frontend tests (74 → 94).

---

## Phase 3 — Nits

Quick wins that take < 15 minutes each.

---

### N-1 — anthropic/openai/mcp not pinned (NIT)

**What:** `agentsuitelocal.spec` hiddenimports include `anthropic`, `openai`, `mcp` but these aren't in `pyproject.toml` — build-time version drift risk.

**Where:** `pyproject.toml:dependencies`

**How:** Add to `pyproject.toml`:
```toml
"anthropic>=0.49.0",
"openai>=1.76.0",
"mcp>=1.9.0",
```

Pin the minimum version you're testing against. These are transitive deps of `agentsuite` so pinning in both is belt-and-suspenders, but it makes the contract explicit.

---

### N-2 — No DPI-awareness manifest (NIT)

**What:** Missing DPI-awareness manifest in spec — app may render blurry on high-DPI Windows.

**Where:** `AgentSuiteLocal.spec`

**How:** Create `agentsuitelocal/assets/dpi_aware.manifest`:
```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/PM</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
  </application>
</assembly>
```

In `AgentSuiteLocal.spec`, add to `EXE()`:
```python
exe = EXE(
    ...
    manifest=str(ROOT / "agentsuitelocal" / "assets" / "dpi_aware.manifest"),
    ...
)
```

---

### N-3 — apiKey stays in React state (NIT)

**What:** `apiKey` is set during the installer and stays in React state for the entire installer session — visible in React DevTools.

**Where:** `web/src/App.jsx:enterApp()`

**How:** After the `await fetch("/api/settings", ...)` succeeds, clear the key:
```js
const enterApp = async () => {
  try {
    await fetch("/api/settings", { method: "PATCH", ... });
    setApiKey(""); // Clear from memory immediately after persisting
  } catch { ... }
  localStorage.setItem(SETUP_KEY, "1");
  setMode("app");
  ...
};
```

---

### N-4 — UninstallRun silently skips if daemon stopped (NIT)

**What:** Inno Setup `[UninstallRun]` calls `/api/uninstall` via PowerShell. If the daemon is already stopped, the curl fails silently and no cleanup runs.

**Where:** `installer/AgentSuiteLocal.iss` — UninstallRun section

**How:** Wrap the PowerShell call to handle the daemon-stopped case:
```pascal
; In [UninstallRun] section:
Filename: "powershell.exe"; \
  Parameters: "-NonInteractive -Command ""try { Invoke-RestMethod http://localhost:8765/api/uninstall -Method POST | Out-Null } catch { exit 0 }"""; \
  Flags: runhidden waituntilterminated;
```

This ensures failure (daemon already stopped) is treated as a no-op rather than an unhandled error.

---

## Phase 4 — Architectural improvements

These are structural changes that reduce long-term risk. They do not fix user-visible bugs but make the system more maintainable and reliable. Tackle after Phase 1–3 are merged and stable.

---

### A-1 — main.py god-file split

**What:** `main.py` is 2,014 lines combining state management, all 48 routes, Ollama proxying, PDF export, telemetry, crash recovery, and hardware probing.

**Target structure:**
```
agentsuitelocal/
  api/
    main.py          # FastAPI app factory + app.include_router() only (~100 lines)
    state.py         # _runs, _pipelines, _save_state, _load_state, locks
    settings.py      # _load_settings, _save_settings, SETTINGS_DEFAULTS, TIER_MODEL_MAP
    runs.py          # APIRouter for /api/run/* routes
    pipelines.py     # APIRouter for /api/pipelines/* routes
    projects.py      # APIRouter for /api/projects/* routes
    ollama.py        # APIRouter for /api/ollama/*, /api/model/* routes
    system.py        # APIRouter for /api/hardware, /api/smoke, /api/update, /api/crash-reports
    export.py        # APIRouter for /api/run/{id}/export/* routes
    installer.py     # APIRouter for /api/install/*, /api/uninstall
```

**How to execute without breaking tests:**
1. Create `state.py` — move `_runs`, `_pipelines`, locks, `_save_state`, `_load_state`. All other modules import from `state`.
2. Create `settings.py` — move `_SETTINGS_DEFAULTS`, `_TIER_MODEL_MAP`, `_load_settings`, `_save_settings`.
3. For each route group: create the router file, move routes, `from .state import _runs, _save_state`, etc.
4. In `main.py`: `from .runs import router as runs_router; app.include_router(runs_router)`.
5. Run `pytest` after each file extraction — it should stay green throughout.

**Blast radius:** This is the highest-blast-radius item in the plan. Do it last, in its own branch, with a full test run after each file extraction. The `conftest.py` `live_server` fixture imports from `agentsuitelocal.api.main` — update it if the import path changes.

---

### A-2 — CORS tightening

**What:** `app.add_middleware(CORSMiddleware, allow_origins=["*"])` in dev mode allows any browser tab on the machine to hit destructive endpoints.

**Where:** `agentsuitelocal/api/main.py:45–51`

**How:** Current code already has this fixed (`allow_origins=["http://localhost:5173", "http://localhost:8765"]`). Verify this is correct and document it in CONTRIBUTING.md. Add a comment explaining why `*` is not used.

**Note:** The deep review noted CORS is `["*"]` but the current `main.py` already shows the restricted list. This may have been fixed in a prior sprint. Verify and close.

---

### A-3 — Launcher port negotiation hardening

**What:** The backend port is communicated via `~/.agentsuitelocal/launcher.log` plain integer. Race condition: frontend can read before file is written.

**Where:** `launcher.py` (port write) + `main.py` `/api/launcher/port` endpoint

**How:** Replace `launcher.log` with a JSON lock file:
```json
{
  "pid": 12345,
  "port": 8765,
  "started_at": "2026-05-03T12:00:00Z",
  "version": "0.7.0"
}
```

This lets the frontend detect stale launchers (pid no longer running) and avoids the plain integer parse.

---

### A-4 — In-memory state durability (SQLite)

**What:** Crash during a run loses all in-flight events. JSON sidecar write is not atomic (read-modify-write under the lock).

**How:** Replace `runs.json` / `pipelines.json` with SQLite via `aiosqlite`. Two tables: `runs` (JSON blob per row) and `pipelines`. Atomic writes via SQLite transactions. The `_state_write_lock` becomes a no-op since SQLite serializes writes.

**Scope:** High effort (~300 lines of new code). Target for v0.8.0.

---

### A-5 — ErrorBoundary in React

**What:** No React `ErrorBoundary` — any unhandled exception in a view unmounts the entire UI to a blank screen.

**Where:** `web/src/App.jsx`

**How:** Create `web/src/components/app/ErrorBoundary.jsx`:
```jsx
import React from "react";

export class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("UI Error:", err, info); }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "var(--bad)", fontWeight: 600 }}>Something went wrong.</p>
        <button className="btn btn-sm" onClick={() => this.setState({ error: null })}>Retry</button>
      </div>
    );
    return this.props.children;
  }
}
```

Wrap `appScene()` return in `App.jsx`:
```jsx
<ErrorBoundary>
  {appScene()}
</ErrorBoundary>
```

---

### A-6 — waitingCount via SSE not polling

**What:** `App.jsx` polls `/api/runs` every 10 seconds to count waiting runs for the sidebar badge. Creates continuous HTTP traffic even when idle.

**Where:** `web/src/App.jsx:77–87`

**How:** Wire `waitingCount` off the existing SSE stream. When a `run_status_changed` or similar event arrives with `status: "waiting"`, increment. When `approve` / `reject` events arrive, decrement. Remove the `setInterval` entirely.

**Effort:** Medium. Depends on what SSE event types the backend emits for status changes. May require a new `status_summary` SSE event from the backend.

---

### A-7 — Optimistic UI for approve/reject

**What:** Clicking "Approve" has no loading state, no error recovery if the POST fails.

**Where:** `web/src/components/app/ApprovalGateView.jsx`

**How:**
```jsx
const [approving, setApproving] = useState(false);
const [approveError, setApproveError] = useState(null);

const handleApprove = async () => {
  setApproving(true);
  setApproveError(null);
  try {
    const r = await fetch(`/api/run/${runId}/approve`, { method: "POST" });
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    onApprove();
  } catch (err) {
    setApproveError(err.message);
    setApproving(false);
  }
};

// In render:
<button className="btn btn-accent" disabled={approving} onClick={handleApprove}>
  {approving ? "Approving…" : "Approve"}
</button>
{approveError && <div style={{ color: "var(--bad)", fontSize: 12 }}>{approveError}</div>}
```

Apply same pattern to Reject.

---

### A-8 — POST /api/settings sentinel handling

**What:** `GET /api/settings` redacts the API key as `"***"`. If a client reads settings, changes an unrelated field, and re-POSTs, the `"***"` sentinel would overwrite the real key.

**Where:** `agentsuitelocal/api/main.py` — `apply_settings` or `update_settings` endpoint

**How:** In the settings write path, check for the sentinel:
```python
if patch.get("api_key") == "***":
    patch.pop("api_key")  # Ignore sentinel — don't overwrite the real key
```

**Verify:** `GET /api/settings` → copy response → change `model_tier` → `POST /api/settings` with that body (including `"***"`) → `GET /api/settings` → API key should still work.

---

## Phase 5 — Security hardening

---

### S-1 — open-folder injection risk

**What:** The `open-folder` endpoint constructs a path from a run ID. If the format parameter is user-supplied and interpolated into a shell string, that's command injection.

**Where:** `agentsuitelocal/api/main.py` — `/api/run/{run_id}/open-folder` or similar

**How:**
1. Confirm `run_id` is validated as a UUID (or slug matching `^[a-z0-9-]+$`) at the Pydantic level
2. Never use `shell=True` in subprocess calls with user-derived data
3. Validate the `format` parameter against an explicit whitelist: `{"zip", "markdown", "pdf"}`

**Verify:** `curl -X POST "http://localhost:8765/api/run/../../etc/passwd/open-folder"` → must return 422 or 404, not a directory traversal.

---

### S-2 — API key storage (plain JSON → OS keychain)

**What:** The cloud API key is stored in `~/.agentsuitelocal/settings.json` in plain text.

**How:**
- Windows: Use `keyring` library (cross-platform) with the Windows Credential Manager backend
- macOS: `keyring` uses Keychain automatically
- Linux: `keyring` uses Secret Service (gnome-keyring / kwallet)

```python
import keyring

SERVICE_NAME = "agentsuitelocal"

def _save_api_key(key: str) -> None:
    keyring.set_password(SERVICE_NAME, "api_key", key)
    
def _load_api_key() -> str | None:
    return keyring.get_password(SERVICE_NAME, "api_key")
```

Remove `api_key` from `settings.json` entirely. Store only in OS keychain.

Add `keyring>=25.0` to `pyproject.toml`.

**Effort:** Medium. Tests need to mock `keyring`. On CI, use `keyring.set_keyring(keyring.backends.null.Keyring())` to avoid platform-specific setup.

---

### S-3 — Telemetry disclosure

**What:** Local telemetry stores usage events but no in-app disclosure or opt-out control.

**How:**
1. Settings screen already has a "Telemetry" toggle — verify it's wired to `_load_settings().get("telemetry")`
2. Add a one-sentence explanation: "Counts run starts, model used, and QA pass/fail. Stored locally only. Never transmitted."
3. Add to README: "All usage data stays on your machine (`~/.agentsuitelocal/usage.jsonl`). You can opt out in Settings."

---

## Phase 6 — UX improvements

---

### UX-1 — Compress installer to 5 screens

**What:** 11 screens is too many for non-technical users. Hardware check, Python env, agent selection can move to Settings or be automated.

**Target flow:**
1. Welcome
2. License
3. Hardware auto-detect + Tier auto-select (show recommendation, allow override)
4. Ollama install + model download (combined screen with progress)
5. Done (smoke test runs in background; success shows on the Done screen)

Move agent selection to the Settings screen (Settings → Agents). Remove the separate Python env screen (autodetected, show in hardware step). Remove the API key screen from installer (it's optional; add it to Settings).

**Effort:** High. Touches App.jsx routing, 6 screen components, and the backend `/api/install/*` endpoints.

---

### UX-2 — Tier consequence copy

**What:** ScreenTier shows RAM labels but no plain-English explanation of output quality difference.

**Where:** `web/src/components/installer/ScreenTier.jsx`

**How:** For each tier card, add a consequence sentence below the RAM label:
- Light: "Shorter, simpler output. Best for quick drafts."
- Balanced: "Full-length artifacts across all 7 agents. Recommended."
- Pro: "Highest fidelity output. Takes 2–3× longer per run."

---

### UX-3 — RunsView sort: waiting first

**What:** RunsView is chronological. "Waiting for your review" runs should be at the top.

**Where:** `web/src/components/app/RunsView.jsx`

**How:**
```js
const sorted = [...runs].sort((a, b) => {
  if (a.status === "waiting" && b.status !== "waiting") return -1;
  if (b.status === "waiting" && a.status !== "waiting") return 1;
  return b.started_at - a.started_at;
});
```

Also replace enum strings with plain-English labels:
```js
const STATUS_LABELS = {
  waiting: "Waiting for your review",
  approved: "Approved",
  rejected: "Rejected",
  running: "Running",
  error: "Error",
  done: "Done",
};
```

---

### UX-4 — KernelView artifact preview

**What:** No way to preview kernel artifacts without opening the file externally.

**How:** Add an inline markdown preview panel to `KernelView`. When the user clicks an artifact name, open a slide-in panel with the file content rendered as markdown (use `react-markdown` or a simple `<pre>` fallback).

---

### UX-5 — No loading/skeleton states

**What:** Views show blank panels while fetching. React Suspense or manual skeleton states would improve perceived performance.

**How:** Add a `<SkeletonCard />` component:
```jsx
const SkeletonCard = ({ lines = 3 }) => (
  <div className="card" style={{ padding: 16 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="shimmer" style={{ height: 14, borderRadius: 4, marginBottom: 8, width: `${80 - i * 15}%` }} />
    ))}
  </div>
);
```

Use in `ProjectsView`, `RunsView`, `KernelView` while `loading === true`.

---

## Phase 7 — Distribution & CI hardening

---

### D-1 — macOS CI runner

**What:** No macOS CI job — the macOS build is untested.

**Where:** `.github/workflows/` CI config

**How:** Add a `build-macos` job that runs on `ubuntu-latest` for tests but `macos-latest` for the PyInstaller build:
```yaml
build-macos:
  runs-on: macos-latest
  if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
  steps:
    - uses: actions/checkout@v4
    - run: pip install pyinstaller .
    - run: cd web && npm ci && npm run build
    - run: pyinstaller AgentSuiteLocal.spec
    - run: ls dist/AgentSuiteLocal.app
```

---

### D-2 — AV false positive guidance

**What:** README should mention that some AV tools flag PyInstaller onedir bundles and how to add an exclusion.

**Where:** `README.md` — add a "Troubleshooting" section

**How:** Add:
```markdown
### Antivirus flagging the installer

Some antivirus tools flag PyInstaller-bundled executables as suspicious. This is a false positive.  
To add an exclusion in Windows Security: Settings → Virus & threat protection → Manage settings → Add or remove exclusions → Add the `AgentSuiteLocal` install folder.
```

---

### D-3 — CI sleep → health-check for Ollama

**What:** `.github/workflows/ci.yml` uses `sleep 3` after `ollama serve &`. If the runner is slow, the pull step fails.

**How:**
```bash
ollama serve &
for i in $(seq 1 30); do
  curl -s http://localhost:11434/api/tags >/dev/null 2>&1 && break
  sleep 0.5
done
```

---

### D-4 — Coverage threshold enforcement

**What:** `pytest-cov` is in dev deps but no threshold is enforced. Coverage can silently drop.

**Where:** `pyproject.toml`

**How:**
```toml
[tool.pytest.ini_options]
addopts = "--cov=agentsuitelocal --cov-report=term-missing --cov-fail-under=70"
```

Start at 70% (current approximate level). Raise by 5% each sprint.

---

## Execution order summary

| Phase | Items | Effort | Prerequisites |
|---|---|---|---|
| Phase 1 | B-1, C-1, C-2, C-3, M-1 through M-9 | 1–2 days | None |
| Phase 2 | m-1 through m-7 (minor + tests) | 1 day | Phase 1 green |
| Phase 3 | N-1 through N-4 (nits) | 2 hours | Phase 2 green |
| Phase 4 | A-1 through A-8 (architecture) | 3–5 days | Phase 3 committed |
| Phase 5 | S-1 through S-3 (security) | 1–2 days | Phase 4 complete |
| Phase 6 | UX-1 through UX-5 (UX improvements) | 3–5 days | Phase 4 stable |
| Phase 7 | D-1 through D-4 (distribution/CI) | 1 day | Any phase |

---

## What NOT to do (process rules)

Derived from the session post-mortem:

1. **Never declare a feature done until every button in that feature is clicked in a live browser.** Tests passing ≠ feature works.

2. **After writing any mock that stubs fetch(), immediately grep main.py for the mocked URL** and confirm the endpoint exists, the HTTP method matches, and the response shape matches.

3. **Any time two files refer to a field name or constant string, add a cross-reference check step** to the implementation: read both files side-by-side before closing the item.

4. **Every new endpoint needs a response-shape test** that asserts the specific field names the frontend reads. This is the contract test that prevents C-2-class bugs.

5. **Do not expand scope during a Phase.** If you notice a bug while working on a different item, add it to the plan as a new item — don't fix it inline without documenting it.

---

## Current baseline state

| Item | Value |
|---|---|
| Branch | `main`, clean, commit `171e8ff` |
| Backend tests | 92 (excl. e2e/live) passing |
| Frontend tests | 74 passing |
| Stash | 1 stash (partial C-3 + B-1 work) — pop and use or drop |
| Stash contents | `_TIER_MODEL_MAP` keys fixed + 3 project endpoints added |
