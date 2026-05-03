import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon, SkeletonCard } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";
// UX-4: markdown rendering for inline artifact preview
import ReactMarkdownPkg from "react-markdown";
import remarkGfmPkg from "remark-gfm";
const ReactMarkdown = ReactMarkdownPkg || null;
const remarkGfm = remarkGfmPkg || null;

function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() / 1000) - ts);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export const KernelView = () => {
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showPath, setShowPath] = useState(false);

  // H4: search + project filter
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef(null);
  const [projectFilter, setProjectFilter] = useState("All");

  // UX-4: inline artifact preview
  const [preview, setPreview] = useState(null); // { project, agent, filename }
  const [previewContent, setPreviewContent] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    fetch("/api/kernel")
      .then(r => r.json())
      .then(data => {
        setProjects(data.projects || {});
        const keys = Object.keys(data.projects || {});
        if (keys.length > 0) setSelectedProject(keys[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // H4: debounce
  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(searchRef.current);
  }, [search]);

  // UX-4: load artifact content when preview changes
  useEffect(() => {
    if (!preview) { setPreviewContent(null); setPreviewError(null); return; }
    setPreviewLoading(true);
    setPreviewContent(null);
    setPreviewError(null);
    fetch(`/api/kernel/${preview.project}/${preview.agent}/${encodeURIComponent(preview.filename)}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setPreviewContent(data.content); setPreviewLoading(false); })
      .catch(err => { setPreviewError(err.message || "Could not load artifact"); setPreviewLoading(false); });
  }, [preview]);

  const projectKeys = Object.keys(projects);

  const filteredProjects = useMemo(() => {
    let keys = projectFilter !== "All" ? [projectFilter] : projectKeys;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      keys = keys.filter(k => {
        if (k.toLowerCase().includes(q)) return true;
        const agents = projects[k] || {};
        return Object.keys(agents).some(a => a.toLowerCase().includes(q));
      });
    }
    return keys;
  }, [projects, projectKeys, projectFilter, debouncedSearch]);

  const totalFiles = filteredProjects.reduce((sum, p) =>
    sum + Object.values(projects[p] || {}).reduce((s, files) => s + files.length, 0), 0);

  const currentAgents = selectedProject ? (projects[selectedProject] || {}) : {};

  const openPreview = (project, agent, filename) => {
    setPreview({ project, agent, filename });
  };
  const closePreview = () => setPreview(null);

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      <TopBar
        title={`Kernel · ${selectedProject || "—"}`}
        subtitle={loading ? "Loading…" : `${totalFiles} artifacts across ${filteredProjects.length} project${filteredProjects.length !== 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setShowPath(v => !v)}>
              <Icon name="folder" size={13} /> Reveal path
            </button>
          </div>
        }
      />

      {/* UX-4: Preview panel + main content side by side */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>

        {/* Main content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

          {showPath && (
            <div style={{ padding: "10px 14px", background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="folder" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 12, flex: 1 }}>~/AgentSuite/.agentsuite/_kernel/</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPath(false)}>Dismiss</button>
            </div>
          )}

          <div className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", background: "linear-gradient(120deg, var(--bg-elev), var(--accent-soft))" }}>
            <Icon name="layers" size={28} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontSize: 18, fontWeight: 500 }}>This is your source of truth</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                Approved artifacts are loaded into every future agent run as canonical context. Edit on disk, version with git.
              </div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>~/AgentSuite/.agentsuite/_kernel/</span>
          </div>

          {/* H4: Search + project filter */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Icon name="search" size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-3)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search project, agent…"
                style={{ width: "100%", padding: "8px 10px 8px 32px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }}
              />
            </div>
            <select
              value={projectFilter}
              onChange={e => { setProjectFilter(e.target.value); setSelectedProject(e.target.value !== "All" ? e.target.value : (projectKeys[0] || null)); }}
              style={{ padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)" }}
            >
              <option value="All">All projects</option>
              {projectKeys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{totalFiles} artifacts</span>
          </div>

          {/* Project selector */}
          {filteredProjects.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {filteredProjects.map(slug => (
                <button key={slug} className={`btn btn-sm ${selectedProject === slug ? "btn-accent" : ""}`}
                  onClick={() => setSelectedProject(slug)}>
                  <Icon name="folder" size={12} /> {slug}
                </button>
              ))}
            </div>
          )}

          {/* UX-5: skeleton grid while loading */}
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[0, 1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} lines={4} />)}
            </div>
          )}

          {!loading && filteredProjects.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <Icon name="layers" size={32} style={{ color: "var(--ink-4)", marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                {projectKeys.length === 0 ? "Kernel is empty" : "No results match your filter"}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>
                {projectKeys.length === 0
                  ? "No approved runs yet — approve a run to promote its artifacts to your kernel."
                  : "Try a different search term or project filter."}
              </div>
            </div>
          )}

          {!loading && selectedProject && filteredProjects.includes(selectedProject) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {AGENTS.map(a => {
                const files = currentAgents[a.id] || [];
                return (
                  <div key={a.id} className="card" style={{ padding: 16, opacity: files.length === 0 ? 0.5 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "var(--bg-tint)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon name={a.icon} size={14} />
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
                      <span className="chip" style={{ marginLeft: "auto", fontSize: 10 }}>{files.length} files</span>
                    </div>
                    {files.length === 0 ? (
                      <div style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>No approved artifacts yet</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {files.slice(0, 4).map((f, j) => (
                          // UX-4: each filename is now a clickable preview trigger
                          <button
                            key={j}
                            className="btn-card"
                            onClick={() => openPreview(selectedProject, a.id, f)}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "4px 6px", borderRadius: 6, width: "100%",
                              background: preview?.project === selectedProject && preview?.agent === a.id && preview?.filename === f
                                ? "var(--accent-soft)" : "transparent",
                              cursor: "pointer",
                            }}
                            title={`Preview ${f}`}
                          >
                            <Icon name="fileText" size={10} style={{ flexShrink: 0, color: "var(--ink-3)" }} />
                            <span className="mono" style={{ fontSize: 10, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{f}</span>
                          </button>
                        ))}
                        {files.length > 4 && (
                          <div style={{ fontSize: 10, color: "var(--ink-4)" }}>+{files.length - 4} more</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* UX-4: Slide-in preview panel */}
        {preview && (
          <div style={{
            width: 440, minWidth: 320, borderLeft: "1px solid var(--line)",
            display: "flex", flexDirection: "column", background: "var(--bg-elev)",
            overflow: "hidden",
          }}>
            {/* Preview header */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="fileText" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {preview.project}/{preview.agent}/{preview.filename}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={closePreview} aria-label="Close preview">
                <Icon name="x" size={13} />
              </button>
            </div>

            {/* Preview body */}
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {previewLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-3)", fontSize: 13 }}>
                  <div className="spin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)" }} />
                  Loading…
                </div>
              )}
              {previewError && (
                <div style={{ fontSize: 13, color: "var(--bad)" }}>{previewError}</div>
              )}
              {!previewLoading && previewContent != null && (
                ReactMarkdown ? (
                  <div className="markdown-body" style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={remarkGfm ? [remarkGfm] : []}>{previewContent}</ReactMarkdown>
                  </div>
                ) : (
                  <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{previewContent}</pre>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
