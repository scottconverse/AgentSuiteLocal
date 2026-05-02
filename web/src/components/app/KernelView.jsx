import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS } from "../../data.js";

export const KernelView = () => {
  const [projects, setProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

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

  const totalFiles = Object.values(projects).reduce((sum, agents) =>
    sum + Object.values(agents).reduce((s, files) => s + files.length, 0), 0);

  const projectKeys = Object.keys(projects);
  const currentAgents = selectedProject ? (projects[selectedProject] || {}) : {};

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title={`Kernel · ${selectedProject || "—"}`}
        subtitle={loading ? "Loading…" : `${totalFiles} approved artifacts across ${projectKeys.length} project${projectKeys.length !== 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={() => {
              const ws = "~/AgentSuite/.agentsuite/_kernel";
              // Reveal in file manager — backend would handle this; for now show the path
              alert(`Kernel is at: ${ws}`);
            }}><Icon name="folder" size={13} /> Reveal</button>
          </div>
        }
      />
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

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

        {/* Project selector */}
        {projectKeys.length > 1 && (
          <div style={{ display: "flex", gap: 8 }}>
            {projectKeys.map(slug => (
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

        {!loading && projectKeys.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <Icon name="layers" size={32} style={{ color: "var(--ink-4)", marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Kernel is empty</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              Complete a run and approve it to populate the kernel.
            </div>
          </div>
        )}

        {!loading && selectedProject && (
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
