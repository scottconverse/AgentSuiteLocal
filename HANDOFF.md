# AgentSuiteLocal — Session Handoff

**Updated:** 2026-05-08
**Branch:** `release/v0.9.0` at `1e6fe19`
**State:** Sprint A FULLY COMPLETE — awaiting Scott calibration approval before Sprint B

---

## TL;DR

Three-sprint v1.0 plan (replaces the prior 10-sprint plan). **Sprint A done.** 22 commits on `release/v0.9.0` since `5d9fef0`. CI green every commit. Real-e2e green 8 consecutive runs. Hard stop reached.

## What Sprint A delivered

11 plan items + 5 Scott-escalated loose ends:

- **A1** `RunRequest.constraints` removed (D1)
- **A2** "Run failed within 3s" e2e assertion restored
- **A3** `xfail` removed from `tests/test_real_founder_run.py`
- **V4** `qa_score` reads agentsuite `QAReport.average` (the deepest find — silent bug since the QA schema landed)
- **A4** `docs/MOCKING_AUDIT.md` — 48 mock sites classified
- **A5** Concurrent-run limitation declared in 3 docs (D3)
- **A6** A11y Bar 1 code-only (aria-current, role=dialog, Esc, focus-rings) (D2)
- **A7** Bundle smoke CI on macOS + Windows (catches v0.8.7-class regressions)
- **A8** CHANGELOG + README current
- **A9** Sprint-end audit-lite — CLEAN (0 Critical / 0 Blocker / 0 Major)
- **A10** Hard stop ✓
- **#1** Mock LLM contract fixed; e2e xfail removed; CI Playwright green
- **#2** A11y Bar 1 runtime tests added (`tests/e2e/test_a11y.py`, 5 tests)
- **#3** Real-e2e green on absolute HEAD
- **#4** Bundle smoke also runs on PRs to main (was: release/* + tags only)
- **#5** `tests/e2e/conftest.py` env-var leak fixed via session-scoped autouse fixture

## Awaiting Scott

The orchestrator does NOT auto-proceed to Sprint B per the layered audit pattern. Three options:
1. **Approve Sprint A → kick off Sprint B** (audit-team + 3 carry-overs)
2. Soft-fail (name the gap)
3. Hard-fail / pause

## Sprint B queue (in `docs/next-cleanup.md`)

Three items survived the loose-ends batch:
1. MOCKING_AUDIT INTERNAL-SUSPECT-REFACTOR — 9 sites (refactor `_save_state` / `_log_telemetry` / `_send_notification` / `_load_settings` from module-level to DI)
2. PipelineCard React `key` prop warning at `web/src/components/app/PipelineView.jsx:344` (pre-existing)
3. Move `next-cleanup.md` from repo root to `docs/` (closed in Sprint B B6)

Plus whatever audit-team surfaces. Sprint B's centerpiece is the `/audit-team` heavyweight 5-role review — the only one before v1.0 ship.

## Sprint C (after Sprint B)

Tag v1.0.0, cleanroom Docker E2E, PyInstaller builds for Win/macOS/Linux, 24h CI green hold, generate release notes from CHANGELOG, ship.

## Locked decisions

- **No code-signing cert** for v1.0 (free OSS, users decide)
- **No agentsuite tag pushes** — pin via commit SHA. Current pin `4bd7869` = v1.1.1 (V1+V2 closed at the source)
- **Concurrent runs deferred to v1.1** — documented as v1.0 limitation in README + user-manual + FAQ
- **A11y bar for v1.0 is Bar 1** (Tab nav, focus rings, aria-current, no traps). Bar 2/3 → v1.1
- **gemma4 IS a real Ollama family** (e2b/e4b/26b) — verify against live registry, not training memory

## Files to read first next session

- `RELEASE_PLAN.md` — Sprint A as executed
- `VERIFICATION_LOG.md` — full timestamped evidence trail (~280 lines)
- `docs/v1.0-milestone.md` — three-sprint plan
- `docs/MOCKING_AUDIT.md` — Sprint B's INTERNAL-SUSPECT-REFACTOR table
- `docs/next-cleanup.md` — 3 carry-overs
- This file (`HANDOFF.md`) — rewritten as a quick orientation

## Slipped to v1.1 (locked, do not pull back into v1.0)

- Recovery sweeps (Ollama crash, model corruption, disk full, key revoke, concurrent runs robustness)
- Performance baseline + benchmarks/
- Frozen API surface + schema-change CI
- A11y Bar 2/3 (skip-to-content, ARIA labels on icon-only buttons, alt text, full WCAG AA, screen-reader audit)
- Linux installer, Windows arm64, multi-instance, plugin system, auto-update

## Branch state

- `main` at `2269117` (post-v0.8.9 doc fixes; not touched this session)
- `release/v0.9.0` at `1e6fe19` (Sprint A complete)
- `v0.8.9` tag at `fe0e75e` (last shipped release)
- AgentSuite repo `main` at `4bd7869` (v1.1.1)
- Working tree clean

## Sprint A statistics

| Metric | Value |
|---|---|
| Commits | 22 (`5d9fef0` → `1e6fe19`) |
| CI green on every commit since | `0992e9a` |
| Real-e2e successes since V4 fix | 8 consecutive |
| Audit-lite findings at A9 | 0 Critical / 0 Blocker / 0 Major / 1 Minor / 2 Nit |
| New tests | `test_qa_score_schema_contract.py` (4), `tests/e2e/test_a11y.py` (5), Vitest a11y (8 across 3 files) |
| Sprint B queue (was 5, now) | 3 items |
