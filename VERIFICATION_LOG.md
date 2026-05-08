# VERIFICATION_LOG.md — v1.0 Sprint A

**Branch:** release/v0.9.0
**Baseline:** 0992e9a
**Started:** 2026-05-07

Each entry = one Sprint A item completion or one orchestrator phase transition.
Format: `[YYYY-MM-DD HH:MM TZ] [item_id] [actor] evidence`.

---

## Pre-flight

[2026-05-07 ~17:50 UTC] [pre-flight] [orchestrator-claude] Real-e2e on d707fac: success (1h5m59s). V1+V2 closed at the source. Run URL: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25512395387
[2026-05-07 ~21:33 UTC] [pre-flight] [orchestrator-claude] CI on 0992e9a: success (8m42s). Run URL: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25522912448
[2026-05-07 ~21:35 UTC] [pre-flight] [orchestrator-claude] D1-D4 decisions locked in docs/v1.0-milestone.md commit 0992e9a
[2026-05-07 ~16:30 UTC] [pre-flight] [orchestrator-claude] agentsuite==1.1.1 (commit 4bd7869) verified active via python -c "import agentsuite; print(agentsuite.__version__)"

---

## Sprint A items

[2026-05-07 21:42 UTC] [A1] [orchestrator-claude] Removed dead `RunRequest.constraints` field. Initial commit 2cb8cf8 was tagged `feat(api)!:` with a `BREAKING CHANGE:` footer; on review that classification was incorrect because `RunRequest` does not set `model_config` with `extra="forbid"`, so Pydantic v2's default `extra="ignore"` applies and old clients sending `{"constraints": ...}` continue to parse cleanly (field silently dropped, same observable behavior as before). Amended to `refactor(api):`, dropped `BREAKING CHANGE:` footer, added wire-compat note. Final SHA: `b8c5397` (force-with-lease pushed to origin/release/v0.9.0).
  - File changed: agentsuitelocal/api/schemas.py (1 deletion, line 30 `constraints: str | None = None`)
  - Fan-out grep `grep -rn "RunRequest.*constraints\|constraints.*RunRequest" agentsuitelocal/ tests/` → 0 matches
  - Fan-out grep `grep -rn "\.constraints\|constraints=" agentsuitelocal/ tests/` → 0 matches in production or test code
  - Tests: `python -m pytest tests/test_api.py -k run -q` → 31 passed
  - Lint: `python -m ruff check agentsuitelocal/api/schemas.py` → clean
  - Push: `git push --force-with-lease origin release/v0.9.0` → `5d9fef0..b8c5397`

[2026-05-07 21:44 UTC] [A2] [orchestrator-claude] Restored "Run failed within 3s" assertion in tests/e2e/test_new_run.py (lines 106-115). Reverts the narrowing from `fdd8da4`. Concern surfaced and recorded in commit body: substring-router MockLLMProvider returns prose for `extract` stage → founder agent's `extract` step raises "extract stage produced invalid JSON: ..." → "Run failed" surfaces in UI → A2 test goes red. The W-1 fix (harden mock to return JSON for extract/qa) is queued for A4. Per Sprint A discipline ("tests must encode honest expectations"), the assertion is restored regardless; CI is the gate.
  - File changed: tests/e2e/test_new_run.py (lines 106-115, 10 insertions / 8 deletions)
  - Commit SHA: `108b322`
  - Lint: `python -m ruff check tests/e2e/test_new_run.py` → All checks passed!
  - Push: `git push origin release/v0.9.0` → `b8c5397..108b322`
  - CI run: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25523786160 (in_progress at log-time; will be observed alongside the A3 real-e2e poll below)
  - real-e2e run on same commit: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25523786166 (in_progress at log-time)

[2026-05-07 21:46 UTC] [A3] [orchestrator-claude] Removed `@pytest.mark.xfail` decorator from `tests/test_real_founder_run.py::test_founder_run_produces_approveable_artifacts` (V1+V2 case). Closed at the source by the agentsuite v1.1.1 repin already active on this branch (commit 4bd7869, pre-flight verified). Updated stale qa_score-assertion comment to record closure + watchlist trigger.
  - File changed: tests/test_real_founder_run.py (7 insertions, 21 deletions; lines 128-142 decorator block removed; lines 210-215 comment rewritten)
  - Commit SHA: `b63a6ad`
  - Lint: `python -m ruff check tests/test_real_founder_run.py` → All checks passed!
  - Push: `git push origin release/v0.9.0` → `108b322..b63a6ad`
  - Real-e2e CI run on `b63a6ad`: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25523865539 — POLLING (in_progress at log-time; baseline d707fac took 1h5m59s)



## A3 follow-up — V4 root cause: AgentSuiteLocal field-name mismatch

[2026-05-07 ~22:55 UTC] [A3-failure] [orchestrator-claude] Real-e2e on b63a6ad: FAILED. Run URL: https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25523865539. Failure: AssertionError qa_score is None at tests/test_real_founder_run.py:217.

[2026-05-07 ~22:58 UTC] [A3-rca] [orchestrator-claude] Root cause identified: NOT in agentsuite v1.1.1. The agentsuite V1+V2 fix is working correctly (run reaches "approval" not "error", qa_scores.json is written with 0.0 scores). The bug is in AgentSuiteLocal's qa_scores.json reader (agentsuitelocal/api/execution.py:358-363 and :449-454): tries field names "weighted_score","overall_score","score","overall" — none of which are in agentsuite's QAReport schema. The canonical field is "average" (agentsuite/kernel/qa.py:21). Result: qa_score has been silently None on every real-LLM run, masked by the test's xfail strict=False marker until A3 removed it.

[2026-05-07 ~23:00 UTC] [A3-fix] [orchestrator-claude] Fixed both call sites to add "average" to _first_defined chain (kept legacy field names as fallbacks for forward-compat). Added contract test tests/test_qa_score_schema_contract.py with 4 assertions: schema field name, JSON round-trip, 0.0 preservation, scores dict name. 4 passed. Full subset (113 tests including execution_integration, execution_state_machine, api): all pass. Ruff clean.

[2026-05-07 ~23:00 UTC] [A2-status] [orchestrator-claude] A2 CI failure confirmed as predicted: substring-routed MockLLMProvider returns prose for extract stage, production correctly rejects as non-JSON, "Run failed" surfaces. This is evidence that A4 mocking audit is required, not a regression. A2 commit (108b322) is correct and stays.



## A4 — MOCKING_AUDIT.md classification only (Q1=b two-phase)

[2026-05-08 01:02 UTC] [A4] [orchestrator-claude] Produced docs/MOCKING_AUDIT.md classification table. Sprint A4 is classification-only per Q1=(b); no tests modified. Sprint B will action recommendations.
  - Doc path: docs/MOCKING_AUDIT.md
  - Commit: `1f43795` (`docs(tests): add MOCKING_AUDIT.md classification (A4)`)
  - Push: `git push origin release/v0.9.0` → `fb503fc..1f43795`
  - Total real mock call sites classified: **48** (across 5 files: test_launcher.py, test_cli.py, test_dependencies.py, test_api.py, test_execution_state_machine.py)
  - Excluded from count: 8 `client.patch("/api/...")` HTTP-verb calls in tests/test_api.py (FastAPI TestClient, not unittest.mock.patch)
  - Breakdown:
    - BOUNDARY-OK: **23** (OS socket / OS thread / OS browser / filesystem / third-party Ollama/uvicorn SDK)
    - INTERNAL-JUSTIFIED: **16** (state-machine wiring contracts in test_execution_state_machine.py; the file's docstring already acknowledges TEST-CRIT-001 and delegates resolver-path coverage to test_dependencies.py + test_real_founder_run.py)
    - INTERNAL-SUSPECT-REFACTOR: **9** (`_save_state` / `_log_telemetry` / `_send_notification` / `_load_settings` patches — Sprint B should convert these module-level helpers to injected dependencies)
    - INTERNAL-SUSPECT-DELETE: **0** (1 deferred candidate: `test_execute_run_completes_without_module_not_found_error` overlaps with `test_execute_run_emits_progress_events`; Sprint B fold decision)
  - Per-file:
    - tests/test_launcher.py: 5 sites — 5 BOUNDARY-OK
    - tests/test_cli.py: 9 sites — 9 BOUNDARY-OK
    - tests/test_dependencies.py: 1 site — 1 BOUNDARY-OK (forces ImportError on agentsuite.llm.ollama.OllamaProvider to verify resolver error capture)
    - tests/test_api.py: 1 real mock site — 1 INTERNAL-JUSTIFIED (`_DB_FILE` redirect for F1 crash recovery test; pseudo-boundary)
    - tests/test_execution_state_machine.py: 32 sites — 15 INTERNAL-JUSTIFIED + 9 INTERNAL-SUSPECT-REFACTOR + 8 BOUNDARY-OK



## A5 — Concurrent-run limitation declared (D3)

[2026-05-08 01:08 UTC] [A5] [orchestrator-claude] Declared v1.0 one-run-per-session limitation in README, user manual, and FAQ.
  - Files changed: README.md (+1 line), docs/user-manual.md (+1 line), docs/FAQ.md (+3 lines)
  - Read fan-out: grep "concurrent|parallel run|multiple runs|simultaneous" across .md files; existing claims (user-manual.md:274 "multiple agents in parallel — Not yet, pipelines queue sequentially") were correct for the in-pipeline case and were left intact. The new claim covers session-level concurrent runs (a different concept).
  - README.md line 326 (under "Known issues (v0.8.9)"): "One run at a time per session. v1.0 supports a single active agent run (or pipeline step) per AgentSuiteLocal session... Concurrent runs land in v1.1."
  - docs/user-manual.md line 275 (under "10. FAQ"): new line "Can I run multiple runs at the same time? No. v1.0 supports one active run (or pipeline step) at a time per session. Concurrent runs land in v1.1."
  - docs/FAQ.md line 46 (under "Running agents"): new Q&A "Can I run multiple agents at the same time?" pointing at the user-manual entry.
  - Commit: `a4989d7` (`docs: declare v1.0 one-run-per-session limitation (A5/D3)`)
  - Push: `git push origin release/v0.9.0` → `1f43795..a4989d7`



## A6 — Bare-min a11y, code-only (Q2=b)

[2026-05-08 01:10 UTC] [A6] [orchestrator-claude] Implemented Bar-1 a11y improvements: aria-current on Sidebar, role/aria-modal on the override dialog, Esc-to-close on the override dialog. No browser driving, no screenshots (per Q2=b). All Vitest tests passing.
  - **Files changed:**
    - `web/src/components/shell/index.jsx` — added `aria-current="page"` to active button in both top nav (`items.map`) and bottom nav (`bottom.map`).
    - `web/src/components/app/ApprovalGateView.jsx` — added `useEffect` Esc handler scoped to `overrideDialog`; added `role="dialog"` + `aria-modal="true"` + `aria-label` to the override-dialog overlay.
  - **Files added:**
    - `web/src/components/shell/Sidebar.test.jsx` — 4 tests: active sets aria-current=page, inactive does not, bottom nav (settings) gets aria-current, exactly one nav button has aria-current at any time.
    - `web/src/styles.test.js` — 2 tests: `:focus-visible` block declares `outline: 2px solid var(--accent)` and `outline-offset: 2px`; `:focus:not(:focus-visible)` declares `outline: none`.
  - **Files modified (test):**
    - `web/src/components/app/ApprovalGateView.test.jsx` — 2 new tests: dialog announces role=dialog + aria-modal=true; dialog closes on Escape keypress.
  - **Focus-ring CSS:** Already present in `web/src/styles.css` lines 80–85 (UX-008 from prior work). No CSS change needed; new test adds a regression guard.
  - **Test results:**
    - Targeted: `npx vitest run src/components/shell/Sidebar.test.jsx src/styles.test.js src/components/app/ApprovalGateView.test.jsx` → 14 passed (3 files).
    - Full vitest suite: 114 passed (18 files).
  - **Lint:** Project does not have an `eslint.config.*` (vitest is the gate); skipped. Test pass is the contract.
  - **Modal coverage:** Only one fixed-overlay modal exists (`ApprovalGateView` override dialog). Grep `position:.{0,3}["']?fixed["']?` on `web/src/components/app/` matched only `ApprovalGateView.jsx:290`. NewRunView and ModelView do not have modal overlays — they use inline panels and full-page views, so no Esc handler is needed.

### Manual a11y checklist for Scott (pre-A10 ship gate)

Walk this once before shipping. For each row, check the box if the answer is yes; flag if no. Tests in CI cover the *code* paths but not *visual* tab order or *perceived* contrast.

| View | Tab order OK? | Focus rings visible? | Esc closes modal? | aria-current set on active sidebar item? |
| --- | --- | --- | --- | --- |
| Dashboard | [ ] | [ ] | n/a (no modal) | [ ] |
| New Run | [ ] | [ ] | n/a (no modal) | [ ] |
| Live Run | [ ] | [ ] | n/a (no modal) | [ ] |
| Runs | [ ] | [ ] | n/a (no modal) | [ ] |
| Pipelines | [ ] | [ ] | n/a (no modal) | [ ] |
| Kernel | [ ] | [ ] | n/a (no modal) | [ ] |
| Manual | [ ] | [ ] | n/a (no modal) | [ ] |
| Settings | [ ] | [ ] | n/a (no modal) | [ ] |
| Approval Gate (override dialog) | [ ] | [ ] | [ ] (Esc) | [ ] |

Notes:
- "Focus rings visible?" — Tab through the page and confirm a 2px terracotta (`--accent`) outline appears on every focused element. Mouse clicks should not show the outline (only keyboard focus does, by `:focus-visible`).
- "aria-current set on active sidebar item?" — open browser devtools, inspect the active sidebar button, confirm `aria-current="page"` is present. Inactive buttons should NOT have the attribute.
- Esc key: trigger by clicking "Override & approve" on a sub-7.0 run → dialog appears → press Escape → dialog must dismiss.



## A7 — Post-PyInstaller bundle smoke CI (D2)

[2026-05-08 01:18 UTC] [A7] [orchestrator-claude] Added bundle-smoke step to existing build-macos job and a parallel new build-windows job. Both launch the PyInstaller-built bundle, wait for launcher.port.json, GET /api/health, kill cleanly. Catches v0.8.7-class regressions (missing hidden import).
  - File changed: `.github/workflows/ci.yml` (+117 lines, -1 line)
  - **build-macos:** appended "Bundle smoke (launch + /api/health)" step. Extended `if:` from `main || tags` to also include `release/*` so v0.9.0 gets coverage.
  - **build-windows (NEW):** mirror of build-macos for windows-latest. PyInstaller build → launches `dist/AgentSuiteLocal/AgentSuiteLocal.exe` via Start-Process → polls `$env:USERPROFILE\.agentsuitelocal\launcher.port.json` up to 30s → reads bound port → Invoke-WebRequest /api/health → Stop-Process. Gates on `main || tags || release/*`.
  - **`BROWSER=echo`** set before bundle launch on both platforms so launcher.py's `webbrowser.open(url)` doesn't block on headless CI runners.
  - **No duplication:** existing build-macos's bundle-structure verify step is preserved; smoke is appended after, not replaced.
  - **YAML validated locally:** `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → "YAML OK"
  - Commit: `402d17b` (`ci: post-PyInstaller bundle smoke on macOS + Windows (A7)`)
  - Push: `git push origin release/v0.9.0` → `f8b9d08..402d17b`
  - **CI run on `402d17b`:** https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25530950254 — POLLING (in_progress at log-time). build-macos and build-windows will be the new gates.
  - **If smoke fails:** per dispatch, STOP A8/A9 and surface as Blocker. Smoke result will be captured in [CHECKPOINT-A8] entry.



## A8 — CHANGELOG + README currency

[2026-05-08 01:25 UTC] [A8] [orchestrator-claude] CHANGELOG `[Unreleased]` and README "Recent releases" updated with every Sprint A change.
  - Files changed: CHANGELOG.md (+16 lines), README.md (+2 lines)
  - **CHANGELOG `[Unreleased]`:**
    - Added under "Fixed": V4 root cause + fix (qa_score=None from `QAReport.average` field-name mismatch).
    - New "Added (Sprint A — v0.9 milestone)" section: agentsuite v1.1.1 repin (V1+V2 closed), A3 xfail removal, A3-RCA contract test, MOCKING_AUDIT (A4), one-run-per-session docs (A5), a11y Bar 1 (A6), bundle smoke CI (A7).
    - New "Changed (Sprint A — v0.9 milestone)" section: A1 dead constraints field removal, A2 e2e assertion restoration.
    - Style matched to existing CHANGELOG entries: Keep-a-Changelog headings, bold lead phrases, file paths in inline code, audit-issue IDs in parentheses.
  - **README "Recent releases":** added a v0.9.0 in-progress paragraph above the table summarizing every Sprint A change.
  - **Style read fan-out:** `head -30 CHANGELOG.md` confirmed Keep-a-Changelog format; existing v0.8.9 entries use `**ID-NAME (Severity, Category) — Title.**` pattern; new Sprint A entries follow the same pattern with `(A1)` / `(A2)` etc. as the equivalent ID.
  - Commit: `b8de7f7` (`docs: CHANGELOG + README currency for Sprint A (A8)`)
  - Push: `git push origin release/v0.9.0` → `402d17b..b8de7f7`



## [CHECKPOINT-A8]

[2026-05-08 01:27 UTC] [CHECKPOINT-A8] [orchestrator-claude] Sprint A items A4 → A8 completed and pushed. **STOPPING per dispatch.** Reason: A9 audit-lite needs the final commit state INCLUDING a real-e2e green on the latest commit. Real-e2e was auto-triggered on `fb503fc` (V4 fix) and again on subsequent commits; the audit-lite gate must wait for one of these to land green.

**Commits pushed in this dispatch (A4 → A8):**
1. `1f43795` — `docs(tests): add MOCKING_AUDIT.md classification (A4)`
2. `a4989d7` — `docs: declare v1.0 one-run-per-session limitation (A5/D3)`
3. `f8b9d08` — `feat(a11y): aria-current on Sidebar, Esc + role=dialog on override modal (A6)`
4. `402d17b` — `ci: post-PyInstaller bundle smoke on macOS + Windows (A7)`
5. `b8de7f7` — `docs: CHANGELOG + README currency for Sprint A (A8)`

**Branch state:** `release/v0.9.0` HEAD = `b8de7f7`. 5 commits ahead of pre-dispatch (`fb503fc..b8de7f7`).

**CI runs to monitor (when next dispatched):**
- Real-e2e on `fb503fc` (V4 fix): triggered ~01:00 UTC, ~75min ETA, awaits result for V4 acceptance.
- Real-e2e on `b8de7f7` (final A8 push): just triggered.
- CI on `b8de7f7`: triggered; will exercise the new bundle-smoke jobs (build-windows, expanded build-macos) for the first time. **Per dispatch: if smoke fails, STOP and surface as Blocker.**
- Reference: most recent CI list at log-time —
  - `25530950254` (CI on 402d17b) https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25530950254
  - `25530950256` (real-e2e on 402d17b) https://github.com/scottconverse/AgentSuiteLocal/actions/runs/25530950256

**Sanity sweep (between A6 and A7):** `python -m ruff check agentsuitelocal/ tests/` → "All checks passed!". `pytest tests/test_qa_score_schema_contract.py tests/test_execution_state_machine.py -q` → 9 passed. Frontend full vitest → 114 passed (18 files).

**Out-of-scope notes:** A4 only classified — no test refactors. A5 only added new claims; existing pipeline-parallelism claim preserved. A6 only code-only; manual a11y checklist appended for Scott to walk before A10 ship gate. A7 added a new `build-windows` job and augmented `build-macos`; no other workflows touched. A8 only added CHANGELOG + README sections; no other docs touched. RELEASE_PLAN.md modified state preserved untouched (Sprint A items A4-A8 not yet ticked there — that is the orchestrator's bookkeeping for the user, intentionally left for the next dispatch to confirm the green gate first).

**Next dispatch (NOT taken now):** A9 audit-lite + A10 ship gate. Will need: real-e2e green + CI green (including build-windows + build-macos bundle smoke) on whatever HEAD is at that time.
