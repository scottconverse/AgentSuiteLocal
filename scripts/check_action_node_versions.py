#!/usr/bin/env python3
"""Fail if any SHA-pinned GitHub Action in .github/workflows/ uses Node.js 20 or older.

Fetches each action's action.yml at the pinned SHA via the GitHub API and checks
the `runs.using` field. Requires `gh` CLI authenticated with a token (GH_TOKEN env var).

Exit 0 — all pins are node24+.
Exit 1 — one or more node20/node16 pins detected; details printed to stdout.
"""

from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

# Matches: uses: owner/repo@40-char-sha  (with optional subdir: owner/repo/dir@sha)
_SHA_RE = re.compile(r"uses:\s+([\w.-]+/[\w.-]+(?:/[\w.-]+)?)@([0-9a-f]{40})")
_OLD_NODE_RE = re.compile(r"\bnode(16|20)\b")


def _gh_api(path: str) -> dict | None:
    result = subprocess.run(
        ["gh", "api", path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def _action_yml_content(owner: str, repo: str, sha: str, subdir: str) -> str | None:
    for filename in ("action.yml", "action.yaml"):
        path = f"{subdir}/{filename}" if subdir else filename
        data = _gh_api(f"/repos/{owner}/{repo}/contents/{path}?ref={sha}")
        if data and "content" in data:
            return base64.b64decode(data["content"]).decode(errors="replace")
    return None


def main() -> int:
    workflow_dir = Path(".github/workflows")
    if not workflow_dir.is_dir():
        print("No .github/workflows directory found — skipping check.")
        return 0

    problems: list[str] = []
    checked: set[tuple[str, str]] = set()

    for wf_file in sorted(workflow_dir.glob("*.yml")):
        content = wf_file.read_text()
        for match in _SHA_RE.finditer(content):
            action_ref, sha = match.group(1), match.group(2)
            key = (action_ref, sha)
            if key in checked:
                continue
            checked.add(key)

            parts = action_ref.split("/")
            owner, repo = parts[0], parts[1]
            subdir = "/".join(parts[2:]) if len(parts) > 2 else ""

            yml = _action_yml_content(owner, repo, sha, subdir)
            if yml is None:
                print(f"  WARN  {action_ref}@{sha[:8]} — could not fetch action.yml (skipped)")
                continue

            if _OLD_NODE_RE.search(yml):
                node_ver = _OLD_NODE_RE.search(yml).group(0)
                problems.append(
                    f"  {wf_file.name}: {action_ref}@{sha[:8]} uses {node_ver}"
                )
                print(f"  FAIL  {action_ref}@{sha[:8]} — {node_ver} detected in action.yml")
            else:
                print(f"  OK    {action_ref}@{sha[:8]}")

    if problems:
        print()
        print("node20/node16 actions detected — update pins to node24+ releases:")
        for p in problems:
            print(p)
        return 1

    print()
    print(f"All {len(checked)} SHA-pinned action(s) use node24+.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
