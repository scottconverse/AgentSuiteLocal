import React from "react";
import { Icon, BrandMark } from "../ui/index.jsx";
import { WorkspacePicker } from "../ui/WorkspacePicker.jsx";
import { InstallerShell } from "./InstallerShell.jsx";

export const ScreenWelcome = ({ onNext, onUninstall, totalSteps, workspacePath, setWorkspacePath, setupError }) => (
  <InstallerShell
    step={1}
    totalSteps={totalSteps}
    onNext={onNext}
    nextLabel="Get started"
    accent
    secondary={<button className="btn btn-ghost" onClick={onUninstall}><Icon name="trash" size={14} /> Uninstall</button>}
  >
    <div style={{ paddingTop: 32 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 24 }}>
        <BrandMark size={56} />
        <div>
          <h1 className="display" style={{ fontSize: 56, fontWeight: 500, margin: 0, letterSpacing: 0, lineHeight: 1.0 }}>
            Seven specialists.<br />
            <span style={{ color: "var(--accent)" }}>Zero cloud.</span>
          </h1>
          <p style={{ fontSize: 17, color: "var(--ink-2)", margin: "20px 0 0", lineHeight: 1.55, maxWidth: 540 }}>
            AgentSuiteLocal turns vague ideas into a brand system, product spec,
            engineering plan, and launch playbook — running entirely on your computer.
            No API keys. No subscription. Your work stays yours.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", marginTop: 16 }}>
          {[
            { icon: "lock",   label: "Private",    sub: "Inputs never leave the machine"   },
            { icon: "zap",    label: "One install", sub: "Bundled. No Python, no terminal." },
            { icon: "layers", label: "Reusable",   sub: "Every artifact saved to disk"     },
          ].map((f, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <Icon name={f.icon} size={18} style={{ color: "var(--accent)", marginBottom: 8 }} />
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{f.sub}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 16, width: "100%" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 8, letterSpacing: "0.06em" }}>SAVE FILES TO</div>
          <WorkspacePicker value={workspacePath} onChange={setWorkspacePath} compact />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.45 }}>
            Runs and approved artifacts are saved in a <span className="mono">.agentsuite</span> folder inside this location. You can change it later in Settings.
          </div>
          {setupError && (
            <div style={{ fontSize: 12, color: "var(--bad)", marginTop: 10, lineHeight: 1.45 }}>
              {setupError}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--ink-3)", marginTop: 16 }}>
          <Icon name="info" size={13} />
          Setup takes about 4 minutes. We'll check your hardware, install Ollama if needed, and download a model that fits your machine.
        </div>
      </div>
    </div>
  </InstallerShell>
);
