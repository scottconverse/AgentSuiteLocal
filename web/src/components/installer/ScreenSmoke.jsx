import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenSmoke = ({ onBack, onNext }) => {
  const [steps, setSteps] = useState([]);
  const [status, setStatus] = useState("running"); // running | done | error
  const [summary, setSummary] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    fetch("/api/smoke")
      .then(r => r.json())
      .then(data => {
        setSteps(data.steps || []);
        if (data.ok) {
          setStatus("done");
          setSummary({
            latency_ms: data.latency_ms,
            toks_per_sec: data.toks_per_sec,
            model: data.model,
          });
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
  }, []);

  return (
    <InstallerShell step={10} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={status !== "done"}>
      <SectionHeader eyebrow="Step 10" title="First-run smoke test"
        sub="Quick end-to-end check that everything talks to everything." />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: "#0e0c0a", color: "#d6cdc1", padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, minHeight: 200 }}>
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

      {status === "error" && (
        <div className="fade-up" style={{ marginTop: 16, padding: 14, background: "var(--bad-soft)", borderRadius: 10, border: "1px solid var(--bad)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 6 }}>Smoke test failed</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 10 }}>{errorMsg}</div>
          <button className="btn btn-sm" onClick={() => {
            setSteps([]);
            setStatus("running");
            setErrorMsg(null);
            setSummary(null);
            fetch("/api/smoke").then(r => r.json()).then(data => {
              setSteps(data.steps || []);
              if (data.ok) { setStatus("done"); setSummary({ latency_ms: data.latency_ms, toks_per_sec: data.toks_per_sec, model: data.model }); }
              else { setStatus("error"); const f = (data.steps || []).find(s => !s.ok); setErrorMsg(f?.error || "Smoke test failed."); }
            }).catch(e => { setStatus("error"); setErrorMsg(e.message); });
          }}>
            <Icon name="refresh" size={12} /> Retry
          </button>
        </div>
      )}
    </InstallerShell>
  );
};
