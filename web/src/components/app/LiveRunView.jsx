import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { STAGES, AGENTS } from "../../data.js";
import { useSSE } from "../../hooks/useSSE.js";

export const LiveRunView = ({ runId, onApprovalReady, onCancel }) => {
  const { events, status, error } = useSSE(runId);
  const [stageIdx, setStageIdx] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [streamLines, setStreamLines] = useState([]);
  const [runMeta, setRunMeta] = useState(null); // {agent, project} from initial fetch
  const [artifacts, setArtifacts] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const logRef = useRef(null);

  // Fetch run metadata (agent, project) once on mount
  useEffect(() => {
    if (!runId) return;
    fetch(`/api/run/${runId}`)
      .then(r => r.json())
      .then(data => setRunMeta(data))
      .catch(() => {});
  }, [runId]);

  // Elapsed timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  // Drive UI from SSE events
  useEffect(() => {
    if (!events.length) return;

    const stageOrder = STAGES.map(s => s.id);

    for (const evt of events) {
      if (evt.type === "stage_update") {
        const idx = stageOrder.indexOf(evt.stage);
        if (idx >= 0) setStageIdx(idx + 1);
        setStreamLines(prev => [...prev, `▸ ${evt.stage}${evt.message ? ": " + evt.message : ""}`]);
        setTokens(t => t + 18); // approximate token progress per stage event
      }
      if (evt.type === "agent_waiting") {
        setStageIdx(STAGES.length);
        setArtifacts(evt.artifacts || []);
        onApprovalReady();
      }
      if (evt.type === "error") {
        setStreamLines(prev => [...prev, `✗ error: ${evt.message}`]);
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
  const elapsedStr = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  const isRunning = status !== "done" && status !== "error";

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={<>
          {ag?.name || runMeta?.agent || "Agent"} ·{" "}
          <span style={{ color: "var(--accent)" }}>{runMeta?.project || "…"}</span>{" "}
          {isRunning && <span className="chip chip-info" style={{ marginLeft: 8 }}><span className="dot pulse-dot" /> Running</span>}
          {status === "error" && <span className="chip chip-bad" style={{ marginLeft: 8 }}>Error</span>}
        </>}
        subtitle={`Run · ${runId}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        }
      />

      {/* UX-001/UX-003: actionable error card with retry, not a raw error string */}
      {(status === "error" || status === "reconnecting") && (
        <div style={{ margin: "16px 24px", padding: 16, background: "var(--bad-soft)", borderRadius: 10, border: "1px solid var(--bad)", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon name="alert" size={18} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>
              {status === "reconnecting" ? "Reconnecting…" : "Run failed"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: status === "error" ? 10 : 0 }}>
              {error || (status === "reconnecting" ? "Lost connection — retrying automatically." : "An unexpected error occurred.")}
            </div>
            {status === "error" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm" onClick={onCancel}>
                  <Icon name="chevL" size={12} /> Back to Dashboard
                </button>
              </div>
            )}
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
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.desc}</div>
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
                { l: "Elapsed", v: elapsedStr },
                { l: "Tokens",  v: tokens.toLocaleString() },
                { l: "Cost",    v: "$0.00" },
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
              <strong>Note:</strong> The pipeline runs to completion on the backend. Closing this window won't stop it.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
