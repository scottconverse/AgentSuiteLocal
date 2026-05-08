# next-cleanup.md

Items collected by the layered-audit overflow rule (Minor / Nit /
Critical-deferred-as-too-big). Burn down at the next sprint's audit-lite
or the v1.0 ship sprint.

---

## v1.0 Sprint B candidates (queued from Sprint A)

### MOCKING_AUDIT — INTERNAL-SUSPECT-REFACTOR (9 sites)

Source: `docs/MOCKING_AUDIT.md` (A4 classification). 9 internal-mock-suspect
test sites identified during Sprint A's classification pass. Refactor
recommendation per audit doc: convert `_save_state`, `_log_telemetry`,
`_send_notification`, `_load_settings` from module-level functions to
dependency injection so tests can substitute boundary implementations
instead of mock-patching internal AgentSuiteLocal callables.

**Scope:** ~9 test sites in `tests/test_execution_state_machine.py` and
sibling files. See `docs/MOCKING_AUDIT.md` for the full per-site list
and recommendations.

### Mock LLM contract gap → e2e xfail

`tests/e2e/test_new_run.py::test_new_run_dispatches_orchestrator_with_mock_llm`
is currently `@pytest.mark.xfail(strict=True, ...)` because the
substring-routed `MockLLMProvider` returns prose for the `extract` stage,
production correctly rejects as non-JSON, and "Run failed" surfaces in
<3s — the restored assertion fires.

**Sprint B fix path:**
1. Update the Mock LLM stage-response map in `tests/e2e/conftest.py` (or
   wherever the factory lives) so `extract` returns a JSON object that
   satisfies the agentsuite `extract_json` contract.
2. Verify the test now passes.
3. Remove the `@pytest.mark.xfail` decorator (strict=True will surface
   the unintended XPASS if you forget).
4. Confirm CI green on the resulting commit.

**Why xfail and not delete:** The test exercises the v0.8.7-class
"orchestrator never started" regression path. It's the only e2e that
catches that class. Real-e2e covers the same path with real Ollama, but
real-e2e is slow (75 min) and gated behind `release/*` push triggers —
mock-CI catches the regression in 5 minutes. Worth keeping; just needs
the mock to actually satisfy the agent contract.

---

## Items deferred from earlier audits (carried)

(none currently — fresh ledger)
