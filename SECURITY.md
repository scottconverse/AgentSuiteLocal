# Security Policy

## Supported versions

AgentSuiteLocal follows a rolling-release model. Only the latest minor line receives security patches.

| Version | Supported |
|---------|-----------|
| 0.8.x   | ✓ Current — receives all security patches |
| 0.7.x   | Best-effort backports for high-severity issues only, through 2026-08 |
| ≤ 0.1.x | Unsupported |

We recommend running the latest tagged release. Auto-update notifications appear in the Dashboard when a new version is published; check **Settings → About** for your installed version.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Open a [private security advisory](https://github.com/scottconverse/AgentSuiteLocal/security/advisories/new) on the repository. Public issues are world-readable and create disclosure pressure before a fix is available.

Please include:
- A description of the vulnerability and affected component
- Steps to reproduce, ideally with a minimal proof of concept
- The version you observed it on (`pip show agentsuitelocal` or **Settings → About**)
- Potential impact and any suggested remediation

You will receive an acknowledgement within 48 hours and a target resolution timeline within 7 days. We will credit you in the release notes unless you request otherwise.

## Security model

AgentSuiteLocal is a single-user desktop application. Its threat model assumes a trusted local machine running an untrusted-network web browser.

### Network surface

- The bundled FastAPI backend binds to `127.0.0.1` only. It is **not** reachable from any other machine on the network.
- Production builds listen on port 8765; dev builds on port 8766. Both are localhost-bound.
- CORS is restricted to `http://localhost:5173` and `http://localhost:8765` (see `CONTRIBUTING.md`).
- The only outbound HTTP calls made by the app are: (a) local `http://127.0.0.1:11434` to Ollama, (b) optional `https://api.github.com/repos/scottconverse/AgentSuiteLocal/releases/latest` for update checks (no payload other than the request URL), and (c) optional `https://api.anthropic.com/v1/messages` if the user has configured an Anthropic API key and selected a cloud model.

### API key storage

Anthropic API keys (used only when the user opts into cloud fallback) are stored in the operating system credential store:

- **Windows:** Windows Credential Manager
- **macOS:** Keychain
- **Linux:** Secret Service via `keyring>=25.0`

Keys are never written to `settings.json` or any plain-text file in the workspace. The `GET /api/settings` endpoint redacts the key to `"***"`. If `keyring` is unavailable (rare; some headless CI environments), the application falls back to the legacy `~/.agentsuitelocal/settings.json` storage with explicit logging — this fallback is the v0.7.0 and earlier behaviour.

A migration runs once on first start of v0.7.1+: any plain-text key found in `settings.json` is moved into the keychain and removed from disk.

### Path containment

All filesystem-write paths derived from user input are validated. The relevant guards:

- `inputs_dir` (in `RunRequest` / `PipelineRequest`): rejected if outside `Path.home()`, non-existent, or longer than 512 characters.
- `/api/open-folder`: target path checked with `Path.is_relative_to(workspace_root)` (not string `startswith`) to prevent sibling-directory bypass.
- Kernel artifact reads (`/api/kernel/{project}/{agent}/{path}`): same `is_relative_to` guard against the kernel root.
- Project slugs are validated against a slug regex before any directory operation.

### Authentication

There is no authentication. The app assumes single-user localhost trust. **Do not expose port 8765 (production) or 8766 (development) to an untrusted network.** Doing so allows any reachable client to start runs, read kernel artifacts, and consume the configured Anthropic API key (if cloud fallback is enabled).

### Dependency chain

The `agentsuite` upstream package is pinned by commit SHA in `pyproject.toml`. The pin is updated intentionally before each distribution build, never via `@main`. PyInstaller is also SHA-pinned. CI lint (`scripts/check_action_node_versions.py`) verifies that every GitHub Actions step is SHA-pinned and on a supported Node.js runtime, blocking re-pin drift to retired runtimes.

### Distribution integrity

- Each release publishes SHA-256 hashes of every artifact on the GitHub Releases page. Verify with `Get-FileHash` (Windows) or `shasum -a 256` (macOS) before running.
- Windows builds are unsigned (Authenticode signing is on the roadmap but not yet in place); macOS DMGs are unsigned (Apple Developer ID codesigning is on the roadmap). The unsigned binaries are otherwise unmodified PyInstaller onedir bundles produced from the tagged commit by GitHub Actions.

### Crash reports and telemetry

Crash reports written to `~/.agentsuitelocal/crash-reports/` contain exception type, message, stack trace, app/Python/OS version, and the request path that triggered the exception. They do **not** contain request bodies, run goals, kernel content, or API keys. Reports stay on disk until the user deletes them; they are never transmitted.

The optional usage-telemetry log (`~/.agentsuitelocal/usage.jsonl`) records run starts/completions, model used, and QA pass/fail counts. It is opt-in and never transmitted off the machine. Disable the **Usage telemetry** toggle in **Settings** to stop logging entirely.

## Out of scope

The following are not considered vulnerabilities under this policy:

- Network attacks against an instance the user has deliberately exposed beyond localhost.
- Physical-access attacks on an unlocked workstation.
- Attacks requiring a malicious Ollama model the user has knowingly pulled and set as active.
- Anything affecting the Anthropic, Ollama, or Google Gemma services upstream (please report those to the respective vendors).
