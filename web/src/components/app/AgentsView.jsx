import React from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const AgentsView = ({ onPick }) => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar
      title="Agents"
      subtitle="Seven specialists. Each writes a different artifact library."
      actions={<button className="btn btn-sm"><Icon name="info" size={13} /> What's a kernel?</button>}
    />
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
      {AGENTS.map(a => (
        <button key={a.id} onClick={() => onPick(a.id)} style={{
          all: "unset", cursor: "pointer", padding: 20,
          borderRadius: 14, border: "1px solid var(--line)",
          background: "var(--bg-elev)", boxShadow: "var(--sh-1)",
          display: "flex", flexDirection: "column", gap: 12, transition: "all 0.15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: a.primary ? "var(--accent)" : "var(--bg-tint)", color: a.primary ? "white" : "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={a.icon} size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span className="display" style={{ fontSize: 18, fontWeight: 500 }}>{a.name}</span>
                {a.primary && <span className="chip chip-accent">Start here</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.tagline}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{a.desc}</div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--ink-3)", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <span><Icon name="fileText" size={11} style={{ verticalAlign: "-2px" }} /> {a.artifactCount} artifacts</span>
            <span><Icon name="clock" size={11} style={{ verticalAlign: "-2px" }} /> {a.runtime}</span>
            <span style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 600 }}>Run <Icon name="arrowR" size={11} style={{ verticalAlign: "-2px" }} /></span>
          </div>
        </button>
      ))}
    </div>
  </div>
);
