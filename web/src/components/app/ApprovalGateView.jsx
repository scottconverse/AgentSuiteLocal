import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";
// C2: react-markdown — static import (package now in dependencies; graceful null-guard retained for safety)
import ReactMarkdownPkg from "react-markdown";
import remarkGfmPkg from "remark-gfm";
const ReactMarkdown = ReactMarkdownPkg || null;
const remarkGfm = remarkGfmPkg || null;

/** C2: Group artifact names by stage prefix (01-research-*, 02-strategy-*, etc.) */
function groupByStage(artifacts) {
  const groups = {};
  for (const name of artifacts) {
    const match = name.match(/^(\d{2}-[a-z]+)/);
    const key = match ? match[1] : "other";
    if (!groups[key]) groups[key] = [];
    groups[key].push(name);
  }
  return groups;
}

/** D4: Trigger a browser download for a run export. */
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "export";
  a.click();
}

export const ApprovalGateView = ({ runId, onApprove, onReject }) => {
  const [run, setRun] = useState(null);
  const [selected, setSelected] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectConfirm, setRejectConfirm] = useState(false);

  // C1: configurable gate
  const [threshold, setThreshold] = useState(7.0);
  // C1: override approval flow
  const [overrideConfirm, setOverrideConfirm] = useState(false);
  const [overrideDialog, setOverrideDialog] = useState(false);
  // D1: export path banner
  const [exportPath, setExportPath] = useState(null);
  // D4: export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  // C3: QA partial notice — must match data.js QA_DIMENSIONS count (9)
  const EXPECTED_QA_DIMS = 9;
  // A-7: optimistic approve/reject loading + error states
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);

  // Load run data + settings (for threshold)
  useEffect(() => {
    if (!runId) { setLoading(false); return; }
    Promise.all([
      fetch(`/api/run/${runId}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch("/api/settings").then(r => r.json()).catch(() => ({})),
    ]).then(([data, settings]) => {
      setRun(data);
      setThreshold(settings.qa_gate_threshold ?? 7.0);
      setLoading(false);
      if (data.artifacts?.length > 0) setSelected(data.artifacts[0]);
    }).catch(e => { setError(e.message); setLoading(false); });
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

  const handleApprove = async (override = false) => {
    if (approving) return;
    setApproving(true);
    setApproveError(null);
    // A-7: use local variable to avoid stale-closure on exportPath state
    let newExportPath = null;
    if (runId) {
      try {
        const r = await fetch(`/api/run/${runId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approver: "user", override }),
        });
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        const data = await r.json().catch(() => ({}));
        if (data.export_path) {
          newExportPath = data.export_path;
          setExportPath(data.export_path);
        }
      } catch (err) {
        setApproveError(err.message || "Approval failed — please try again");
        setApproving(false);
        return;
      }
    }
    setApproving(false);
    // A-7: only auto-advance if no export banner to show
    if (!newExportPath) {
      onApprove();
    }
  };

  const handleOverrideApprove = async () => {
    setOverrideDialog(false);
    // handleApprove handles onApprove() internally; don't double-call
    await handleApprove(true);
  };

  const handleReject = async () => {
    if (!rejectConfirm) { setRejectConfirm(true); return; }
    if (rejecting) return;
    setRejecting(true);
    setRejectError(null);
    if (runId) {
      try {
        const r = await fetch(`/api/run/${runId}/reject`, { method: "POST" });
        if (!r.ok) throw new Error(`Server error ${r.status}`);
      } catch (err) {
        setRejectError(err.message || "Rejection failed — please try again");
        setRejecting(false);
        return;
      }
    }
    setRejecting(false);
    onReject();
  };

  const handleExport = (format) => {
    setExportOpen(false);
    const ext = format === "zip" ? "zip" : format === "pdf" ? "pdf" : "md";
    triggerDownload(`/api/run/${runId}/export/${format}`, `${runId}-bundle.${ext}`);
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
        <Icon name="alert" size={32} style={{ color: "var(--warn)" }} />
        <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{error || "No run selected."}</div>
        <button className="btn" onClick={onReject}>Back</button>
      </div>
    );
  }

  const ag = AGENTS.find(a => a.id === run?.agent);
  const qaScore = run?.qa_score;
  const qaDims = run?.qa_dimensions || [];
  const artifacts = run?.artifacts || [];

  // C1: disable primary approve if below threshold (not when null)
  const belowThreshold = qaScore != null && qaScore < threshold;
  const approveDisabled = belowThreshold;

  const fmt = (n) => (typeof n === "number" ? n.toFixed(1) : "—");

  // C2: group artifacts by stage prefix
  const artifactGroups = groupByStage(artifacts);
  const groupKeys = Object.keys(artifactGroups);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar
        title={<>Review · <span style={{ color: "var(--accent)" }}>{ag?.name || run?.agent} · {run?.project}</span></>}
        subtitle={
          qaScore != null
            ? `QA ${fmt(qaScore)}/10 · Gate: ${threshold.toFixed(1)}/10 — ${qaScore >= threshold ? "eligible to approve" : "below gate"}`
            : "Review artifacts below."
        }
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {/* D4: Export dropdown */}
            <div style={{ position: "relative" }}>
              <button className="btn btn-sm" onClick={() => setExportOpen(v => !v)}>
                <Icon name="download" size={13} /> Export
              </button>
              {exportOpen && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", zIndex: 100, minWidth: 180 }}>
                  {[
                    { id: "zip", label: "ZIP — all artifacts", icon: "package" },
                    { id: "markdown", label: "Markdown bundle", icon: "fileText" },
                    { id: "pdf", label: "PDF", icon: "layers" },
                  ].map(opt => (
                    <button key={opt.id} onClick={() => handleExport(opt.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", fontSize: 13, background: "none", border: "none", cursor: "pointer", color: "var(--ink-2)" }}
                      className="btn-card">
                      <Icon name={opt.icon} size={13} style={{ color: "var(--ink-3)" }} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="btn btn-sm"
              onClick={handleReject}
              disabled={rejecting}
              style={rejectConfirm ? { borderColor: "var(--bad)", color: "var(--bad)" } : {}}
            >
              <Icon name="x" size={13} />
              {rejecting ? "Rejecting…" : rejectConfirm ? "Confirm reject" : "Reject"}
            </button>
            {rejectConfirm && !rejecting && (
              <button className="btn btn-ghost btn-sm" onClick={() => setRejectConfirm(false)}>Cancel</button>
            )}
            <button
              className="btn btn-accent btn-sm"
              onClick={() => handleApprove(false)}
              disabled={approveDisabled || approving}
              title={approveDisabled ? `Score ${fmt(qaScore)}/10 is below your ${threshold.toFixed(1)} gate` : ""}
            >
              {approving
                ? "Approving…"
                : <><Icon name="check" size={13} /> Approve & promote</>
              }
            </button>
            {/* C1: Override & approve for below-threshold runs */}
            {belowThreshold && (
              <button
                className="btn btn-sm"
                style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                onClick={() => setOverrideDialog(true)}
              >
                Override & approve
              </button>
            )}
          </div>
        }
      />

      {/* A-7: Approve / reject error banners */}
      {approveError && (
        <div style={{ margin: "8px 16px 0", padding: "10px 16px", background: "var(--bad-soft, #ffeaea)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <Icon name="alert" size={16} style={{ color: "var(--bad)" }} />
          <span style={{ flex: 1, color: "var(--bad)", fontWeight: 500 }}>{approveError}</span>
          <button className="btn btn-sm" onClick={() => setApproveError(null)}>Dismiss</button>
        </div>
      )}
      {rejectError && (
        <div style={{ margin: "8px 16px 0", padding: "10px 16px", background: "var(--bad-soft, #ffeaea)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <Icon name="alert" size={16} style={{ color: "var(--bad)" }} />
          <span style={{ flex: 1, color: "var(--bad)", fontWeight: 500 }}>{rejectError}</span>
          <button className="btn btn-sm" onClick={() => setRejectError(null)}>Dismiss</button>
        </div>
      )}

      {/* D1: Export path banner */}
      {exportPath && (
        <div style={{ margin: "8px 16px", padding: "10px 16px", background: "var(--good-soft)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
          <Icon name="check" size={16} style={{ color: "var(--good)" }} />
          <span style={{ flex: 1, color: "var(--good)", fontWeight: 500 }}>
            Saved to kernel: <span className="mono">{exportPath}</span>
          </span>
          <button className="btn btn-sm" onClick={() => fetch("/api/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: exportPath }) }).catch(() => {})}>
            Open folder
          </button>
          <button className="btn btn-accent btn-sm" onClick={onApprove}>Continue</button>
        </div>
      )}

      {/* C1: Override confirmation dialog */}
      {overrideDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ padding: 24, maxWidth: 440, width: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Override & approve?</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.55 }}>
              This run scored <strong>{fmt(qaScore)}/10</strong>, below your <strong>{threshold.toFixed(1)}</strong> gate.
              Approve anyway?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-sm" onClick={() => setOverrideDialog(false)}>Cancel</button>
              <button className="btn btn-sm" style={{ borderColor: "var(--warn)", color: "var(--warn)" }} onClick={handleOverrideApprove}>
                Confirm Approve
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px 1fr 260px", overflow: "hidden", minHeight: 0 }}>

        {/* C2: File tree grouped by stage */}
        <div style={{ borderRight: "1px solid var(--line)", overflow: "auto", padding: "12px 0" }}>
          <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, padding: "0 16px 8px" }}>
            {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
          </div>
          {artifacts.length === 0 && (
            <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--ink-4)", fontStyle: "italic" }}>No artifacts found.</div>
          )}
          {groupKeys.map(groupKey => (
            <details key={groupKey} open style={{ marginBottom: 4 }}>
              <summary style={{ padding: "6px 16px", fontSize: 11, color: "var(--ink-3)", fontWeight: 600, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="mono">{groupKey}</span>
                <span className="chip" style={{ fontSize: 9 }}>{artifactGroups[groupKey].length}</span>
              </summary>
              {artifactGroups[groupKey].map((name, i) => (
                <button key={i} onClick={() => setSelected(name)} className="btn-card" style={{
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 16px 7px 24px", width: "100%", fontSize: 11, boxSizing: "border-box",
                  background: selected === name ? "var(--accent-soft)" : "transparent",
                  color: selected === name ? "var(--accent-ink)" : "var(--ink-2)",
                  borderLeft: `2px solid ${selected === name ? "var(--accent)" : "transparent"}`,
                }}>
                  <Icon name="fileText" size={11} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                  <span className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name.replace(/^\d{2}-[a-z]+-/, "")}</span>
                </button>
              ))}
            </details>
          ))}
        </div>

        {/* C2: File preview with markdown rendering */}
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

          {/* C2: Markdown rendering */}
          {!fileLoading && fileContent != null && (
            ReactMarkdown ? (
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, maxWidth: "100%" }}
                className="markdown-body">
                <ReactMarkdown remarkPlugins={remarkGfm ? [remarkGfm] : []}>{fileContent}</ReactMarkdown>
              </div>
            ) : (
              <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{fileContent}</pre>
            )
          )}

          {!fileLoading && fileContent == null && selected && fileError && (
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
              Could not load this file — it may be a binary file or still being written. Try selecting another artifact.
            </div>
          )}

          {!selected && (
            <div style={{ color: "var(--ink-4)", fontSize: 13 }}>Select a file on the left.</div>
          )}
        </div>

        {/* QA panel */}
        <div style={{ borderLeft: "1px solid var(--line)", overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>
              QA score · Gate {threshold.toFixed(1)}/10
            </div>
            {qaScore != null ? (
              <>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 48, fontWeight: 500, color: qaScore >= threshold ? "var(--good)" : "var(--warn)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmt(qaScore)}<span style={{ fontSize: 18, color: "var(--ink-3)" }}>/10</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                  {qaScore >= threshold ? "Above gate · eligible to promote" : "Below gate · consider re-running"}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>No QA score recorded.</div>
            )}
          </div>

          {/* C3: partial QA notice */}
          {qaDims.length > 0 && qaDims.length < EXPECTED_QA_DIMS && (
            <div style={{ padding: 10, background: "var(--warn-soft, #fff8e1)", borderRadius: 8, border: "1px solid var(--warn)", fontSize: 11 }}>
              <div style={{ fontWeight: 600, color: "var(--warn)", marginBottom: 4 }}>
                Partial QA scores — {qaDims.length} of {EXPECTED_QA_DIMS} dimensions
              </div>
              <div style={{ color: "var(--ink-2)", marginBottom: 6 }}>
                Scores shown may not reflect full output quality. This is a known limitation of smaller models.
              </div>
              <details>
                <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: 11 }}>What does this mean?</summary>
                <div style={{ marginTop: 6, color: "var(--ink-2)", lineHeight: 1.55 }}>
                  QA scoring evaluates multiple quality dimensions. When a smaller model returns fewer dimensions, only the available scores are shown. This does not mean the run failed — it means quality assessment is incomplete.
                </div>
              </details>
            </div>
          )}

          {qaDims.length > 0 && (
            <div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 8 }}>Per dimension</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {qaDims.map(d => (
                  <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                    <div style={{ width: 70, height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                      <div style={{ width: `${Math.min(100, d.score * 10)}%`, height: "100%", background: d.score >= 8 ? "var(--good)" : d.score >= threshold ? "var(--accent)" : "var(--warn)", borderRadius: 2 }} />
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
              onClick={() => handleApprove(false)}
              disabled={approveDisabled || approving}
            >
              {approving
                ? "Approving…"
                : <><Icon name="check" size={13} /> Approve & promote</>
              }
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
