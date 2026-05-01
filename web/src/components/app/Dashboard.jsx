import React from "react";
import { Icon, MetricCard } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS, RECENT_RUNS, PROJECTS } from "../../data.js";

export const Dashboard = ({ onNew, onOpen }) => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar
      title="Dashboard"
      subtitle="Three projects · 32 runs · 224 artifacts on disk"
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm"><Icon name="search" size={13} /> Search</button>
          <button className="btn btn-accent btn-sm" onClick={onNew}><Icon name="plus" size={13} /> New run</button>
        </div>
      }
    />
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Hero */}
      <div className="card" style={{ padding: 24, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, background: "linear-gradient(135deg, var(--bg-elev) 0%, var(--accent-soft) 140%)", overflow: "hidden" }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Pick up where you left off</div>
          <h2 className="display" style={{ fontSize: 28, margin: 0, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Engineering run on <span style={{ color: "var(--accent)" }}>myco-pivot</span> is waiting on your approval.
          </h2>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 12, lineHeight: 1.55 }}>QA scored 7.1/10 — above the 7.0 gate but worth a look. Review the 9 spec artifacts, then approve to promote into your kernel.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={onOpen}><Icon name="eye" size={14} /> Review run</button>
            <button className="btn">Snooze</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "100%", aspectRatio: "1.4", background: "var(--bg)", borderRadius: 10, padding: 12, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ color: "var(--ink-2)", fontWeight: 600 }}>qa_report.md</div>
            <div style={{ color: "var(--good)" }}>✓ specificity ............ 8.4</div>
            <div style={{ color: "var(--good)" }}>✓ internal-consistency .. 8.1</div>
            <div style={{ color: "var(--warn)" }}>⚠ originality ........... 6.2</div>
            <div style={{ color: "var(--good)" }}>✓ coverage .............. 7.8</div>
            <div style={{ color: "var(--good)" }}>✓ actionability ......... 7.4</div>
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--line)", color: "var(--ink-2)", fontWeight: 600 }}>composite: 7.1 / 10.0</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <MetricCard icon="folder"   label="Projects"        value="3"    sub="active"                    />
        <MetricCard icon="activity" label="Runs this week"  value="11"   sub="+4 vs last"  status={{ kind: "good", label: "+57%" }} />
        <MetricCard icon="layers"   label="Kernel artifacts"value="46"   sub="approved & live"            />
        <MetricCard icon="zap"      label="Engine"          value="18.4" sub="tok/s · gemma4:e4b" status={{ kind: "good", label: "LOCAL" }} />
      </div>

      {/* Two columns */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Recent runs */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Recent runs</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>View all <Icon name="chevR" size={11} /></button>
          </div>
          {RECENT_RUNS.map((r, i) => {
            const ag = AGENTS.find(a => a.id === r.agent);
            const statusMap = {
              approved: { kind: "good", label: "Approved"    },
              approval: { kind: "warn", label: "Needs review" },
              running:  { kind: "info", label: "Running"      },
              rejected: { kind: "bad",  label: "Rejected"     },
            };
            return (
              <div key={r.id} onClick={r.status === "approval" ? onOpen : undefined}
                style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 12, borderTop: i === 0 ? "none" : "1px solid var(--line)", cursor: r.status === "approval" ? "pointer" : "default" }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-tint)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={ag?.icon || "box"} size={14} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{ag?.name} · <span style={{ color: "var(--ink-3)" }}>{r.project}</span></div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>{r.id} · {r.duration}</div>
                </div>
                {r.score && <div className="mono" style={{ fontSize: 12, color: r.score >= 7 ? "var(--good)" : "var(--warn)", fontWeight: 600 }}>{r.score.toFixed(1)}</div>}
                <span className={`chip chip-${statusMap[r.status].kind}`} style={{ minWidth: 90, justifyContent: "center" }}>
                  {r.status === "running" && <span className="dot pulse-dot" />}
                  {statusMap[r.status].label}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-3)", minWidth: 80, textAlign: "right" }}>{r.time}</span>
              </div>
            );
          })}
        </div>

        {/* Projects */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Projects</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}><Icon name="plus" size={12} /></button>
          </div>
          {PROJECTS.map((p, i) => (
            <div key={p.slug} style={{ padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon name="folder" size={13} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: "auto" }}>{p.slug}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--ink-3)" }}>
                <span>{p.agents} agents</span>
                <span>{p.runs} runs</span>
                <span>{p.artifacts} artifacts</span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>{p.lastTouch}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
