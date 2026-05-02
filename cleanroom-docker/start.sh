#!/bin/sh
# Proxy localhost:11434 -> host.docker.internal:11434 so the hardcoded Ollama URL works
socat TCP-LISTEN:11434,fork,reuseaddr TCP:host.docker.internal:11434 &
sleep 1
exec uvicorn agentsuitelocal.api.main:app --host 0.0.0.0 --port 8765
