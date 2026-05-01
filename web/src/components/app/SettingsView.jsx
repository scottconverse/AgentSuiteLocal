import React, { useState } from "react";
import { Icon, Toggle } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const SettingsView = () => {
  const [autoApprove, setAutoApprove] = useState(false);
  const [openOnLaunch, setOpenOnLaunch] = useState(true);
  const [telemetry, setTelemetry] = useState(false);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar title="Settings" subtitle="Configure agents, model, costs, and behavior" />
      <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>LLM Engine</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--bg-tint)", borderRadius: 8 }}>
            <Icon name="server" size={20} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>gemma4:e4b · Ollama</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>localhost:11434 · 5.4 GB · loaded</div>
            </div>
            <span className="chip chip-good"><span className="dot" /> Healthy</span>
            <button className="btn btn-sm">Swap</button>
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Enabled agents</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGENTS.map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }}>
                <Icon name={a.icon} size={14} style={{ color: "var(--ink-2)" }} />
                <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                <Toggle checked={true} onChange={() => {}} size="sm" />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Behavior</div>
          {[
            { l: "Auto-approve runs scoring ≥ 8.0", v: autoApprove, set: setAutoApprove, sub: "Skip the manual review gate when QA is high"  },
            { l: "Open browser on launch",          v: openOnLaunch, set: setOpenOnLaunch, sub: "Auto-open dashboard at localhost:8765"        },
            { l: "Send anonymous performance telemetry", v: telemetry, set: setTelemetry, sub: "Off by default. We don't collect anything."   },
          ].map(r => (
            <div key={r.l} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.l}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.sub}</div>
              </div>
              <Toggle checked={r.v} onChange={r.set} />
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Workspace</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Where artifacts and runs are stored</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input readOnly value="~/AgentSuite" className="mono" style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg-tint)" }} />
            <button className="btn btn-sm">Change</button>
            <button className="btn btn-sm"><Icon name="folder" size={13} /> Reveal</button>
          </div>
        </div>
      </div>
    </div>
  );
};
