import React, { useEffect, useRef, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { parseSseStream } from "../../utils/sseStream.js";

export const ScreenOllama = ({ onBack, onNext, totalSteps }) => {
  const [phase, setPhase] = useState("detecting"); // detecting | not-found | installing | done | error
  const [installPct, setInstallPct] = useState(0);
  const [installMsg, setInstallMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  // A1: detected Ollama version string
  const [ollamaVersion, setOllamaVersion] = useState(null);
  // I2: platform for macOS vs Windows install path
  const [platform, setPlatform] = useState("win32");
  const ctrlRef = useRef(null);

  // Detect Ollama on mount
  useEffect(() => {
    fetch("/api/ollama/status")
      .then(r => r.json())
      .then(data => {
        if (data.platform) setPlatform(data.platform);
        if (data.running) {
          setOllamaVersion(data.version || null);
          setPhase("done");
        } else {
          setPhase("not-found");
        }
      })
      .catch(() => setPhase("not-found"));
  }, []);

  const startInstall = () => {
    setPhase("installing");
    setInstallPct(0);
    setInstallMsg("Starting…");
    setErrorMsg(null);

    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    fetch("/api/install/ollama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: ctrl.signal,
    }).then(async (res) => {
      for await (const evt of parseSseStream(res.body.getReader())) {
        if (evt.type === "error") {
          setPhase("error");
          setErrorMsg(evt.message);
          return;
        }
        if (evt.message) setInstallMsg(evt.message);
        if (evt.pct != null) setInstallPct(evt.pct);
        if (evt.type === "done") {
          setInstallPct(100);
          setPhase("done");
        }
      }
    }).catch(e => {
      if (e.name !== "AbortError") {
        setPhase("error");
        setErrorMsg(e.message);
      }
    });
  };

  return (
    <InstallerShell step={5} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={phase !== "done"}>
      <SectionHeader eyebrow="Step 05" title="Ollama runtime"
        sub="Ollama is the engine that runs the model on your machine." />

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: phase === "done" ? "var(--good-soft)" : "var(--bg-tint)",
            color: phase === "done" ? "var(--good)" : "var(--ink-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name={phase === "done" ? "check" : "server"} size={22} stroke={phase === "done" ? 2.4 : 1.6} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Ollama</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>localhost:11434 · daemon</div>
          </div>
          {phase === "detecting"  && <span className="chip"><span className="dot pulse-dot" /> Detecting</span>}
          {phase === "not-found"  && <span className="chip chip-warn">Not installed</span>}
          {phase === "installing" && <span className="chip chip-info"><span className="dot pulse-dot" /> Installing</span>}
          {phase === "done"       && <span className="chip chip-good">Ready</span>}
          {phase === "error"      && <span className="chip chip-bad">Failed</span>}
        </div>

        {phase === "detecting" && (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Looking for an existing Ollama daemon…</div>
        )}

        {phase === "not-found" && platform === "darwin" && (
          /* I2: macOS — Homebrew is interactive, no silent install */
          <>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.55 }}>
              Ollama isn't running. On macOS, install Ollama via Homebrew or the official installer.
            </div>
            <div style={{ background: "var(--bg-tint)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontFamily: "monospace", fontSize: 12, color: "var(--ink-1)" }}>
              brew install ollama
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 14, lineHeight: 1.5 }}>
              Or download the macOS app from <strong>ollama.com/download</strong>. Once installed, run{" "}
              <span style={{ fontFamily: "monospace" }}>ollama serve</span> in Terminal, then click Retry below.
            </div>
            <button className="btn btn-primary" onClick={() => { setPhase("detecting"); setTimeout(() => {
              fetch("/api/ollama/status").then(r => r.json()).then(data => {
                if (data.running) { setOllamaVersion(data.version || null); setPhase("done"); }
                else setPhase("not-found");
              });
            }, 500); }}>
              Retry detection
            </button>
          </>
        )}
        {phase === "not-found" && platform !== "darwin" && (
          <>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14, lineHeight: 1.55 }}>
              Ollama isn't running. We'll download and install it — no terminal required.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={startInstall}><Icon name="download" size={14} /> Install Ollama (~280 MB)</button>
            </div>
          </>
        )}

        {phase === "installing" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ProgressBar value={installPct} label={installMsg} sublabel={`${installPct}%`} accent />
          </div>
        )}

        {phase === "done" && (
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Daemon is running at <span className="mono" style={{ color: "var(--accent)" }}>localhost:11434</span>.
            {/* A1: show version if available */}
            {ollamaVersion && <span style={{ marginLeft: 4 }}>Ollama <strong>{ollamaVersion}</strong> detected — OK.</span>}
            {" "}We'll start it automatically whenever you launch AgentSuiteLocal.
          </div>
        )}

        {phase === "error" && (
          <div style={{ fontSize: 13, color: "var(--bad)", lineHeight: 1.55 }}>
            <strong>Install failed:</strong> {errorMsg}
            <div style={{ marginTop: 8 }}>
              <a href="https://ollama.ai" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Download Ollama manually</a>, install it, then click Continue.
            </div>
            <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => {
              setPhase("detecting");
              fetch("/api/ollama/status").then(r => r.json()).then(d => setPhase(d.running ? "done" : "not-found")).catch(() => setPhase("not-found"));
            }}>Check again</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name="info" size={13} style={{ marginTop: 2 }} />
        <span>Ollama is open-source and free. Source: github.com/ollama/ollama. We install the official release unchanged.</span>
      </div>
    </InstallerShell>
  );
};
