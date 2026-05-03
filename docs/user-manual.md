# User Manual — AgentSuiteLocal v0.7.0

AgentSuiteLocal runs seven specialist AI agents on your machine. Each agent takes a one-sentence business goal, walks a five-stage pipeline, and writes a folder of structured markdown artifacts to your disk. You review them, approve what's good, and the approved output feeds every future run on that project.

That's the whole loop. Everything in this app is a UI on top of it. All processing happens locally — nothing leaves your machine unless you explicitly configure a cloud API key.

---

## 1. Installation walkthrough

The installer runs once. It walks 11 short steps. After setup completes, the installer does not appear again unless you reinstall.

| Step | Screen | What happens |
|------|--------|--------------|
| 1 | Welcome | Intro screen. Click **Get started**. |
| 2 | License & privacy | Read the license. Check the box. Click **I agree**. |
| 3 | Checking your hardware | The app probes your CPU, RAM, and disk. A green check means you're good. An amber warning means reduced performance — the app will still work. A red cross on RAM means the model will be slow; consider lowering the model tier. |
| 4 | Pick a model | Choose a model tier based on your hardware. Balanced (16 GB RAM, gemma4:e4b) works for most people. Fast (8 GB RAM, gemma2:2b) works on budget hardware. Powerful (32+ GB RAM, llama3.1:8b) produces the best output but is slow on most machines. |
| 5 | Ollama runtime | The app detects whether Ollama is installed and running. If Ollama is not found: on Windows, click **Install Ollama** to download and install it automatically. On macOS, run `brew install ollama` in Terminal, then `ollama serve`, then click **Retry detection**. |
| 6 | Downloading model | Pulls the selected model from Ollama's registry. Takes 2–10 minutes on a typical connection. A progress bar shows download speed and estimated time. If the download fails, the screen offers a **Try again** button (up to 3 attempts). |
| 7 | Setting up the runtime | Verifies the Python runtime and all libraries are intact. Usually instant. |
| 8 | Pick your agents | All seven agents are enabled by default. Disable any you don't plan to use to reduce startup time. |
| 9 | Cloud fallback (optional) | Paste an Anthropic API key if you want to use Claude models. This is optional — the app runs fully locally without it. |
| 10 | First-run smoke test | Runs four sequential checks: Ollama reachable, model loaded, API health, test inference. Each shows a green tick or a red cross with a specific fix. If all four pass, click **Continue**. If one fails, follow the inline fix and retry. If you need to skip, click **Skip smoke test** and confirm — this bypasses the check and the app may not work. |
| 11 | You're set up | Click **Launch AgentSuiteLocal** to open the main app. |

---

## 2. First run — from Dashboard to approved artifact

**Step 1: Open the app.** You'll see the Dashboard with an engine status card and a "Start a new run" prompt.

**Step 2: Click New run** (or click an agent card in the Agents view). The New Run screen appears.

**Step 3: Fill in three fields:**
- **Business goal** — one sentence. "Launch X for Y in Z" works well. The sharper this is, the better every artifact will be.
- **Project slug** — a short identifier like `my-product-v2`. All runs for the same product should share a slug. Approved artifacts are grouped by this slug in the kernel.
- **Inputs folder** — optional. Drop your existing notes, brand docs, or research into a folder and point the app at it. The Extract stage pulls structured facts from these files.

**Step 4: Click Start run.** The New Run screen transitions to the Live Run view.

**Step 5: Wait.** The pipeline runs five stages. Each lights up when it starts and shows a checkmark when complete. The whole pipeline takes 9–16 minutes on typical hardware.

**Step 6: Review.** When QA completes, the Approval Gate opens automatically.

**Step 7: Read the artifacts.** The file tree on the left lists every artifact the agent produced. Click any file to read it in the center panel. The right panel shows QA scores across nine dimensions.

**Step 8: Approve or reject.** If the QA score is 7.0 or above, the **Approve & promote** button is enabled. Click it to copy every artifact to your kernel. If the score is below 7.0, or if the content is wrong, click **Reject** and run again with a sharper goal.

---

## 3. Agent reference

### Founder
- **What it produces:** brand system, positioning statement, voice guidelines, competitor positioning, tone dictionary, messaging hierarchy
- **What to write in the goal field:** "Launch [your product name], a [category] for [target audience], positioned on [key differentiator]"
- **What you'll get back:** 26 artifacts — brand tone dictionary, positioning statement, voice guidelines, competitor analysis, messaging hierarchy
- **Typical runtime:** 14 minutes on balanced tier
- **Run this first.** The Founder agent's output becomes the kernel context that Design, Marketing, and other agents inherit.

### Design
- **What it produces:** design briefs, visual language spec, brand QA checklist, icon direction, design principles
- **Goal field tip:** "Design identity for [product name], expressed as [aesthetic direction]"
- **Typical runtime:** 9 minutes
- **Prerequisite:** Founder kernel recommended

### Product
- **What it produces:** UI/UX spec, feature specs, user stories, handoff doc, acceptance criteria
- **Goal field tip:** "Define the MVP feature set for [product name] targeting [user type]"
- **Typical runtime:** 12 minutes
- **Prerequisite:** Founder kernel recommended

### Engineering
- **What it produces:** ADRs (Architecture Decision Records), system design, API specs, runbooks, infrastructure checklist
- **Goal field tip:** "Design the backend architecture for [product name], a [type] app serving [scale]"
- **Typical runtime:** 16 minutes
- **Prerequisite:** Product kernel recommended

### Marketing
- **What it produces:** launch plan, campaign briefs, messaging matrix, social content plan, email sequences, press release
- **Goal field tip:** "Plan the launch campaign for [product name], targeting [channel] with [offer type]"
- **Typical runtime:** 11 minutes
- **Prerequisite:** Founder kernel recommended

### Trust / Risk
- **What it produces:** threat model, controls register, compliance checklist, incident response plan, risk register
- **Goal field tip:** "Assess the security and compliance risk profile for [product name], a [description]"
- **Typical runtime:** 13 minutes

### CIO
- **What it produces:** IT strategy, technology roadmap, vendor evaluation matrix, IT architecture brief
- **Goal field tip:** "Build the IT strategy for [company type] adopting [technology]"
- **Typical runtime:** 14 minutes

---

## 4. The live view — understanding what you're seeing

### Stage indicators
Each of the five stages has a row in the left panel:
- **Gray dot:** waiting
- **Pulsing dot:** running now
- **Green checkmark:** complete
- **Red cross:** failed — check the error message below

### Stage elapsed time
Next to the current stage you'll see a timer: "Stage: Extraction · 1m 24s". This resets when each stage starts. If a stage has been running longer than 10 minutes without completing, the model may be stuck — check Ollama status in Settings.

### Total elapsed time
The top bar shows "Total: 4m 12s" — the time since the run started.

### QA scores
After the QA stage, nine dimensions appear in the right panel:
- **Clarity** — how readable the artifacts are
- **Completeness** — whether all required sections are present
- **Coherence** — whether the artifacts are internally consistent
- **Specificity** — how concrete and actionable the content is
- **Brand alignment** — whether the output matches your stated positioning
- **Feasibility** — whether the artifacts are realistic to implement
- **Differentiation** — whether the output takes a distinct point of view
- **Depth** — whether it goes beyond surface-level analysis
- **Actionability** — whether there are clear next steps

Each dimension scores 0–10. The composite score is a weighted average. The default approval threshold is 7.0 (configurable in Settings).

If the model returned fewer than the expected 9 dimensions, you'll see an amber notice: "Partial QA scores — the model returned N of 9 dimensions." This is common with smaller models and doesn't mean the output is wrong — it means the QA rubric response was truncated.

---

## 5. The kernel — what it is and how to use it

The kernel is the canonical store of approved artifacts. Every run loads the kernel for its project as context before starting.

**Location on disk:** `~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/{YYYY-MM-DD-HHMMSS}/`

**When you approve a run,** all its artifacts are copied to the kernel with a timestamped folder. Subsequent runs on the same project see this content as prior context.

**The Kernel view** lists all approved exports grouped by project, then agent, then reverse-chronological. Each entry shows: agent name, project, timestamp, artifact count, total size, and an **Open folder** button.

**Comparing versions:** If a project/agent combination has more than one approved export, a **Compare** button appears. It opens a side-by-side diff: left = selected version, right = latest. A file selector lets you pick which artifact to diff. Added lines are green, removed lines are red.

**Exporting:** In the Approval Gate and Run Detail views, an **Export** dropdown offers:
- **ZIP — all artifacts** — downloads a zip of the entire run output folder
- **Markdown bundle** — concatenates all artifacts into a single `.md` file with `---` separators
- **PDF** — renders the markdown bundle as a PDF

---

## 6. Pipelines

Pipelines chain multiple agents end-to-end. The output of each agent is passed as context to the next.

**Creating a pipeline:** In the Pipelines view, select the agents you want to chain and set the order. Typically: Founder → Design → Product → Engineering.

**Running a pipeline:** Each step requires an approval before the next agent starts (unless you enable Auto-approve in Settings). When a step reaches the Approval Gate, approve it to advance the pipeline.

**Resuming after error:** If a pipeline step fails, it enters an error state. In the Pipelines view, click **Resume from step N** to restart from the failed step without re-running earlier steps.

---

## 7. Model management

Open **Settings → Model Management** (or click **Models** in the sidebar) to manage your local models.

**Installed models:** Lists all models Ollama has pulled, with size, last-used date, and two buttons:
- **Set as active** — makes this model the one used for all future runs
- **Delete** — removes the model from disk (requires confirmation)

**Recommended models:** A curated list of five models with tier, disk size, and RAM requirement. Click **Pull** next to any model to download it. A progress bar shows live download progress.

**Active model indicator:** Shows which model is currently configured in Settings.

**Tier mapping:**
| Tier | Model | Disk | Min RAM |
|------|-------|------|---------|
| Fast | gemma2:2b | 1.7 GB | 8 GB |
| Balanced | gemma4:e4b | 4.1 GB | 16 GB |
| Powerful | llama3.1:8b | 4.7 GB | 24 GB |

---

## 8. Settings reference

### Run configuration
| Setting | Default | Description |
|---------|---------|-------------|
| Model tier | balanced | Which tier to use for all runs |
| Run timeout | 15 min | Max time before a run is killed with an error |
| Auto-approve | off | Skip the Approval Gate and promote artifacts automatically |
| QA gate threshold | 7.0 | Minimum composite QA score to enable the Approve button |
| Workspace path | ~/AgentSuite | Where runs and the kernel are stored |

### Cloud fallback
When an Anthropic API key is present, a model dropdown appears with three options: Claude 3.5 Haiku, Claude 3.5 Sonnet, and Claude Opus 4. Selecting a cloud model routes all future runs through the Anthropic API. A permanent warning reads: "Cloud runs send your goal and context to Anthropic's servers and incur API costs. Local runs are always free."

### Notifications
When enabled, AgentSuiteLocal sends a desktop notification when a run reaches a terminal state (waiting, approved, rejected, error, cancelled, timed out). The notification body is "{Agent} run on {project} is {status}." Notifications respect your OS Do Not Disturb setting.

### Telemetry
When enabled, app events (run started, run completed, run errored, approve, reject) are written to `~/.agentsuitelocal/usage.jsonl` as newline-delimited JSON. No personally identifiable information. No network calls. The file stays on your machine.

### Uninstall
Settings → Danger zone → **Uninstall AgentSuiteLocal** opens a three-phase flow:
1. Shows your workspace size and asks whether to delete all run data
2. Asks whether to delete the Ollama model
3. Calls the system uninstaller (Windows) to remove Start Menu entries and Add/Remove Programs registration

---

## 9. Troubleshooting

**The installer is stuck on "Ollama runtime" and Continue never lights up.**
The AI engine isn't running. Look for an Ollama icon in your system tray (Windows) or menu bar (macOS) — it looks like a small llama head. If you don't see it, open the Ollama app you installed. Once the icon appears, the installer should unlock within a few seconds. If you haven't installed Ollama, go to [ollama.com/download](https://ollama.com/download).

**Model download fails after 3 attempts.**
Check your internet connection. Ollama pulls from Ollama's servers — if those are unreachable, the download will fail. Try again when connectivity is restored. If the download partially completes but shows "Model download appears incomplete", click the one-click re-pull button.

**A run starts but immediately shows an error.**
The most common cause is Ollama not running. Check the engine status card on the Dashboard — it shows "Not running" if Ollama has stopped. Click the restart button or manually run `ollama serve` in a terminal.

**Run shows "Timed out after 15 minutes".**
The model stopped responding. This can happen with very large inputs or on low-memory machines. Options: (a) increase the run timeout in Settings, (b) switch to a lighter model tier, (c) reduce the size of your inputs folder.

**The run finished but QA score is below 7.0.**
This usually means the goal was too vague. Try: (a) adding more specific context to the goal, (b) adding an inputs folder with real brand/product notes, (c) switching to a higher model tier. A score of 6.5+ from a small model often improves to 8.0+ on a balanced model with the same goal.

**Approve button is grayed out despite a score above 7.0.**
Check the QA gate threshold in Settings — it may have been raised above the current score. You can also click **Override & approve** (amber button) to bypass the threshold with a confirmation dialog.

**QA dimensions show "partial QA scores" notice.**
The model returned fewer than 9 dimensions. This is a known limitation of smaller models — they sometimes truncate the QA rubric response. The scores shown are still valid; the composite is calculated from what was returned. For full 9-dimension scores, switch to a balanced or powerful tier.

**The artifacts look cut off or much shorter than expected.**
Usually caused by the Fast tier model running out of context window. Switch to Balanced or Powerful in Settings and run again.

**I see "Connection lost — reconnecting" in the live view.**
The browser lost its SSE connection to the backend. The app will automatically reconnect and resume streaming where it left off (up to 10 attempts with exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s). If reconnection fails, the run is still executing in the background — navigate to Runs to check its status.

**Kernel files are not showing up in the Kernel view.**
A run must be approved before its artifacts appear in the Kernel. Check the Runs view — if the run shows status "approved", the artifacts should be present. If the kernel is empty after approval, check the workspace path in Settings.

**Retry button doesn't pre-fill the goal field.**
Make sure the run had a goal saved. Runs started before v0.7.0 may not have a `goal` field in their record. In that case, fill in the goal manually when retrying.

**Desktop notifications are not appearing.**
On Windows, check that notifications are enabled for AgentSuiteLocal in Windows Settings → System → Notifications. On macOS, check System Settings → Notifications → AgentSuiteLocal. Also verify the "Desktop notifications" toggle is on in AgentSuiteLocal Settings.

**The app opens to the installer on every launch.**
The installer completion state is stored in `~/.agentsuitelocal/installer.json`. If this file is missing or malformed, the app will re-run the installer. To fix: open the Settings view, which will create the file if missing, or run the smoke test from the installer through to completion.

**Build fails with PyInstaller errors.**
Ensure you have run `npm run build` in the `web/` directory first so `web/dist/` exists before running PyInstaller. PyInstaller bundles the pre-built frontend — it does not run the build itself.

**`make build-installer` says "iscc not found".**
Inno Setup is not on your PATH. Install Inno Setup 6 from [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php) and add it to your PATH, or run `choco install innosetup` with Chocolatey.

**`pytest` fails with import errors on a clean clone.**
Run `pip install -e ".[dev]"` from the repo root to install the package in editable mode with all dev dependencies.

**Vite build fails with "top-level await" error.**
This means a dependency is using dynamic `await import()` at module scope. Check that `ApprovalGateView.jsx` uses static imports for `react-markdown` and `remark-gfm` (not dynamic `await import()`). See the note in `docs/architecture.md` under "Static vs dynamic imports".

---

## 10. FAQ

**Q: Does any data leave my machine?**  
A: No. All processing uses your local Ollama model. The only outbound calls are: (a) an optional GitHub API request to check for app updates (no payload, just version comparison), and (b) cloud API calls if you configure an API key and select a cloud model. Telemetry, if enabled, writes only to a local JSONL file.

**Q: What happens to my data if I uninstall?**  
A: The uninstaller asks before deleting anything. You can choose to keep your run history and kernel files — they stay in `~/AgentSuite/` and `~/.agentsuitelocal/` unless you explicitly check "Delete all runs, pipelines, and kernel files" during uninstall.

**Q: Can I use a different Ollama model not on the recommended list?**  
A: Yes. Pull it manually with `ollama pull model-name` in a terminal, then open Settings → Model Management and click **Set as active** next to it. Any model in your Ollama library works.

**Q: How do I back up my kernel?**  
A: Copy the `~/AgentSuite/.agentsuite/_kernel/` folder to a safe location. It's plain markdown files — no database, no binary format.

**Q: Can I run multiple agents in parallel?**  
A: Not yet. Agents run sequentially. A pipeline queues them one at a time with approval gates between steps.

**Q: The output quality isn't what I expected. What should I try first?**  
A: In order: (1) sharpen the goal — specific goals produce better output, (2) add an inputs folder with real context, (3) switch to a higher model tier. The difference between a vague goal on the Fast tier and a specific goal on the Balanced tier is substantial.

**Q: What's in the QA score?**  
A: Nine dimensions scored 0–10 by the model itself, after the main pipeline completes. The model applies a rubric and scores each dimension. The composite is a weighted average. Scores above 8.0 are consistently good. 7.0–8.0 is serviceable. Below 7.0 usually signals that the output missed something important.

**Q: Can I edit artifacts before approving?**  
A: Not through the UI in v0.7.0. The artifacts are plain markdown files — open them in any text editor from your file manager, edit them, save, then approve from the Approval Gate. The app reads the files from disk on approval.

**Q: How do I update AgentSuiteLocal?**  
A: When a new version is available, a non-blocking banner appears at the top of the Dashboard: "vX.Y.Z is available — [Download] [Dismiss]". Click Download to open the GitHub releases page in your browser. Download the new installer and run it — it replaces the existing installation.

**Q: Why does the smoke test fail on "API health endpoint"?**  
A: The backend failed to start. On Windows, this is sometimes caused by a port conflict — another process is using port 8765. Check Task Manager and kill any conflicting process, then restart the app. You can also check `~/.agentsuitelocal/launcher.log` for the actual port the backend bound to.

**Q: Can I run AgentSuiteLocal on a server?**  
A: It's designed for desktop use — it needs a running Ollama daemon and opens a browser window. You could run it headless and connect remotely, but that's not a supported configuration.

**Q: How much disk space does it need?**  
A: The installed app is ~300 MB. The models are 1.7–4.7 GB depending on tier. Each run produces ~2–5 MB of artifacts. A full kernel for one project across all seven agents is typically 15–30 MB.

**Q: What Python version does it require?**  
A: Python 3.11 or 3.12. The bundled executable ships its own Python runtime, so you don't need Python installed to run the distributed build. You only need Python for development.

**Q: What's the difference between "Reject" and starting a new run?**  
A: Reject marks the existing run as rejected and preserves its artifacts. Starting a new run creates a new run record. Both leave the previous run's files on disk. Use Reject if you want to keep a clear record of what you tried; use a new run for a completely different approach.

**Q: Does the Retry button carry over my inputs folder?**  
A: Yes. Clicking Retry in the Runs view pre-populates the New Run screen with the same agent, goal, project, and inputs folder from the original run. You can edit any field before launching.

**Q: Is there a CLI?**  
A: Yes — `agentsuitelocal` is installed as a command when you `pip install -e .`. But the CLI is the AgentSuite library's CLI, not the desktop app. For the full experience including the UI, run the desktop app.

**Q: How do I contribute?**  
A: Read CONTRIBUTING.md. The short version: fork the repo, make changes on a feature branch, run `pytest` and `npm run test`, then open a PR.

**Q: Where are the crash reports stored?**  
A: `~/.agentsuitelocal/crash-reports/{timestamp}.json`. Each file contains: exception type, message, stack trace, app version, Python version, OS version, and the request path that triggered it. No request body or user data is included.

**Q: What does the "Stage decisions so far" panel show?**  
A: This is the K1 cross-stage context feature. After each stage completes, the app summarizes the first 500 words of the primary artifact and displays it in a collapsible panel. This is what the next stage sees as prior context — useful for understanding why later stages made particular choices.
