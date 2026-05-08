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
