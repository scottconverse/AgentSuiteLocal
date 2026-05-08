# AgentSuiteLocal — Session Handoff

**Updated:** 2026-05-08 (Sprint B close)
**Branch:** `release/v0.9.0` at `9654f31`
**State:** Sprint A + Sprint B BOTH COMPLETE — awaiting Scott calibration approval before Sprint C (the v1.0 ship sprint)

---

## TL;DR

Two of three v1.0 sprints closed. **Sprint C is the v1.0 ship sprint and requires explicit Scott approval before dispatch.** Do NOT auto-proceed.

## What Sprint B delivered (since the prior handoff)

9 commits (`757a5c3` → `9654f31`):

- **B1** `/audit-team` 5-role pass — 0 Blocker / 1 Critical / 4 Major (all triaged into existing items)
- **B2** Triage per overflow rule
- **B3** N/A (0 Blockers)
- **B4** UX-B-001 Critical absorbed by B5
- **B5** PipelineCard `key` prop fix + UX-B-001 mock field rename
- **B6** `next-cleanup.md` moved to `docs/`
- **B7** **MOCKING_AUDIT 9-site DI refactor** — `_save_state` / `_log_telemetry` / `_load_settings` converted to optional-default-callable kwargs. `_send_notification` reclassified BOUNDARY-OK
- **B8** D4: `real-e2e.yml` `release/*` push trigger removed
- **B9** Audit-team doc-rewrites merged (architecture currency + FAQ)
- **B10** Scoped re-audit-lite — **0 of every severity** (genuinely clean)
- **B11** Hard stop reached

## Sprint C scope (when Scott approves)

The Sprint C plan was drafted in chat but **never landed on disk** (interrupted). Next session must write it fresh from `docs/v1.0-milestone.md` Sprint C section. High level:

1. **C1 — Version bump fan-out.** `__version__.py` (0.8.9), `web/package.json` (0.7.1 — known mismatch), ManualView.jsx version stamp, README, USER-MANUAL/user-manual.md, docs/troubleshooting.md, docs/index.html, AgentSuiteLocal.iss.
2. **C2 — CHANGELOG `[Unreleased]` → `[1.0.0] — YYYY-MM-DD`.**
3. **C3 — README "Recent releases" v1.0.0 paragraph + landing page.**
4. **C4 — Pre-tag CI gate (7/7 jobs green on final commit).**
5. **C5 — Generate `docs/release-notes-v1.0.0.md`.**
6. **C6 — Final ship gate (HARD STOP — Scott explicit approval, then tag).**
7. **C7 — Tag `v1.0.0` on `release/v0.9.0` (no rename), GitHub Actions auto-builds artifacts, `gh release create`.**
8. **C8 — Post-ship: merge to main, update HANDOFF.md, write v1.0-shipped memory file.**

## Critical pre-Sprint-C lessons (do not repeat)

1. **Pass standing directives EXPLICITLY into every subagent dispatch prompt.** This session's "narrate as you work" instruction was given hours ago, not honored by the orchestrator dispatch I built, then misinterpreted as Sprint C approval at the calibration gate. Both errors. Fix: when Scott gives a how-to-work directive, bake it into every subsequent Agent dispatch as a per-item explicit instruction.

2. **Calibration gates are LOAD-BEARING.** Sprint B → Sprint C dispatch is multi-hour autonomous work touching a release branch. Auto mode does NOT authorize that — it explicitly requires "ask and wait" for material shared-system changes. Approval requires a literal go/yes/ship signal. Ambiguous directives are not approval.

3. **Long subagent runs queue user messages.** Scott sees grey-out during runs. Structural Claude Code behavior; not project-specific. Mitigate via shorter dispatches with more frequent return-to-user gates, or Esc-to-abort.

## Awaiting Scott

Three options at this calibration gate:

**A — "Sprint B approved. Kick off Sprint C."** → Next session writes Sprint C `RELEASE_PLAN.md`, dispatches orchestrator with explicit per-item narration instruction. Stops at C6 hard stop for tag approval.

**B — "Soft-fail — fix X first."** → Name the gap.

**C — "Hard-fail / pause / replan."** → Stop, replan, or ship `v0.9.0` from current state and defer 1.0.

## Locked decisions

- No code-signing cert (free OSS)
- No agentsuite tag pushes — pin via commit SHA. Current `4bd7869` = v1.1.1.
- Tag v1.0.0 directly on `release/v0.9.0` — do NOT rename branch
- Concurrent runs deferred to v1.1
- A11y bar Bar 1 only for v1.0 (Bar 2/3 → v1.1)
- 3-sprint plan replaces prior 10-sprint plan; slipped-to-v1.1 list is binding

## Slipped to v1.1 (locked, do NOT pull back)

Recovery sweeps, performance baseline, frozen API surface, Bar 2/3 a11y, multi-instance, plugin system, auto-update, Linux installer, Windows arm64, full WCAG AA, screen-reader audit, localization. v1.1 backlog lives in `docs/next-cleanup.md`.

## Files to read first next session

In order:
1. This file
2. `RELEASE_PLAN.md` — currently the Sprint B plan (all boxes ticked except STOP marker)
3. `VERIFICATION_LOG.md` — full evidence trail across both sprints
4. `docs/v1.0-milestone.md` — three-sprint plan (Sprint C section is the next-session blueprint)
5. `docs/next-cleanup.md` — v1.1 backlog
6. `docs/MOCKING_AUDIT.md` — should show 9 sites CLOSED after B7

## Branch state

- `main` at `2269117`
- `release/v0.9.0` at `9654f31` (Sprint B close)
- `v0.8.9` tag at `fe0e75e`
- AgentSuite repo `main` at `4bd7869` (v1.1.1)
- Working tree clean

## Combined Sprint A + B statistics

| Metric | Value |
|---|---|
| Sprint A commits | 22 + 1 handoff (`5d9fef0` → `2d6b540`) |
| Sprint B commits | 9 (`757a5c3` → `9654f31`) |
| CI green on every commit since | `0992e9a` |
| Real-e2e successes since V4 fix | 8 consecutive |
| Audit-lite finding counts (Sprint A end) | 0 / 0 / 0 / 1 / 2 |
| Audit-team finding counts (Sprint B B1) | 0 / 1 / 4 / N / N (all triaged) |
| Re-audit-lite (Sprint B end) | 0 / 0 / 0 / 0 / 0 |
| Tests added | `test_qa_score_schema_contract.py`, `tests/e2e/test_a11y.py`, Vitest a11y suite, MOCKING_AUDIT refactor reduced internal-mock-suspect count to 0 |
