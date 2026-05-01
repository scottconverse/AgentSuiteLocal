import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

const PROBES = [
  "Starting Ollama daemon",
  "Loading gemma4:e4b into memory",
  "Pinging /api/generate",
  "Running 1-token reasoning probe",
  "Verifying agent kernel can write to ~/.agentsuite",
];

export const ScreenSmoke = ({ onBack, onNext }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setStep(s => s >= PROBES.length ? s : s + 1), 480);
    return () => clearInterval(iv);
  }, []);

  const allDone = step >= PROBES.length;

  return (
    <InstallerShell step={10} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={!allDone}>
      <SectionHeader eyebrow="Step 10" title="First-run smoke test"
        sub="Quick end-to-end check that everything talks to everything." />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: "#0e0c0a", color: "#d6cdc1", padding: "16px 18px", fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.7, minHeight: 240 }}>
          {PROBES.slice(0, step).map((p, i) => (
            <div key={i}><span style={{ color: "#7fb87a" }}>✓</span> {p}</div>
          ))}
          {step < PROBES.length && (
            <div>
              <span className="pulse-dot" style={{ color: "var(--accent)" }}>◆</span> {PROBES[step]}<span className="pulse-dot">_</span>
            </div>
          )}
          {allDone && (
            <>
              <div style={{ marginTop: 12, color: "#7fb87a" }}>━━━━━━━━━━━━━━━━━━━━━━━━━</div>
              <div style={{ marginTop: 4, color: "#e6d8c2" }}>
                <span style={{ color: "#7fb87a" }}>READY.</span> Latency 142ms · 18.4 tok/s · model loaded
              </div>
            </>
          )}
        </div>
      </div>

      {allDone && (
        <div className="fade-up" style={{ marginTop: 16, padding: 14, background: "var(--good-soft)", color: "var(--good)", borderRadius: 10, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="check" size={18} stroke={2.4} />
          Everything is wired up correctly.
        </div>
      )}
    </InstallerShell>
  );
};
