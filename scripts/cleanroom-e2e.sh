#!/usr/bin/env bash
# AgentSuiteLocal cleanroom E2E — runs the full API validation suite
# against the built PyInstaller distributable in a clean temp directory.
# Mirrors scripts/cleanroom.ps1 for CI/Linux contexts.
set -euo pipefail

DIST_DIR="${1:-dist/AgentSuiteLocal}"
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "=== AgentSuiteLocal cleanroom E2E ==="
echo "Dist:    $DIST_DIR"
echo "Tmp:     $TMP_DIR"

cp -r "$DIST_DIR" "$TMP_DIR/AgentSuiteLocal"
EXE="$TMP_DIR/AgentSuiteLocal/AgentSuiteLocal"
chmod +x "$EXE" 2>/dev/null || true

"$EXE" &
EXE_PID=$!
trap "kill $EXE_PID 2>/dev/null; rm -rf $TMP_DIR" EXIT

echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8765/api/health >/dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  sleep 1
done

PASS=0; FAIL=0
check() {
  local desc="$1"; local url="$2"; local key="$3"
  local result
  result=$(curl -sf "$url" 2>/dev/null)
  if echo "$result" | grep -q "$key"; then
    echo "  [✓] $desc"; PASS=$((PASS+1))
  else
    echo "  [✗] $desc"; FAIL=$((FAIL+1))
  fi
}

check "GET / serves HTML"               "http://127.0.0.1:8765/"                "html"
check "/api/health responds"            "http://127.0.0.1:8765/api/health"      "ok"
check "/api/settings model_tier"        "http://127.0.0.1:8765/api/settings"    "model_tier"
check "/api/ollama/status responds"     "http://127.0.0.1:8765/api/ollama/status" "running"
check "/api/pipelines returns list"     "http://127.0.0.1:8765/api/pipelines"   "pipelines"
check "/api/runs returns list"          "http://127.0.0.1:8765/api/runs"        "runs"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Result: PASS ($PASS checks)"
  exit 0
else
  echo "Result: FAIL ($FAIL/$((PASS+FAIL)) checks failed)"
  exit 1
fi
