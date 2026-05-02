import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenUninstall = ({ onBack }) => {
  const [keepModels, setKeepModels] = useState(true);
  const [keepArtifacts, setKeepArtifacts] = useState(true);

  // UX-004: use OS-neutral paths; actual paths depend on OS and install location
  const items = [
    { id: "app",       label: "AgentSuiteLocal app",            sub: "%LOCALAPPDATA%\\AgentSuiteLocal  (or /Applications on macOS)", size: "82 MB",             forced: true  },
    { id: "py",        label: "Python runtime + dependencies",   sub: "%APPDATA%\\AgentSuiteLocal\\runtime  (or ~/Library on macOS)", size: "164 MB",            forced: true  },
    { id: "ollama",    label: "Ollama daemon",                   sub: "Installed by Ollama's own installer",                          size: "94 MB"                            },
    { id: "models",    label: "Downloaded models (Gemma 4 e4b)", sub: "%USERPROFILE%\\.ollama\\models  (or ~/.ollama on macOS)",      size: "5.4 GB",            keep: keepModels,    setKeep: setKeepModels    },
    { id: "artifacts", label: "Your runs and artifacts",         sub: "%USERPROFILE%\\AgentSuite  (or ~/AgentSuite on macOS)",        size: "variable",          keep: keepArtifacts, setKeep: setKeepArtifacts },
  ];

  return (
    <InstallerShell step={12} totalSteps={12} onBack={onBack} hideNav>
      <SectionHeader eyebrow="Uninstall" title="Remove AgentSuiteLocal"
        sub="By default we keep the model files and your artifacts so reinstalling is fast." />

      <div className="card" style={{ padding: 4, overflow: "hidden" }}>
        {items.map((r, i) => {
          const willDelete = r.forced ? true : r.keep !== undefined ? !r.keep : false;
          return (
            <div key={r.id} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: i < items.length - 1 ? "1px solid var(--line)" : "none" }}>
              <input type="checkbox"
                checked={willDelete}
                onChange={r.forced ? undefined : (e) => r.setKeep(!e.target.checked)}
                disabled={r.forced}
                style={{ accentColor: "var(--bad)" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {r.label}
                  {r.forced && <span className="chip chip-bad" style={{ marginLeft: 8, fontSize: 10 }}>required</span>}
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{r.sub}</div>
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>{r.size}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onBack}>Cancel</button>
        <button className="btn" style={{ background: "var(--bad)", color: "white", borderColor: "var(--bad)" }}>
          <Icon name="x" size={14} /> Uninstall
        </button>
      </div>
    </InstallerShell>
  );
};
