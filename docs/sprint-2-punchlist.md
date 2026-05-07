# v0.9 Sprint 2 punchlist

Items queued during sprint 1 by the layered-audit overflow rule. P-tier
priority is the order to address; "size" is rough effort estimate.

---

## P1 — QA-stage output flakiness (Critical, surfaced by sprint 1 day 2)

**What:** Real production bug class surfaced by the new real-model E2E
test in `tests/test_real_founder_run.py`. With real `gemma4:e4b`, the
founder agent's QA stage produces output that fails the agent's
validators in two distinct ways. Both root in the agentsuite library
(pinned `v1.1.0`).

### Variant 1 — non-JSON output → silent degradation

**Failure shape:** QA stage runs, writes `qa_scores.json` with content
that isn't parseable JSON. `_execute_run` silently swallows the parse
error and leaves `qa_score = None`. Run reaches `status="waiting"`.

**User-visible impact:** The approval gate's QA dimension table is
empty. The composite score isn't shown. The Approve button still
works (artifacts are written), but the user has no signal whether
the output is good. Worse: the QA-gate threshold (default 7.0)
can't be enforced when there's no score.

**Evidence:**
- Run `0ba02d45-8cf7-4737-9a87-ab09a720e109` in real-e2e CI on
  `d41742a` (60-min timeout). All five stages emitted "complete"
  events; artifacts list has campaign-production-workflow.md,
  brand-system.md, audience-map.md, etc. But `qa_score: None`.
- Production swallow point: `agentsuitelocal/api/execution.py:336-351`
  wraps the `qa_scores.json` parse in `except Exception: pass` and
  leaves the locals at default (None / empty list).

### Variant 2 — JSON with non-canonical dimension names → loud failure

**Failure shape:** QA stage runs, writes `qa_scores.json` with valid
JSON but containing dimension names the agent's validator doesn't
recognize (observed: `'clarity'`, `'actionability'`). The agentsuite
library raises `ValueError("Unknown dimensions: {...}")`. `_execute_run`
catches it, sets `status="error"`, and surfaces the friendly message
"Something went wrong. Check Settings and try again." with the raw
ValueError appended.

**User-visible impact:** Worse than V1 — the run is marked errored,
no artifacts are approve-able, the user has no path forward except
"try again." Friendly error message hides what actually went wrong.

**Evidence:**
- Run `f0fbac28-...` in real-e2e CI on `7f5ca95` (60-min timeout,
  6.3 min total runtime — fast runner this iteration).
  Last events: execute complete → qa starting → error.
  Error message: `Unknown dimensions: {'clarity', 'actionability'}`.

### Fix paths (any one of these likely closes both V1 and V2)

1. **Stricter JSON-mode prompt** — pass `format="json"` to Ollama
   (or the equivalent for the AgentSuite library's call site) in
   the QA stage so the model is constrained to JSON output AND
   given the canonical dimension-name list explicitly in the prompt.
2. **Unify the two failures into V1 (soft degradation)** — in the
   agentsuite library's QA validator, treat unknown dimensions as
   warning-and-skip rather than ValueError. Both V1 and V2 then
   collapse to `qa_score=None` (or partial qa_score from the
   recognized dimensions only). The approval gate already handles
   that case acceptably for users.
3. **More forgiving parser** — currently `json.loads(qa_file.read_text())`.
   Could try strict json.loads first, then code-fence-stripped retry
   (model often wraps JSON in ```json blocks), then regex extraction
   of the first balanced `{...}` block. Closes V1 only; V2 still
   raises.

Recommended: **path 2 first** (smallest diff, collapses two failure
modes into one well-tested code path), then **path 1** as a
follow-up to actually improve the QA-output reliability rate.

### Sprint-2 owner

TBD. Tackle early — fix is in the AgentSuite library (different repo:
`scottconverse/AgentSuite`), so the loop is: fix → cut v1.1.1 of
agentsuite → repin AgentSuiteLocal pyproject → re-run real-e2e to
verify. Cross-repo coordination cost.

### Definition of done

- 5 consecutive real-e2e CI runs all produce `status="waiting"` AND
  `qa_score` non-None AND `qa_dimensions` list non-empty.
- `tests/test_real_founder_run.py::test_founder_run_produces_approveable_artifacts`
  has its `@pytest.mark.xfail` removed AND its strict assertions
  pass without modification.
- This punchlist entry deleted.

---

(Reserved for additional sprint-2 items as they queue.)
