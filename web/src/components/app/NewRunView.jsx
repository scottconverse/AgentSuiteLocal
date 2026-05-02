import React, { useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const NewRunView = ({ agentId, onCancel, onLaunch }) => {
  const a = AGENTS.find(x => x.id === agentId) || AGENTS[0];
  const [goal, setGoal] = useState("Launch AgentSuiteLocal v1.0 — a fully-local desktop app for non-technical founders");
  const [project, setProject] = useState("agentsuitelocal");
  const [inputsDir, setInputsDir] = useState("");
  // QA-005: loading guard prevents double-submission
  const [loading, setLoading] = useState(false);
  const [launchError, setLaunchError] = useState(null);

  const handleLaunch = async () => {
    if (loading) return;
    setLaunchError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: a.id,
          goal,
          project: project.trim(),
          ...(inputsDir.trim() ? { inputs_dir: inputsDir.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const { run_id } = await res.json();
      onLaunch(run_id);
    } catch (err) {
      // UX-001: surface errors to the user instead of silently discarding
      setLaunchError(err.message || "Could not start the run. Check your settings and try again.");
      setLoading(false);
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

        {launchError && (
          <div className="card" style={{ padding: 14, borderColor: "var(--bad)", background: "var(--bad-soft)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="alertTriangle" size={16} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>Could not start run</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{launchError}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Business goal</label>
            <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2} style={{ width: "100%", padding: 10, fontSize: 13, border: "1px solid var(--line-2)", borderRadius: 8, fontFamily: "var(--font-sans)", background: "var(--bg)", resize: "vertical" }} />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>One sentence. The agent writes everything else around this.</div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Project slug</label>
            <input
              value={project}
              onChange={e => setProject(e.target.value)}
              placeholder="my-project"
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }}
            />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Letters, numbers, hyphens, and underscores only.</div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>
              Inputs folder <span style={{ fontWeight: 400, color: "var(--ink-3)" }}>(optional)</span>
            </label>
            {/* QA-014: Browse button removed — file system access requires native integration not available in web */}
            <input
              value={inputsDir}
              onChange={e => setInputsDir(e.target.value)}
              placeholder="C:\Users\you\brand-notes  or  ~/brand-notes"
              style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }}
            />
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Paste the full path to a folder of markdown notes or brand documents. Leave blank to skip.</div>
          </div>
        </div>

        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--bg-tint)", border: "none" }}>
          <Icon name="info" size={16} style={{ color: "var(--ink-3)" }} />
          <div style={{ fontSize: 12, color: "var(--ink-2)", flex: 1 }}>
            Estimated runtime: <strong>~{a.runtime}</strong> on your hardware. Cost cap: <strong>local (free)</strong>. Output goes to <span className="mono">AgentSuite/.agentsuite/runs/</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn btn-accent"
            onClick={handleLaunch}
            disabled={loading || !goal.trim() || !project.trim()}
          >
            {loading
              ? <><span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "white", display: "inline-block" }} /> Starting…</>
              : <><Icon name="play" size={14} /> Start run</>
            }
          </button>
        </div>
      </div>
    </div>
  );
};
