# AgentSuiteLocal — build targets
#
# Requirements:
#   Python ≥ 3.11  with agentsuitelocal[dev] installed
#   Node.js ≥ 18   in PATH
#   pyinstaller    installed in the active virtualenv
#
# Usage:
#   make build-web       # build the React frontend only
#   make build-win       # Windows distributable (run on Windows)
#   make build-mac       # macOS .app bundle (run on macOS)
#   make dist            # build-web + platform distributable (auto-detects OS)
#   make test            # unit + integration tests
#   make test-e2e        # Playwright E2E tests (requires built frontend)
#   make clean           # remove build artefacts

.PHONY: build-web build-win build-mac dist build-installer test test-e2e cleanroom clean

# ── Frontend ────────────────────────────────────────────────────────────────

build-web:
	cd web && npm ci && npm run build

# ── Native distributable ────────────────────────────────────────────────────

build-win: build-web
	pyinstaller AgentSuiteLocal.spec --noconfirm

# I1: Inno Setup installer — requires Inno Setup 6 in PATH (iscc.exe)
build-installer: build-win
	iscc installer\AgentSuiteLocal.iss

build-mac: build-web
	pyinstaller AgentSuiteLocal.spec --noconfirm

dist:
	$(MAKE) build-web
ifeq ($(OS),Windows_NT)
	$(MAKE) build-win
else
	$(MAKE) build-mac
endif

# ── Tests ───────────────────────────────────────────────────────────────────

test:
	pytest tests/ -m "not e2e and not ollama" -v

test-frontend:
	cd web && npm run test

test-all: test test-frontend

test-ollama:
	pytest tests/ -m "ollama" -v

test-e2e: build-web
	pytest tests/e2e/ -v

# ── Cleanroom distributable test ────────────────────────────────────────────

cleanroom:
	powershell -ExecutionPolicy Bypass -File scripts\cleanroom.ps1

# ── Clean ───────────────────────────────────────────────────────────────────

clean:
	rm -rf dist/ build/ web/dist __pycache__ .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
