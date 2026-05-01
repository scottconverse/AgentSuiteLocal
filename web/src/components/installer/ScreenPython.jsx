import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

const ITEMS = [
  { name: "Python 3.11 runtime",            size: "42 MB"  },
  { name: "agentsuite (core kernel)",        size: "9.4 MB" },
  { name: "Ollama provider",                 size: "1.1 MB" },
  { name: "FastAPI + uvicorn (local server)",size: "6.8 MB" },
  { name: "MCP server adapter",              size: "2.3 MB" },
  { name: "PyYAML, pydantic, httpx",         size: "11 MB"  },
];

export const ScreenPython = ({ onBack, onNext }) => {
  const [done, setDone] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setDone(d => d >= ITEMS.length ? d : d + 1), 320);
    return () => clearInterval(iv);
  }, []);

  const allDone = done >= ITEMS.length;

  return (
    <InstallerShell step={7} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={!allDone}>
      <SectionHeader eyebrow="Step 07" title="Setting up the runtime"
        sub="The agents themselves run inside a sandboxed Python environment. Already bundled — we just unpack and verify." />

      <div className="card" style={{ padding: 4, overflow: "hidden" }}>
        {ITEMS.map((it, i) => {
          const state = i < done ? "done" : i === done ? "active" : "queued";
          return (
            <div key={i} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: i < ITEMS.length - 1 ? "1px solid var(--line)" : "none", opacity: state === "queued" ? 0.5 : 1 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: state === "done" ? "var(--good)" : "var(--bg-tint)", color: state === "done" ? "white" : "var(--ink-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {state === "done"   && <Icon name="check" size={12} stroke={3} />}
                {state === "active" && <span className="dot pulse-dot" style={{ background: "var(--accent)" }} />}
              </div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: state === "active" ? 600 : 500 }}>{it.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{it.size}</div>
              <div style={{ width: 70, textAlign: "right" }}>
                {state === "done"   && <span className="chip chip-good"  style={{ fontSize: 10 }}>installed</span>}
                {state === "active" && <span className="chip chip-info"  style={{ fontSize: 10 }}>installing</span>}
                {state === "queued" && <span className="chip"            style={{ fontSize: 10 }}>queued</span>}
              </div>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="card fade-up" style={{ marginTop: 16, padding: 14, borderColor: "var(--good)", background: "var(--good-soft)", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="check" size={18} stroke={2.4} style={{ color: "var(--good)" }} />
          <div style={{ fontSize: 13 }}><strong>Runtime ready.</strong> All 6 components installed and verified.</div>
        </div>
      )}
    </InstallerShell>
  );
};
