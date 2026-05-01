import React, { useEffect, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";

export const ScreenModelDownload = ({ onBack, onNext, tier }) => {
  const model = MODELS.find(m => m.id === tier) || MODELS[1];
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setPct(p => Math.min(100, p + (p < 90 ? 2.4 : 0.6)));
    }, 180);
    return () => clearInterval(iv);
  }, []);

  const totalGB = parseFloat(model.size);
  const downloadedGB = (totalGB * pct / 100).toFixed(1);
  const eta = pct >= 100 ? "Done" : `${Math.max(1, Math.round((100 - pct) / 12))} min remaining`;

  return (
    <InstallerShell step={6} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={pct < 100}>
      <SectionHeader eyebrow="Step 06" title="Downloading model"
        sub="One-time download. The model is shared with any other Ollama-based app you install later." />

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <Icon name="package" size={26} />
            <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${pct}%`, background: "var(--accent)", transition: "width 0.18s" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{model.tier} · Gemma 4</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{model.model} · {model.size}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28, color: "var(--accent)", letterSpacing: "-0.02em" }}>
              {Math.floor(pct)}<span style={{ fontSize: 16, color: "var(--ink-3)" }}>%</span>
            </div>
          </div>
        </div>

        <ProgressBar value={pct} accent />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
          <span className="mono" style={{ color: "var(--ink-3)" }}>{downloadedGB} / {model.size}</span>
          <span className="mono" style={{ color: "var(--ink-3)" }}>32.4 MB/s</span>
          <span className="mono" style={{ color: "var(--ink-2)", fontWeight: 500 }}>{eta}</span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", flexDirection: "column", gap: 3 }}>
            <span>▸ Pulling manifest from registry.ollama.ai</span>
            <span>▸ Verifying SHA256: a3c…7f9 ✓</span>
            <span>▸ Downloading {model.size} across 8 layers</span>
            <span style={{ color: "var(--accent)" }}>▸ layer 5/8 · weights.q4_k_m</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "var(--bg-tint)", borderRadius: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Icon name="info" size={14} style={{ color: "var(--ink-3)", marginTop: 2 }} />
        <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--ink)" }}>Brew yourself a coffee.</strong> This is the only big download.
          The app itself is ~80 MB; the model is the heavy bit. Once it's local, every future run is offline.
        </div>
      </div>
    </InstallerShell>
  );
};
