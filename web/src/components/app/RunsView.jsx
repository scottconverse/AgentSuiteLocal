import React, { useEffect, useMemo, useState, useRef } from "react";
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
  waiting:   { kind: "warn", label: "Needs review" },
  approved:  { kind: "good", label: "Approved"     },
  running:   { kind: "info", label: "Running"       },
  rejected:  { kind: "bad",  label: "Rejected"      },
  error:     { kind: "bad",  label: "Error"          },
  cancelled: { kind: "info", label: "Cancelled"      },
  timeout:   { kind: "bad",  label: "Timed out"      },
};

const ALL_STATUSES = ["All", "running", "waiting", "approved", "rejected", "error", "cancelled"];

// B5: RunDetailView for terminal-state runs
const RunDetailView = ({ run, onBack, onRetry }) => {
  const ag = AGENTS.find(a => a.id === run.agent);
  const fmt = (n) => (typeof n === "number" ? n.toFixed(1) : "—");
  const qaDims = run.qa_dimensions || [];

  const handleExport = (format) => {
    const ext = format === "zip" ? "zip" : format === "pdf" ? "pdf" : "md";
    const a = document.createElement("a");
    a.href = `/api/run/${run.id}/export/${format}`;
    a.download = `${run.id}-bundle.${ext}`;
    a.click();
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={<>{ag?.name || run.agent} · <span style={{ color: "var(--accent)" }}>{run.project}</span></>}
        subtitle={`Run ${run.id} · ${STATUS_MAP[run.status]?.label || run.status}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {["error", "rejected", "cancelled"].includes(run.status) && (
              <button className="btn btn-sm btn-accent" onClick={() => onRetry(run)}>
                <Icon name="refresh" size={12} /> Retry
              </button>
            )}
            <button className="btn btn-sm" onClick={onBack}>
              <Icon name="chevL" size={12} /> Back
            </button>
          </div>
        }
      />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
        {/* Metadata */}
        <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { l: "Agent", v: ag?.name || run.agent },
            { l: "Project", v: run.project },
            { l: "Status", v: STATUS_MAP[run.status]?.label || run.status },
            { l: "Goal", v: run.goal },
            { l: "Duration", v: elapsed(run.started_at, run.approved_at || run.cancelled_at) },
            { l: "QA Score", v: run.qa_score != null ? `${fmt(run.qa_score)}/10` : "—" },
            ...(run.error ? [{ l: "Error", v: run.error }] : []),
            ...(run.partial_artifacts ? [{ l: "Partial artifacts", v: "Saved to cancelled-outputs/" }] : []),
          ].map(r => (
            <div key={r.l} style={{ display: "flex", gap: 12, fontSize: 12 }}>
              <span style={{ color: "var(--ink-3)", minWidth: 100 }}>{r.l}</span>
              <span style={{ color: "var(--ink-2)", fontWeight: 500 }}>{r.v}</span>
            </div>
          ))}
        </div>

        {/* QA Dimensions */}
        {qaDims.length > 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 10 }}>QA Dimensions</div>
            {qaDims.map(d => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "var(--ink-2)", flex: 1 }}>{d.name}</span>
                <div style={{ width: 100, height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                  <div style={{ width: `${Math.min(100, d.score * 10)}%`, height: "100%", background: d.score >= 8 ? "var(--good)" : d.score >= 7 ? "var(--accent)" : "var(--warn)", borderRadius: 2 }} />
                </div>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, width: 30 }}>{d.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Artifacts */}
        {run.artifacts?.length > 0 && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                {run.artifacts.length} artifacts
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["zip", "markdown", "pdf"].map(fmt => (
                  <button key={fmt} className="btn btn-sm" onClick={() => handleExport(fmt)}>
                    <Icon name="download" size={11} /> {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {run.artifacts.slice(0, 20).map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11 }}>
                <Icon name="fileText" size={11} style={{ color: "var(--ink-3)" }} />
                <span className="mono" style={{ color: "var(--ink-2)" }}>{f}</span>
              </div>
            ))}
            {run.artifacts.length > 20 && (
              <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 4 }}>+{run.artifacts.length - 20} more</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const RunsView = ({ onOpen, onRerun }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  // H3: search + filter
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const searchDebounceRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // B5: detail view
  const [detailRun, setDetailRun] = useState(null);

  const fetchRuns = () =>
    fetch("/api/runs")
      .then(r => r.json())
      .then(data => { setRuns(data.runs || []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { fetchRuns(); }, []);

  useEffect(() => {
    const hasActive = runs.some(r => r.status === "running" || r.status === "waiting");
    if (!hasActive) return;
    const iv = setInterval(fetchRuns, 10_000);
    return () => clearInterval(iv);
  }, [runs]);

  // H3: debounce search 250ms
  useEffect(() => {
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  const filteredRuns = useMemo(() => {
    let result = runs;
    if (statusFilter !== "All") {
      result = result.filter(r => r.status === statusFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(r =>
        r.agent?.toLowerCase().includes(q) ||
        r.project?.toLowerCase().includes(q) ||
        r.goal?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [runs, statusFilter, debouncedSearch]);

  // B5: open run based on status
  const openRun = (run) => {
    if (run.status === "waiting") return onOpen(run.id);
    setDetailRun(run);
  };

  // E1: retry run — navigate to NewRunView pre-populated
  const retryRun = (run) => {
    onRerun?.(run.agent, { goal: run.goal, project: run.project });
  };

  if (detailRun) {
    return (
      <RunDetailView
        run={detailRun}
        onBack={() => setDetailRun(null)}
        onRetry={(run) => { setDetailRun(null); retryRun(run); }}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Runs"
        subtitle={loading ? "Loading…" : `${filteredRuns.length}${filteredRuns.length !== runs.length ? ` of ${runs.length}` : ""} run${filteredRuns.length !== 1 ? "s" : ""}`}
        actions={<button className="btn btn-sm" onClick={() => { setLoading(true); fetchRuns(); }}><Icon name="refresh" size={13} /> Refresh</button>}
      />

      {/* H3: Search bar + status filter */}
      <div style={{ padding: "12px 24px 0", display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Icon name="search" size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agent, project, goal, status…"
            style={{ width: "100%", padding: "8px 10px 8px 32px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)", fontFamily: "var(--font-sans)" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)", fontFamily: "var(--font-sans)" }}
        >
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : STATUS_MAP[s]?.label || s}</option>)}
        </select>
        {(search || statusFilter !== "All") && (
          <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{filteredRuns.length} result{filteredRuns.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <div style={{ padding: "12px 24px 24px" }}>
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

          {!loading && filteredRuns.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              {runs.length === 0 ? "No runs yet. Start one from the Agents screen." : "No runs match your filter."}
            </div>
          )}

          {filteredRuns.map((r, i) => {
            const ag = AGENTS.find(a => a.id === r.agent);
            const st = STATUS_MAP[r.status] || { kind: "info", label: r.status };
            const isWaiting = r.status === "waiting";
            const isRetryable = ["error", "rejected", "cancelled"].includes(r.status);
            const hasDetail = ["approved", "rejected", "error", "cancelled", "timeout"].includes(r.status);
            const isPartial = r.partial_artifacts;

            return (
              <div key={r.id}
                data-testid="run-row"
                onClick={() => openRun(r)}
                style={{
                  padding: "12px 18px",
                  display: "grid", gridTemplateColumns: "1.4fr 1fr 80px 100px 120px 90px", gap: 12, alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid var(--line)",
                  cursor: (isWaiting || hasDetail) ? "pointer" : "default",
                  background: isWaiting ? "var(--accent-soft)" : r.status === "error" ? "var(--bad-soft)" : "transparent",
                }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name={ag?.icon || "box"} size={14} style={{ color: "var(--ink-3)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ag?.name || r.agent}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {r.project}
                      {isPartial && <span className="chip" style={{ marginLeft: 6, fontSize: 9 }}>partial output saved</span>}
                    </div>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.id}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: r.qa_score != null && r.qa_score >= 7 ? "var(--good)" : r.qa_score != null ? "var(--warn)" : "var(--ink-4)" }}>
                  {r.qa_score != null ? r.qa_score.toFixed(1) : "—"}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{elapsed(r.started_at, r.approved_at)}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={`chip chip-${st.kind}`} style={{ justifyContent: "center" }}>
                    {r.status === "running" && <span className="dot pulse-dot" />}
                    {st.label}
                  </span>
                  {/* E1: retry on error/rejected/cancelled */}
                  {isRetryable && (
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 10, padding: "3px 7px" }}
                      onClick={e => { e.stopPropagation(); retryRun(r); }}
                    >
                      <Icon name="refresh" size={10} /> Retry
                    </button>
                  )}
                </div>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{timeAgo(r.started_at)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
