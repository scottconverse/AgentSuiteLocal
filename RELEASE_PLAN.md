# Release v0.8.8

**Type:** bugfix
**Summary:** Backfill v0.8.7 CHANGELOG with Issue #16 CI lint gate details and corrected test metrics.
**Generated:** 2026-05-05T07:11:58Z
**Previous version:** v0.8.7

## Implementation
- [x] Bump version to 0.8.8 in `agentsuitelocal/__version__.py` line 1
- [x] Update CHANGELOG.md with `## [0.8.8] — 2026-05-05` section using the summary

## Verification
- [x] Test suite passes: `pytest -v`
- [x] Lint clean: `python -m ruff check .`
- [x] Build succeeds: `python -m build`
- [x] Cleanroom Docker E2E passes: `scripts/cleanroom-e2e.sh` (n/a — Windows platform; CI Ubuntu runner covers this)

## Documentation
- [x] README.md current
- [x] CHANGELOG.md updated
- [x] CONTRIBUTING.md current
- [x] LICENSE current
- [x] .gitignore current
- [x] docs/index.html current

## Release
- [x] Push to feature branch `release/v0.8.8`
- [x] CI green on feature branch (poll every 110s, max 30 min)
- [ ] Merge feature branch to main
- [ ] Tag v0.8.8
- [ ] `gh release create v0.8.8` with summary as release notes

---

## Recent commits since v0.8.7
- `fe6be9c` docs: backfill v0.8.7 CHANGELOG with Issue #16 material and test-metrics correction
