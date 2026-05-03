import React, { useEffect, useMemo, useRef, useState } from "react";
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

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
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
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

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

        {loading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Loading kernel…</div>
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
                        <div key={j} className="mono" style={{ fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 6, alignItems: "center" }}>
                          <Icon name="fileText" size={10} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
                        </div>
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
    </div>
  );
};
