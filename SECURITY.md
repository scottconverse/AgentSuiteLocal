# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✓ Current |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Open a [private security advisory](https://github.com/scottconverse/AgentSuiteLocal/security/advisories/new) on GitHub. Do not post vulnerability details in public issues.

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix

You will receive an acknowledgment within 48 hours and a resolution timeline within 7 days.

## Security model

AgentSuiteLocal is a locally-run desktop app. The threat model is:

- **No remote attack surface by default.** The FastAPI backend binds to `localhost` only. It is not exposed to the network.
- **API key storage.** Anthropic API keys are stored in `~/.agentsuitelocal/settings.json` on disk and are never transmitted to Anthropic except as the authorization header in direct LLM calls. The `GET /api/settings` endpoint redacts the key to `"****"`.
- **Path traversal protection.** Artifact paths are validated with a slug regex and a resolved-path prefix check before any file write.
- **No authentication.** The app is single-user and assumes localhost trust. Do not expose port 8765 to an untrusted network.
- **Dependency chain.** The `agentsuite` package is pinned to a specific commit SHA in `pyproject.toml`. Update the pin intentionally before each distribution build.
