import React from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";

export const ScreenTier = ({ onBack, onNext, tier, setTier }) => (
  <InstallerShell step={4} totalSteps={12} onBack={onBack} onNext={onNext}>
    <SectionHeader eyebrow="Step 04" title="Pick a model"
      sub="Bigger model = better output, slower runs, more disk. We've highlighted what fits your hardware." />

    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {MODELS.map(m => {
        const selected = tier === m.id;
        const tooBig = m.id === "pro";
        return (
          <button key={m.id} onClick={() => !tooBig && setTier(m.id)}
            style={{
              all: "unset", cursor: tooBig ? "not-allowed" : "pointer",
              padding: 16, borderRadius: 12,
              border: `1.5px solid ${selected ? "var(--accent)" : "var(--line)"}`,
              background: selected ? "var(--accent-soft)" : "var(--bg-elev)",
              opacity: tooBig ? 0.55 : 1,
              display: "flex", alignItems: "stretch", gap: 16,
              transition: "all 0.15s",
              boxShadow: selected ? "var(--sh-2)" : "var(--sh-1)",
            }}
          >
            <div style={{ width: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, borderRight: "1px solid var(--line)", paddingRight: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 500, color: selected ? "var(--accent)" : "var(--ink)" }}>
                {m.id === "light" ? "S" : m.id === "balanced" ? "M" : "L"}
              </div>
              <div className="mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: "0.1em" }}>TIER</div>
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{m.tier}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{m.model}</span>
                {m.recommended && <span className="chip chip-accent">Recommended for you</span>}
                {tooBig && <span className="chip chip-warn">Needs 32 GB RAM</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.5 }}>{m.blurb}</div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
                <span><Icon name="download" size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{m.size}</span>
                <span><Icon name="ram" size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{m.ram} RAM</span>
                <span><Icon name="zap" size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} />{m.speed}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  Quality
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ width: 5, height: 8, borderRadius: 1, background: i < m.quality ? (selected ? "var(--accent)" : "var(--ink-2)") : "var(--line-2)" }} />
                  ))}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${selected ? "var(--accent)" : "var(--line-2)"}`, background: selected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                {selected && <Icon name="check" size={11} stroke={3} />}
              </div>
            </div>
          </button>
        );
      })}
    </div>

    <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <Icon name="info" size={14} style={{ marginTop: 1 }} />
      <span>You can swap tiers anytime in Settings. Models live in <span className="mono" style={{ color: "var(--ink-2)" }}>~/.ollama/models</span> and are shared across apps.</span>
    </div>
  </InstallerShell>
);
