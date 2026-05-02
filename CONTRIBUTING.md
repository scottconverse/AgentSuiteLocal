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
cd web && npm install && cd ..

# 3. Run backend + frontend
uvicorn agentsuitelocal.api.main:app --reload --port 8766
# (in a second terminal)
cd web && npm run dev
```

Open http://localhost:5173.

---

## Tests

```bash
# Backend unit + integration tests (no Ollama required)
pytest tests/test_api.py tests/test_integration.py -v

# E2E tests (Vite on :5173, backend auto-started on :8766 by conftest)
playwright install chromium
pytest tests/e2e/ -v -m e2e

# Coverage report
pytest tests/test_api.py tests/test_integration.py --cov=agentsuitelocal --cov-report=term-missing
```

Every PR must keep the unit + integration suite green. New behavior should include at least one test.

---

## Code style

- **Python:** black + isort. Run `black . && isort .` before committing.
- **JavaScript/JSX:** Prettier defaults. Run `cd web && npx prettier --write src/`.
- No comments unless the why is non-obvious. No docstrings on internal helpers.
- Keep `main.py` the single source of truth for the API — don't split across files without discussion.

---

## Pull requests

1. Branch off `main`. Name branches `fix/short-description` or `feat/short-description`.
2. Keep PRs focused. One fix or one feature per PR.
3. Update `CHANGELOG.md` under `[Unreleased]` with what changed.
4. Fill in the PR template (what, why, how to test).

---

## Reporting bugs

Open an issue at https://github.com/scottconverse/AgentSuiteLocal/issues. Include:
- OS and RAM
- What you did
- What you expected
- What happened (paste logs from `~/.agentsuitelocal/launcher.log` if available)

---

## License

By contributing you agree that your changes will be licensed under the [MIT License](LICENSE).
