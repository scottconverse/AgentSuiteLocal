import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { STAGES, AGENTS } from "../../data.js";
import { useSSE } from "../../hooks/useSSE.js";

export const LiveRunView = ({ runId, onApprovalReady, onCancel, onRetry, onOpenSettings }) => {
  const { events, status, error, reconnectAttempt } = useSSE(runId);
  const [stageIdx, setStageIdx] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [streamLines, setStreamLines] = useState([]);
  const [runMeta, setRunMeta] = useState(null);
  const [artifacts, setArtifacts] = useState([]);
  // UX-005: retry button in-flight state + error surface (QA-201 fix)
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);

  // E2: elapsed time tracking
  const [elapsed, setElapsed] = useState(0);
  const [stageElapsed, setStageElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const stageStartRef = useRef(Date.now());

  // B1: cancel in-flight state
  const [cancelling, setCancelling] = useState(false);

  const logRef = useRef(null);

  // Fetch run metadata once on mount
  useEffect(() => {
    if (!runId) return;
    fetch(`/api/run/${runId}`)
      .then(r => r.json())
      .then(data => setRunMeta(data))
      .catch(() => {});
  }, [runId]);

  // E2: total elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // E2: per-stage elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setStageElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Drive UI from SSE events
  useEffect(() => {
    if (!events.length) return;

    const stageOrder = STAGES.map(s => s.id);

    for (const evt of events) {
      if (evt.type === "stage_update") {
        const idx = stageOrder.indexOf(evt.stage);
        if (idx >= 0) {
          setStageIdx(idx + 1);
          stageStartRef.current = Date.now(); // E2: reset stage timer
          setStageElapsed(0);
        }
        setStreamLines(prev => [...prev, `▸ ${evt.stage}${evt.message ? ": " + evt.message : ""}`]);
        // UX-004: only update token count from real telemetry. The stage_update
        // event carries `tokens` when the orchestrator has counted them; otherwise
        // leave the counter alone. Fabricating +18 per stage misled users.
        if (typeof evt.tokens === "number") setTokens(evt.tokens);
      }
      if (evt.type === "agent_waiting") {
        setStageIdx(STAGES.length);
        setArtifacts(evt.artifacts || []);
        onApprovalReady();
      }
      if (evt.type === "error") {
        setStreamLines(prev => [...prev, `✗ error: ${evt.message}`]);
      }
      if (evt.type === "timeout") {
        setStreamLines(prev => [...prev, `✗ timed out: ${evt.message}`]);
      }
    }
  }, [events, onApprovalReady]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [streamLines]);

  if (!runId) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <Icon name="alert" size={32} style={{ color: "var(--warn)" }} />
        <div style={{ fontSize: 14, color: "var(--ink-2)" }}>No run ID. Go back and start a run.</div>
        <button className="btn" onClick={onCancel}>Back</button>
      </div>
    );
  }

  const ag = AGENTS.find(a => a.id === runMeta?.agent);
  const fmtTime = (secs) => `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const elapsedStr = fmtTime(elapsed);
  const stageElapsedStr = fmtTime(stageElapsed);
  const isRunning = status !== "done" && status !== "error" && status !== "timeout" && status !== "cancelled" && !cancelling;
  const isTimeout = status === "timeout";
  const isError = status === "error";

  // B1: real cancel handler
  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await fetch(`/api/run/${runId}/cancel`, { method: "POST" });
    } catch { /* ignore */ }
    onCancel();
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={<>
          {ag?.name || runMeta?.agent || "Agent"} ·{" "}
          <span style={{ color: "var(--accent)" }}>{runMeta?.project || "…"}</span>{" "}
          {isRunning && <span className="chip chip-info" style={{ marginLeft: 8 }}><span className="dot pulse-dot" /> Running</span>}
          {isError && <span className="chip chip-bad" style={{ marginLeft: 8 }}>Error</span>}
          {isTimeout && <span className="chip chip-bad" style={{ marginLeft: 8 }}>Timed out</span>}
          {status === "cancelled" && <span className="chip" style={{ marginLeft: 8 }}>Cancelled</span>}
        </>}
        subtitle={`Run · ${runId} · Total: ${elapsedStr}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {isRunning && (
              <button className="btn btn-sm" onClick={handleCancel} disabled={cancelling}>
                {cancelling
                  ? <><span className="dot pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-3)", display: "inline-block" }} /> Cancelling…</>
                  : "Cancel"
                }
              </button>
            )}
          </div>
        }
      />

      {/* B4: reconnect banner */}
      {status === "reconnecting" && (
        <div style={{ margin: "8px 24px", padding: "10px 16px", background: "var(--warn-soft, #fff8e1)", borderRadius: 8, border: "1px solid var(--warn)", display: "flex", gap: 10, alignItems: "center", fontSize: 12 }}>
          <span className="dot pulse-dot" style={{ background: "var(--warn)" }} />
          <span style={{ color: "var(--warn)", fontWeight: 500 }}>
            Connection lost — reconnecting (attempt {reconnectAttempt}/10)…
          </span>
        </div>
      )}

      {/* Error / timeout card — UX-005: provide actionable next steps,
          not just Back. Retry re-submits the same goal; Verify Integrity
          opens the runtime-verify panel; Settings opens the model picker. */}
      {(isError || isTimeout) && (
        <div style={{ margin: "16px 24px", padding: 16, background: "var(--bad-soft)", borderRadius: 10, border: "1px solid var(--bad)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon name="alert" size={18} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>
              {isTimeout ? "Timed out — the model stopped responding" : "Run failed"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 12 }}>
              {error || "An unexpected error occurred."}
            </div>
            {/* UX3-001 fix: retryError state is now actually rendered. The
                round-3 retry button set it on 3 branches (409, non-OK, catch)
                but no JSX referenced it — silent failures, especially the 409
                "can't retry from current state" case. Show inline above the
                action row when set. */}
            {retryError && (
              <div role="alert" style={{ fontSize: 12, color: "var(--bad)", marginBottom: 10, padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--bad)", borderRadius: 6 }}>
                {retryError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn btn-sm btn-primary" disabled={retrying} onClick={async () => {
                // UX-005 / QA-201 / ENG-R2-001: server-side retry. Re-fetches
                // run record under the existing view (no hash navigation —
                // App.jsx doesn't route on hash). Retry button disables while
                // in flight to prevent double-click duplicates.
                if (retrying) return;
                setRetrying(true);
                setRetryError(null);
                try {
                  const r = await fetch(`/api/run/${runId}/retry`, { method: "POST" });
                  if (r.status === 409) {
                    setRetryError("This run can't be retried in its current state.");
                  } else if (!r.ok) {
                    setRetryError(`Retry failed (HTTP ${r.status}). See diagnostic.`);
                  } else {
                    const d = await r.json();
                    if (d.run_id && onRetry) onRetry(d.run_id);
                  }
                } catch (e) {
                  setRetryError(`Retry failed: ${e.message || "network error"}`);
                } finally {
                  setRetrying(false);
                }
              }}>
                <Icon name="refresh" size={12} /> {retrying ? "Retrying…" : "Retry run"}
              </button>
              <button className="btn btn-sm" onClick={() => onOpenSettings && onOpenSettings()}>
                <Icon name="settings" size={12} /> Open Settings
              </button>
              <button className="btn btn-sm" onClick={onCancel}>
                <Icon name="chevL" size={12} /> Back to Dashboard
              </button>
              {/* UX2-002 fix: Diagnostic moved AFTER the action buttons, no
                  marginLeft:auto layout hack. Reads naturally as
                  "[Retry] [Settings] [Back] · Diagnostic ▸". */}
              <details style={{ fontSize: 11, marginLeft: "auto" }}>
                <summary style={{ cursor: "pointer", color: "var(--ink-3)" }}>Diagnostic</summary>
                <pre style={{ marginTop: 8, padding: 10, background: "var(--bg-tint)", borderRadius: 6, fontSize: 10, overflow: "auto", maxWidth: 600 }}>
                  Run ID: {runId}{"\n"}
                  Error: {error || "(none)"}{"\n"}
                  {retryError ? `Last retry attempt: ${retryError}\n` : ""}
                  See Settings → Verify Integrity for the full health snapshot.
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Stage timeline */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Five-stage pipeline</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Stage {Math.min(stageIdx + 1, STAGES.length)} of {STAGES.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STAGES.map((s, i) => {
                const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
                return (
                  <div key={s.id} style={{
                    padding: 12, borderRadius: 8,
                    border: `1px solid ${state === "active" ? "var(--accent)" : "var(--line)"}`,
                    background: state === "active" ? "var(--accent-soft)" : state === "done" ? "var(--bg-tint)" : "transparent",
                    display: "flex", alignItems: "center", gap: 12,
                    opacity: state === "todo" ? 0.5 : 1,
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%",
                      background: state === "done" ? "var(--good)" : state === "active" ? "var(--accent)" : "var(--bg-tint)",
                      color: state === "done" || state === "active" ? "white" : "var(--ink-3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0,
                    }}>
                      {state === "done" ? <Icon name="check" size={12} stroke={3} /> : state === "active" ? <span className="dot pulse-dot" /> : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                      {/* E2: stage elapsed time for active stage */}
                      {state === "active" ? (
                        <div style={{ fontSize: 11, color: "var(--accent)" }}>
                          Stage: {s.desc} · {stageElapsedStr}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.desc}</div>
                      )}
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{s.artifacts} files</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live output */}
          <div className="card" style={{ padding: 0, overflow: "hidden", height: 280, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 12 }}>Live output</span>
              <span className="chip" style={{ marginLeft: 8, fontSize: 10 }}>SSE · /api/run/stream</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }} className="mono">{tokens.toLocaleString()} tokens</span>
            </div>
            <div ref={logRef} style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#0e0c0a", color: "#cdc4b8", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
              {streamLines.length === 0 && (
                <div style={{ color: "#555" }}>Connecting to pipeline…<span className="pulse-dot">▌</span></div>
              )}
              {streamLines.map((l, i) => (
                <div key={i} className="fade-up" style={{ color: l.includes("✓") || l.includes("▸") ? "#cdc4b8" : l.includes("✗") ? "#e07070" : "#cdc4b8" }}>{l}</div>
              ))}
              {isRunning && streamLines.length > 0 && <span className="pulse-dot">▌</span>}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>This run</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { l: "Total elapsed", v: elapsedStr },
                { l: "Stage elapsed",  v: stageElapsedStr },
                // UX-004: only show Tokens if we actually have a real count.
                ...(tokens > 0 ? [{ l: "Tokens",  v: tokens.toLocaleString() }] : []),
                // Cost is honest for local Ollama — say so explicitly instead
                // of showing a meaningless $0.00 next to a $ sign.
                { l: "Cost",    v: "Local — no cloud cost" },
                { l: "Agent",   v: ag?.name || runMeta?.agent || "…" },
                { l: "Project", v: runMeta?.project || "…" },
              ].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--ink-3)" }}>{r.l}</span>
                  <span className="mono" style={{ fontWeight: 500 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>Artifacts so far</div>
            {artifacts.length === 0 && stageIdx === 0 && (
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>Pipeline running…</div>
            )}
            {artifacts.slice(0, 12).map((name, i) => (
              <div key={i} className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11 }}>
                <Icon name="fileText" size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                <span className="mono" style={{ flex: 1, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
              </div>
            ))}
            {artifacts.length > 12 && (
              <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>+{artifacts.length - 12} more</div>
            )}
          </div>

          <div className="card" style={{ padding: 16, background: "var(--bg-tint)", border: "none" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.55 }}>
              <strong>Note:</strong> The pipeline runs to completion on the backend. You can cancel at any time — partial artifacts will be saved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
