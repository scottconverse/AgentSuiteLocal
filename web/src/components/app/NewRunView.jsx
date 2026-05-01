import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const NewRunView = ({ agentId, onCancel, onLaunch }) => {
  const a = AGENTS.find(x => x.id === agentId) || AGENTS[0];
  const [goal, setGoal] = useState("Launch AgentSuiteLocal v1.0 — a fully-local desktop app for non-technical founders");
  const [project, setProject] = useState("agentsuitelocal");
  const [inputsDir, setInputsDir] = useState("~/Desktop/agentsuitelocal-brand-inputs");

  const handleLaunch = async () => {
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: a.id, goal, project, inputs_dir: inputsDir }),
      });
      const { run_id } = await res.json();
      onLaunch(run_id);
    } catch {
      onLaunch(null);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={`New run · ${a.name} agent`}
        subtitle={`Walks the 5-stage pipeline and writes ${a.artifactCount} artifacts`}
        actions={<button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
      />
      <div style={{ padding: 24, maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={a.icon} size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontSize: 20, fontWeight: 500 }}>{a.name} agent</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{a.desc}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Business goal</label>
            <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} style={{ width: "100%", padding: 10, fontSize: 13, border: "1px solid var(--line-2)", borderRadius: 8, fontFamily: "var(--font-sans)", background: "var(--bg)", resize: "vertical" }} />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>One sentence. The agent writes everything else around this.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Project slug</label>
              <input value={project} onChange={e => setProject(e.target.value)} style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Constraints</label>
              <select style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }}>
                <option>Default (founder voice, B2B)</option>
                <option>B2C consumer</option>
                <option>Open-source</option>
                <option>Custom...</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Inputs folder</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={inputsDir} onChange={e => setInputsDir(e.target.value)} style={{ flex: 1, padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }} />
              <button className="btn btn-sm"><Icon name="folder" size={13} /> Browse</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Drop in any markdown notes, brand documents, or links the agent should learn from.</div>
          </div>
        </div>

        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--bg-tint)", border: "none" }}>
          <Icon name="info" size={16} style={{ color: "var(--ink-3)" }} />
          <div style={{ fontSize: 12, color: "var(--ink-2)", flex: 1 }}>
            Estimated runtime: <strong>~{a.runtime}</strong> on your hardware. Cost cap: <strong>local (free)</strong>. Output goes to <span className="mono">~/AgentSuite/.agentsuite/runs/</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-accent" onClick={handleLaunch}><Icon name="play" size={14} /> Start run</button>
        </div>
      </div>
    </div>
  );
};
