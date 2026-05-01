import React from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS, SAMPLE_ARTIFACTS } from "../../data.js";

export const KernelView = () => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar
      title="Kernel · agentsuitelocal"
      subtitle="46 approved artifacts, reused across every downstream run"
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm"><Icon name="upload" size={13} /> Export</button>
          <button className="btn btn-sm"><Icon name="folder" size={13} /> Reveal</button>
        </div>
      }
    />
    <div style={{ padding: 24 }}>
      <div className="card" style={{ padding: 18, marginBottom: 16, display: "flex", gap: 16, alignItems: "center", background: "linear-gradient(120deg, var(--bg-elev), var(--accent-soft))" }}>
        <Icon name="layers" size={28} style={{ color: "var(--accent)" }} />
        <div style={{ flex: 1 }}>
          <div className="display" style={{ fontSize: 18, fontWeight: 500 }}>This is your source of truth</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
            Approved artifacts in the kernel are loaded into every future agent run as canonical context. Edit on disk, version with git.
          </div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>~/AgentSuite/.agentsuite/_kernel/agentsuitelocal/</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {AGENTS.slice(0, 6).map((a, i) => (
          <div key={a.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-tint)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={a.icon} size={14} />
              </div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
              <span className="chip" style={{ marginLeft: "auto", fontSize: 10 }}>{[12, 8, 0, 9, 0, 9][i]} files</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SAMPLE_ARTIFACTS.slice(0, 3).map((f, j) => (
                <div key={j} className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 6 }}>
                  <Icon name="fileText" size={10} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
