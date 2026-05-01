import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenLicense = ({ onBack, onNext }) => {
  const [agreed, setAgreed] = useState(false);
  return (
    <InstallerShell step={2} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={!agreed} nextLabel="I agree">
      <SectionHeader eyebrow="Step 02" title="License & privacy" sub="Plain English. The legal text is in LICENSE.md if you want it." />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { icon: "lock",   t: "Your inputs never leave this machine.",  d: "Every prompt, every artifact, every brand input — all stays on local disk. No telemetry, no analytics, no cloud calls." },
          { icon: "shield", t: "AgentSuiteLocal is MIT-licensed.",       d: "Free for personal and commercial use. Modify and redistribute freely. The model (Gemma 4) carries Google's open-weight license." },
          { icon: "alert",  t: "AI output is a draft, not advice.",      d: "These artifacts are starting points — not legal, financial, or medical advice. Review before you ship anything to customers, investors, or counsel." },
        ].map((row, i) => (
          <div key={i} className="card" style={{ padding: 16, display: "flex", gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={row.icon} size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{row.t}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{row.d}</div>
            </div>
          </div>
        ))}
      </div>

      <label style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        marginTop: 24, padding: 16,
        border: `1.5px solid ${agreed ? "var(--accent)" : "var(--line-2)"}`,
        borderRadius: 10, cursor: "pointer",
        background: agreed ? "var(--accent-soft)" : "transparent",
        transition: "all 0.15s",
      }}>
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: 2, accentColor: "var(--accent)" }} />
        <span style={{ fontSize: 13, color: "var(--ink)" }}>
          I've read the above and the full license. I understand AI output is a draft and I'm responsible for what I do with it.
        </span>
      </label>
    </InstallerShell>
  );
};
