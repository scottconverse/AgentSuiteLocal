import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
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

function elapsed(startedAt, finishedAt) {
  if (!startedAt) return "—";
  const end = finishedAt || Date.now() / 1000;
  const secs = Math.round(end - startedAt);
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const STATUS_MAP = {
  waiting:  { kind: "warn", label: "Needs review" },
  approved: { kind: "good", label: "Approved"     },
  running:  { kind: "info", label: "Running"       },
  rejected: { kind: "bad",  label: "Rejected"      },
  error:    { kind: "bad",  label: "Error"          },
};

export const RunsView = ({ onOpen }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/runs")
      .then(r => r.json())
      .then(data => { setRuns(data.runs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Runs"
        subtitle={loading ? "Loading…" : `${runs.length} run${runs.length !== 1 ? "s" : ""} total`}
        actions={<button className="btn btn-sm" onClick={() => { setLoading(true); fetch("/api/runs").then(r => r.json()).then(d => { setRuns(d.runs || []); setLoading(false); }); }}><Icon name="refresh" size={13} /> Refresh</button>}
      />
      <div style={{ padding: 24 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1.4fr 1fr 80px 100px 120px 90px", gap: 12, fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
            <span>Agent / Project</span>
            <span>Run ID</span>
            <span>Score</span>
            <span>Duration</span>
            <span>Status</span>
            <span>When</span>
          </div>

          {loading && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Loading…</div>
          )}

          {!loading && runs.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>No runs yet. Start one from the Agents screen.</div>
          )}

          {runs.map((r, i) => {
            const ag = AGENTS.find(a => a.id === r.agent);
            const st = STATUS_MAP[r.status] || { kind: "info", label: r.status };
            return (
              <div key={r.id}
                onClick={r.status === "waiting" ? () => onOpen(r.id) : undefined}
                style={{
                  padding: "12px 18px",
                  display: "grid", gridTemplateColumns: "1.4fr 1fr 80px 100px 120px 90px", gap: 12, alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  cursor: r.status === "waiting" ? "pointer" : "default",
                  background: r.status === "waiting" ? "var(--accent-soft)" : "transparent",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name={ag?.icon || "box"} size={14} style={{ color: "var(--ink-3)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ag?.name || r.agent}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.project}</div>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.id}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: r.qa_score != null && r.qa_score >= 7 ? "var(--good)" : r.qa_score != null ? "var(--warn)" : "var(--ink-4)" }}>
                  {r.qa_score != null ? r.qa_score.toFixed(1) : "—"}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{elapsed(r.started_at, r.approved_at)}</span>
                <span className={`chip chip-${st.kind}`} style={{ width: 110, justifyContent: "center" }}>
                  {r.status === "running" && <span className="dot pulse-dot" />}
                  {st.label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{timeAgo(r.started_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
