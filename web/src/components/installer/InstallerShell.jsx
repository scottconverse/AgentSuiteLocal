import React from "react";
import { Icon, Brand } from "../ui/index.jsx";

export const InstallerShell = ({
  step, totalSteps, onBack, onNext,
  nextLabel = "Continue", nextDisabled, secondary,
  children, accent = false, hideNav = false,
}) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
    <div style={{
      padding: "20px 32px", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
    }}>
      <Brand size={15} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--ink-3)" }}>
        <span className="mono" style={{ letterSpacing: "0.04em" }}>SETUP</span>
        <span style={{ color: "var(--ink-4)" }}>·</span>
        <span className="mono">{String(step).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}</span>
      </div>
    </div>

    <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, padding: "40px 32px 32px" }}>
        {children}
      </div>
    </div>

    {!hideNav && (
      <div style={{
        padding: "16px 32px", borderTop: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-elev)", flexShrink: 0,
      }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={!onBack} style={{ opacity: onBack ? 1 : 0.3 }}>
          <Icon name="chevL" size={14} /> Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {secondary}
          <button
            className={accent ? "btn btn-accent" : "btn btn-primary"}
            onClick={onNext} disabled={nextDisabled}
          >
            {nextLabel} <Icon name="arrowR" size={14} />
          </button>
        </div>
      </div>
    )}
  </div>
);

export const SectionHeader = ({ eyebrow, title, sub }) => (
  <div style={{ marginBottom: 28 }}>
    {eyebrow && (
      <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>
        {eyebrow}
      </div>
    )}
    <h1 className="display" style={{ fontSize: 36, fontWeight: 500, margin: 0, marginBottom: 12, letterSpacing: "-0.02em", color: "var(--ink)" }}>
      {title}
    </h1>
    {sub && <p style={{ fontSize: 15, color: "var(--ink-2)", margin: 0, lineHeight: 1.55, maxWidth: 600 }}>{sub}</p>}
  </div>
);
