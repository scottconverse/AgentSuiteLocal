import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenPython = ({ onBack, onNext, totalSteps }) => {
  const [checks, setChecks] = useState([]);
  const [shown, setShown] = useState(0); // how many checks to render (for staggered animation)
  const [allOk, setAllOk] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/runtime/verify")
      .then(r => r.json())
      .then(data => {
        setChecks(data.checks || []);
        setAllOk(data.all_ok);
        // Reveal items one at a time for the animation effect
        let i = 0;
        const iv = setInterval(() => {
          i++;
          setShown(i);
          if (i >= (data.checks || []).length) clearInterval(iv);
        }, 280);
        return () => clearInterval(iv);
      })
      .catch(e => setError(e.message));
  }, []);

  const visibleChecks = checks.slice(0, shown);
  const anyFailed = checks.some(c => !c.ok);

  return (
    <InstallerShell step={7} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={shown < checks.length || !allOk}>
      <SectionHeader eyebrow="Step 07" title="Setting up the runtime"
        sub="The agents run inside a bundled Python environment. Verifying everything is intact." />

      <div className="card" style={{ padding: 4, overflow: "hidden" }}>
        {visibleChecks.length === 0 && !error && (
          <div style={{ padding: 16, fontSize: 13, color: "var(--ink-3)" }}>
            <span className="dot pulse-dot" style={{ background: "var(--accent)", marginRight: 8 }} />
            Verifying…
          </div>
        )}
        {visibleChecks.map((it, i) => (
          <div key={i} style={{
            padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
            borderBottom: i < visibleChecks.length - 1 ? "1px solid var(--line)" : "none",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: it.ok ? "var(--good)" : "var(--bad)",
              color: "white",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name={it.ok ? "check" : "x"} size={12} stroke={3} />
            </div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{it.name}</div>
            {it.size && <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{it.size}</div>}
            <div style={{ width: 70, textAlign: "right" }}>
              <span className={`chip ${it.ok ? "chip-good" : "chip-bad"}`} style={{ fontSize: 10 }}>
                {it.ok ? "verified" : "failed"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="card" style={{ marginTop: 16, padding: 14, borderColor: "var(--bad)", background: "var(--bad-soft)", fontSize: 13, color: "var(--bad)" }}>
          Could not reach the runtime verification endpoint. Is the backend running?
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>{error}</div>
        </div>
      )}

      {shown >= checks.length && allOk && (
        <div className="card fade-up" style={{ marginTop: 16, padding: 14, borderColor: "var(--good)", background: "var(--good-soft)", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="check" size={18} stroke={2.4} style={{ color: "var(--good)" }} />
          <div style={{ fontSize: 13 }}><strong>Runtime ready.</strong> All components verified.</div>
        </div>
      )}

      {shown >= checks.length && anyFailed && (
        <div className="card fade-up" style={{ marginTop: 16, padding: 14, borderColor: "var(--bad)", background: "var(--bad-soft)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>Some components failed verification.</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)" }}>
            This usually means the app bundle is incomplete. Try quitting and re-opening AgentSuiteLocal.
          </div>
        </div>
      )}
    </InstallerShell>
  );
};
