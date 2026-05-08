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

- [x] Drop `constraints` from `RunRequest` Pydantic model (`agentsuitelocal/api/schemas.py`)
- [x] Remove any references in `agentsuitelocal/api/routers/runs.py`, `tests/`, `docs/architecture.md`
- [x] `grep -rn "RunRequest.*constraints\|constraints.*RunRequest" agentsuitelocal/ tests/` returns 0 references
- [x] `python -m pytest tests/test_api.py -k "run" -q` passes
- [x] VERIFICATION_LOG entry: file paths changed, test pass count, ruff clean

### A2 — Restore `assert not "Run failed" within 3s` in tests/e2e/test_new_run.py

- [x] Find the assertion that was removed in v0.8.9; restore it
- [x] Lint clean
- [x] Push triggers CI; CI is the actual gate (Playwright env not always set up locally)
- [x] VERIFICATION_LOG entry: file path, line number, CI run URL

### A3 — Remove `xfail` from `tests/test_real_founder_run.py`

- [x] Remove `@pytest.mark.xfail(strict=False, reason=...)` markers from V1+V2 cases
- [x] Push triggers real-e2e workflow
- [ ] Real-e2e on the resulting commit returns `passed` (not `xpassed`) — POLLING
- [ ] VERIFICATION_LOG entry: real-e2e CI run URL + pass status + wall-clock — pending poll

### A4 — MOCKING_AUDIT.md sweep

- [x] Read every `patch(`/`Mock(` call in `tests/`
- [x] Classify each as boundary-mock-OK (HTTP, filesystem, subprocess, OS notifications) or internal-mock-suspect (AgentSuiteLocal/agentsuite internals)
- [x] Write classifications to new `docs/MOCKING_AUDIT.md` (commit `1f43795`)
- [x] Q1=(b) two-phase per Scott decision: classify-only, refactors deferred to Sprint B
- [x] 9 INTERNAL-SUSPECT-REFACTOR sites queued in `next-cleanup.md` for Sprint B
- [x] All non-deleted tests still pass
- [x] VERIFICATION_LOG entry: 48 mock sites classified — 23 BOUNDARY-OK, 16 INTERNAL-JUSTIFIED, 9 INTERNAL-SUSPECT-REFACTOR, 0 INTERNAL-SUSPECT-DELETE

### A5 — Document concurrent-run limitation (D3)

- [x] Added to `README.md` (known issues / limitations)
- [x] Added to `docs/user-manual.md` (limitations / FAQ section)
- [x] Added to `docs/FAQ.md` ("Can I run multiple agents at the same time?")
- [x] Frontend tests still pass (no UI change)
- [x] VERIFICATION_LOG entry: commit `a4989d7`

### A6 — Bare-min a11y (D2 — Bar 1)

- [x] Q2=(b) code-only per Scott decision: code changes + manual checklist for Scott
- [x] `aria-current="page"` on `Sidebar.jsx` active nav (top + bottom)
- [x] Visible focus rings (`:focus-visible` outline) — pre-existed in CSS; regression-guard test added (`web/src/styles.test.js`)
- [x] Override modal got `role="dialog"`, `aria-modal="true"`, `aria-label`, Esc-handler in `ApprovalGateView.jsx`
- [x] Vitest tests added: `Sidebar.test.jsx` (4 tests), `ApprovalGateView.test.jsx` (2 new for role=dialog + Esc), `styles.test.js`
- [x] Manual checklist (per-view) recorded in VERIFICATION_LOG for Scott pre-A10
- [x] Frontend tests pass (114 passed, 18 files); lint clean
- [x] VERIFICATION_LOG entry: commit `f8b9d08`

### A7 — Post-PyInstaller smoke (bundle integrity)

- [x] CI jobs added: `macOS build (PyInstaller)` smoke step + NEW `Windows build (PyInstaller)` mirror
- [x] Bundle launches; `launcher.port.json` written; `/api/health` returns 200; clean kill
- [x] Gated on `main || tags || release/*`
- [x] Job runs **green** on `release/v0.9.0` HEAD (commit `3743937`, run 25531160434)
- [x] VERIFICATION_LOG entry: workflow file + first green run URL

### A8 — CHANGELOG + README currency

- [x] CHANGELOG `[Unreleased]` complete:
  - weasyprint → reportlab
  - approve_run guard correction
  - ApprovalGateView tooltip
  - agentsuite v1.1.1 repin closing V1+V2
  - constraints removal (A1)
  - V4 qa_score `average` field fix
  - test_real_founder_run xfail removal (A3)
  - MOCKING_AUDIT (A4)
  - concurrent-run documentation (A5)
  - a11y Bar 1 (A6)
  - bundle smoke CI (A7)
- [x] README "Recent releases" section reflects current state (v0.9.0 in-progress paragraph at top)
- [x] Lint clean
- [x] VERIFICATION_LOG entry: commit `b8de7f7`

### A9 — Sprint-end audit-lite

- [x] Run `/audit-lite` skill scoped to the diff `0992e9a..HEAD` (HEAD=`3743937`)
- [x] 0 Critical findings, 0 Blockers
- [x] ≤2 Major findings — **0 Major found** (clean; bar met with margin)
- [x] VERIFICATION_LOG entry: full audit-lite output appended

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
