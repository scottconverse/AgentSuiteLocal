"""
Regression tests for PDF export safety (ENG-088-001 and its successor).

ENG-088-001 class of bug: artifact content containing `<`, `>`, `&`, or
literal `</pre>` (markdown with embedded HTML, code blocks) corrupts an
HTML-based PDF renderer or injects content.

Two layers of protection:
1. ``_build_pdf_html`` — HTML string builder; all interpolated values are
   html.escape()d.  Tested here to lock the escaping contract in place even
   though this function is no longer used by the live rendering path.
2. ``_build_pdf_bytes`` — reportlab-based renderer; Preformatted flowable
   treats artifact text as literal characters (no HTML parsing), so the
   injection surface is eliminated by design.  Tested here to verify
   injection-like artifact content never crashes the generator.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from agentsuitelocal.api.routers.runs import _build_pdf_bytes, _build_pdf_html


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


# ---------------------------------------------------------------------------
# _build_pdf_bytes — reportlab renderer (live path since weasyprint removal)
# Injection-like content must not crash the generator; the Preformatted
# flowable treats artifact text as literal characters (no HTML parsing).
# ---------------------------------------------------------------------------


def test_pdf_bytes_returns_pdf_magic_bytes(outputs_dir: Path) -> None:
    (outputs_dir / "report.md").write_text("# Hello")
    pdf = _build_pdf_bytes("run-1", outputs_dir)
    assert isinstance(pdf, bytes)
    assert pdf[:4] == b"%PDF", "reportlab must produce a valid PDF"


def test_pdf_bytes_handles_xss_payload_in_artifact(outputs_dir: Path) -> None:
    """Injection-like artifact content must not crash the PDF generator."""
    (outputs_dir / "evil.md").write_text("</pre><script>alert('xss')</script><pre>")
    pdf = _build_pdf_bytes("run-1", outputs_dir)
    assert pdf[:4] == b"%PDF"


def test_pdf_bytes_handles_script_tag_in_run_id(outputs_dir: Path) -> None:
    """run_id with embedded angle brackets must not crash Paragraph XML parsing."""
    pdf = _build_pdf_bytes("run-<script>alert(1)</script>-id", outputs_dir)
    assert pdf[:4] == b"%PDF"


def test_pdf_bytes_handles_ampersand_in_filename(outputs_dir: Path) -> None:
    (outputs_dir / "fish & chips.md").write_text("content")
    pdf = _build_pdf_bytes("run-1", outputs_dir)
    assert pdf[:4] == b"%PDF"


def test_pdf_bytes_handles_missing_outputs_dir(tmp_path: Path) -> None:
    """Non-existent outputs dir should produce a valid (artifact-free) PDF."""
    pdf = _build_pdf_bytes("run-empty", tmp_path / "nope")
    assert pdf[:4] == b"%PDF"


def test_pdf_bytes_handles_binary_artifact(outputs_dir: Path) -> None:
    (outputs_dir / "image.bin").write_bytes(b"\x00\x01\x02\xff")
    pdf = _build_pdf_bytes("run-1", outputs_dir)
    assert pdf[:4] == b"%PDF"
