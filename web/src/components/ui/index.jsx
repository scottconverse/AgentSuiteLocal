import React from "react";

const ICON_PATHS = {
  check:    <polyline points="20 6 9 17 4 12" />,
  x:        <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  chevR:    <polyline points="9 18 15 12 9 6" />,
  chevL:    <polyline points="15 18 9 12 15 6" />,
  chevD:    <polyline points="6 9 12 15 18 9" />,
  chevU:    <polyline points="18 15 12 9 6 15" />,
  arrowR:   <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  plus:     <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  cpu:      <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="2" x2="9" y2="4" /><line x1="15" y1="2" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="22" /><line x1="15" y1="20" x2="15" y2="22" /><line x1="20" y1="9" x2="22" y2="9" /><line x1="20" y1="15" x2="22" y2="15" /><line x1="2" y1="9" x2="4" y2="9" /><line x1="2" y1="15" x2="4" y2="15" /></>,
  hdd:      <><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="18" x2="6.01" y2="18" /><line x1="10" y1="18" x2="10.01" y2="18" /><path d="M6 14V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10" /></>,
  ram:      <><rect x="2" y="6" width="20" height="12" rx="1.5" /><line x1="6" y1="6" x2="6" y2="18" /><line x1="10" y1="6" x2="10" y2="18" /><line x1="14" y1="6" x2="14" y2="18" /><line x1="18" y1="6" x2="18" y2="18" /></>,
  gpu:      <><rect x="2" y="7" width="20" height="10" rx="1.5" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="12" r="2" /><line x1="2" y1="19" x2="6" y2="19" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  folder:   <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  file:     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></>,
  play:     <polygon points="5 3 19 12 5 21 5 3" />,
  pause:    <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  info:     <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  alert:    <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  shield:   <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  lock:     <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  home:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  grid:     <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  layers:   <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  box:      <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  search:   <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  eye:      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  list:     <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>,
  refresh:  <><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></>,
  book:     <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" />,
  terminal: <><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></>,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  star:     <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  rocket:   <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></>,
  target:   <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  palette:  <><circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.5-4.5-10-10-10z" /></>,
  code:     <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>,
  megaphone:<><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  briefcase:<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  upload:   <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  server:   <><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>,
  cloud:    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
  cloudOff: <><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" /><line x1="1" y1="1" x2="23" y2="23" /></>,
  package:  <><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>,
  clock:    <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  history:  <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /><polyline points="12 7 12 12 15 14" /></>,
  git2:     <><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>,
  moreH:    <><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /><circle cx="5" cy="12" r="1" fill="currentColor" /></>,
  archive:  <><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></>,
  edit:     <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>,
  trash:    <><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  copy:     <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  // "Open external" — square with arrow exiting top-right; used for launching
  // another app from inside AgentSuiteLocal (Open Ollama in smoke screen).
  open:     <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>,
};

export const Icon = ({ name, size = 16, stroke = 1.6, style, "aria-label": ariaLabel }) => {
  if (process.env.NODE_ENV !== "production" && !ICON_PATHS[name]) {
    console.warn(`Icon: unknown name "${name}". Available: ${Object.keys(ICON_PATHS).join(", ")}`);
  }
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { flexShrink: 0, ...style },
    role: ariaLabel ? "img" : undefined,
    "aria-label": ariaLabel || undefined,
    "aria-hidden": ariaLabel ? undefined : true,
  };
  return <svg {...props}>{ICON_PATHS[name] || null}</svg>;
};

export const BrandMark = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
    <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--ink)" />
    <rect x="7" y="7" width="18" height="18" rx="3" fill="none" stroke="var(--bg)" strokeWidth="1.5" />
    <path d="M7 19 L25 19 L25 25 L7 25 Z" fill="var(--accent)" />
    <circle cx="11" cy="22" r="1.2" fill="var(--bg)" />
    <circle cx="15" cy="22" r="1.2" fill="var(--bg)" />
  </svg>
);

export const Brand = ({ size = 16 }) => (
  <span className="brand" style={{ fontSize: size, gap: 8 }}>
    <BrandMark size={Math.round(size * 1.4)} />
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ letterSpacing: "-0.01em" }}>AgentSuite</span>
      <span className="brand-local">LOCAL</span>
    </span>
  </span>
);

export const Stepper = ({ steps, current }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", flexWrap: "wrap" }}>
    {steps.map((s, i) => {
      const state = i < current ? "done" : i === current ? "active" : "todo";
      return (
        <React.Fragment key={i}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, opacity: state === "todo" ? 0.4 : 1 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 999,
              background: state === "done" ? "var(--accent)" : state === "active" ? "var(--ink)" : "transparent",
              border: state === "todo" ? "1.5px solid var(--line-2)" : "none",
              color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
            }}>
              {state === "done" ? <Icon name="check" size={11} stroke={3} /> : (i + 1)}
            </div>
            <span style={{ fontSize: 12, fontWeight: state === "active" ? 600 : 400, color: state === "active" ? "var(--ink)" : "var(--ink-3)" }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: "var(--line-2)" }} />}
        </React.Fragment>
      );
    })}
  </div>
);

export const ProgressBar = ({ value, max = 100, label, sublabel, accent = false }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {(label || sublabel) && (
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        {label && <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{label}</span>}
        {sublabel && <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{sublabel}</span>}
      </div>
    )}
    <div style={{ height: 6, background: "var(--bg-sunk)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--line)" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, (value / max) * 100)}%`,
        background: accent ? "var(--accent)" : "var(--ink)",
        borderRadius: 999, transition: "width 0.4s ease",
      }} />
    </div>
  </div>
);

export const MetricCard = ({ icon, label, value, sub, status }) => (
  <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)" }}>
      <Icon name={icon} size={14} />
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
      {status && <span className={`chip chip-${status.kind}`} style={{ marginLeft: "auto", fontSize: 10, padding: "1px 7px" }}>{status.label}</span>}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>{value}</span>
      {sub && <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{sub}</span>}
    </div>
  </div>
);

export const Toggle = ({ checked, onChange, size = "md", label }) => {
  const w = size === "sm" ? 28 : 36;
  const h = size === "sm" ? 16 : 20;
  const k = size === "sm" ? 12 : 16;
  return (
    <button onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      style={{
      width: w, height: h, padding: 0, borderRadius: 999,
      background: checked ? "var(--accent)" : "var(--line-2)",
      border: "none", position: "relative", transition: "background 0.18s", cursor: "pointer",
    }}>
      <span style={{
        position: "absolute", top: 2, left: checked ? w - k - 2 : 2,
        width: k, height: k, borderRadius: 999, background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.18s",
      }} />
    </button>
  );
};

export const WindowChrome = ({ children, title, subtitle, height = "100%", controls = true }) => (
  <div style={{
    background: "var(--bg)", border: "1px solid var(--line-2)", borderRadius: 12,
    overflow: "hidden", display: "flex", flexDirection: "column",
    height, width: "100%", boxShadow: "var(--sh-3)",
  }}>
    <div style={{
      height: 36, background: "var(--bg-tint)", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", padding: "0 12px", gap: 12, flexShrink: 0,
    }}>
      {controls && (
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ed6a5e" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#f5bf4f" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#62c554" }} />
        </div>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
        <span style={{ fontWeight: 500, color: "var(--ink-2)" }}>{title}</span>
        {subtitle && <span style={{ color: "var(--ink-4)" }}>— {subtitle}</span>}
      </div>
      {controls && <div style={{ width: 50 }} />}
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  </div>
);

/**
 * UX-5: SkeletonCard — shimmer placeholder shown while data is loading.
 * Use in place of a real card while `loading === true`.
 *
 * @param {number} lines - number of skeleton rows (default 3)
 * @param {number} height - card height in px (auto if not set)
 */
export const SkeletonCard = ({ lines = 3, height }) => (
  <div className="card" style={{ padding: 16, ...(height ? { height } : {}) }}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className="shimmer"
        style={{
          height: 14, borderRadius: 4, marginBottom: i < lines - 1 ? 10 : 0,
          width: `${90 - i * 14}%`,
        }}
      />
    ))}
  </div>
);
