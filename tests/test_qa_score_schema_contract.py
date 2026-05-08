"""
Contract test for the qa_scores.json shape between agentsuite and AgentSuiteLocal.

Sprint A V4 root cause: AgentSuiteLocal's _execute_run reads qa_score from
qa_scores.json by trying field names ("weighted_score", "overall_score",
"score", "overall") that NEVER existed in agentsuite's QAReport schema.
agentsuite's QAReport (kernel/qa.py) uses 'average' as the canonical
composite-score field. Result: qa_score was always None on real runs,
masked by xfail strict=False on test_real_founder_run.py.

This test locks the contract: agentsuite QAReport must have 'average',
AgentSuiteLocal's _first_defined chain must check 'average', and the two
must round-trip cleanly through json.dumps/loads (since the runtime path
is QAReport.model_dump() -> json -> qa_scores.json -> json.loads).

If agentsuite ever renames the field, this test fails fast in CI before
anyone ships another silent qa_score=None.
"""
from __future__ import annotations

import json

from agentsuite.kernel.qa import QARubric, RubricDimension

from agentsuitelocal.api.execution import _first_defined


def test_qa_report_uses_average_as_composite_score_field() -> None:
    """agentsuite QAReport schema must contain 'average'."""
    rubric = QARubric(
        dimensions=[
            RubricDimension(name="craftsmanship", question="?", weight=1.0),
            RubricDimension(name="consistency", question="?", weight=1.0),
        ]
    )
    report = rubric.score(
        scores={"craftsmanship": 8.0, "consistency": 9.0},
        revision_instructions=[],
    )
    data = report.model_dump()
    assert "average" in data, (
        "agentsuite QAReport schema must expose composite score as 'average'. "
        "AgentSuiteLocal's _first_defined chain in execution.py depends on "
        "this field name. If you renamed it in agentsuite, update both call "
        "sites in agentsuitelocal/api/execution.py (lines ~358 and ~449)."
    )
    assert data["average"] == 8.5


def test_qa_score_round_trips_through_json() -> None:
    """The runtime path is QAReport.model_dump() → json → qa_scores.json →
    json.loads → _first_defined. This test exercises the full round-trip."""
    rubric = QARubric(
        dimensions=[RubricDimension(name="craftsmanship", question="?", weight=1.0)]
    )
    report = rubric.score(
        scores={"craftsmanship": 7.25},
        revision_instructions=[],
    )
    serialized = json.dumps(report.model_dump())
    qa_data = json.loads(serialized)
    qa_score = _first_defined(
        qa_data.get("average"),
        qa_data.get("weighted_score"),
        qa_data.get("overall_score"),
        qa_data.get("score"),
        qa_data.get("overall"),
    )
    assert qa_score == 7.25, (
        f"qa_score should round-trip through JSON unchanged; got {qa_score!r}. "
        "If this fails, the field-name contract between agentsuite QAReport "
        "and AgentSuiteLocal _first_defined has drifted."
    )


def test_qa_score_zero_is_preserved_not_promoted_to_none() -> None:
    """Soft-degraded runs (V1+V2 close in agentsuite v1.1.1) produce
    average=0.0. _first_defined must preserve 0.0, not promote to None
    via falsy-or-chaining (the original ENG-0907-002 bug)."""
    rubric = QARubric(
        dimensions=[RubricDimension(name="craftsmanship", question="?", weight=1.0)]
    )
    report = rubric.score(
        scores={"craftsmanship": 0.0},
        revision_instructions=["LLM produced unparseable output; soft-degraded"],
    )
    qa_data = json.loads(json.dumps(report.model_dump()))
    qa_score = _first_defined(
        qa_data.get("average"),
        qa_data.get("weighted_score"),
        qa_data.get("overall_score"),
        qa_data.get("score"),
        qa_data.get("overall"),
    )
    assert qa_score == 0.0
    assert qa_score is not None  # explicit: 0.0 is a real score, not "missing"


def test_qa_dimensions_field_is_named_scores() -> None:
    """Companion contract: the per-dimension scores dict in QAReport is
    named 'scores'. AgentSuiteLocal reads either 'dimensions' (legacy) or
    'scores' (current). The agentsuite schema uses 'scores' — locking that
    contract here so a rename can't silently regress qa_dimensions."""
    rubric = QARubric(
        dimensions=[
            RubricDimension(name="craftsmanship", question="?", weight=1.0),
            RubricDimension(name="consistency", question="?", weight=1.0),
        ]
    )
    report = rubric.score(
        scores={"craftsmanship": 8.0, "consistency": 7.5},
        revision_instructions=[],
    )
    data = report.model_dump()
    assert "scores" in data
    assert data["scores"] == {"craftsmanship": 8.0, "consistency": 7.5}
