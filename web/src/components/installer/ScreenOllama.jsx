import React, { useEffect, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenOllama = ({ onBack, onNext }) => {
  const [phase, setPhase] = useState("detecting");

  useEffect(() => {
    fetch("/api/ollama/status")
      .then(r => r.json())
      .then(data => setPhase(data.running ? "done" : "not-found"))
      .catch(() => setTimeout(() => setPhase("not-found"), 1200));
  }, []);

  const startInstall = () => {
    setPhase("installing");
    let pct = 0;
    const iv = setInterval(() => {
      pct += 7;
      if (pct >= 100) { clearInterval(iv); setPhase("done"); }
    }, 220);
  };

  return (
    <InstallerShell step={5} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={phase !== "done"}>
      <SectionHeader eyebrow="Step 05" title="Ollama runtime"
        sub="Ollama is the engine that runs the model. We bundle it so you don't have to install anything by hand." />

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: phase === "done" ? "var(--good-soft)" : "var(--bg-tint)", color: phase === "done" ? "var(--good)" : "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={phase === "done" ? "check" : "server"} size={22} stroke={phase === "done" ? 2.4 : 1.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Ollama 0.4.6</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>localhost:11434 · daemon</div>
          </div>
          {phase === "detecting"  && <span className="chip"><span className="dot pulse-dot" /> Detecting</span>}
          {phase === "not-found"  && <span className="chip chip-warn">Not installed</span>}
          {phase === "installing" && <span className="chip chip-info"><span className="dot pulse-dot" /> Installing</span>}
          {phase === "done"       && <span className="chip chip-good">Ready</span>}
        </div>

        {phase === "detecting" && <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Looking for an existing Ollama daemon...</div>}

        {phase === "not-found" && (
          <>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.55 }}>
              We couldn't find Ollama on this machine. We'll install it from the bundled package — no terminal, no admin password unless your OS asks.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={startInstall}><Icon name="download" size={14} /> Install Ollama (~280 MB)</button>
              <button className="btn">I have it elsewhere — point to it</button>
            </div>
          </>
        )}

        {phase === "installing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ProgressBar value={62} label="Extracting & registering daemon" sublabel="62%" accent />
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              ▸ unpack ollama-darwin-arm64.tar.gz<br />
              ▸ install to /usr/local/bin/ollama<br />
              ▸ register launchd service<br />
              <span style={{ color: "var(--ink-4)" }}>▸ start daemon ...</span>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Daemon is running and reachable at <span className="mono" style={{ color: "var(--accent)" }}>localhost:11434</span>. We'll auto-start it whenever you launch AgentSuiteLocal.
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name="info" size={13} style={{ marginTop: 2 }} />
        <span>Ollama is open-source. Source: github.com/ollama/ollama. We don't modify or repackage it — just bundle the official release.</span>
      </div>
    </InstallerShell>
  );
};
