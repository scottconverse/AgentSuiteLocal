import React, { useEffect, useState } from "react";
import { Icon, MetricCard } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() / 1000) - ts);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function duration(startedAt, finishedAt) {
  if (!startedAt) return "—";
  const end = finishedAt || Date.now() / 1000;
  const secs = Math.round(end - startedAt);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export const Dashboard = ({ onNew, onOpen }) => {
  const [runs, setRuns] = useState([]);
  const [projects, setProjects] = useState([]);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      Promise.all([
        fetch("/api/runs").then(r => r.json()).catch(() => ({ runs: [] })),
        fetch("/api/projects").then(r => r.json()).catch(() => ({ projects: [] })),
        fetch("/api/ollama/status").then(r => r.json()).catch(() => null),
      ]).then(([runsData, projectsData, ollamaData]) => {
        setRuns(runsData.runs || []);
        setProjects(projectsData.projects || []);
        setOllamaStatus(ollamaData);
        setLoading(false);
      });
    };
    load();
    // Refresh every 10s so running status updates
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, []);

  const waiting = runs.find(r => r.status === "waiting");
  const recent = runs.slice(0, 6);
  const totalArtifacts = runs.filter(r => r.status === "approved").reduce((n, r) => n + (r.artifacts?.length || 0), 0);

  const statusMap = {
    waiting:  { kind: "warn", label: "Needs review" },
    approved: { kind: "good", label: "Approved"     },
    running:  { kind: "info", label: "Running"       },
    rejected: { kind: "bad",  label: "Rejected"      },
    error:    { kind: "bad",  label: "Error"          },
  };

  const model = ollamaStatus?.loaded?.[0] || ollamaStatus?.models?.[0] || "—";
  const engineOk = ollamaStatus?.running;

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Dashboard"
        subtitle={loading ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""} · ${runs.length} runs · ${totalArtifacts} approved artifacts`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-accent btn-sm" onClick={onNew}><Icon name="plus" size={13} /> New run</button>
          </div>
        }
      />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Hero — pending approval or empty state */}
        {waiting ? (
          <div className="card" style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, background: "linear-gradient(135deg, var(--bg-elev) 0%, var(--accent-soft) 140%)", overflow: "hidden" }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Pick up where you left off</div>
              <h2 className="display" style={{ fontSize: 28, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {AGENTS.find(a => a.id === waiting.agent)?.name || waiting.agent} run on{" "}
                <span style={{ color: "var(--accent)" }}>{waiting.project}</span> is waiting on your approval.
              </h2>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 12, lineHeight: 1.55 }}>
                {waiting.qa_score != null
                  ? `QA scored ${waiting.qa_score.toFixed(1)}/10 — ${waiting.qa_score >= 7 ? "above the 7.0 gate" : "below the 7.0 gate"}. Review the artifacts, then approve to promote into your kernel.`
                  : "Review the artifacts, then approve to promote into your kernel."}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => onOpen(waiting.id)}><Icon name="eye" size={14} /> Review run</button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "100%", aspectRatio: "1.4", background: "var(--bg)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ color: "var(--ink-2)", fontWeight: 600 }}>{waiting.id}</div>
                {waiting.qa_dimensions?.slice(0, 5).map(d => (
                  <div key={d.name} style={{ color: d.score >= 7 ? "var(--good)" : "var(--warn)" }}>
                    {d.score >= 7 ? "✓" : "⚠"} {d.name.toLowerCase().padEnd(22, ".")} {d.score.toFixed(1)}
                  </div>
                ))}
                {waiting.qa_score != null && (
                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--line)", color: "var(--ink-2)", fontWeight: 600 }}>
                    composite: {waiting.qa_score.toFixed(1)} / 10.0
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 24, background: "linear-gradient(135deg, var(--bg-elev) 0%, var(--accent-soft) 140%)" }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Ready to go</div>
            <h2 className="display" style={{ fontSize: 28, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {runs.length === 0 ? "Start your first run." : "No runs waiting for review."}
            </h2>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 12 }}>
              {runs.length === 0
                ? "Pick an agent, write one sentence, and let it run."
                : "All runs are either approved, rejected, or in progress."}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNew}><Icon name="play" size={14} /> New run</button>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <MetricCard icon="folder"   label="Projects"         value={projects.length}   sub="active" />
          <MetricCard icon="activity" label="Total runs"       value={runs.length}        sub="all time" />
          <MetricCard icon="layers"   label="Approved artifacts" value={totalArtifacts}  sub="in kernel" />
          <MetricCard icon="zap"      label="Engine"
            value={engineOk ? "Online" : "Offline"}
            sub={engineOk ? model : "Start Ollama"}
            status={{ kind: engineOk ? "good" : "bad", label: engineOk ? "LOCAL" : "DOWN" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          {/* Recent runs */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Recent runs</span>
            </div>
            {recent.length === 0 && (
              <div style={{ padding: 24, fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>No runs yet</div>
            )}
            {recent.map((r, i) => {
              const ag = AGENTS.find(a => a.id === r.agent);
              const st = statusMap[r.status] || { kind: "info", label: r.status };
              return (
                <div key={r.id}
                  onClick={r.status === "waiting" ? () => onOpen(r.id) : undefined}
                  style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, borderTop: i === 0 ? "none" : "1px solid var(--line)", cursor: r.status === "waiting" ? "pointer" : "default" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-tint)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={ag?.icon || "box"} size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ag?.name || r.agent} · <span style={{ color: "var(--ink-3)" }}>{r.project}</span></div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{r.id} · {duration(r.started_at, r.approved_at)}</div>
                  </div>
                  {r.qa_score != null && (
                    <div className="mono" style={{ fontSize: 12, color: r.qa_score >= 7 ? "var(--good)" : "var(--warn)", fontWeight: 600 }}>{r.qa_score.toFixed(1)}</div>
                  )}
                  <span className={`chip chip-${st.kind}`} style={{ minWidth: 90, justifyContent: "center" }}>
                    {r.status === "running" && <span className="dot pulse-dot" />}
                    {st.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 72, textAlign: "right" }}>{timeAgo(r.started_at)}</span>
                </div>
              );
            })}
          </div>

          {/* Projects */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Projects</span>
            </div>
            {projects.length === 0 && (
              <div style={{ padding: 24, fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>No projects yet</div>
            )}
            {projects.map((p, i) => (
              <div key={p.slug} style={{ padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Icon name="folder" size={13} style={{ color: "var(--accent)" }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{p.slug}</span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: "auto" }}>{p.slug}</span>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-3)" }}>
                  <span>{p.agents} agent{p.agents !== 1 ? "s" : ""}</span>
                  <span>{p.runs} run{p.runs !== 1 ? "s" : ""}</span>
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>{timeAgo(p.last_touch)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
