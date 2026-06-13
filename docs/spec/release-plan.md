# AgentSuiteLocal Pipeline Release Plan

## 99 - Installer lifecycle hard gates

Automated tests catch the installer/setup regressions found during the prior verification pass.

Required modules:

- agentsuitelocal/api/
- installer/
- tests/
- web/src/

Scope:

- Run the ScottDevSkills pipeline init in the AgentSuiteLocal repo.
- Create a bugfix/feature pipeline for installer lifecycle hard gates.
- Add automated tests for uninstall cleanup, setup false success, output folder persistence, and uninstall visibility.
- Clean mojibake around `Setup Â·` in `web/src/App.jsx`.
- Review dirty changes carefully and commit only the intended scope.

Exit criteria:

- Pipeline scaffold exists with `.pipelines/`, `scripts/policy/`, `.agent-runs/`, and `AGENTS.md`.
- Regression tests exist for every requested installer lifecycle hard gate.
- The setup separator in `web/src/App.jsx` no longer contains mojibake.
- Targeted backend/frontend tests pass.
- Dirty changes are reviewed before commit.
