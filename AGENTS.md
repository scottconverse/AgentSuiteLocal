# AGENTS.md

This project uses the ScottDevSkills Agent Pipeline for scoped, evidence-driven work.

## Project Orientation

- Purpose: AgentSuiteLocal is a local-first desktop/web UI for running AgentSuite through Ollama, with a Windows installer lifecycle for non-technical users.
- Primary users: Non-technical founders and local-first users who need guided agent workflows without a cloud dependency.
- Stack: Python 3.11+, FastAPI-style backend, React 18/Vite frontend, PyInstaller, Inno Setup, Ollama.
- Test command: `pytest tests/test_api.py tests/test_integration.py -v` for backend coverage; `cd web && npm test` for frontend coverage.
- Lint/static command: `ruff check .` when available.

## Order Of Operations

1. Read this file, the active manifest, and relevant repo docs before editing.
2. Keep work inside the manifest's `allowed_paths`.
3. Treat `forbidden_paths` as absolute unless the human director amends the manifest.
4. Preserve installer and release evidence unless the manifest explicitly authorizes changes.
5. Run policy checks and project tests named by the manifest before claiming a stage is ready for verification.
6. If a slice changes `.github/workflows/*.yml` or `.github/workflows/*.yaml`, name the workflow files in the plan, apply the workflow-cost directives below, run `scripts/policy/run_all.py --run <run-id>`, and record workflow-cost evidence in the run artifacts.

## Layered Audit Pattern

- Product altitude: Confirm the user-facing installer, setup, run, and uninstall flows still match documented expectations.
- Architecture altitude: Confirm backend settings, workspace paths, runtime checks, and installer lifecycle code stay coherent across packaged and development modes.
- Implementation altitude: Keep changes narrow, preserve existing conventions, and avoid unrelated refactors.
- Evidence altitude: Capture automated test output and any manual installer verification required by the manifest.

## Closed Architectural Decisions

- Setup completion is stored in backend settings rather than browser-only localStorage.
- The Windows uninstall path delegates to the real Inno uninstaller.
- Inno uninstall kills `AgentSuiteLocal.exe` before file removal.

## Open Decisions

- Add formal ADRs under `docs/adr/` if installer lifecycle policies need durable project-level decisions.

## Tooling

- Backend: `pytest`, `ruff`, PyInstaller.
- Frontend: `npm test`, `npm run build`, Vite, Vitest.
- Installer: Inno Setup compiler, Windows silent install/uninstall checks.
- Pipeline policy: `scripts/policy/run_all.py`.

## Non-Negotiables

- Do not revert existing user or prior-session changes.
- Do not claim installer lifecycle readiness without automated tests and, when packaging behavior changes, real install/uninstall evidence.
- Do not allow New Run to bypass local model readiness gates.
- Do not silently change workspace/output persistence behavior.
- Do not add or modify GitHub Actions workflows without satisfying the workflow-cost directives.

## Git Workflow

- Review the dirty tree before editing.
- Commit only the intended scope.
- Keep generated build outputs out of commits unless explicitly requested.
- Prefer focused commits that separate pipeline scaffolding from product fixes when practical.

## Role Posture

- Planner: Define the smallest manifest that catches the requested regressions.
- Implementer: Change code and tests only inside the manifest scope.
- Verifier: Run policy, backend, frontend, build, and installer checks appropriate to the change.
- Critic: Look specifically for false success states, missing progress/error visibility, and persistence regressions.

## What You Never Do

- Do not overwrite pipeline templates, `AGENTS.md`, or release docs without reading them first.
- Do not expand the allowed path list just to make an incidental edit easier.
- Do not leave failing lifecycle gates undocumented.
- Do not mask setup or uninstall failures as success states.

## GitHub Actions Workflow-Cost Directives

1. Never add a daily cron without explicit Scott approval. Weekly is the maximum default schedule.
2. Every new GitHub Actions workflow must include a concurrency block unless it is a release/tag workflow where cancellation would corrupt the release.
3. Do not duplicate push-to-main and pull-request validation for the same heavy workflow.
4. Add `paths:` filters when adding heavy workflows, including Playwright, browser installs, large language models, cleanroom, or e2e validation.
5. macOS jobs are allowed on release tags only unless Scott explicitly approves a PR-fired exception.
6. Windows jobs are allowed on PR only when truly necessary, and the run record or policy evidence must justify the cost.
7. Cache anything that takes more than 30 seconds to install or download.
8. Every `upload-artifact` step must set `retention-days: 7` unless the artifact is a release artifact or Scott explicitly approves longer retention.

## Pipeline Files

- `.pipelines/` contains local pipeline definitions and role files.
- `scripts/policy/` contains deterministic policy checks.
- `.agent-runs/` contains per-run artifacts and is gitignored by default.
