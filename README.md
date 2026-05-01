# AgentSuiteLocal

Desktop UI for [AgentSuite](https://github.com/scottconverse/AgentSuite), running 100% local via Ollama. Built for non-technical founders — no CLI, no API key, no cloud required.

Seven specialist agents (Founder, Design, Product, Engineering, Marketing, Trust/Risk, CIO) walk a five-stage pipeline and write a structured artifact library to your disk. You review, approve, and promote outputs into a persistent kernel that feeds every future run.

## Requirements

- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.ai) with a supported model (gemma4:e4b recommended)
- 16 GB RAM (8 GB minimum for the Light tier)

## Quick start

```bash
# Clone
git clone https://github.com/scottconverse/AgentSuiteLocal
cd AgentSuiteLocal

# Python backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .

# Frontend
cd web
npm install
npm run build
cd ..

# Run
uvicorn agentsuitelocal.api.main:app --port 8765
# Open http://localhost:8765
```

## Development mode

```bash
# Terminal 1 — backend
uvicorn agentsuitelocal.api.main:app --reload --port 8765

# Terminal 2 — frontend (HMR)
cd web && npm run dev
# Vite proxies /api/* to :8765, open http://localhost:5173
```

## Architecture

```
agentsuitelocal/
  api/main.py         FastAPI app (~200 lines) — REST + SSE
web/
  src/
    App.jsx           Router + scene switching
    components/
      installer/      12-screen setup wizard
      app/            9 main app screens
      ui/             Icon, Toggle, ProgressBar, etc.
      shell/          Sidebar, TopBar
    hooks/useSSE.js   SSE → React state bridge
```

The backend is a thin wrapper around AgentSuite's `PipelineOrchestrator`. SSE events map directly to `ProgressCallback` — `agent_start`, `stage_update`, `agent_done`, `agent_waiting`.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + uvicorn + sse-starlette |
| Frontend | React 18 + Vite |
| LLM | Ollama (local, no cloud) |
| Agent engine | AgentSuite |
| Packaging (Phase 2) | Tauri + Go tray |

## License

MIT — see [LICENSE](LICENSE).
The bundled Gemma 4 model carries [Google's open-weight license](https://ai.google.dev/gemma/terms).
