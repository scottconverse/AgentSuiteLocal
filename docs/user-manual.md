# User Manual

AgentSuiteLocal runs seven specialist AI agents on your machine. Each agent takes a one-sentence business goal, walks a five-stage pipeline, and writes a folder of structured markdown artifacts to your disk. You review them, approve what's good, and the approved output feeds every future run on that project.

That's the whole loop. Everything in this app is a UI on top of it.

---

## First launch — the installer

The installer runs once. It walks 11 short steps.

| Step | Screen | What happens |
|------|--------|--------------|
| 1 | Welcome | Intro screen. Click **Get started**. |
| 2 | License & privacy | Read the license. Check the box. Click **I agree**. |
| 3 | Checking your hardware | The app probes your CPU, RAM, and disk. Wait for the results. |
| 4 | Pick a model | Choose a model tier based on your hardware. Balanced (16 GB RAM, gemma4:e4b) works for most people. |
| 5 | Ollama runtime | Confirms Ollama is running and the model is available. If this step hangs, open a terminal and run `ollama serve`. |
| 6 | Downloading model | Pulls the model if it's not already local. Takes a few minutes depending on connection speed. |
| 7 | Setting up the runtime | Confirms Python environment. |
| 8 | Pick your agents | Select which agents to enable. All seven are on by default. |
| 9 | Cloud fallback (optional) | Paste an Anthropic API key if you want cloud fallback for difficult prompts. This is optional — the app runs fully local without it. |
| 10 | First-run smoke test | Runs a quick end-to-end check against your local model. |
| 11 | You're set up | Click **Launch AgentSuiteLocal** to open the main app. |

After launch, the installer doesn't appear again unless you reinstall.

---

## Main app — screen by screen

### Dashboard

The default view. Shows:

- **Pending approval** — any run that's finished and is waiting for your review. This is the thing you should look at first when you open the app.
- **Recent runs** — the last few runs across all projects, with status and QA score.
- **Projects** — a summary of your workspaces.
- **Engine status** — which model is loaded and its current speed.

If there's a run waiting on approval, there's a "Review run" button at the top of the hero card. Click it to go straight to the Approval Gate.

---

### Agents

The seven specialist agents:

| Agent | What it writes | Artifacts | ~Time |
|-------|---------------|-----------|-------|
| **Founder** | Brand system, voice, positioning | 26 | 14 min |
| **Design** | Design briefs, brand QA | 18 | 9 min |
| **Product** | UI specs, handoff docs | 17 | 12 min |
| **Engineering** | ADRs, system design, runbooks | 17 | 16 min |
| **Marketing** | Campaign briefs, launch plans | 18 | 11 min |
| **Trust / Risk** | Threat models, controls, compliance | 17 | 13 min |
| **CIO** | IT strategy, roadmap | 17 | 14 min |

Click an agent card to start a new run with that agent.

The **Founder** agent is typically the one to run first. Its output (brand system, positioning, voice) becomes the kernel context that other agents inherit.

---

### New Run

Fill in three fields:

- **Business goal** — one sentence. "Launch X for Y in Z" works well. The agent writes everything else from this.
- **Project slug** — a short identifier like `my-product-v2`. All runs for the same product should share a slug. Approved artifacts are stored under this slug in the kernel.
- **Inputs folder** — a folder of notes, brand documents, or markdown files you want the agent to learn from. Leave blank if you don't have any.

Click **Start run**. The view switches to the Live Run screen automatically.

---

### Live Run

Watches the pipeline in real time. Five stages:

| Stage | What it does |
|-------|-------------|
| **Intake** | Validates the request, manifests inputs |
| **Extract** | Pulls structured context from your inputs folder |
| **Spec** | Generates the core artifact library (~10 files) |
| **Execute** | Builds brief templates and the export manifest |
| **QA** | Runs a 9-dimension rubric and produces a score |

Each stage lights up as it completes. Token output streams into a log panel on the right.

The run can take 9–16 minutes depending on your hardware and model tier. Don't close the window — the pipeline runs in the background even if you navigate away, but live streaming requires the window to be open.

When the pipeline finishes, the view automatically transitions to the Approval Gate.

---

### Approval Gate

Three-pane view:

- **Left — File tree.** All artifacts from the run. Click any file to preview it.
- **Center — Artifact preview.** Markdown rendered inline. Scroll and read.
- **Right — QA scores.** Nine dimensions scored 0–10. The composite score must exceed 7.0 to unlock Approve.

**Approve & promote** — copies every artifact to `~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/`. This becomes canonical context for every future run on this project.

**Reject** — marks the run rejected. Artifacts stay on disk under `runs/` but are not promoted. Run again with a better goal if the output isn't right.

The sidebar is hidden while the Approval Gate is open. Click **Dashboard** after approving or rejecting to return.

---

### Runs

Full run history — every run across all projects, sorted newest first. Shows status, QA score, duration, and which agent ran it. Click a run to open its artifact tree.

---

### Kernel

All approved artifacts, organized by project and agent. These are the files that feed every future run as canonical context. If a run produces output that contradicts your kernel, the kernel wins.

Use the Kernel view to audit what's been approved. You can't delete from the Kernel through the UI in v0.1 — use your file manager (`~/AgentSuite/.agentsuite/_kernel/`).

---

### Pipelines

Chain agents end-to-end. The Founder agent's output feeds the Design agent, which feeds the Product agent, and so on. Useful for a full launch sequence where you want every agent to run in order without manual intervention between steps.

This view is a preview in v0.1 — the chain builder UI is functional but saving and re-running chains requires the CLI.

---

### Settings

- **Model** — switch between Light / Balanced / Pro tiers (requires Ollama to have the model pulled).
- **Agents** — enable or disable individual agents.
- **Auto-approve** — skip the Approval Gate and promote artifacts automatically. Useful for exploration; turn it off for anything you'll act on.
- **Workspace path** — where runs and the kernel are stored. Defaults to `~/AgentSuite/`.
- **Cloud fallback** — add or update your Anthropic API key for difficult prompts.

---

### Manual

The in-app version of this document. Always accessible from the sidebar.

---

## The kernel — what it is and why it matters

The kernel is a versioned folder of approved artifacts. Every run loads the kernel for its project as context before starting. This means:

- The second Founder run knows what the first one decided.
- The Design agent inherits the brand system the Founder wrote.
- The Engineering agent knows the product the Product agent specced.

Without the kernel, each run starts from scratch. With the kernel, each run builds on approved prior work.

**Practical advice:** run Founder first, review carefully, approve the best outputs. Then run Design. Then Product. Build the kernel deliberately — it's the durable output of the system.

---

## Tips

**Goal quality matters more than anything else.** "Launch my app" produces generic output. "Launch a B2B SaaS subscription tool for independent music teachers targeting 18–40 year olds in North America, positioning on ease of use vs. Studio Manager" produces specific, useful output.

**Inputs folder.** Drop in any markdown notes, prior brand documents, or research you have. The Extract stage pulls structured facts from them. The more real context you give, the more specific the output.

**QA score of 7.0 is the floor, not the target.** 8.0+ runs are worth promoting. 7.1 runs might be worth a re-run with a sharper goal. Scores below 7.0 are usually a signal that the goal was too vague.

**Reject liberally in the early runs.** Until you have a solid Founder kernel, downstream agents are working blind. It's faster to re-run Founder once with a better goal than to promote weak context and have every downstream agent inherit it.

---

## Troubleshooting

**Ollama screen stays stuck (Continue stays disabled)**  
Ollama isn't running or the model isn't loaded. Open a terminal and run:
```
ollama serve
ollama pull gemma4:e4b
```
Then refresh the installer page.

**Run immediately shows error**  
AgentSuite isn't installed or the Python environment is wrong. Run `pip install -e .` in the project root and restart the backend.

**Slow token speed (< 5 tok/s)**  
Your RAM is likely swapping. Try the Light tier model (`gemma4:e2b`) which uses less RAM.

**Artifacts are empty or very short**  
The model context window was exhausted during Spec or Execute. Try the Balanced or Pro tier model.

**Can't find the artifacts**  
They're at `~/AgentSuite/.agentsuite/runs/{run-id}/`. The run ID is shown in the Runs view.
