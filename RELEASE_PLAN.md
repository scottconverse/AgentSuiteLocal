# RELEASE_PLAN.md — v1.0 Sprint A

**Type:** sprint (Sprint A of three: A → audit-team → ship)
**Branch:** `release/v0.9.0`
**Baseline:** `0992e9a` (CI green, real-e2e green on `d707fac`, V1+V2 closed)
**Sprint goal:** Test honesty + bundle integrity + a11y bar
**Sprint gate:** Sprint-end audit-lite returns 0 Criticals, then Scott approval before Sprint B
**This is NOT v1.0 ship.** This is Sprint A's calibration gate.

---

## Discipline (layered audit pattern)

- **Per-commit:** careful-coding 9-step (read callers, runtime context, fan-out grep, data contract, blast radius, re-read, narrate path, prove render, self-audit)
- **Per checkpoint (every 2-3 commits):** lint clean (`python -m ruff check .`), changed-file tests pass, `git diff` matches claimed work
- **Per sprint end:** audit-lite (4-lens, scoped to sprint diff)
- **Mid-sprint overflow:** Blocker stops sprint; Critical only if fits; Major queues to next sprint; Minor/Nit collects in `next-cleanup.md`
- **Scoped re-audits only.** Never unscoped re-audit mid-sprint.

## Pre-flight gate

- [x] Real-e2e CI green for at least one commit on this branch (`d707fac`)
- [x] CI green at the baseline commit (`0992e9a`)
- [x] D1–D4 decisions locked in `docs/v1.0-milestone.md`
- [x] `agentsuite==1.1.1` (commit `4bd7869`) is the active pin

---

## Sprint A checklist

Items execute in order. Each item runs the careful-coding 9-step loop; each commit produces a `VERIFICATION_LOG.md` entry with timestamped evidence.

### A1 — Remove dead `RunRequest.constraints` field (D1)

- [ ] Drop `constraints` from `RunRequest` Pydantic model (`agentsuitelocal/api/schemas.py`)
- [ ] Remove any references in `agentsuitelocal/api/routers/runs.py`, `tests/`, `docs/architecture.md`
- [ ] `grep -rn "RunRequest.*constraints\|constraints.*RunRequest" agentsuitelocal/ tests/` returns 0 references
- [ ] `python -m pytest tests/test_api.py -k "run" -q` passes
- [ ] VERIFICATION_LOG entry: file paths changed, test pass count, ruff clean

### A2 — Restore `assert not "Run failed" within 3s` in tests/e2e/test_new_run.py

- [ ] Find the assertion that was removed in v0.8.9; restore it
- [ ] Lint clean
- [ ] Push triggers CI; CI is the actual gate (Playwright env not always set up locally)
- [ ] VERIFICATION_LOG entry: file path, line number, CI run URL

### A3 — Remove `xfail` from `tests/test_real_founder_run.py`

- [ ] Remove `@pytest.mark.xfail(strict=False, reason=...)` markers from V1+V2 cases
- [ ] Push triggers real-e2e workflow
- [ ] Real-e2e on the resulting commit returns `passed` (not `xpassed`)
- [ ] VERIFICATION_LOG entry: real-e2e CI run URL + pass status + wall-clock

### A4 — MOCKING_AUDIT.md sweep

- [ ] Read every `patch(`/`Mock(` call in `tests/`
- [ ] Classify each as boundary-mock-OK (HTTP, filesystem, subprocess, OS notifications) or internal-mock-suspect (AgentSuiteLocal/agentsuite internals)
- [ ] Write classifications to new `docs/MOCKING_AUDIT.md`
- [ ] Refactor any internal-mock-suspect tests in `tests/test_execution_state_machine.py` to use the real-resolver path via `AGENTSUITE_LLM_PROVIDER_FACTORY` (template in `tests/test_execution_integration.py`), OR delete as redundant with `tests/test_real_founder_run.py`
- [ ] 0 internal-mock-suspect mocks remain (each refactored, deleted, or annotated with explicit justification queued in `next-cleanup.md`)
- [ ] All non-deleted tests still pass
- [ ] VERIFICATION_LOG entry: total patches classified, refactored count, deleted count, justified count

### A5 — Document concurrent-run limitation (D3)

- [ ] Add to `README.md` (known issues / limitations section): "v1.0 supports one run at a time per session. Concurrent runs land in v1.1."
- [ ] Add to `docs/user-manual.md` (limitations / FAQ section)
- [ ] Add to `docs/FAQ.md` (new entry: "Can I run multiple agents at the same time?")
- [ ] Frontend tests still pass (no UI change)
- [ ] VERIFICATION_LOG entry: file paths + line numbers added

### A6 — Bare-min a11y (D2 — Bar 1)

- [ ] Audit Tab order in every primary view (Dashboard, NewRun, LiveRun, Runs, Pipelines, Kernel, Manual, Settings, ApprovalGate)
- [ ] Add visible focus rings (`:focus-visible` outline) to interactive elements in `web/src/styles/`
- [ ] Verify modals trap focus correctly and Esc closes them, returning focus to trigger
- [ ] Add `aria-current="page"` to active sidebar nav item in `web/src/components/shell/Sidebar.jsx`
- [ ] Add Vitest tests for the aria-current attribute and focus-ring CSS
- [ ] Manual checklist (per-view) recorded in VERIFICATION_LOG
- [ ] Frontend tests pass; lint clean
- [ ] VERIFICATION_LOG entry: per-view tab-through results + screenshot evidence references

### A7 — Post-PyInstaller smoke (bundle integrity)

- [ ] Add a CI job that builds the .exe (and .dmg on macOS-latest) and verifies first-launch end-to-end:
  - Bundle launches without error
  - Backend port file `launcher.port.json` is written
  - GET `/api/health` returns 200
  - Bundle process exits cleanly when killed
- [ ] Job added to `.github/workflows/ci.yml` (or new `.github/workflows/bundle-smoke.yml`)
- [ ] Job runs green on the latest `release/v0.9.0` commit
- [ ] VERIFICATION_LOG entry: CI run URL, total wall-clock, exit code

### A8 — CHANGELOG + README currency

- [ ] CHANGELOG `[Unreleased]` includes:
  - weasyprint → reportlab (already there)
  - approve_run guard correction (already there)
  - ApprovalGateView tooltip (already there)
  - agentsuite v1.1.1 repin closing V1+V2
  - constraints removal (A1)
  - test_real_founder_run xfail removal (A3)
  - MOCKING_AUDIT (A4)
  - concurrent-run documentation (A5)
  - a11y Bar 1 (A6)
  - bundle smoke CI (A7)
- [ ] README "Recent releases" section reflects current state
- [ ] Lint clean
- [ ] VERIFICATION_LOG entry: lines added per file

### A9 — Sprint-end audit-lite

- [ ] Run `/audit-lite` skill scoped to the diff `0992e9a..HEAD`
- [ ] 0 Critical findings, 0 Blockers
- [ ] ≤2 Major findings (each with explicit "fold into Sprint A or queue for Sprint B?" decision)
- [ ] VERIFICATION_LOG entry: full audit-lite output appended

### A10 — Sprint A ship gate (HARD STOP)

- [ ] All A1–A8 items have VERIFICATION_LOG entries
- [ ] A9 audit-lite returns 0 Criticals
- [ ] All CI workflows on the final commit are green
- [ ] Real-e2e on the final commit is green
- [ ] **STOP. Hand off to Scott for calibration. Do NOT proceed to Sprint B.**

---

## Out of scope for Sprint A

- Sprint B work (audit-team, doc-rewrites)
- Sprint C work (release artifact build, tagging)
- Recovery sweeps (Ollama crash, model corruption, disk full, key revoke, concurrent runs robustness)
- Performance baseline / benchmarks
- Frozen API surface / schema-change CI
- Bar 2 / Bar 3 a11y
- Code signing
- Multi-instance, plugin system, auto-update

If a finding surfaces during Sprint A in one of these areas:
- **Blocker** → stop sprint; surface to Scott; renegotiate
- **Critical** → only fix if fits remaining time; otherwise queue
- **Major / Minor / Nit** → queue in `next-cleanup.md` with file path

---

## Hard stop

The orchestrator MUST NOT proceed past A10 without Scott approval. Sprint A's "ship gate" is a calibration gate, not the v1.0 release gate. The next step after A10 is a fresh `/ship` invocation for Sprint B.
