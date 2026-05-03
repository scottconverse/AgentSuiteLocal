import React, { useState, useEffect, useCallback } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

const STATUS_COLOR = {
  running:            "var(--accent)",
  awaiting_approval:  "var(--warn, #f59e0b)",
  done:               "var(--good)",
  error:              "var(--bad)",
  rejected:           "var(--bad)",
};
const STATUS_LABEL = {
  running:            "Running",
  awaiting_approval:  "Needs approval",
  done:               "Done",
  error:              "Error",
  rejected:           "Rejected",
};

// ---------------------------------------------------------------------------
// New-pipeline form
// ---------------------------------------------------------------------------

function NewPipelineForm({ onCancel, onCreate }) {
  const [name, setName]         = useState("End-to-end launch");
  const [project, setProject]   = useState("");
  const [goal, setGoal]         = useState("");
  const [agents, setAgents]     = useState(["founder"]);
  const [autoApprove, setAuto]  = useState(false);
  const [busy, setBusy]         = useState(false);

  const toggle = (id) =>
    setAgents(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  const submit = async () => {
    if (!project.trim() || !goal.trim() || agents.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Unnamed pipeline",
          project: project.trim(),
          goal: goal.trim(),
          agents,
          auto_approve: autoApprove,
        }),
      });
      const { pipeline_id } = await res.json();
      onCreate(pipeline_id);
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>New pipeline</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Pipeline name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Project slug</label>
          <input value={project} onChange={e => setProject(e.target.value)} placeholder="my-project"
            style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "var(--font-mono)", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }} />
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>Business goal</label>
        <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={2}
          placeholder="One sentence. The agents write everything else around this."
          style={{ width: "100%", padding: 10, fontSize: 13, border: "1px solid var(--line-2)", borderRadius: 8, fontFamily: "var(--font-sans)", background: "var(--bg)", resize: "vertical" }} />
      </div>

      <div>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Agents (run in order)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {AGENTS.map(a => {
            const on = agents.includes(a.id);
            return (
              <button key={a.id} onClick={() => toggle(a.id)} className="btn btn-sm"
                style={{ border: `1.5px solid ${on ? "var(--accent)" : "var(--line)"}`, background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--ink-2)" }}>
                <Icon name={a.icon} size={12} /> {a.name}
              </button>
            );
          })}
        </div>
        {agents.length > 0 && (
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
            Order: {agents.join(" → ")}
          </div>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-2)", cursor: "pointer" }}>
        <input type="checkbox" checked={autoApprove} onChange={e => setAuto(e.target.checked)} />
        Auto-approve each step (no manual review gates)
      </label>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-accent" onClick={submit}
          disabled={!project.trim() || !goal.trim() || agents.length === 0 || busy}>
          {busy ? "Starting…" : <><Icon name="play" size={14} /> Start pipeline</>}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step card
// ---------------------------------------------------------------------------

function StepCard({ step }) {
  const a = AGENTS.find(x => x.id === step.agent);
  if (!a) return null;
  const warnColor = "var(--warn, #f59e0b)";
  return (
    <div style={{
      padding: 14, borderRadius: 10, minWidth: 160,
      border: `1.5px solid ${
        step.status === "running"           ? "var(--accent)" :
        step.status === "awaiting_approval" ? warnColor :
        step.status === "done"              ? "var(--line)" :
        step.status === "error"             ? "var(--bad)" : "var(--line)"
      }`,
      background:
        step.status === "running"           ? "var(--accent-soft)" :
        step.status === "awaiting_approval" ? "rgba(245,158,11,0.07)" :
        step.status === "done"              ? "var(--bg-tint)" : "transparent",
      opacity: step.status === "todo" ? 0.45 : 1,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={a.icon} size={14} style={{ color: step.status === "running" ? "var(--accent)" : "var(--ink-2)" }} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
        {step.status === "done"              && <Icon name="check" size={13} style={{ color: "var(--good)", marginLeft: "auto" }} stroke={3} />}
        {step.status === "running"           && <span className="dot pulse-dot" style={{ marginLeft: "auto", color: "var(--accent)" }} />}
        {step.status === "awaiting_approval" && <Icon name="clock" size={13} style={{ color: warnColor, marginLeft: "auto" }} />}
        {step.status === "error"             && <Icon name="alert" size={13} style={{ color: "var(--bad)", marginLeft: "auto" }} />}
      </div>
      {step.qa_score != null && (
        <div className="mono" style={{ fontSize: 11, color: step.status === "done" ? "var(--good)" : warnColor }}>
          QA {Number(step.qa_score).toFixed(1)}{step.status === "done" ? " · approved" : " · pending"}
        </div>
      )}
      {step.status === "running"  && <div className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>Running…</div>}
      {step.status === "todo"     && <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>Queued</div>}
      {step.status === "error"    && <div className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>Error</div>}
      {step.status === "rejected" && <div className="mono" style={{ fontSize: 11, color: "var(--bad)" }}>Rejected</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline card
// ---------------------------------------------------------------------------

function PipelineCard({ pipeline, onApprove, onReject }) {
  const waiting = pipeline.steps.find(s => s.status === "awaiting_approval");
  const sc = STATUS_COLOR[pipeline.status] || "var(--ink-3)";
  const sl = STATUS_LABEL[pipeline.status] || pipeline.status;
  const warnColor = "var(--warn, #f59e0b)";

  return (
    <div className="card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4, letterSpacing: "0.06em" }}>
            {pipeline.id} · {pipeline.project}
          </div>
          <div className="display" style={{ fontSize: 20, fontWeight: 500 }}>{pipeline.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "var(--bg-tint)", border: `1px solid ${sc}`, whiteSpace: "nowrap" }}>
          {pipeline.status === "running" && <span className="dot pulse-dot" style={{ color: "var(--accent)" }} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: sc }}>{sl}</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 8 }}>
        {pipeline.steps.map((step, i) => (
          <React.Fragment key={step.agent}>
            <StepCard step={step} />
            {i < pipeline.steps.length - 1 && (
              <div style={{ width: 28, height: 1, background: "var(--line-2)", flexShrink: 0 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {waiting && (
        <div style={{ marginTop: 16, padding: 14, background: "rgba(245,158,11,0.07)", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="clock" size={16} style={{ color: warnColor }} />
          <div style={{ flex: 1, fontSize: 13 }}>
            <strong>{AGENTS.find(a => a.id === waiting.agent)?.name}</strong> completed
            {waiting.qa_score != null ? ` with QA score ${Number(waiting.qa_score).toFixed(1)}` : ""}.
            {" "}Review artifacts before promoting to kernel.
          </div>
          <button className="btn" onClick={() => onReject(pipeline.id)}>Reject</button>
          <button className="btn btn-accent" onClick={() => onApprove(pipeline.id)}>Approve &amp; continue</button>
        </div>
      )}

      {!waiting && !["done", "error", "rejected"].includes(pipeline.status) && (
        <div style={{ marginTop: 14, padding: 12, background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-2)" }}>
          <strong>Auto-approve:</strong>{" "}
          {pipeline.auto_approve ? "on — steps promote automatically." : "off — each step pauses for your review."}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export const PipelineView = () => {
  const [pipelines, setPipelines] = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pipelines");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setPipelines(data.pipelines || []);
      setFetchError(null);
    } catch (err) {
      setFetchError(err.message || "Could not load pipelines");
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh]);

  const approve = async (id) => {
    await fetch(`/api/pipelines/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approver: "user" }),
    });
    refresh();
  };

  const reject = async (id) => {
    await fetch(`/api/pipelines/${id}/reject`, { method: "POST" });
    refresh();
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Pipelines"
        subtitle="Chain agents back-to-back. Each step's output feeds the next."
        actions={
          !showForm && (
            <button className="btn btn-accent btn-sm" onClick={() => setShowForm(true)}>
              <Icon name="plus" size={13} /> New pipeline
            </button>
          )
        }
      />
      <div style={{ padding: 24 }}>
        {showForm && (
          <div style={{ marginBottom: 24 }}>
            <NewPipelineForm
              onCancel={() => setShowForm(false)}
              onCreate={() => { setShowForm(false); refresh(); }}
            />
          </div>
        )}

        {fetchError && (
          <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "var(--bad)", background: "var(--bad-soft)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Icon name="alert" size={16} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 2 }}>Could not load pipelines</div>
              <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{fetchError}</div>
            </div>
          </div>
        )}

        {pipelines.length === 0 && !showForm && !fetchError ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--ink-3)" }}>
            <Icon name="git2" size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, color: "var(--ink-2)" }}>No pipelines yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              Chain multiple agents to run in sequence on the same project and goal.
            </div>
            <button className="btn btn-accent" onClick={() => setShowForm(true)}>
              <Icon name="plus" size={14} /> Create your first pipeline
            </button>
          </div>
        ) : (
          pipelines.map(p => (
            <PipelineCard key={p.id} pipeline={p} onApprove={approve} onReject={reject} />
          ))
        )}
      </div>
    </div>
  );
};
