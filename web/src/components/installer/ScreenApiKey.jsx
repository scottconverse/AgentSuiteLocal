import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenApiKey = ({ onBack, onNext }) => {
  const [mode, setMode] = useState("local");

  return (
    <InstallerShell step={9} totalSteps={12} onBack={onBack} onNext={onNext}>
      <SectionHeader eyebrow="Step 09" title="Cloud fallback (optional)"
        sub="AgentSuiteLocal runs 100% local by default. If you want, you can drop in a cloud API key for one-click escalation when an agent stalls." />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { id: "local", icon: "cloudOff", label: "Pure local", badge: "Recommended", desc: "Nothing leaves your machine. Ever. Cost is electricity." },
          { id: "hybrid", icon: "cloud",   label: "Hybrid — local first, cloud on demand", badge: null, desc: "Default to local. When QA scores low, you'll see a \"Re-run on cloud\" button. Keys stay in your OS keychain." },
        ].map(opt => (
          <button key={opt.id} onClick={() => setMode(opt.id)} style={{
            all: "unset", cursor: "pointer", padding: 16, borderRadius: 10,
            border: `1.5px solid ${mode === opt.id ? "var(--accent)" : "var(--line)"}`,
            background: mode === opt.id ? "var(--accent-soft)" : "var(--bg-elev)",
            display: "flex", gap: 14,
          }}>
            <Icon name={opt.icon} size={22} style={{ color: mode === opt.id ? "var(--accent)" : "var(--ink-2)", marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{opt.label}</span>
                {opt.badge && <span className="chip chip-accent">{opt.badge}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {mode === "hybrid" && (
        <div className="card fade-up" style={{ padding: 16, marginTop: 14 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>API keys (optional — all blank = pure local)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Anthropic", "OpenAI", "Google Gemini"].map(p => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 110, fontSize: 13, color: "var(--ink-2)" }}>{p}</div>
                <input type="password" placeholder="sk-..." style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--line-2)", borderRadius: 6, background: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
                <button className="btn btn-sm">Test</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </InstallerShell>
  );
};
