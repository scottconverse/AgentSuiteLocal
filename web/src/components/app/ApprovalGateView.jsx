import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const ApprovalGateView = ({ runId, onApprove, onReject }) => {
  const [run, setRun] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState(false);

  // Load run data
  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    fetch(`/api/run/${runId}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        setRun(data);
        setLoading(false);
        if (data.artifacts?.length > 0) setSelected(data.artifacts[0]);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [runId]);

  // Load file content when selection changes
  useEffect(() => {
    if (!runId || !selected) return;
    setFileContent(null);
    setFileError(false);
    setFileLoading(true);
    fetch(`/api/run/${runId}/artifact/${encodeURIComponent(selected)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setFileContent(data.content); setFileLoading(false); })
      .catch(() => { setFileError(true); setFileLoading(false); });
  }, [runId, selected]);

  const handleApprove = async () => {
    if (runId) {
      await fetch(`/api/run/${runId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approver: "user" }),
      }).catch(() => {});
    }
    onApprove();
  };

  const handleReject = async () => {
    if (!rejectConfirm) { setRejectConfirm(true); return; }
    if (runId) {
      await fetch(`/api/run/${runId}/reject`, { method: "POST" }).catch(() => {});
    }
    onReject();
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div className="spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)" }} />
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading run data…</div>
      </div>
    );
  }

  if (error || (!runId && !loading)) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <Icon name="alertCircle" size={32} style={{ color: "var(--warn)" }} />
        <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{error || "No run selected."}</div>
        <button className="btn" onClick={onReject}>Back</button>
      </div>
    );
  }

  const ag = AGENTS.find(a => a.id === run?.agent);
  const qaScore = run?.qa_score;
  const qaDims = run?.qa_dimensions || [];
  const artifacts = run?.artifacts || [];
  // UX-009: only disable approve if score is explicitly below threshold (not when null)
  const approveDisabled = qaScore != null && qaScore < 7.0;

  const fmt = (n) => (typeof n === "number" ? n.toFixed(1) : "—");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar
        title={<>Review · <span style={{ color: "var(--accent)" }}>{ag?.name || run?.agent} · {run?.project}</span></>}
        subtitle={
          qaScore != null
            ? `QA composite ${fmt(qaScore)} — ${qaScore >= 7 ? "above the 7.0 gate. Approve to promote into your kernel." : "below the 7.0 gate. Consider re-running with a clearer goal."}`
            : "Review artifacts below."
        }
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {/* UX-010: two-click reject with confirmation */}
            <button
              className="btn btn-sm"
              onClick={handleReject}
              style={rejectConfirm ? { borderColor: "var(--bad)", color: "var(--bad)" } : {}}
            >
              <Icon name="x" size={13} />
              {rejectConfirm ? "Confirm reject" : "Reject"}
            </button>
            {rejectConfirm && (
              <button className="btn btn-ghost btn-sm" onClick={() => setRejectConfirm(false)}>
                Cancel
              </button>
            )}
            {/* UX-009: tooltip describes what "below threshold" means, not dev jargon */}
            <button
              className="btn btn-accent btn-sm"
              onClick={handleApprove}
              disabled={approveDisabled}
              title={approveDisabled ? `QA score ${fmt(qaScore)}/10 is below the 7.0 minimum. Re-run with a more focused goal to improve it.` : ""}
            >
              <Icon name="check" size={13} /> Approve & promote
            </button>
          </div>
        }
      />
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr 260px", overflow: "hidden", minHeight: 0 }}>

        {/* File tree */}
        <div style={{ borderRight: "1px solid var(--line)", overflow: "auto", padding: "12px 0" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 16px 8px" }}>
            {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
          </div>
          {artifacts.length === 0 && (
            <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--ink-4)", fontStyle: "italic" }}>No artifacts found.</div>
          )}
          {artifacts.map((name, i) => (
            <button key={i} onClick={() => setSelected(name)} style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 16px", width: "100%", fontSize: 12, boxSizing: "border-box",
              background: selected === name ? "var(--accent-soft)" : "transparent",
              color: selected === name ? "var(--accent-ink)" : "var(--ink-2)",
              borderLeft: `2px solid ${selected === name ? "var(--accent)" : "transparent"}`,
            }}>
              <Icon name={name.endsWith("/") ? "folder" : "fileText"} size={12} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
              <span className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            </button>
          ))}
        </div>

        {/* File preview */}
        <div style={{ overflow: "auto", padding: 24, background: "var(--bg-elev)" }}>
          {selected && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
              <Icon name="fileText" size={16} style={{ color: "var(--accent)" }} />
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{selected}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>{run?.id}</span>
            </div>
          )}

          {fileLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 13 }}>
              <div className="spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)" }} />
              Loading…
            </div>
          )}

          {!fileLoading && fileContent != null && (
            <pre style={{
              margin: 0, fontFamily: "var(--font-mono)", fontSize: 12,
              color: "var(--ink-2)", lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>{fileContent}</pre>
          )}

          {/* UX-006: distinguish "still writing" vs "failed to load" vs "binary" */}
          {!fileLoading && fileContent == null && selected && fileError && (
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
              Could not load this file — it may be a binary file or still being written. Try selecting another artifact.
            </div>
          )}

          {!selected && (
            <div style={{ color: "var(--ink-4)", fontSize: 13 }}>Select a file on the left.</div>
          )}
        </div>

        {/* QA panel — UX-015: removed approverName field, single-user app */}
        <div style={{ borderLeft: "1px solid var(--line)", overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>QA score</div>
            {qaScore != null ? (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, color: qaScore >= 7 ? "var(--good)" : "var(--warn)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmt(qaScore)}<span style={{ fontSize: 18, color: "var(--ink-3)" }}>/10</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                  {qaScore >= 7 ? "Above 7.0 gate · eligible to promote" : "Below 7.0 gate · consider re-running"}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No QA score recorded.</div>
            )}
          </div>

          {qaDims.length > 0 && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>Per dimension</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {qaDims.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                    <div style={{ width: 70, height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, d.score * 10)}%`, height: "100%", background: d.score >= 8 ? "var(--good)" : d.score >= 7 ? "var(--accent)" : "var(--warn)", borderRadius: 2 }} />
                    </div>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: d.score >= 8 ? "var(--good)" : "var(--ink-2)", width: 26, textAlign: "right" }}>{fmt(d.score)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 12 }}>
            <button
              className="btn btn-accent"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={handleApprove}
              disabled={approveDisabled}
            >
              <Icon name="check" size={13} /> Approve & promote
            </button>
            <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
              Promotes {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""} to{" "}
              <span className="mono">_kernel/{run?.project}/{run?.agent}/</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
