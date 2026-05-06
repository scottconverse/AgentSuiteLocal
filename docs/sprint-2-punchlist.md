# v0.9 Sprint 2 punchlist

Items queued during sprint 1 by the layered-audit overflow rule. P-tier
priority is the order to address; "size" is rough effort estimate.

---

## P1 — QA-stage JSON parse failure (Critical, surfaced by sprint 1 day 2)

**What:** Real production bug surfaced by the new real-model E2E test
in `tests/test_real_founder_run.py`. With real `gemma4:e4b`, the
founder agent's QA stage produces non-JSON output some fraction of
the time. When that happens, the agent layer's `qa_scores.json` file
either doesn't exist or contains unparseable content; `_execute_run`
silently swallows the parse error and leaves `qa_score = None`.

**User-visible impact:** The approval gate's QA dimension table is
empty. The composite score isn't shown. The Approve button still
works (status reaches "waiting"; artifacts are written), but the
user has no signal whether the output is good. Worse: the QA-gate
threshold (default 7.0) can't be enforced when there's no score.

**Evidence:**
- Run `0ba02d45-8cf7-4737-9a87-ab09a720e109` in real-e2e CI on
  `d41742a` (60-min timeout). All five stages emitted "complete"
  events; artifacts list has campaign-production-workflow.md,
  brand-system.md, audience-map.md, export-manifest-template.json,
  inputs_manifest.json, asset-qa-checklist.md, etc. But
  `qa_score: None`.
- Production swallow point: `agentsuitelocal/api/execution.py:336-351`
  wraps the `qa_scores.json` parse in `except Exception: pass` and
  leaves the locals at default (None / empty list).

**Fix paths to investigate (any one likely closes it):**
1. Stricter JSON-mode prompt — pass `format="json"` to Ollama (or
   the equivalent for the AgentSuite library's call site) in the QA
   stage so the model is constrained to JSON output.
2. More forgiving parser — currently `json.loads(qa_file.read_text())`.
   Could try `json.loads` first, then a code-fence-stripped re-attempt
   (the model often wraps JSON in ```json blocks), then a regex
   extraction of the first balanced `{...}` block.
3. Surface the failure to the user — at minimum, when parse fails,
   log it loudly and show "QA scoring unavailable for this run" in
   the approval gate so the user knows something went wrong.

**Sprint-2 owner:** TBD. Recommend tackling early — needs a real-
Ollama dev environment or repeated CI runs to verify the fix lands
across multiple QA invocations (the failure rate isn't 100%).

**Definition of done:**
- 5 consecutive real-e2e CI runs all produce a non-None qa_score
  AND a populated dimensions list.
- Test assertion in `test_founder_run_produces_approveable_artifacts`
  is restored to require `qa_score is not None`.
- This punchlist entry deleted.

---

(Reserved for additional sprint-2 items as they queue.)
