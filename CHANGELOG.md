# Changelog

All notable changes to AgentSuiteLocal are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [0.1.0] — 2026-05-01

### Added
- FastAPI backend wrapping AgentSuite PipelineOrchestrator
- SSE streaming endpoint mapping ProgressCallback events
- Hardware probe API (CPU, RAM, disk, Ollama status)
- React + Vite frontend — 22 screens (12 installer + 9 main app + tray)
- Full installer flow: hardware check, model tier picker, Ollama detection, smoke test
- Dashboard, Agents, New Run, Live Run, Approval Gate, Kernel, Pipelines, Settings, Manual
- Three-pane approval gate: file tree / artifact preview / QA scores
- Dark mode support via `[data-theme="dark"]` CSS attribute
- Design token system: warm neutrals, terracotta accent, Fraunces + Inter Tight + JetBrains Mono
