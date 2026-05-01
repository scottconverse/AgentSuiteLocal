import React from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const PipelineView = () => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar title="Pipelines" subtitle="Chain agents back-to-back. Each step's output feeds the next." />
    <div style={{ padding: 24 }}>
      <div className="card" style={{ padding: 24 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8, letterSpacing: "0.06em" }}>ACTIVE PIPELINE · pipeline-7zk2v</div>
        <div className="display" style={{ fontSize: 22, fontWeight: 500, marginBottom: 18 }}>End-to-end launch · agentsuitelocal</div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
          {[
            { ag: "founder",     state: "done",   score: 8.4 },
            { ag: "design",      state: "done",   score: 8.1 },
            { ag: "product",     state: "active", score: null },
            { ag: "engineering", state: "todo",   score: null },
            { ag: "marketing",   state: "todo",   score: null },
          ].map((step, i, arr) => {
            const a = AGENTS.find(x => x.id === step.ag);
            return (
              <React.Fragment key={i}>
                <div style={{
                  padding: 14, borderRadius: 10, minWidth: 180,
                  border: `1.5px solid ${step.state === "active" ? "var(--accent)" : "var(--line)"}`,
                  background: step.state === "active" ? "var(--accent-soft)" : step.state === "done" ? "var(--bg-tint)" : "transparent",
                  opacity: step.state === "todo" ? 0.5 : 1,
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon name={a.icon} size={14} style={{ color: step.state === "active" ? "var(--accent)" : "var(--ink-2)" }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                    {step.state === "done"   && <Icon name="check" size={13} style={{ color: "var(--good)", marginLeft: "auto" }} stroke={3} />}
                    {step.state === "active" && <span className="dot pulse-dot" style={{ marginLeft: "auto", color: "var(--accent)" }} />}
                  </div>
                  {step.score  && <div className="mono" style={{ fontSize: 11, color: "var(--good)" }}>QA {step.score.toFixed(1)} · approved</div>}
                  {step.state === "active" && <div className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>Stage 3 of 5 · spec</div>}
                  {step.state === "todo"   && <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Queued</div>}
                </div>
                {i < arr.length - 1 && <div style={{ width: 28, height: 1, background: "var(--line-2)" }} />}
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ marginTop: 18, padding: 14, background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-2)" }}>
          <strong>Auto-approve mode:</strong> off. Each step pauses for your review before promoting to kernel.
          <button className="btn btn-sm" style={{ marginLeft: 12 }}>Switch to auto</button>
        </div>
      </div>
    </div>
  </div>
);
