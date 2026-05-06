# Welcome to AgentSuiteLocal Discussions

Hello and welcome. This is the place for questions, bug reports, feature requests, showcase posts, and anything else related to AgentSuiteLocal.

## What AgentSuiteLocal is

AgentSuiteLocal is a desktop application that runs multi-agent AI workflows entirely on your machine using Ollama. Seven specialist agents — Founder, Design, Product, Engineering, Marketing, Trust/Risk, and CIO — each run structured 5–7 stage pipelines and produce artifact sets that you approve before they're stored anywhere permanent. No cloud, no subscription, no data leaving your machine.

The goal is to make multi-agent AI useful for solo founders and small teams who want the output quality of structured prompting without building custom pipelines themselves, and who care about keeping their work private.

## The seven agents at a glance

| Agent | What it produces | Typical runtime |
|---|---|---|
| Founder | Brand system, positioning, ICP definition | 12–18 min |
| Design | Visual design brief, component inventory, style guide | 10–15 min |
| Product | PRD, feature prioritization, acceptance criteria | 14–20 min |
| Engineering | Technical spec, architecture decisions, implementation plan | 15–22 min |
| Marketing | Launch strategy, channel plan, messaging hierarchy | 10–14 min |
| Trust / Risk | Compliance checklist, risk register, mitigation plan | 8–12 min |
| CIO | Infrastructure assessment, toolchain evaluation, security posture | 8–12 min |

Runtimes are estimates on the balanced tier (gemma4:e4b) with 16 GB RAM. Faster models are faster; larger models produce better output but take longer.

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

**v0.8 (planned)**
- Pipeline templates — save and reuse agent sequences as named pipelines
- Batch runs — run the same agent across multiple input folders
- Kernel search — full-text search across all approved artifacts
- Better QA explanations — per-dimension explanations of what the score means

**v0.9 (planned)**
- Team workspace — shared kernel across multiple users on a local network (no cloud)
- Plugin system — bring your own agent definition as a YAML file
- Custom stages — add, remove, or reorder stages within an agent

**v1.0 (planned)**
- Signed installers on both platforms
- Auto-update through the installer (not just the in-app banner)
- Windows arm64 build
- Accessibility pass — keyboard navigation, screen reader support

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

Thanks for trying AgentSuiteLocal. The current release is v0.8.9 — the v0.7.0 line was the first that was feature-complete enough to use for real work, and the v0.8.x line has been hardening reliability, supply-chain posture, and the pipeline orchestrator. We still expect bugs and rough edges; the issues list is the right place for them.
