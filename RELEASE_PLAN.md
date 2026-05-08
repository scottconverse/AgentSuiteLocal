# RELEASE_PLAN.md — v1.0 Sprint C (ship)

**Type:** sprint (Sprint C of three: A → B → **C**)
**Branch:** `release/v0.9.0`
**Baseline:** `2cc4509` (Sprint B close — CI green, re-audit-lite 0/0/0/0/0)
**Sprint goal:** Bump all version strings to 1.0.0, update CHANGELOG and docs, verify CI green, generate release notes, get explicit Scott approval, tag v1.0.0, merge to main.
**Sprint gate:** Scott explicit approval at C6 before any tag or merge.
**This IS the v1.0 ship sprint.**

---

## Discipline (layered audit pattern)

- **Per-commit:** careful-coding 9-step
- **Per checkpoint:** lint clean + changed-file tests
- **Per sprint end:** audit-lite scoped to Sprint C diff
- **Overflow rule:** any unexpected finding → surface to Scott before continuing
- **No scope creep.** If something unrelated is found, document it in `docs/next-cleanup.md` and keep moving.

## Pre-flight gate

- [x] Sprint B approved by Scott
- [x] CI green at baseline `2cc4509`
- [x] Working tree clean
- [x] MOCKING_AUDIT: 9 INTERNAL-SUSPECT sites CLOSED (Sprint B B7)
- [x] Re-audit-lite Sprint B: 0 / 0 / 0 / 0 / 0 (Blocker / Critical / Major / Minor / Nit)
- [x] `docs/next-cleanup.md` carries only v1.1 queue items — no Sprint C blockers
- [x] Locked decisions in effect (no code-signing, no branch rename, no agentsuite tag push, DI refactor complete)

---

## Sprint C checklist

### C1 — Version bump fan-out

Fan-out grep to find every version string that needs updating, then update each:

- [ ] `agentsuitelocal/__version__.py` — `0.8.9` → `1.0.0`
- [ ] `web/package.json` — `0.7.1` → `1.0.0` (known mismatch — fix here)
- [ ] `web/src/components/app/ManualView.jsx` — any hardcoded version stamp → `1.0.0`
- [ ] `README.md` — installer filenames, version badges, any hardcoded version references
- [ ] `USER-MANUAL/user-manual.md` — version stamps
- [ ] `docs/troubleshooting.md` — version stamps
- [ ] `docs/index.html` — version stamps and title
- [ ] `AgentSuiteLocal.iss` (Inno Setup) — `AppVersion` or `OutputBaseFilename`
- [ ] Fan-out grep: `grep -rn "0\.8\.9\|0\.7\.1\|0\.9\.0" --include="*.py" --include="*.json" --include="*.md" --include="*.jsx" --include="*.html" --include="*.iss" .` — catch any remaining strays
- [ ] careful-coding 9-step on all changed files
- [ ] `python -m pytest tests/ -m "not real_ollama and not e2e" -q` → all pass
- [ ] `python -m ruff check agentsuitelocal/` → clean
- [ ] One commit: `chore(release): bump version to 1.0.0`
- [ ] Push; wait CI green
- [ ] VERIFICATION_LOG entry: which files changed, grep output showing 0 strays, test + lint output

### C2 — CHANGELOG `[Unreleased]` → `[1.0.0] — 2026-05-08`

- [ ] Read `CHANGELOG.md` — identify the `[Unreleased]` section header
- [ ] Replace `[Unreleased]` with `[1.0.0] — 2026-05-08`
- [ ] Add a new blank `## [Unreleased]` section above `[1.0.0]` (keep the keepachangelog pattern)
- [ ] Verify the diff looks correct before committing
- [ ] careful-coding 9-step
- [ ] One commit: `docs(changelog): cut 1.0.0 release — 2026-05-08`
- [ ] Push; wait CI green
- [ ] VERIFICATION_LOG entry: CHANGELOG diff, confirm format

### C3 — README "Recent releases" v1.0.0 + landing page

- [ ] Add a "v1.0.0" entry to README "Recent releases" section (one short paragraph: what's in 1.0.0, link to release notes once generated)
- [ ] Update `docs/index.html` landing page — version badge / headline / download link if present
- [ ] careful-coding 9-step
- [ ] One commit: `docs: add v1.0.0 to README recent releases and landing page`
- [ ] Push; wait CI green
- [ ] VERIFICATION_LOG entry: sections updated, no broken links introduced

### C4 — Pre-tag CI gate

- [ ] Confirm all 7 CI jobs are green on the C3 commit (or latest Sprint C commit)
- [ ] No red or cancelled jobs
- [ ] VERIFICATION_LOG entry: CI run URL, job-by-job status, commit SHA

### C5 — Generate `docs/release-notes-v1.0.0.md`

Write a human-readable release notes file from CHANGELOG [1.0.0] plus sprint context:

- [ ] Header: `# AgentSuiteLocal v1.0.0 — Release Notes` + date
- [ ] Short (2–3 sentence) intro paragraph: what v1.0.0 is
- [ ] Sections from CHANGELOG: Added / Changed / Fixed / Removed
- [ ] "Known limitations" section — from `docs/next-cleanup.md` + locked decisions:
  - One run at a time per session (concurrent runs land in v1.1)
  - No code-signing cert (users decide; OSS)
  - Recovery sweeps (Ollama crash, disk full, etc.) land in v1.1
- [ ] "What's next (v1.1)" — one-liner list from `docs/next-cleanup.md`
- [ ] careful-coding 9-step
- [ ] One commit: `docs: generate v1.0.0 release notes`
- [ ] Push; wait CI green
- [ ] VERIFICATION_LOG entry: file path, section headings, confirmation known-limitations section complete

### C6 — HARD STOP — Scott approval required before tag

- [ ] All C1–C5 items have VERIFICATION_LOG entries
- [ ] C4 CI gate is green
- [ ] `docs/release-notes-v1.0.0.md` exists and looks correct
- [ ] `CHANGELOG.md` shows `[1.0.0] — 2026-05-08`
- [ ] **STOP. Surface the following to Scott for explicit approval:**
  - Final commit SHA on `release/v0.9.0`
  - Link to CI run (all green)
  - Link to `docs/release-notes-v1.0.0.md`
  - Confirm: "Ready to tag v1.0.0 on this commit. Proceed?"
- [ ] **DO NOT PROCEED until Scott responds with an explicit go signal (e.g., "tag it", "ship it", "yes", "go").**

### C7 — Tag v1.0.0 and create GitHub release

Only after Scott's explicit C6 approval:

- [ ] `git tag -a v1.0.0 -m "AgentSuiteLocal v1.0.0"` on `release/v0.9.0` HEAD
- [ ] `git push origin v1.0.0`
- [ ] `gh release create v1.0.0 --title "AgentSuiteLocal v1.0.0" --notes-file docs/release-notes-v1.0.0.md`
- [ ] Verify GitHub Actions builds trigger on the tag (if configured)
- [ ] VERIFICATION_LOG entry: tag SHA, release URL, CI trigger confirmation

### C8 — Post-ship

- [ ] `git checkout main && git merge --no-ff release/v0.9.0 -m "chore: merge release/v0.9.0 into main (v1.0.0)"`
- [ ] `git push origin main`
- [ ] Update `HANDOFF.md`: mark Sprint C complete; update branch state; record v1.0.0 tag SHA
- [ ] Write memory file `handoff_2026-05-08-agentsuitelocal-v100-shipped.md` in `~/.claude/projects/.../memory/`
- [ ] Update `MEMORY.md` index to point to the new memory file as CURRENT
- [ ] VERIFICATION_LOG entry: merge SHA on main, memory file path

---

## Out of scope for Sprint C

Per locked decisions and v1.1 backlog — do NOT pull back:

- Recovery sweeps (Ollama crash, model corruption, disk full, key revoke, concurrent runs)
- Performance baseline / benchmarks
- Frozen API surface / schema-change CI
- A11y Bar 2 / Bar 3
- Multi-instance, plugin system, auto-update, Linux installer, Windows arm64, full WCAG AA, screen-reader audit, localization
- Code-signing cert
- Cleanroom Docker E2E as a blocking step (CI artifacts build on tag push via GitHub Actions)
- 24h CI green hold

If any unexpected finding surfaces during C1–C5:
- **Blocker** → STOP; surface to Scott; renegotiate scope
- **Critical** → STOP; surface to Scott before C6
- **Major / Minor / Nit** → append to `docs/next-cleanup.md`; continue

---

## Hard stop

The orchestrator MUST NOT proceed past C6 without Scott's explicit go signal.
Tag and merge are irreversible. C6 is load-bearing.
