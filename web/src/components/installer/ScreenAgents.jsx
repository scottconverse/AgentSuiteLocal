import React from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { AGENTS } from "../../data.js";

export const ScreenAgents = ({ onBack, onNext, enabled, setEnabled }) => {
  const toggle = id => setEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <InstallerShell step={8} totalSteps={12} onBack={onBack} onNext={onNext}
      nextDisabled={enabled.length === 0}
      secondary={<button className="btn btn-ghost" onClick={() => setEnabled(AGENTS.map(a => a.id))}>Select all</button>}
    >
      <SectionHeader eyebrow="Step 08" title="Pick your agents"
        sub="Each agent is a five-stage pipeline that produces a different kind of artifact library. You can change this anytime." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {AGENTS.map(a => {
          const sel = enabled.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggle(a.id)} className="btn-card" style={{
              cursor: "pointer", padding: 14, borderRadius: 10,
              border: `1.5px solid ${sel ? "var(--accent)" : "var(--line)"}`,
              background: sel ? "var(--accent-soft)" : "var(--bg-elev)",
              display: "flex", flexDirection: "column", gap: 8, transition: "all 0.12s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: sel ? "var(--accent)" : "var(--bg-tint)", color: sel ? "white" : "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={a.icon} size={16} />
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{a.tagline}</div>
                </div>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${sel ? "var(--accent)" : "var(--line-2)"}`, background: sel ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  {sel && <Icon name="check" size={10} stroke={3} />}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "left" }}>
                {a.artifactCount} artifacts · {a.runtime}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-3)", textAlign: "center" }}>
        {enabled.length} of {AGENTS.length} selected
      </div>
    </InstallerShell>
  );
};
