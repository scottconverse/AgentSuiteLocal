# Frequently Asked Questions

These answers cover AgentSuiteLocal v0.8.9 and the v0.9.0 work in progress. For full details on any topic, see the [user manual](./user-manual.md) and the in-app **Manual** view.

---

## Setup

**Do I need to know how to code?**
No. Download the installer from the [Releases page](https://github.com/scottconverse/AgentSuiteLocal/releases/latest), double-click it, and the in-app installer walks you through Ollama, the model download, and a smoke test. No terminal commands, no API key, no cloud account.

**What hardware do I need?**
- **Minimum:** 8 GB RAM, 10 GB free disk, Windows 10 64-bit or macOS 12+.
- **Recommended:** 16 GB RAM, 20 GB free disk, Windows 11 or macOS 14+.

The installer's hardware-probe step tells you which model tier fits — Light (8 GB), Balanced (16 GB), or Pro (24+ GB).

**Does it work on macOS?**
Yes — the macOS DMG is published on the [Releases page](https://github.com/scottconverse/AgentSuiteLocal/releases/latest). The DMG is unsigned, so on first run macOS may show "AgentSuiteLocal cannot be opened because it is from an unidentified developer." Right-click the app and choose **Open** to allow it. See the README's Gatekeeper section for the full procedure.

**Does it work on Linux?**
There is no Linux distributable yet. Linux developers can run from source (`pip install -e .[dev]` and `npm run dev`) but the bundled installer artifacts ship for Windows and macOS only.

**Does it need an internet connection?**
Only for the one-time model download (a few hundred MB to a few GB depending on tier) and for optional update checks. After the model is on disk, runs are entirely local. The optional Anthropic cloud-fallback path requires internet, but it is opt-in.

---

## Running agents

**What's a "goal"?**
One sentence describing what you want the agent to produce. Example: "Launch AgentSuiteLocal v1.0 — a fully-local desktop app for non-technical founders." The sharper the goal, the better every artifact will be. Vague goals are the most common cause of low QA scores.

**How long does a run take?**
Roughly 9–16 minutes per agent on the Balanced tier with typical hardware. The Live Run screen shows total elapsed time and a per-stage timer.

**Can I stop a run once it starts?**
Yes. The Live Run screen has a **Cancel** button (added in v0.7.0). Cancel saves any partial artifacts to the run folder before terminating. Closing the Live Run view does **not** cancel the run — use the Cancel button.

**Why did my run score below 7.0?**
The most common cause is a vague goal. Sharpen it to be specific and concrete — "Launch X for Y in Z, positioned on W" works better than "Launch my app" — and re-run. Adding an inputs folder with real brand or product notes also significantly improves scores. If the goal is already specific, try a higher model tier.

**The Approve button is greyed out — why?**
It enables only when the composite QA score meets the gate threshold (default 7.0). Either lower the threshold in **Settings → QA gate threshold**, sharpen the goal and re-run, or click **Override & approve** to bypass the gate with a confirmation dialog.

**Can I run multiple agents at the same time?**
Not in v1.0. AgentSuiteLocal supports one active run (or one in-progress pipeline step) per session. Starting a second run while another is in progress is not supported. Concurrent runs land in v1.1. (See also the user manual's [Limitations / FAQ section](./user-manual.md#10-faq).)

---

## The kernel

**What's the kernel?**
A folder of approved artifacts at `~/AgentSuite/.agentsuite/_kernel/`. Every future run on the same project loads the kernel as canonical context. Approving a run promotes its artifacts into the kernel; rejecting leaves them in the run folder but excluded from kernel context.

**Can I edit kernel files?**
Yes. They're plain markdown — edit them in any text editor, commit them to git, or run them through your own toolchain. The app reads whatever is on disk at run time.

**How do I back up my kernel?**
Copy `~/AgentSuite/.agentsuite/_kernel/` to a safe location. No database, no binary format — just markdown.

**What happens if I reject a run?**
The artifacts stay in the run folder (`~/AgentSuite/.agentsuite/runs/{run-id}/`) but are not promoted. A **Retry** button appears on rejected runs in the Runs view to restart with the same goal/inputs.

---

## Models and AI

**Does it use the internet to run the AI?**
No. The model runs in Ollama on your machine. All inference is local unless you have explicitly configured an Anthropic API key and selected a cloud model in **Settings**.

**Can I use Claude or GPT-4 instead of Gemma?**
You can use Claude. Paste an Anthropic API key in **Settings → Cloud fallback** to enable Claude 3.5 Haiku, Claude 3.5 Sonnet, or Claude Opus 4. The cloud-model selector then appears in the model picker. Cloud runs send your goal and context to Anthropic's servers and incur API costs — there is a permanent warning in Settings to that effect. OpenAI is not supported.

**Can I use a different Ollama model?**
Yes. Open **Settings → Models** (or click **Models** in the sidebar) and use the **Pull** button on any recommended model, or pull a custom model with `ollama pull model-name` in a terminal and click **Set as active** next to it in the Models view. Any model in your Ollama library works.

---

## Privacy and security

**What data leaves my machine?**
By default, nothing. The only outbound calls are: (a) an optional GitHub API call to check for updates (no payload other than the version comparison), and (b) Anthropic API calls if you have explicitly configured a cloud model. The optional usage-telemetry log writes only to `~/.agentsuitelocal/usage.jsonl` on your disk.

**Where is my Anthropic API key stored?**
In your operating system's credential store: Windows Credential Manager, macOS Keychain, or Linux Secret Service. It is never written to `settings.json` or any other plain-text file. If keyring is unavailable on your system, the app falls back to the legacy JSON storage with explicit logging — see [SECURITY.md](../SECURITY.md).

**How do I report a security issue?**
Open a [private security advisory](https://github.com/scottconverse/AgentSuiteLocal/security/advisories/new) on GitHub. Do not file a public issue. See [SECURITY.md](../SECURITY.md) for the full disclosure policy.

---

## Troubleshooting

**The smoke test fails with "Ollama is not running."**
On Windows, look for the Ollama icon in the system tray and let it finish starting. On macOS, confirm Ollama is in the menu bar. If Ollama isn't installed, get it from [ollama.com/download](https://ollama.com/download), then return to the installer and click **Retry**.

**The smoke test fails on "API health endpoint."**
The backend failed to start, typically due to a port conflict. Check `~/.agentsuitelocal/launcher.port.json` for the actual port the backend bound to (since v0.8.8 — older builds wrote it to `launcher.log`), and verify no other process is using it. Restart the app.

**Model download stalls or fails after 3 attempts.**
Usually a network or Ollama-registry transient. Wait a few minutes and click **Try again**. Partial downloads are resumed where Ollama supports it.

**The distributable shows a "Windows protected your PC" warning.**
The Windows build is unsigned. Click **More info** → **Run anyway**. You only see this once per machine. To verify the binary independently, compare its SHA-256 against the hash on the [release page](https://github.com/scottconverse/AgentSuiteLocal/releases/latest).

**The macOS DMG won't open.**
The DMG is unsigned. In Finder, right-click (or Control-click) the app inside the mounted DMG and choose **Open**, then **Open** in the warning dialog. If macOS has already quarantined it, go to **System Settings → Privacy & Security**, scroll down to the blocked-app entry, and click **Open Anyway**.

**Where are my artifacts?**
- Run outputs: `~/AgentSuite/.agentsuite/runs/{run-id}/`
- Approved (kernel) artifacts: `~/AgentSuite/.agentsuite/_kernel/{project}/{agent}/`

Override the workspace root with `AGENTSUITE_WORKSPACE=/your/path`.

**The Retry button doesn't pre-fill the goal field.**
Runs created before v0.7.0 may not have a `goal` field saved. Fill it in manually for those runs. All v0.7.0+ runs save the goal automatically.

**PDF export returns a 500 error.**
PDF export uses reportlab (pure Python, no native runtime required). A 500 usually means the run has no artifacts yet — start a run and wait for it to reach the approval gate before exporting. If the error persists, check the backend log for the underlying exception.

---

## More

The in-app **Manual** view (sidebar → Manual) is the most complete reference and is updated alongside each release. The full user manual lives at [docs/user-manual.md](./user-manual.md). Every release is documented in [CHANGELOG.md](../CHANGELOG.md).
