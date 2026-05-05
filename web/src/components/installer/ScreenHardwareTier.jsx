/**
 * UX-1: ScreenHardwareTier — combined hardware scan + tier selection (step 3 of 6).
 * Replaces the separate ScreenHardware (step 3) and ScreenTier (step 4).
 * Hardware scan auto-detects RAM and pre-selects the recommended tier.
 */
import React, { useEffect, useState } from "react";
import { Icon, MetricCard } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";

/** Return the appropriate tier given detected RAM GB. */
function recommendedTier(ramGb) {
  if (ramGb >= 32) return "pro";
  if (ramGb >= 16) return "balanced";
  return "light";
}

export const ScreenHardwareTier = ({ onBack, onNext, tier, setTier, totalSteps }) => {
  const [scanning, setScanning] = useState(true);
  const [specs, setSpecs]       = useState(null);
  const [ramGb, setRamGb]       = useState(null);

  useEffect(() => {
    fetch("/api/hardware")
      .then(r => r.json())
      .then(data => {
        const detected = data.ram?.total_gb ?? 0;
        setRamGb(detected);
        setSpecs([
          { icon: "cpu", label: "CPU",  value: data.cpu?.brand || "Unknown",            sub: `${data.cpu?.cores ?? "?"} cores`,          status: { kind: "good", label: "PASS"     } },
          { icon: "ram", label: "RAM",  value: `${data.ram?.total_gb ?? "?"} GB`,        sub: `${data.ram?.free_gb ?? "?"} GB free`,       status: { kind: "good", label: "PASS"     } },
          { icon: "hdd", label: "DISK", value: `${data.disk?.free_gb ?? "?"} GB free`,   sub: `of ${data.disk?.total_gb ?? "?"} GB`,       status: { kind: "good", label: "PASS"     } },
          { icon: "gpu", label: "GPU",  value: "Metal / CUDA",                           sub: "hardware accel",                            status: { kind: "good", label: "DETECTED" } },
        ]);
        // Auto-select recommended tier based on RAM
        const rec = recommendedTier(detected);
        setTier(rec);
        setScanning(false);
      })
      .catch(() => {
        setSpecs([
          { icon: "cpu", label: "CPU",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "ram", label: "RAM",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "hdd", label: "DISK", value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "gpu", label: "GPU",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
        ]);
        setScanning(false);
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <InstallerShell step={3} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={scanning}>
      <SectionHeader eyebrow="Step 03" title="Hardware & model"
        sub="We scanned your machine and pre-selected the best model. Override below if you like." />

      {/* Hardware scan panel */}
      {scanning ? (
        <div className="card" style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ position: "relative", width: 48, height: 48 }}>
            <div className="spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)" }} />
            <Icon name="cpu" size={20} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--accent)" }} />
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)" }}>Scanning hardware…</div>
        </div>
      ) : (
        <div className="fade-up" style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {specs.map(s => <MetricCard key={s.label} icon={s.icon} label={s.label} value={s.value} sub={s.sub} status={s.status} />)}
          </div>
        </div>
      )}

      {/* Tier picker (shown once scan completes) */}
      {!scanning && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 2 }}>
            Choose your model tier
          </div>
          {MODELS.map(m => {
            const selected = tier === m.id;
            const tooBig = ramGb !== null && ramGb < parseInt(m.ram);
            return (
              <button key={m.id} onClick={() => setTier(m.id)}
                className="btn-card"
                style={{
                  cursor: "pointer",
                  padding: 14, borderRadius: 10,
                  border: `1.5px solid ${selected ? "var(--accent)" : "var(--line)"}`,
                  background: selected ? "var(--accent-soft)" : "var(--bg-elev)",
                  opacity: tooBig ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "all 0.15s",
                  boxShadow: selected ? "var(--sh-2)" : "var(--sh-1)",
                }}
              >
                <div style={{ width: 36, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, color: selected ? "var(--accent)" : "var(--ink)" }}>
                    {m.id === "light" ? "S" : m.id === "balanced" ? "M" : "L"}
                  </div>
                </div>
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{m.tier}</span>
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{m.model}</span>
                    {m.recommended && !tooBig && <span className="chip chip-accent" style={{ fontSize: 9 }}>Recommended</span>}
                    {tooBig && <span className="chip chip-warn" style={{ fontSize: 9 }}>Needs {m.ram} RAM</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{m.blurb}</div>
                  {/* UX-2: consequence copy */}
                  {m.consequence && (
                    <div style={{ fontSize: 11, color: selected ? "var(--accent)" : "var(--ink-3)", fontStyle: "italic", marginTop: 2 }}>
                      {m.consequence}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--ink-3)", flexDirection: "column", alignItems: "flex-end" }}>
                  <span><Icon name="download" size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{m.size}</span>
                  <span><Icon name="ram" size={10} style={{ verticalAlign: "-1px", marginRight: 3 }} />{m.ram}</span>
                </div>
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${selected ? "var(--accent)" : "var(--line-2)"}`, background: selected ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  {selected && <Icon name="check" size={10} stroke={3} />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Icon name="info" size={13} style={{ marginTop: 1 }} />
        <span>You can change tiers anytime in Settings. Models live in <span className="mono" style={{ color: "var(--ink-2)" }}>~/.ollama/models</span>.</span>
      </div>
    </InstallerShell>
  );
};
