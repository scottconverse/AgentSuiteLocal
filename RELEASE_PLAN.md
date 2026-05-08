# RELEASE_PLAN.md — v1.0 Sprint B

**Type:** sprint (Sprint B of three: A → **B** → ship)
**Branch:** `release/v0.9.0`
**Baseline:** `2d6b540` (Sprint A close — CI green, real-e2e green 8x since V4)
**Sprint goal:** Audit-team 5-role pass + close all Blockers + close 3 carry-overs from Sprint A
**Sprint gate:** Audit-team returns 0 Blockers, all Criticals fixed-or-explicitly-deferred-with-Scott-approval, Sprint-end re-audit-lite scoped to changed files returns 0 new Criticals
**This is NOT v1.0 ship.** This is Sprint B's calibration gate.

---

## Discipline (layered audit pattern)

- **Per-commit:** careful-coding 9-step
- **Per checkpoint (every 2-3 commits):** lint clean + changed-file tests + diff review
- **Per sprint end:** audit-lite scoped to changed files (NOT unscoped re-audit)
- **Mid-sprint overflow:**
  - **Blocker** stops sprint; surface to Scott; renegotiate scope
  - **Critical** fix only if it fits remaining time; otherwise queue with Scott approval
  - **Major** → queue to v1.1 in `next-cleanup.md` with file path
  - **Minor / Nit** → collect in `next-cleanup.md`
- **Scoped re-audits only.**

## Pre-flight gate

- [x] Sprint A approved by Scott (this dispatch)
- [x] CI green at baseline `2d6b540`
- [x] Real-e2e green at baseline (8 consecutive successes since V4)
- [x] `next-cleanup.md` carries 3 Sprint B items
- [x] `docs/v1.0-milestone.md` Sprint B section governs scope

---

## Sprint B checklist

### B1 — `/audit-team` 5-role parallel pass

- [x] Run `/audit-team` skill scoped to `release/v0.9.0` HEAD
- [x] 5 roles: Engineering / UX / Documentation / Tests / QA
- [x] Output package lands at `audit-agentsuitelocal-2026-05-08/` (or similar dated dir)
- [x] Read `00-executive-audit.md` and `sprint-punchlist.md` end-to-end
- [x] VERIFICATION_LOG entry: audit-team output URL/path, finding counts by role, total Blocker/Critical/Major/Minor/Nit counts

### B2 — Triage audit-team findings

- [ ] Group findings by severity
- [ ] **Every Blocker** → fix this sprint (no exceptions)
- [ ] **Every Critical that fits** → fix this sprint
- [ ] **Critical-doesn't-fit** → STOP and surface to Scott for explicit defer-or-stretch decision
- [ ] **Major** → append to `next-cleanup.md` with file path + reason
- [ ] **Minor / Nit** → append to `next-cleanup.md` (or fix inline if trivial single-line)
- [ ] VERIFICATION_LOG entry: triage decisions per finding ID

### B3 — Fix B1 Blockers (if any)

- [ ] careful-coding 9-step on each fix
- [ ] One commit per logical Blocker close
- [ ] Push, wait CI green per commit
- [ ] VERIFICATION_LOG entry per fix

### B4 — Fix B1 Criticals that fit

- [ ] careful-coding 9-step on each fix
- [ ] One commit per logical Critical close
- [ ] Push, wait CI green per commit
- [ ] VERIFICATION_LOG entry per fix

### B5 — Carry-over from Sprint A: PipelineCard React `key` prop warning

- [ ] `web/src/components/app/PipelineView.jsx:344` — add a unique `key` prop to the `<PipelineCard>` map
- [ ] Vitest no longer emits the React `key` warning for PipelineView
- [ ] careful-coding 9-step
- [ ] VERIFICATION_LOG entry: file:line, vitest output before/after

### B6 — Carry-over: move `next-cleanup.md` to `docs/`

- [ ] `git mv next-cleanup.md docs/next-cleanup.md`
- [ ] Update any references in HANDOFF.md, RELEASE_PLAN.md, VERIFICATION_LOG.md, docs/v1.0-milestone.md
- [ ] careful-coding 9-step (fan-out grep for `next-cleanup.md` references)
- [ ] VERIFICATION_LOG entry

### B7 — Carry-over: MOCKING_AUDIT INTERNAL-SUSPECT-REFACTOR (9 sites)

- [ ] Read `docs/MOCKING_AUDIT.md` for the per-site recommendations
- [ ] Convert `_save_state`, `_log_telemetry`, `_send_notification`, `_load_settings` from module-level functions to dependency-injected callables (likely via FastAPI `Depends` or a `RuntimeEnv`/`AppContext` dataclass)
- [ ] Update each affected test in `tests/test_execution_state_machine.py` (and siblings) to substitute boundary implementations instead of mock-patching internal callables
- [ ] All non-deleted tests still pass
- [ ] CI green on the resulting commit
- [ ] **Acceptance:** 0 INTERNAL-SUSPECT-REFACTOR sites remain; `docs/MOCKING_AUDIT.md` updated to reflect closures
- [ ] VERIFICATION_LOG entry: per-site classification table now showing CLOSED for the 9 sites

### B8 — D4: Remove `real-e2e.yml` push trigger on `release/v0.9.0`

- [ ] Per `docs/v1.0-milestone.md` D4 decision: Sprint B removes the sprint-time `release/*` push trigger from `.github/workflows/real-e2e.yml`
- [ ] Keep cron + tag + opt-in PR-label triggers
- [ ] Verify the next push to `release/v0.9.0` does NOT auto-trigger real-e2e (a `release/v1.0.0` rename in Sprint C will need its own trigger if desired)
- [ ] VERIFICATION_LOG entry: workflow file diff + confirmation that next push doesn't auto-trigger

### B9 — Doc-rewrite drafts from audit-team

- [ ] If `/audit-team` produced `doc-rewrites/` drafts: review each, merge what's accurate, reject what's wrong with reason
- [ ] If no drafts produced: skip this item; note in VERIFICATION_LOG
- [ ] careful-coding 9-step on each merge

### B10 — Scoped re-audit-lite

- [ ] Run `/audit-lite` 4-lens scoped to the diff `2d6b540..HEAD` (Sprint B's diff only)
- [ ] **0 Critical, 0 Blocker** — these would re-open Sprint B
- [ ] ≤2 Major findings (each with explicit "fold or queue?" decision)
- [ ] AUDITOR-RUN tagging on every Critical/Blocker
- [ ] VERIFICATION_LOG entry: full punchlist appended

### B11 — Sprint B ship gate (HARD STOP)

- [ ] All B1–B9 items have VERIFICATION_LOG entries
- [ ] B10 audit-lite returns 0 Critical / 0 Blocker
- [ ] All CI workflows on the final commit are green
- [ ] No outstanding Blocker or Critical from B1's audit-team
- [ ] **STOP. Hand off to Scott for calibration. Do NOT proceed to Sprint C.**

---

## Out of scope for Sprint B

Slipped to v1.1 explicitly (locked in `docs/v1.0-milestone.md`):
- Recovery sweeps (Ollama crash, model corruption, disk full, key revoke, concurrent runs robustness)
- Performance baseline / benchmarks
- Frozen API surface / schema-change CI
- A11y Bar 2 / Bar 3 (skip-link, ARIA labels, full WCAG AA, screen-reader audit)
- Multi-instance, plugin system, auto-update, Linux installer, Windows arm64, full localization

If a finding from `/audit-team` falls into one of these areas:
- **Blocker** → STOP; surface to Scott; renegotiate
- **Critical** → only fix if fits; otherwise queue
- **Major / Minor / Nit** → queue in `next-cleanup.md`

Sprint C scope (NOT this sprint):
- Tag v1.0.0
- Cleanroom Docker E2E (final integrity gate)
- PyInstaller builds Win/macOS/Linux
- 24h CI green hold
- Generate release notes
- v1.0 ship gate (final Scott approval)

---

## Hard stop

The orchestrator MUST NOT proceed past B11 without Scott approval. Sprint B's "ship gate" is a calibration gate, not the v1.0 release gate. The next step after B11 is a fresh `/ship` invocation for Sprint C (the actual v1.0 tag).
