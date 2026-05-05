#!/usr/bin/env python3
"""Doc-drift guard (DOC-NEW from audit 2026-05-05).

Reads `TOTAL_STEPS` from `web/src/App.jsx` and verifies the same number is
reflected in every doc artifact and test that describes the installer flow.
Fails CI if any artifact disagrees.

Why this exists: v0.8.7 shipped with multiple docs (ManualView, user-manual,
architecture, FAQ, README) describing different step counts because each was
written against a different snapshot. This guard makes that drift impossible
to merge.

Run manually: `python scripts/check_installer_step_count.py`
Wired into CI: see `.github/workflows/ci.yml`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def main() -> int:
    app_jsx = ROOT / "web" / "src" / "App.jsx"
    m = re.search(r"const\s+TOTAL_STEPS\s*=\s*(\d+)", _read(app_jsx))
    if not m:
        print(f"FAIL: could not find TOTAL_STEPS in {app_jsx}", file=sys.stderr)
        return 2
    canonical = int(m.group(1))
    print(f"App.jsx TOTAL_STEPS = {canonical}")

    # Each entry: (relative path, regex that captures the step count)
    targets = [
        ("web/src/components/app/ManualView.jsx",
         r"It\s+walks\s+(?:<strong>)?(\d+)\s+short\s+steps"),
        ("docs/user-manual.md",
         r"^(?:The installer|installer)\s+(?:has|is|walks)\s+(\d+)\s+(?:steps|short steps)"),
        ("docs/architecture.md",
         r"(\d+)-(?:step|screen)\s+installer"),
        ("docs/FAQ.md",
         r"(\d+)\s+(?:steps|screens)"),
        ("README.md",
         r"(\d+)-(?:screen|step)\s+(?:setup|installer)"),
        ("tests/e2e/test_installer.py",
         r"all\s+(\d+)\s+(?:installer|steps)"),
        ("tests/e2e/test_app.py",
         r"installer\s+is\s+(\d+)\s+steps"),
    ]

    failures = []
    for rel, pattern in targets:
        path = ROOT / rel
        if not path.exists():
            print(f"WARN: {rel} not found, skipping")
            continue
        content = _read(path)
        m = re.search(pattern, content, re.IGNORECASE | re.MULTILINE)
        if not m:
            failures.append(f"{rel}: no step-count phrase matched (pattern: {pattern})")
            continue
        n = int(m.group(1))
        if n != canonical:
            failures.append(f"{rel}: claims {n} steps, App.jsx says {canonical}")
        else:
            print(f"OK   {rel}: {n}")

    if failures:
        print(f"\nFAIL: {len(failures)} artifact(s) disagree with App.jsx TOTAL_STEPS={canonical}:",
              file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        print("\nFix the listed files OR update App.jsx if the new count is intentional.",
              file=sys.stderr)
        return 1

    print(f"\nAll artifacts agree on {canonical}-step installer.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
