# AgentSuiteLocal v1.0.0 — Release Notes

**Released:** 2026-05-08
**Branch:** `release/v0.9.0` → tagged `v1.0.0`
**Changelog:** [CHANGELOG.md — [1.0.0]](../CHANGELOG.md)

---

## What is v1.0.0?

AgentSuiteLocal v1.0.0 is the first stable release of the desktop UI for [AgentSuite](https://github.com/scottconverse/AgentSuite). It runs seven specialist AI agents (Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO) entirely on your machine via Ollama — no cloud, no API key required, no monthly bill. The v0.8.x line hardened reliability and supply-chain posture across three audit rounds; the v0.9 Sprints A and B closed the final pre-1.0 backlog; Sprint C stamps the version and ships.

The headline improvements in this release are the V4 `qa_score` fix (every real-LLM run now correctly surfaces a QA score at the approval gate), the DI refactor eliminating internal mock-patching in the test suite, and the a11y Bar 1 pass making the app keyboard-navigable. All seven CI jobs are green; the real-Ollama E2E gate has been validated on eight consecutive commits.

---

## Fixed

- **PDF export replaced WeasyPrint with reportlab** — WeasyPrint required the GTK3 native runtime (libgobject, libpango, libcairo) which is not bundled and must be installed separately on Windows. PDF export silently failed with a 501 on most fresh installs. Replaced with reportlab (pure Python, no native runtime). PDF export now works out of the box on all platforms.

- **`approve_run` state guard corrected** — the guard previously accepted runs in `"done"` state; individual runs never reach `"done"` (only pipeline steps do). Changed to `!= "waiting"` for symmetry with `reject_run`.

- **`ApprovalGateView` Approve button tooltip** — now shows a distinct message when the button is disabled by missing/failed QA score vs. below-threshold score. Previously always showed the score message, which rendered `null/10` when `qa_score` was absent.

- **`qa_score` was silently `None` on every real-LLM run (V4)** — `agentsuitelocal/api/execution.py` read `qa_scores.json` looking for fields named `weighted_score` / `overall_score` / `score` / `overall` — none of which are in agentsuite's `QAReport` schema. The canonical field is `average` (`agentsuite/kernel/qa.py:21`). Added `average` to the field-lookup chain at both call sites (kept legacy field names as forward-compat fallbacks). Added `tests/test_qa_score_schema_contract.py` (4 contract tests) to enforce the field-name agreement with agentsuite.

---

## Added

- **agentsuite repinned to v1.1.1** — V1 and V2 closed at the source.

- **`tests/test_real_founder_run.py` xfail removed (A3)** — the test now hard-asserts that a real founder run produces approve-able artifacts end-to-end with `qa_score` populated.

- **`tests/test_qa_score_schema_contract.py` (4 tests)** — schema contract guard against the V4 regression. Asserts `QAReport.average` field exists, round-trips JSON, preserves `0.0`, and uses the `dimensions`/`scores` shape AgentSuiteLocal reads.

- **`docs/MOCKING_AUDIT.md` (A4)** — classification-only audit of all 48 real mock call sites in `tests/`. 23 BOUNDARY-OK, 16 INTERNAL-JUSTIFIED, 9 INTERNAL-SUSPECT-REFACTOR (closed in Sprint B B7), 0 INTERNAL-SUSPECT-DELETE.

- **One-run-per-session limitation declared (A5)** — README `Known issues`, `docs/user-manual.md` FAQ, and `docs/FAQ.md` all state v1.0 supports one active run at a time per session. Concurrent runs land in v1.1.

- **a11y Bar 1 (A6)** — `Sidebar` sets `aria-current="page"` on the active item; `ApprovalGateView` override dialog has `role="dialog"` + `aria-modal="true"` + `aria-label` + Escape-to-close. Vitest static tests and Playwright runtime tests cover all of the above.

- **Bundle smoke CI on macOS + Windows (A7)** — `build-macos` and the new `build-windows` CI jobs launch the PyInstaller-built bundle, poll `launcher.port.json`, GET `/api/health`, and verify clean exit. Catches v0.8.7-class regressions where the bundle ships with a missing hidden import.

- **DI refactor for `_save_state` / `_log_telemetry` / `_load_settings` (B7)** — `_execute_run` and `_execute_pipeline_step` now accept these as optional-default-callable kwargs. All 9 INTERNAL-SUSPECT-REFACTOR test sites in `tests/test_execution_state_machine.py` converted from `unittest.mock.patch` to DI substitution. Test file is 5× faster; production call sites are unchanged.

---

## Changed

- **Removed dead `RunRequest.constraints` field (A1)** — field was unused everywhere; deleted from `agentsuitelocal/api/schemas.py`. Wire-compat preserved (Pydantic v2 `extra="ignore"` accepts old clients sending `constraints`).

- **E2E "Run failed within 3s" assertion restored (A2)** — was previously commented out; restored as the active gate for mock-LLM contract correctness.

- **PipelineCard React key fixed (B5)** — `key={step.agent}` (duplicate-agent-safe) changed to `key={i}`; test mock `agent_id` field corrected to `agent` matching the production data shape.

- **`next-cleanup.md` moved to `docs/` (B6)** — was at repo root; all path-string references updated across HANDOFF.md, RELEASE_PLAN.md, docs/v1.0-milestone.md.

- **`docs/architecture.md` Roadmap updated (B9)** — removed misleading code-signing line; added explicit "Not on the roadmap: code-signing certs" statement. Added v1.1 entries for streaming preview, concurrent runs, A11y Bar 2, recovery sweeps.

- **`docs/FAQ.md` version stamp and DMG link updated (B9)** — intro line updated to reflect v1.0.0; versioned DMG filename replaced with a link to the Releases page.

- **Real-e2e push trigger on `release/v0.9.0` removed (B8 / D4)** — prevents accidental 1-hour E2E runs on every documentation commit during the release sprint. Cron, tag, and labeled-PR triggers preserved.

---

## Removed

- **`_run_event_buffers` dict and `_SSE_BUFFER_SIZE` constant** — removed from `api/state.py` as part of the events-cap fix (ENG-088-002 from v0.8.9).

- **Dead `RunRequest.constraints` field** — see Changed above.

---

## Known Limitations

- **One run at a time per session.** v1.0 supports a single active agent run (or pipeline step) per AgentSuiteLocal session. Starting a second run while one is in progress is not supported in the UI and is unsafe in the backend. Concurrent runs land in v1.1.

- **No code-signing certificate.** The Windows `.exe` and macOS `.dmg` are unsigned. Windows users may see a SmartScreen warning ("Windows protected your PC") on first run. This is expected for free, open-source beta software without a signing certificate: click **More info** → **Run anyway** if you downloaded it from the official Releases page. macOS users will see a Gatekeeper warning — right-click the app → "Open" → "Open". See the README for full guidance.

- **Recovery sweeps deferred to v1.1.** Ollama crash mid-run, model corruption, disk-full mid-write, API key revoke mid-run, and concurrent-runs robustness are all v1.1 scope. The current crash-recovery (startup repair of `running` → `error`) handles the common restart case.

---

## What's Next (v1.1)

Items from `docs/next-cleanup.md` queued for the v1.1 sprint:

- **SSE busy-wait at 200ms** (`runs.py` stream loop) — replace with `asyncio.Event` per run; producer wakes consumer directly. Relevant under multi-SSE concurrency.
- **Cancel-button confirmation on Live Run** — a stray click on a 9–16-minute run loses partial work (though `_move_partial_artifacts` preserves outputs as `cancelled-outputs/`). Add a confirmation modal.
- **Frontend coverage tooling** — `web/vitest.config.js` does not configure coverage; no `npm run test:coverage` script. Add `@vitest/coverage-v8`.
- **`_LAUNCHER_LOG` alias sweep** — `config.py:40-41` keeps `_LAUNCHER_LOG = _LAUNCHER_PORT_FILE` as a soft-deprecation alias. Sweep when renaming `_write_launcher_log`.
- **Recovery sweeps** — Ollama crash, model corruption, disk full, key revoke, concurrent-runs robustness.
- **Performance baseline / benchmarks.**
- **Frozen API surface / schema-change CI.**
- **A11y Bar 2 / Bar 3** — skip-link, full ARIA review, WCAG AA audit, screen-reader pass.
- **Multi-instance, plugin system, auto-update, Linux installer, Windows arm64, full localization.**

---

*Generated by the Sprint C release orchestrator. For the complete change history see [CHANGELOG.md](../CHANGELOG.md).*
