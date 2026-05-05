#!/bin/sh
# Proxy localhost:11434 -> host.docker.internal:11434 so the hardcoded Ollama URL works
#
# KNOWN LIMITATION (TEST-002): Because this proxies to the HOST's Ollama, the
# cleanroom never exercises a true cold-start daemon or a cold-pull. Two real
# bug classes are architecturally invisible here:
#   1. SSE keepalive timing — host Ollama serves cached layers in <1s, so the
#      sse-starlette `: ping - N` keepalive (default 15s) never fires during
#      pulls. The v0.8.7 frontend ping-crash bug COULD NOT have been caught
#      by cleanroom.
#   2. First-launch daemon-start delays — the host daemon is already running.
#      The real-user 30→90s wait in routers/ollama.py is never tested here.
#
# TODO (next-sprint watchlist): replace the proxy with a real Ollama sidecar
# container that pulls a small model fresh on every cleanroom run. See
# audit-AgentSuiteLocal-2026-05-05/next-sprint-watchlist.md item 2.
socat TCP-LISTEN:11434,fork,reuseaddr TCP:host.docker.internal:11434 &
sleep 1
exec uvicorn agentsuitelocal.api.main:app --host 0.0.0.0 --port 8765
