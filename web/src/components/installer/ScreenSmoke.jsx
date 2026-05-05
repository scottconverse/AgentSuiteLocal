import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

// Per-check fix messages and action buttons, plus a "Skip smoke test" escape hatch.
// Keys MUST match the labels emitted by /api/smoke in routers/ollama.py — drift
// here means failed users see 'X failed' with no actionable fix guidance.
const STEP_FIX_MAP = {
  "Starting Ollama daemon":
    { msg: "Ollama is not running. Go back and install or start it, then retry.", action: "Go back", goBack: true },
  "Loading model into memory":
    { msg: "No model is loaded. Go back and complete model download.", action: "Go back", goBack: true },
  "Pinging /api/generate":
    { msg: "Ollama daemon refused the inference request. Try restarting Ollama.", action: null },
  "Running 1-token reasoning probe":
    { msg: "Model inference failed. The model may be corrupted — try re-downloading from Model Management.", action: null },
  "Verifying Python kernel → OllamaProvider → import ollama":
    { msg: "AgentSuiteLocal's Python bundle is missing the Ollama SDK. This is a build defect — please reinstall from a fresh release. Skipping is not safe; New Run will fail.", action: null },
  "Verifying agent kernel write access":
    { msg: "Cannot write to ~/.agentsuite. Check folder permissions and disk space.", action: null },
};

export const ScreenSmoke = ({ onBack, onNext, totalSteps }) => {
  const [steps, setSteps]   = useState([]);
  const [status, setStatus] = useState("running"); // running | done | error
  const [summary, setSummary]     = useState(null);
  const [errorMsg, setErrorMsg]   = useState(null);
  // A4: skip state
  const [skipped, setSkipped]     = useState(false);
  const [skipWarning, setSkipWarning] = useState(false);

  const runSmoke = () => {
    setSteps([]);
    setStatus("running");
    setErrorMsg(null);
    setSummary(null);
    fetch("/api/smoke")
      .then(r => r.json())
      .then(data => {
        setSteps(data.steps || []);
        if (data.ok) {
          setStatus("done");
          setSummary({ latency_ms: data.latency_ms, toks_per_sec: data.toks_per_sec, model: data.model });
        } else {
          setStatus("error");
          const failed = (data.steps || []).find(s => !s.ok);
          setErrorMsg(failed?.error || "Smoke test failed.");
        }
      })
      .catch(e => {
        setStatus("error");
        setErrorMsg(e.message);
      });
  };

  useEffect(() => { runSmoke(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const failedSteps = steps.filter(s => !s.ok);

  // A4: skip flow
  const handleSkip = () => {
    if (!skipWarning) { setSkipWarning(true); return; }
    setSkipped(true);
    onNext();
  };

  return (
    <InstallerShell step={5} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={status !== "done" && !skipped}>
      <SectionHeader eyebrow="Step 05" title="First-run smoke test"
        sub="Quick end-to-end check that everything talks to everything." />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: "#0e0c0a", color: "#d6cdc1", padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, minHeight: 180 }}>
          {status === "running" && steps.length === 0 && (
            <div><span style={{ color: "var(--accent)" }}>◆</span> Running probes…<span className="pulse-dot">_</span></div>
          )}
          {steps.map((s, i) => (
            <div key={i}>
              <span style={{ color: s.ok ? "#7fb87a" : "#e07070" }}>{s.ok ? "✓" : "✗"}</span> {s.label}
              {s.error && <span style={{ color: "#e07070" }}> — {s.error}</span>}
            </div>
          ))}
          {status === "running" && steps.length > 0 && (
            <div><span style={{ color: "var(--accent)" }}>◆</span> <span className="pulse-dot">_</span></div>
          )}
          {status === "done" && summary && (
            <>
              <div style={{ marginTop: 12, color: "#7fb87a" }}>━━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <div style={{ marginTop: 4, color: "#e6d8c2" }}>
                <span style={{ color: "#7fb87a" }}>READY.</span>{" "}
                Latency {summary.latency_ms}ms · {summary.toks_per_sec} tok/s · {summary.model}
              </div>
            </>
          )}
        </div>
      </div>

      {status === "done" && (
        <div className="fade-up" style={{ marginTop: 16, padding: 14, background: "var(--good-soft)", color: "var(--good)", borderRadius: 10, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="check" size={18} stroke={2.4} />
          Everything is wired up correctly.
        </div>
      )}

      {/* A4: per-check fix cards for failed steps */}
      {status === "error" && failedSteps.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {failedSteps.map((s, i) => {
            const fix = STEP_FIX_MAP[s.label];
            return (
              <div key={i} className="card" style={{ padding: 12, borderColor: "var(--bad)", background: "var(--bad-soft)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Icon name="alert" size={14} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--bad)", marginBottom: 2 }}>{s.label} failed</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)" }}>
                    {fix?.msg || s.error || "Check your installation and try again."}
                  </div>
                </div>
                {fix?.action && (
                  <button className="btn btn-sm" onClick={fix.goBack ? onBack : null}>{fix.action}</button>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="btn btn-sm btn-accent" onClick={runSmoke}>
              <Icon name="refresh" size={12} /> Retry all checks
            </button>
            {/* QA-002: when the daemon-down step is the failure, offer a
                one-click way to launch Ollama so Mac users (who can't run
                CLI commands) have a path out. The backend's open-app endpoint
                handles platform-specific launch. */}
            {failedSteps.some(s => s.label === "Starting Ollama daemon") && (
              <button className="btn btn-sm" onClick={async () => {
                // QA-204: check response.ok — a 404 (Ollama not installed) was
                // previously treated as success and the user got a silent 2s
                // retry loop with the same error.
                try {
                  const r = await fetch("/api/system/open-app", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ app: "Ollama" }),
                  });
                  if (r.status === 404) {
                    setErrorMsg("Ollama isn't installed. Go back and click Install Ollama.");
                    return;
                  }
                  if (!r.ok) {
                    setErrorMsg(`Couldn't launch Ollama (HTTP ${r.status}). Open it from your Start menu / Applications, then click Retry.`);
                    return;
                  }
                  setTimeout(runSmoke, 2000);
                } catch (e) {
                  setErrorMsg(`Couldn't reach the launcher: ${e.message || "unknown error"}.`);
                }
              }}>
                <Icon name="open" size={12} /> Open Ollama
              </button>
            )}
          </div>
        </div>
      )}

      {status === "error" && failedSteps.length === 0 && (
        <div className="fade-up" style={{ marginTop: 16, padding: 14, background: "var(--bad-soft)", borderRadius: 10, border: "1px solid var(--bad)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 6 }}>Smoke test failed</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10 }}>{errorMsg}</div>
          <button className="btn btn-sm" onClick={runSmoke}><Icon name="refresh" size={12} /> Retry</button>
        </div>
      )}

      {/* A4: skip smoke test escape hatch */}
      {status === "error" && (
        <div style={{ marginTop: 12 }}>
          {!skipWarning ? (
            <button className="btn btn-sm" style={{ color: "var(--ink-3)" }} onClick={handleSkip}>Skip smoke test</button>
          ) : (
            <div style={{ padding: 12, background: "var(--warn-soft, #fff8e1)", borderRadius: 8, border: "1px solid var(--warn)", fontSize: 12, color: "var(--warn)" }}>
              Skipping the smoke test means the app may not work correctly.
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button className="btn btn-sm" style={{ borderColor: "var(--warn)", color: "var(--warn)" }} onClick={handleSkip}>Skip anyway</button>
                <button className="btn btn-sm" onClick={() => setSkipWarning(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </InstallerShell>
  );
};
