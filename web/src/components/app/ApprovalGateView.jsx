import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { SAMPLE_ARTIFACTS, QA_DIMENSIONS } from "../../data.js";

export const ApprovalGateView = ({ runId, onApprove, onReject }) => {
  const [selected, setSelected] = useState(SAMPLE_ARTIFACTS[0]);
  const [approverName, setApproverName] = useState("Scott Converse");

  const handleApprove = async () => {
    if (runId) {
      await fetch(`/api/run/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: approverName }),
      }).catch(() => {});
    }
    onApprove();
  };

  const handleReject = async () => {
    if (runId) {
      await fetch(`/api/run/${runId}/reject`, { method: "POST" }).catch(() => {});
    }
    onReject();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar
        title={<>Review · <span style={{ color: "var(--accent)" }}>Founder · agentsuitelocal</span></>}
        subtitle="QA composite 8.4 — above the 7.0 gate. Skim the spec artifacts, then approve to promote into your kernel."
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={handleReject}><Icon name="x" size={13} /> Reject & re-run</button>
            <button className="btn btn-accent btn-sm" onClick={handleApprove}><Icon name="check" size={13} /> Approve & promote</button>
          </div>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr 280px", overflow: "hidden", minHeight: 0 }}>
        {/* File tree */}
        <div style={{ borderRight: "1px solid var(--line)", overflow: "auto", padding: "12px 0" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 16px 8px" }}>14 artifacts</div>
          {SAMPLE_ARTIFACTS.map((a, i) => (
            <button key={i} onClick={() => setSelected(a)} style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", width: "100%", fontSize: 12,
              background: selected.name === a.name ? "var(--accent-soft)" : "transparent",
              color: selected.name === a.name ? "var(--accent-ink)" : "var(--ink-2)",
              borderLeft: `2px solid ${selected.name === a.name ? "var(--accent)" : "transparent"}`,
            }}>
              <Icon name={a.folder ? "folder" : "fileText"} size={12} style={{ color: a.folder ? "var(--accent)" : "var(--ink-3)" }} />
              <span className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: a.primary ? 600 : 400 }}>{a.name}</span>
              {a.primary && <span className="chip chip-accent" style={{ fontSize: 9, padding: "0 5px" }}>★</span>}
              <span className="mono" style={{ fontSize: 9, color: "var(--ink-4)" }}>{a.size}</span>
            </button>
          ))}
        </div>

        {/* File preview */}
        <div style={{ overflow: "auto", padding: 24, background: "var(--bg-elev)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
            <Icon name="fileText" size={16} style={{ color: "var(--accent)" }} />
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{selected.name}</span>
            <span className="chip" style={{ fontSize: 10 }}>{selected.kind}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>{selected.size}</span>
          </div>

          <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, marginBottom: 8, letterSpacing: "-0.01em" }}>
            AgentSuiteLocal — Brand System
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 18 }}>
            Generated 2026-05-01T14:22 · approver pending · {runId || "run-fbk7c"}
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>1. Positioning Statement</h3>
          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.65, margin: 0, marginBottom: 14 }}>
            For non-technical founders, inventors, and entrepreneurs, AgentSuiteLocal is a desktop application that turns vague intent into precise operating artifacts — without sending a byte off the machine. Unlike cloud agent platforms, AgentSuiteLocal runs the entire seven-agent pipeline against a local Ollama model.
          </p>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>2. Voice Pillars</h3>
          <ul style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, paddingLeft: 20, margin: 0, marginBottom: 14 }}>
            <li><strong>Direct, never breathless.</strong> No "revolutionary" or "game-changing." State the mechanism.</li>
            <li><strong>Honest about local limits.</strong> Local models won't match Claude. Say so plainly.</li>
            <li><strong>Operator-grade.</strong> Every claim ties back to a verifiable artifact on disk.</li>
          </ul>

          <h3 style={{ fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 8 }}>3. Color & Type</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[
              { c: "#c2562b", n: "Terracotta" },
              { c: "#1a1614", n: "Ink"        },
              { c: "#faf8f5", n: "Paper"      },
              { c: "#3f7d3a", n: "Verify"     },
            ].map(s => (
              <div key={s.c} style={{ flex: 1 }}>
                <div style={{ height: 60, background: s.c, borderRadius: 6, border: "1px solid var(--line)" }} />
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4 }}>{s.n} · {s.c}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>
            ... continued. Full document is {selected.size}. Open in your editor for the rest.
          </p>
        </div>

        {/* QA panel */}
        <div style={{ borderLeft: "1px solid var(--line)", overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>QA score</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, color: "var(--good)", letterSpacing: "-0.02em", lineHeight: 1 }}>
              8.4<span style={{ fontSize: 18, color: "var(--ink-3)" }}>/10</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Above 7.0 gate · auto-promote eligible</div>
          </div>

          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>Per dimension</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {QA_DIMENSIONS.map(d => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                  <div style={{ width: 80, height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                    <div style={{ width: `${d.score * 10}%`, height: "100%", background: d.score >= 8 ? "var(--good)" : d.score >= 7 ? "var(--accent)" : "var(--warn)", borderRadius: 2 }} />
                  </div>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: d.score >= 8 ? "var(--good)" : "var(--ink-2)", width: 26, textAlign: "right" }}>{d.score.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 12, background: "var(--bg-tint)", border: "none" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 6 }}>Approver</div>
            <input value={approverName} onChange={e => setApproverName(e.target.value)} style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 6, background: "var(--bg)" }} />
            <button className="btn btn-accent" style={{ width: "100%", marginTop: 8, justifyContent: "center" }} onClick={handleApprove}>
              <Icon name="check" size={13} /> Approve as {approverName.split(" ")[0]}
            </button>
            <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
              Promotes 12 spec artifacts to <span className="mono">_kernel/agentsuitelocal/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
