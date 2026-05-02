# Changelog

All notable changes to AgentSuiteLocal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [0.1.0] — 2026-05-01

### Added
- PyInstaller Windows distributable — self-contained, no Python or Node required on the target machine
- FastAPI + uvicorn backend bundled in-process; launcher finds a free port and writes it to `~/.agentsuitelocal/launcher.log`
- SSE streaming endpoint mapping AgentSuite `ProgressCallback` events to the frontend
- Hardware probe API (CPU, RAM, disk, Ollama status)
- React + Vite frontend — 12 installer screens + 9 main app screens
- Full installer flow: hardware check, model tier picker, Ollama auto-install, model download, smoke test
- Dashboard, Agents, New Run, Live Run, Approval Gate, Kernel, Settings, Manual, Runs
- Pipelines view — multi-agent chain builder wired to real backend; `POST /api/pipelines` executes agents in sequence through `PipelineOrchestrator` with per-step approval gates
- Three-pane approval gate: file tree / artifact preview / QA scores
- Pipeline endpoints: `GET/POST /api/pipelines`, `GET /api/pipelines/{id}`, `POST /api/pipelines/{id}/approve`, `POST /api/pipelines/{id}/reject`, `GET /api/pipelines/{id}/stream`
- Dark mode support via `[data-theme="dark"]` CSS attribute
- Design token system: warm neutrals, terracotta accent, Fraunces + Inter Tight + JetBrains Mono
- `scripts/cleanroom.ps1` — isolated distributable test; copies dist to temp dir, strips Python/Node from PATH, asserts 7 API checks, cleans up (`make cleanroom`)
