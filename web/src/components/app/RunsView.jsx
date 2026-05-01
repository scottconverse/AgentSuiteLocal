import React from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS, RECENT_RUNS } from "../../data.js";

export const RunsView = ({ onOpen }) => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar title="Runs" subtitle="Every run, every artifact, every score" actions={<button className="btn btn-sm"><Icon name="search" size={13} /> Filter</button>} />
    <div style={{ padding: 24 }}>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1.4fr 1fr 100px 100px 110px 100px", gap: 12, fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          <span>Agent / Project</span>
          <span>Run id</span>
          <span>Score</span>
          <span>Duration</span>
          <span>Status</span>
          <span>When</span>
        </div>
        {RECENT_RUNS.map((r, i) => {
          const ag = AGENTS.find(a => a.id === r.agent);
          const statusMap = { approved: "good", approval: "warn", running: "info", rejected: "bad" };
          return (
            <div key={r.id} onClick={r.status === "approval" ? onOpen : undefined} style={{
              padding: "12px 18px",
              display: "grid", gridTemplateColumns: "1.4fr 1fr 100px 100px 110px 100px", gap: 12, alignItems: "center",
              borderTop: i === 0 ? "none" : "1px solid var(--line)",
              cursor: r.status === "approval" ? "pointer" : "default",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name={ag?.icon || "box"} size={14} style={{ color: "var(--ink-3)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ag?.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.project}</div>
                </div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.id}</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: r.score && r.score >= 7 ? "var(--good)" : r.score ? "var(--warn)" : "var(--ink-4)" }}>
                {r.score ? r.score.toFixed(1) : "—"}
              </span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.duration}</span>
              <span className={`chip chip-${statusMap[r.status]}`} style={{ width: 90, justifyContent: "center" }}>
                {r.status === "running" && <span className="dot pulse-dot" />}
                {r.status}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);
