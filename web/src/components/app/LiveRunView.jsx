import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { STAGES, SAMPLE_ARTIFACTS } from "../../data.js";
import { useSSE } from "../../hooks/useSSE.js";

export const LiveRunView = ({ runId, onApprovalReady, onCancel }) => {
  const { events, status } = useSSE(runId);
  const [stageIdx, setStageIdx] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [streamLines, setStreamLines] = useState([]);

  // Derive stage progress from SSE events; fall back to animation in demo mode
  useEffect(() => {
    const stageEvents = events.filter(e => e.type === "stage_update");
    if (stageEvents.length > 0) {
      const stageOrder = STAGES.map(s => s.id);
      const lastStage = stageEvents[stageEvents.length - 1].stage;
      const idx = stageOrder.indexOf(lastStage);
      if (idx >= 0) setStageIdx(idx + 1);
      setStreamLines(stageEvents.map(e => `▸ ${e.stage}: ${e.message}`));
    }

    const waiting = events.find(e => e.type === "agent_waiting");
    if (waiting) onApprovalReady();
  }, [events, onApprovalReady]);

  // Demo animation when no real backend
  useEffect(() => {
    if (runId) return;
    const stageIv = setInterval(() => setStageIdx(s => Math.min(s + 1, STAGES.length)), 2400);
    const tokIv   = setInterval(() => setTokens(t => t + 18), 250);
    const demoLines = [
      "▸ founder/intake: validating inputs_manifest.json",
      "▸ founder/extract: 14 input docs ingested (87 KB)",
      "▸ founder/spec: drafting brand-system.md",
      "▸ founder/qa: composite 8.4 — above 7.0 gate ✓",
    ];
    let i = 0;
    const lineIv = setInterval(() => {
      if (i < demoLines.length) { setStreamLines(s => [...s, demoLines[i]]); i++; }
    }, 900);
    return () => { clearInterval(stageIv); clearInterval(tokIv); clearInterval(lineIv); };
  }, [runId]);

  useEffect(() => {
    if (!runId && stageIdx >= STAGES.length) {
      const t = setTimeout(() => onApprovalReady(), 1200);
      return () => clearTimeout(t);
    }
  }, [runId, stageIdx, onApprovalReady]);

  const runLabel = runId || `run-${Date.now().toString(36).slice(-6)}`;

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={<>Founder · <span style={{ color: "var(--accent)" }}>agentsuitelocal</span> <span className="chip chip-info" style={{ marginLeft: 8 }}><span className="dot pulse-dot" /> Running</span></>}
        subtitle={`Run · ${runLabel}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm"><Icon name="pause" size={12} /> Pause</button>
            <button className="btn btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        }
      />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Stage timeline */}
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Five-stage pipeline</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Stage {Math.min(stageIdx + 1, STAGES.length)} of {STAGES.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STAGES.map((s, i) => {
                const state = i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
                return (
                  <div key={s.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${state === "active" ? "var(--accent)" : "var(--line)"}`, background: state === "active" ? "var(--accent-soft)" : state === "done" ? "var(--bg-tint)" : "transparent", display: "flex", alignItems: "center", gap: 12, opacity: state === "todo" ? 0.5 : 1 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: state === "done" ? "var(--good)" : state === "active" ? "var(--accent)" : "var(--bg-tint)", color: state === "done" || state === "active" ? "white" : "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", flexShrink: 0 }}>
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
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#0e0c0a", color: "#cdc4b8", fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
              {streamLines.map((l, i) => (
                <div key={i} className="fade-up" style={{ color: l.includes("✓") ? "#7fb87a" : "#cdc4b8" }}>{l}</div>
              ))}
              {streamLines.length > 0 && <span className="pulse-dot">▌</span>}
            </div>
          </div>
        </div>

        {/* Sidebar metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>This run</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { l: "Elapsed", v: `${Math.floor(stageIdx * 2.4)}m ${Math.floor((stageIdx * 2.4 % 1) * 60)}s` },
                { l: "Tokens",  v: tokens.toLocaleString() },
                { l: "Cost",    v: "$0.00"       },
                { l: "Model",   v: "gemma4:e4b"  },
                { l: "RAM",     v: "7.2 GB"      },
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
            {SAMPLE_ARTIFACTS.slice(0, Math.min(stageIdx * 3, SAMPLE_ARTIFACTS.length)).map((a, i) => (
              <div key={i} className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11 }}>
                <Icon name={a.folder ? "folder" : "fileText"} size={11} style={{ color: a.folder ? "var(--accent)" : "var(--ink-3)" }} />
                <span className="mono" style={{ flex: 1, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                <span className="mono" style={{ color: "var(--ink-4)", fontSize: 10 }}>{a.size}</span>
              </div>
            ))}
            {stageIdx === 0 && <div style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>No artifacts yet — intake stage</div>}
          </div>

          <div className="card" style={{ padding: 16, background: "var(--bg-tint)", border: "none" }}>
            <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.55 }}>
              <strong>Tip:</strong> Quit safely anytime. Runs auto-resume on reopen — state lives in <span className="mono">_state.json</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
