# r/LocalLLaMA — Intro post

**AgentSuiteLocal — seven AI agents that run entirely on your machine, with a proper installer and approval workflow** (current release: v0.8.9)

---

I've been building a desktop app that wraps local LLMs in a structured multi-agent workflow. The v0.7.0 line was the first feature-complete release; the v0.8.x line (currently v0.8.9) has been hardening reliability, supply-chain posture, and the pipeline orchestrator. Sharing it here since this community is exactly the audience.

**What it is**

AgentSuiteLocal is a desktop application (Windows + macOS) that lets you run seven specialist AI agents against a goal and a folder of inputs — entirely offline, no API keys required. Think of it as a local alternative to cloud-based AI writing and planning tools, but with no subscription, no data leaving your machine, and no model size limits beyond your hardware.

The seven agents are:

- **Founder** — brand system, positioning, ICP definition
- **Design** — visual design brief, component inventory, style guide
- **Product** — PRD, feature prioritization, acceptance criteria
- **Engineering** — technical spec, architecture decisions, implementation plan
- **Marketing** — launch strategy, channel plan, messaging hierarchy
- **Trust / Risk** — compliance checklist, risk register, mitigation plan
- **CIO** — infrastructure assessment, toolchain evaluation, security posture

Each agent runs a 5–7 stage pipeline. Between the pipeline completing and the output being saved anywhere permanent, you get an approval gate — you can read the full output, see QA scores, export as ZIP/Markdown/PDF, and either approve (which promotes to a versioned kernel) or reject (which keeps the run for retry).

**How it actually works**

The backend is FastAPI with an asyncio event loop managing agent runs as tasks. The frontend is a React/Vite SPA that communicates with the backend via REST and SSE for live streaming. The agents are powered by the AgentSuite library (github.com/scottconverse/AgentSuite), which handles multi-stage orchestration, QA scoring, and cross-stage context passing.

Models are managed through Ollama. The installer walks you through pulling a model if you don't have one.

**Honest limitations**

- Output quality is entirely dependent on your model. The Light tier (`gemma4:e2b`, 8 GB RAM) is enough to see the workflow but not for outputs you'd ship. The Balanced tier (`gemma4:e4b`, 16 GB RAM) is a reasonable middle ground. The Pro tier (`gemma4:26b`, 32 GB RAM) is the best locally available option but takes longer.
- Runs take 8–25 minutes depending on model and hardware. The live view shows per-stage progress, but there's no magic speed-up.
- PDF export uses reportlab (pure Python, no system runtime). ZIP and Markdown export are also available.
- macOS build is `.app` only for now — no signed DMG yet, so Gatekeeper will block it on first launch until you right-click-open.

**Installation**

Windows: download `AgentSuiteLocal-0.8.9-setup.exe` from the GitHub releases page and run it. The installer walks through Ollama detection, model selection, and a smoke test before entering the app.

macOS: download the `.app`, right-click and open to bypass Gatekeeper on first launch.

Either way you need Ollama installed and 8 GB RAM minimum. 16 GB is comfortable for the balanced tier.

**What I'd love feedback on**

- Are there agent types that would be more useful to you than the current seven?
- The QA scoring system rates output on 9 dimensions (clarity, completeness, coherence, specificity, brand alignment, feasibility, differentiation, depth, actionability). Does this match how you'd evaluate agent output?
- Performance on different hardware. I've only tested on two machines (Windows/Intel and macOS/Apple Silicon).

Repo: github.com/scottconverse/AgentSuiteLocal

Happy to answer questions about the implementation — the SSE reconnect logic, the approval-gate state machine, the kernel versioning system, or anything else.
