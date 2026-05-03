# AgentSuiteLocal Brand Assets

This asset pack contains a first-pass logo system and icon set for AgentSuiteLocal. It is designed to match the repository's warm-neutral UI tokens, terracotta accent, local-first positioning, and seven-agent product structure.

## Included

- `svg/logo/agentsuitelocal-mark.svg` — primary square mark
- `svg/logo/agentsuitelocal-logo-horizontal.svg` — README/header/app-shell lockup
- `svg/logo/agentsuitelocal-logo-stacked.svg` — splash/installer/social lockup
- `svg/logo/agentsuitelocal-app-icon.svg` — app icon base
- `svg/logo/favicon.svg` — simplified small-size favicon
- `svg/icons/agents/` — Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO
- `svg/icons/stages/` — Intake, Extract, Spec, Execute, QA
- `svg/icons/app/` — Local runtime, model, kernel, pipeline, approvals, projects, export, recovery
- `svg/icons/agentsuitelocal-icon-sprite.svg` — symbol sprite
- `react/AgentSuiteLocalIcons.jsx` — drop-in React helper
- `png/` — generated previews and PNG versions

## Design notes

The logo mark is built around a geometric **A** with a terracotta center node. Seven satellites represent the seven specialist agents. The surrounding rounded square and warm neutral palette are matched to the current UI token system.

Primary palette:

- Ink: `#1a1614`
- Terracotta accent: `#c2562b`
- Warm background: `#faf8f5`
- Elevated background: `#ffffff`
- Line: `#e8e1d6`
- Info: `#3a6a85`
- Good: `#3f7d3a`
- Warn: `#b08020`
- Bad: `#b03a2e`

## Suggested usage

Use the horizontal lockup for GitHub README headers and app chrome. Use the square mark for installer, desktop shortcut, favicon, and tray-style surfaces. Use the icon set at 18–24px in the app UI; the icons are intentionally outline-first to fit the current vanilla CSS interface.

## App icon exports

The `png/app-icon-sizes/` directory includes 16, 24, 32, 48, 64, 128, 256, and 512px PNG exports. `windows/AgentSuiteLocal.ico` is included for the Windows installer / shortcut path.
