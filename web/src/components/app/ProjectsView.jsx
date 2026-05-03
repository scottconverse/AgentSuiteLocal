import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";

// H5: Project management view — rename, archive, delete
export const ProjectsView = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [renameId, setRenameId] = useState(null);   // project slug being renamed
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [flash, setFlash]       = useState(null);   // { id, msg }

  const showFlash = (id, msg) => {
    setFlash({ id, msg });
    setTimeout(() => setFlash(null), 2000);
  };

  const fetchProjects = () => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(data => { setProjects(data.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, []);

  const renameProject = async (slug) => {
    if (!renameDraft.trim() || renameDraft.trim() === slug) {
      setRenameId(null);
      return;
    }
    setSaving(true);
    await fetch(`/api/projects/${encodeURIComponent(slug)}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: renameDraft.trim() }),
    }).catch(() => {});
    setSaving(false);
    setRenameId(null);
    showFlash(slug, "Renamed");
    fetchProjects();
  };

  const archiveProject = async (slug) => {
    await fetch(`/api/projects/${encodeURIComponent(slug)}/archive`, { method: "POST" }).catch(() => {});
    showFlash(slug, "Archived");
    fetchProjects();
  };

  const deleteProject = async (slug) => {
    setConfirmDelete(null);
    await fetch(`/api/projects/${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => {});
    fetchProjects();
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Projects"
        subtitle={loading ? "Loading…" : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
        actions={
          <button className="btn btn-sm" onClick={() => { setLoading(true); fetchProjects(); }}>
            <Icon name="refresh" size={13} /> Refresh
          </button>
        }
      />

      <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 }}>

        {loading && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>Loading…</div>
        )}

        {!loading && projects.length === 0 && (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <Icon name="folder" size={32} style={{ color: "var(--ink-4)", marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>No projects yet</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.55 }}>
              Projects are created automatically when you start a new run. Start a run from the Agents screen.
            </div>
          </div>
        )}

        {projects.map(p => {
          const isRenaming = renameId === p.slug;
          const isDeleting = confirmDelete === p.slug;
          const flashing   = flash?.id === p.slug;

          return (
            <div key={p.slug} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name={p.archived ? "archive" : "folder"} size={16} style={{ color: p.archived ? "var(--ink-4)" : "var(--accent)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameProject(p.slug); if (e.key === "Escape") setRenameId(null); }}
                        style={{ flex: 1, padding: "5px 8px", fontSize: 13, border: "1px solid var(--accent)", borderRadius: 6, background: "var(--bg)", fontWeight: 600 }}
                      />
                      <button className="btn btn-sm btn-accent" disabled={saving} onClick={() => renameProject(p.slug)}>Save</button>
                      <button className="btn btn-sm" onClick={() => setRenameId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, opacity: p.archived ? 0.5 : 1 }}>{p.name || p.slug}</span>
                      {p.archived && <span className="chip" style={{ fontSize: 10 }}>Archived</span>}
                      {flashing && <span style={{ fontSize: 11, color: "var(--good)" }}>{flash.msg}</span>}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    {p.runs ?? 0} run{p.runs !== 1 ? "s" : ""}
                    {p.last_touch ? ` · last run ${new Date(p.last_touch * 1000).toLocaleDateString()}` : ""}
                  </div>
                </div>

                {/* Actions */}
                {!isRenaming && !isDeleting && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-sm" onClick={() => { setRenameId(p.slug); setRenameDraft(p.name || p.slug); }}>
                      <Icon name="edit" size={11} /> Rename
                    </button>
                    {!p.archived && (
                      <button className="btn btn-sm" onClick={() => archiveProject(p.slug)}>
                        <Icon name="archive" size={11} /> Archive
                      </button>
                    )}
                    <button className="btn btn-sm" style={{ color: "var(--bad)" }} onClick={() => setConfirmDelete(p.slug)}>
                      <Icon name="trash" size={11} /> Delete
                    </button>
                  </div>
                )}

                {isDeleting && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--bad)" }}>Delete all runs and artifacts?</span>
                    <button className="btn btn-sm" style={{ color: "var(--bad)", borderColor: "var(--bad)" }} onClick={() => deleteProject(p.slug)}>Confirm</button>
                    <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
