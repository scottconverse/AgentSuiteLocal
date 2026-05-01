import React from "react";
import { Icon, Brand } from "../ui/index.jsx";

export const TrayMenu = ({ onAction }) => (
  <div style={{
    position: "absolute", top: 32, right: 16, width: 280,
    background: "var(--bg-elev)", border: "1px solid var(--line-2)",
    borderRadius: 12, boxShadow: "var(--sh-pop)", padding: 6, zIndex: 50,
  }}>
    <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
      <Brand size={13} />
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <span className="dot" style={{ color: "var(--good)" }} />
        Daemon healthy · gemma4:e4b loaded
      </div>
    </div>
    {[
      { icon: "home",     label: "Open dashboard",    action: "open"     },
      { icon: "plus",     label: "New run",            action: "new"      },
      { icon: "folder",   label: "Reveal workspace",  action: "folder"   },
      { icon: "activity", label: "Live activity",     action: "activity" },
    ].map(i => (
      <button key={i.label} onClick={() => onAction?.(i.action)} style={{
        all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: 6, fontSize: 13, width: "100%",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-tint)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <Icon name={i.icon} size={14} style={{ color: "var(--ink-3)" }} />
        {i.label}
      </button>
    ))}
    <div style={{ borderTop: "1px solid var(--line)", margin: "4px 0", paddingTop: 4 }}>
      {[
        { icon: "settings", label: "Preferences", action: "settings" },
        { icon: "x",        label: "Quit AgentSuiteLocal", action: "quit" },
      ].map(i => (
        <button key={i.label} onClick={() => onAction?.(i.action)} style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
          padding: "8px 12px", borderRadius: 6, fontSize: 13, width: "100%", color: "var(--ink-3)",
        }}>
          <Icon name={i.icon} size={14} /> {i.label}
        </button>
      ))}
    </div>
  </div>
);

export const Sidebar = ({ view, setView, projectSlug }) => {
  const items = [
    { id: "home",     icon: "home",     label: "Dashboard" },
    { id: "agents",   icon: "grid",     label: "Agents"    },
    { id: "runs",     icon: "activity", label: "Runs",     badge: "1" },
    { id: "kernel",   icon: "layers",   label: "Kernel"    },
    { id: "pipeline", icon: "git2",     label: "Pipelines" },
  ];
  const bottom = [
    { id: "settings", icon: "settings", label: "Settings" },
    { id: "manual",   icon: "book",     label: "Manual"   },
  ];
  return (
    <div style={{
      width: 220, background: "var(--bg-sunk)", borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line)" }}>
        <Brand size={13} />
      </div>

      <div style={{ padding: 10 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.08em", padding: "8px 10px 4px", textTransform: "uppercase", fontWeight: 600 }}>Workspace</div>
        <div style={{
          padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
          borderRadius: 6, background: "var(--bg-elev)", border: "1px solid var(--line)",
          fontSize: 12, fontWeight: 500, marginBottom: 8,
        }}>
          <Icon name="folder" size={13} style={{ color: "var(--accent)" }} />
          <span style={{ flex: 1 }}>{projectSlug || "myco-pivot"}</span>
          <Icon name="chevD" size={12} style={{ color: "var(--ink-3)" }} />
        </div>
      </div>

      <nav style={{ padding: "0 10px", flex: 1 }}>
        {items.map(i => {
          const active = view === i.id;
          return (
            <button key={i.id} onClick={() => setView(i.id)} style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%", marginBottom: 2,
              background: active ? "var(--bg-elev)" : "transparent",
              boxShadow: active ? "var(--sh-1)" : "none",
              border: active ? "1px solid var(--line)" : "1px solid transparent",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--ink)" : "var(--ink-2)",
            }}>
              <Icon name={i.icon} size={14} style={{ color: active ? "var(--accent)" : "var(--ink-3)" }} />
              <span style={{ flex: 1 }}>{i.label}</span>
              {i.badge && <span className="chip chip-accent" style={{ fontSize: 10, padding: "1px 6px" }}>{i.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid var(--line)" }}>
        {bottom.map(i => (
          <button key={i.id} onClick={() => setView(i.id)} style={{
            all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 6, fontSize: 13, width: "100%", color: "var(--ink-3)",
          }}>
            <Icon name={i.icon} size={14} /> {i.label}
          </button>
        ))}
        <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--bg-elev)", borderRadius: 8, border: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span className="dot" style={{ color: "var(--good)" }} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Local engine</span>
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}>
            gemma4:e4b<br />18.4 tok/s · 7.2 GB
          </div>
        </div>
      </div>
    </div>
  );
};

export const TopBar = ({ title, subtitle, actions }) => (
  <div style={{
    height: 56, borderBottom: "1px solid var(--line)", padding: "0 24px",
    display: "flex", alignItems: "center", gap: 16,
    background: "var(--bg)", flexShrink: 0,
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>{subtitle}</div>}
    </div>
    {actions}
  </div>
);
