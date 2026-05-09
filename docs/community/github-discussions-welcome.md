# Welcome to AgentSuiteLocal Discussions

Hello and welcome. This is the place for questions, bug reports, feature requests, showcase posts, and anything else related to AgentSuiteLocal.

## What AgentSuiteLocal is

AgentSuiteLocal is a desktop application that runs multi-agent AI workflows entirely on your machine using Ollama. Seven specialist agents — Founder, Design, Product, Engineering, Marketing, Trust/Risk, and CIO — each run a structured five-stage pipeline and produce artifact sets that you approve before they're stored anywhere permanent. No cloud, no subscription, no data leaving your machine.

The goal is to make multi-agent AI useful for solo founders and small teams who want the output quality of structured prompting without building custom pipelines themselves, and who care about keeping their work private.

## The seven agents at a glance

| Agent | What it produces | Typical runtime |
|---|---|---|
| Founder | Brand system, positioning, voice guidelines | ~14 min |
| Design | Design briefs, visual language spec, brand QA checklist | ~9 min |
| Product | UI/UX spec, feature specs, user stories, handoff docs | ~12 min |
| Engineering | ADRs, system design, API specs, runbooks | ~16 min |
| Marketing | Launch plan, campaign briefs, messaging matrix, content plan | ~11 min |
| Trust / Risk | Threat model, controls register, compliance checklist, risk register | ~13 min |
| CIO | IT strategy, technology roadmap, vendor evaluation matrix | ~14 min |

Runtimes are estimates on the Balanced tier (gemma4:e4b) with 16 GB RAM. Lighter models are faster; larger models produce better output but take longer.

## Reporting a bug

Before opening a bug report, please check if it's already filed in [Issues](../../issues).

A useful bug report includes:

- **AgentSuiteLocal version** (shown in Settings → About, or `agentsuitelocal --version`)
- **OS and version** (Windows 10/11, macOS version)
- **Model and tier** (shown in the sidebar — e.g. "gemma4:e4b · balanced")
- **What you did** — the agent, the goal text, and if relevant, what the inputs folder contained
- **What happened** — the exact error message, or a description of the wrong behavior
- **Crash report if available** — Settings shows a banner when a crash report exists; the "Copy report" button puts the JSON on your clipboard. Paste it in the issue.

Do not include your actual goal text or input file contents in the issue if they contain anything sensitive.

## Requesting a feature

Open a [discussion in the Ideas category](../../discussions/categories/ideas) rather than an issue. Describe:

- The workflow you're trying to do
- Why the current tool doesn't support it well
- What success would look like

We don't commit to timelines on feature requests, but we do read them all.

## Rough roadmap

**v1.0 (released — current)**
- First stable release with full seven-agent support
- Installer, approval gate, kernel, model management, pipelines, and projects all stable
- One active run per session (concurrent runs ship in v1.1)

**v1.1 (planned)**
- Concurrent runs — multiple agent runs in parallel per session
- Streaming artifact preview — render markdown live during the run
- Tauri wrapper — native window, tray icon, single-binary distribution (exploratory)
- A11y Bar 2 — focus management, screen reader pass, WCAG AA

This roadmap is aspirational, not a commitment. Things move based on what the community finds most useful.

## How to contribute

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for setup instructions, the branching model, how to run tests, and how to propose changes to the upstream AgentSuite library.

The short version: fork, branch off `main`, make your change with tests, open a PR. The CI suite runs pytest, ruff, and the Vite build. A PR needs all three green before it can merge.

If you're not sure whether a change is in scope, open a discussion before writing code. It saves everyone time.

## A note on the model quality ceiling

Output quality is bounded by your model. The Light tier (`gemma4:e2b`) is enough to see the workflow in action but is not good enough for outputs you'd actually use. The Balanced tier (`gemma4:e4b`) produces substantially better results and runs in reasonable time on 16 GB RAM. The Pro tier (`gemma4:26b`) is the best locally available option but requires 32 GB RAM and takes longer.

If you have an Anthropic API key, the Settings panel lets you configure a Claude model as a cloud fallback. Cloud runs produce the best output quality but send your goal and context to Anthropic's servers and incur API costs.

We're working on better model guidance in the docs as we learn more about what models work well for different agent types.

---

Thanks for trying AgentSuiteLocal. The current release is v1.0.0 — the first stable release. We still expect bugs and rough edges; the issues list is the right place for them.
