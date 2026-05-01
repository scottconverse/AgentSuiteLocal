import React from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell } from "./InstallerShell.jsx";

export const ScreenSuccess = ({ onBack, onNext }) => (
  <InstallerShell step={11} totalSteps={12} onBack={onBack} onNext={onNext} nextLabel="Launch AgentSuiteLocal" accent>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", paddingTop: 24 }}>
      <div style={{ width: 72, height: 72, borderRadius: 18, background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 12px 32px rgba(194, 86, 43, 0.32)" }}>
        <Icon name="check" size={36} stroke={2.4} />
      </div>
      <h1 className="display" style={{ fontSize: 44, fontWeight: 500, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.05 }}>You're set up.</h1>
      <p style={{ fontSize: 16, color: "var(--ink-2)", marginTop: 14, lineHeight: 1.55, maxWidth: 520 }}>
        Seven agents are loaded and waiting. The model is local, the runtime is verified, and the first run is a click away.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 28, width: "100%" }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6, letterSpacing: "0.06em" }}>WORKSPACE</div>
          <div className="mono" style={{ fontSize: 13, color: "var(--ink)", wordBreak: "break-all" }}>~/AgentSuite</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6, letterSpacing: "0.06em" }}>STATUS</div>
          <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <span className="dot" style={{ color: "var(--good)" }} /> All systems go
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 24, fontSize: 13 }}>
        <a href="#" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}><Icon name="book" size={13} /> User manual</a>
        <span style={{ color: "var(--line-2)" }}>·</span>
        <a href="#" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}><Icon name="folder" size={13} /> Open workspace folder</a>
        <span style={{ color: "var(--line-2)" }}>·</span>
        <a href="#" style={{ color: "var(--accent)", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}><Icon name="settings" size={13} /> Tweak setup</a>
      </div>
    </div>
  </InstallerShell>
);
