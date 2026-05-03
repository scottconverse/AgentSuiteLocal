# Frequently Asked Questions

## Setup

**Do I need to know how to code?**  
No. Download the distributable, double-click it, and the in-app installer walks you through everything.

**What hardware do I need?**  
At minimum: 8 GB RAM and Windows 10 64-bit. Recommended: 16 GB RAM and Windows 11. The installer's hardware check will tell you which model tier fits your machine.

**Does it work on macOS or Linux?**  
The distributable is Windows-only in v0.1. Developers can run from source on macOS and Linux.

**Does it need an internet connection?**  
Only for the one-time model download. After that, everything runs offline.

---

## Running agents

**What's a "goal"?**  
One sentence describing what you want the agent to produce. Example: "Launch AgentSuiteLocal v1.0 — a fully-local desktop app for non-technical founders." The agent writes everything else around it.

**How long does a run take?**  
Roughly 9–16 minutes depending on the agent and your hardware tier. The Live Run screen shows elapsed time and stage progress.

**Why did my run score below 7.0?**  
The most common cause is a vague goal. Rewrite it to be more specific and concrete, then re-run.

**Can I stop a run once it starts?**  
No — once started, a run runs to completion on the backend. Navigating away from the Live Run screen does not stop the pipeline. If it completes while you're away, it will be waiting in the Runs screen for your review. To discard the output, reject it in the Approval Gate.

---

## The kernel

**What's the kernel?**  
A folder on your disk (`~/AgentSuite/.agentsuite/_kernel/`) where approved artifacts live. Every future run on the same project reads the kernel as canonical context.

**Can I edit kernel files?**  
Yes. They're plain markdown. Edit them directly in any text editor, commit them to git, or run them through your own toolchain. The app reads whatever is on disk at run time.

**What happens if I reject a run?**  
The artifacts stay in the run folder but are never promoted. You can start a new run at any time.

---

## Models and AI

**Does it use the internet to run the AI?**  
No. The model runs in Ollama on your machine. All inference is local.

**Can I use Claude or GPT-4 instead of Gemma?**  
You can paste an Anthropic API key in Settings to enable Claude as a cloud fallback. OpenAI is not supported in v0.1.

**Can I use a different Ollama model?**  
The model selector in the installer supports `gemma4:e2b`, `gemma4:e4b`, and `gemma4:26b-moe`. Custom models are not supported through the UI in v0.1, but you can set one via the settings API directly.

---

## Troubleshooting

**The smoke test fails with "Ollama is not running."**  
Open a terminal and run `ollama serve`. Then click Retry in the installer.

**I see "No AI model configured" when I try to start a run.**  
Either Ollama isn't running, or you don't have a model pulled. Run `ollama pull gemma4:e4b` in a terminal.

**The distributable shows a "Windows protected your PC" warning.**  
Click **More info**, then **Run anyway**. The binary is unsigned in v0.1. You only see this once.

**Where are my artifacts?**  
At `~/AgentSuite/.agentsuite/runs/{run-id}/` for run outputs, and `~/AgentSuite/.agentsuite/_kernel/` for approved artifacts.
