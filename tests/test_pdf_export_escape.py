"""
Regression test for ENG-088-001 (audit-AgentSuiteLocal-2026-05-05-v088).

Class of bug: artifact content interpolated into the PDF-export HTML
template without escaping. LLM-produced artifacts routinely contain
`<`, `>`, `&`, or literal `</pre>` (markdown with embedded HTML, code
blocks). Without escaping, weasyprint parses them as live HTML and
the PDF renders incorrectly. With a malicious artifact, injected
`<style>` / `<a href="javascript:">` / `<img onerror=...>` would
execute against the rendering context.

Tests the helper directly so weasyprint isn't needed.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from agentsuitelocal.api.routers.runs import _build_pdf_html


@pytest.fixture
def outputs_dir(tmp_path: Path) -> Path:
    """A run-outputs directory with one artifact containing HTML special chars."""
    d = tmp_path / "outputs"
    d.mkdir()
    return d


def test_pdf_html_escapes_run_id(outputs_dir: Path) -> None:
    html = _build_pdf_html("run-<script>alert(1)</script>-id", outputs_dir)
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html


def test_pdf_html_escapes_filename(outputs_dir: Path) -> None:
    # File names cannot contain `<` on Windows, but `&` is legal everywhere
    # and would render as an entity in unescaped HTML.
    artifact = outputs_dir / "fish & chips.md"
    artifact.write_text("body")
    html = _build_pdf_html("run-1", outputs_dir)
    assert "fish & chips.md" not in html  # raw `&` would corrupt entity rendering
    assert "fish &amp; chips.md" in html


def test_pdf_html_escapes_artifact_pre_breakout(outputs_dir: Path) -> None:
    """The headline injection: a body containing `</pre>` followed by
    arbitrary HTML must NOT escape the <pre> wrapper."""
    payload = "</pre><script>alert('xss')</script><pre>"
    (outputs_dir / "evil.md").write_text(payload)
    html = _build_pdf_html("run-1", outputs_dir)
    # The literal payload must be escaped — no live tags.
    assert "</pre><script>" not in html
    assert "&lt;/pre&gt;&lt;script&gt;" in html


def test_pdf_html_escapes_ampersand_and_angle_brackets(outputs_dir: Path) -> None:
    (outputs_dir / "code.md").write_text("if a < b && c > d: pass")
    html = _build_pdf_html("run-1", outputs_dir)
    assert "if a &lt; b &amp;&amp; c &gt; d: pass" in html


def test_pdf_html_handles_missing_outputs_dir(tmp_path: Path) -> None:
    """Non-existent outputs dir should yield a valid (empty-body) HTML doc."""
    html = _build_pdf_html("run-empty", tmp_path / "nope")
    assert "<h1>run-empty — Artifact Bundle</h1>" in html
    assert "<hr>" not in html  # no artifacts


def test_pdf_html_handles_binary_file(outputs_dir: Path) -> None:
    (outputs_dir / "image.bin").write_bytes(b"\x00\x01\x02\xff")
    html = _build_pdf_html("run-1", outputs_dir)
    # Binary content is replaced with a placeholder; not escape-relevant
    # but exercise the path so the helper never crashes on weird files.
    assert "image.bin" in html
