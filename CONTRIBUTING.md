# Contributing to AgentSuiteLocal

Thanks for your interest in contributing. This document covers the development workflow, code style, and how to submit changes.

---

## Getting started

```bash
# 1. Clone and set up the Python environment
git clone https://github.com/scottconverse/AgentSuiteLocal.git
cd AgentSuiteLocal
python -m venv .venv
source .venv/bin/activate         # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# 2. Install frontend dependencies
cd web && npm ci && cd ..

# 3. Run backend + frontend
python agentsuitelocal/cli.py --reload
# (in a second terminal)
cd web && npm run dev
```

Open http://localhost:5173. The backend binds to port **8765** by default and writes the actual bound port to a structured JSON file at `~/.agentsuitelocal/launcher.port.json` (since v0.8.8 — the legacy plaintext `launcher.log` was split off and is no longer the source of truth for port lookups). E2E tests, the in-app uninstaller, and any other consumer should read `launcher.port.json`.

---

## Running tests

```bash
# Backend unit + integration tests (no Ollama required)
pytest tests/ --ignore=tests/e2e -v

# Frontend unit tests (Vitest)
cd web && npm run test

# Lint (ruff)
ruff check .

# Frontend build smoke test (verifies no import/build errors)
cd web && npm run build

# E2E tests (backend auto-started by conftest via launcher.port.json; Ollama + gemma4:e4b required)
pytest tests/e2e/ -v -m e2e
```

The backend test suite covers 160+ tests without needing Ollama running (current count fluctuates per release; see the latest CHANGELOG entry for an exact figure). E2E tests self-start the backend via `subprocess` and read the bound port from `~/.agentsuitelocal/launcher.port.json`. The smoke step verifies the configured model is installed locally, so CI and local E2E runs need the same model that `_SETTINGS_DEFAULTS["model_name"]` points at — currently `gemma4:e4b`.

Every PR must keep the unit + integration suite green. New backend behaviour needs at least one pytest test. New frontend behaviour needs at least one Vitest test.

---

## Building the installer

Windows installer requires Inno Setup 6 on your PATH (install from https://jrsoftware.org/isinfo.php).

```bash
# 1. Build the frontend bundle
cd web && npm run build && cd ..

# 2. Build the PyInstaller executable
python -m PyInstaller AgentSuiteLocal.spec --noconfirm

# 3. Build the Inno Setup installer
make build-installer
# equivalent to: iscc installer\AgentSuiteLocal.iss
```

Output: `dist/AgentSuiteLocal-1.0.0-setup.exe`

The installer embeds the full `dist/AgentSuiteLocal/` folder produced by PyInstaller, so the PyInstaller build must complete before running Inno Setup.

macOS: `make build-mac` runs PyInstaller with the macOS BUNDLE block in `AgentSuiteLocal.spec`. You need `create-dmg` installed for the DMG step.

---

## Making AgentSuite upstream changes

AgentSuiteLocal pins the AgentSuite library at a specific commit SHA in `pyproject.toml`:

```
agentsuite @ git+https://github.com/scottconverse/AgentSuite.git@<SHA>
```

To change the upstream library:

1. Fork `scottconverse/AgentSuite` and create a branch.
2. Make your changes with tests in the forked repo.
3. Open a PR against `scottconverse/AgentSuite` main.
4. After the PR is merged, get the new commit SHA:
   ```bash
   gh api repos/scottconverse/AgentSuite/commits/main --jq '.sha'
   ```
5. Update the SHA in `pyproject.toml` and re-run `pip install -e ".[dev]"`.
6. Run the full test suite against the new pin before submitting your PR to AgentSuiteLocal.

Never pin a feature branch SHA in `pyproject.toml` for a merged PR — always pin the post-merge commit on main.

---

## Code style

- **Python:** `ruff check .` must pass. Run `ruff check . --fix` to auto-fix most issues.
- **JavaScript/JSX:** Prettier defaults. Run `cd web && npx prettier --write src/`.
- No comments unless the why is non-obvious. No docstrings on internal helpers.
- The API was split per-domain in v0.8.0: `agentsuitelocal/api/main.py` is now an entrypoint that wires routers from `agentsuitelocal/api/routers/` (health, kernel, ollama, pipelines, projects, runs, settings, system, uninstall, etc.). New routes go in the most appropriate existing router, or a new router file if no fit exists. Don't reintroduce the pre-v0.8.0 monolith.

---

## Pull requests

1. Branch off `main`. Name branches `fix/short-description` or `feat/short-description`.
2. Keep PRs focused. One fix or one feature per PR.
3. Update `CHANGELOG.md` under `[Unreleased]` with what changed.
4. Fill in the PR template (what, why, how to test).
5. CI must be green (pytest, ruff, npm test, Vite build) before requesting review.

---

## Reporting bugs

Open an issue at https://github.com/scottconverse/AgentSuiteLocal/issues. Include:
- OS and RAM
- AgentSuiteLocal version (shown in Settings or `agentsuitelocal --version`)
- What you did and what you expected
- What happened — paste logs from `~/.agentsuitelocal/launcher.log` (general events) and the bound port from `~/.agentsuitelocal/launcher.port.json` if relevant
- Crash report JSON if one was captured (Settings shows a banner when a crash report exists)

---

## License

By contributing you agree that your changes will be licensed under the [MIT License](LICENSE).
