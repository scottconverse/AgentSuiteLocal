import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";

// G3: Recommended models list — name, tier, size, RAM
const RECOMMENDED = [
  { id: "gemma2:2b",      tier: "fast",     size: "1.6 GB", ram: "4 GB",  label: "Gemma 2 2B"      },
  { id: "gemma4:e4b",     tier: "balanced", size: "5.0 GB", ram: "8 GB",  label: "Gemma 4 E4B"     },
  { id: "llama3.1:8b",    tier: "powerful", size: "4.7 GB", ram: "10 GB", label: "Llama 3.1 8B"    },
  { id: "qwen2.5:3b",     tier: "fast",     size: "2.0 GB", ram: "4 GB",  label: "Qwen 2.5 3B"     },
  { id: "mistral:7b",     tier: "balanced", size: "4.1 GB", ram: "8 GB",  label: "Mistral 7B"      },
];

const TIER_COLORS = { fast: "var(--good)", balanced: "var(--accent)", powerful: "var(--warn)" };

export const ModelView = ({ onBack }) => {
  const [installedModels, setInstalledModels] = useState([]);
  const [settings, setSettings]               = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [ollamaOk, setOllamaOk]               = useState(false);

  // G3: per-model pull state
  const [pulling, setPulling]     = useState({}); // { modelId: { progress, status, done, error } }
  const pullAborts                = useRef({});

  // G3: delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(null); // modelId

  const fetchModels = useCallback(() => {
    Promise.all([
      fetch("/api/ollama/models").then(r => r.json()).catch(() => ({ models: [], running: false })),
      fetch("/api/settings").then(r => r.json()).catch(() => ({})),
    ]).then(([m, s]) => {
      setInstalledModels(m.models || []);
      setOllamaOk(m.running || false);
      setSettings(s);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const setActiveModel = async (modelId) => {
    // Determine tier from recommended list; fallback to "powerful"
    const rec = RECOMMENDED.find(r => r.id === modelId);
    const tier = rec?.tier || "powerful";
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_name: modelId, model_tier: tier }),
    });
    setSettings(prev => ({ ...prev, model_name: modelId, model_tier: tier }));
  };

  const deleteModel = async (modelId) => {
    setConfirmDelete(null);
    await fetch(`/api/ollama/models/${encodeURIComponent(modelId)}`, { method: "DELETE" });
    fetchModels();
  };

  // G3: SSE pull with live progress
  const pullModel = (modelId) => {
    if (pulling[modelId]?.active) return;
    setPulling(prev => ({ ...prev, [modelId]: { active: true, progress: 0, status: "Starting…", done: false, error: null } }));

    const es = new EventSource(`/api/ollama/pull?model=${encodeURIComponent(modelId)}`);
    pullAborts.current[modelId] = es;

    es.onmessage = (evt) => {
      try {
        const d = JSON.parse(evt.data);
        if (d.status === "success") {
          setPulling(prev => ({ ...prev, [modelId]: { active: false, progress: 100, status: "Done", done: true, error: null } }));
          es.close();
          fetchModels();
          return;
        }
        const pct = d.total && d.completed ? Math.round((d.completed / d.total) * 100) : 0;
        setPulling(prev => ({ ...prev, [modelId]: { active: true, progress: pct, status: d.status || "Pulling…", done: false, error: null } }));
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setPulling(prev => ({
        ...prev,
        [modelId]: { active: false, progress: 0, status: null, done: false, error: "Pull failed — check Ollama is running" },
      }));
      es.close();
    };
  };

  const activeModel = settings?.model_name;

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Model Management"
        subtitle="Manage local Ollama models, pull new ones, set the active model"
        actions={
          onBack
            ? <button className="btn btn-sm" onClick={onBack}><Icon name="chevL" size={12} /> Back</button>
            : null
        }
      />

      <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status banner */}
        <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, background: ollamaOk ? "var(--bg-tint)" : "var(--bad-soft)", border: `1px solid ${ollamaOk ? "var(--line)" : "var(--bad)"}` }}>
          <Icon name="server" size={18} style={{ color: ollamaOk ? "var(--good)" : "var(--bad)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Ollama {ollamaOk ? "running" : "not detected"}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>localhost:11434</div>
          </div>
          <span className={`chip chip-${ollamaOk ? "good" : "bad"}`}>
            <span className="dot" /> {ollamaOk ? "Healthy" : "Offline"}
          </span>
        </div>

        {/* Active model indicator */}
        {activeModel && (
          <div style={{ padding: "10px 14px", background: "var(--accent-soft)", borderRadius: 8, border: "1px solid var(--accent)", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="check" size={13} style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--ink-2)" }}>Active model:</span>
            <span className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>{activeModel}</span>
          </div>
        )}

        {/* Installed models */}
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Installed models</div>
            <button className="btn btn-sm" onClick={fetchModels}><Icon name="refresh" size={12} /> Refresh</button>
          </div>

          {loading && <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "12px 0" }}>Loading…</div>}

          {!loading && installedModels.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "12px 0", fontStyle: "italic" }}>
              No models installed yet. Pull a model from the list below.
            </div>
          )}

          {installedModels.map(m => {
            const isActive = m === activeModel || m.startsWith(activeModel?.split(":")[0]);
            return (
              <div key={m} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 0", borderTop: "1px solid var(--line)",
              }}>
                <Icon name="box" size={14} style={{ color: isActive ? "var(--accent)" : "var(--ink-3)" }} />
                <span className="mono" style={{ flex: 1, fontSize: 12, color: isActive ? "var(--ink-1)" : "var(--ink-2)", fontWeight: isActive ? 700 : 400 }}>{m}</span>
                {isActive && <span className="chip chip-good" style={{ fontSize: 10 }}>Active</span>}
                {!isActive && (
                  <button className="btn btn-sm" onClick={() => setActiveModel(m)}>Set active</button>
                )}
                {confirmDelete === m ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-sm" style={{ color: "var(--bad)", borderColor: "var(--bad)" }} onClick={() => deleteModel(m)}>Confirm delete</button>
                    <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn btn-sm" style={{ color: "var(--bad)" }} onClick={() => setConfirmDelete(m)}>Delete</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Recommended models */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Recommended models</div>
          {RECOMMENDED.map(rec => {
            const isInstalled = installedModels.some(m => m === rec.id || m.startsWith(rec.id.split(":")[0]));
            const pullState = pulling[rec.id];
            return (
              <div key={rec.id} style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{rec.label}</span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{rec.id}</span>
                      <span style={{ fontSize: 10, color: TIER_COLORS[rec.tier], fontWeight: 600, textTransform: "uppercase" }}>{rec.tier}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Disk: {rec.size} · RAM: {rec.ram}</div>
                  </div>
                  {isInstalled ? (
                    <span className="chip chip-good" style={{ fontSize: 10 }}>Installed</span>
                  ) : (
                    <button
                      className="btn btn-sm btn-accent"
                      onClick={() => pullModel(rec.id)}
                      disabled={pullState?.active || !ollamaOk}
                    >
                      {pullState?.active ? "Pulling…" : "Pull"}
                    </button>
                  )}
                </div>
                {/* G3: Pull progress bar */}
                {pullState && !pullState.done && !pullState.error && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>
                      <span>{pullState.status}</span>
                      <span className="mono">{pullState.progress}%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--bg-sunk)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pullState.progress}%`, background: "var(--accent)", borderRadius: 2, transition: "width 0.3s ease" }} />
                    </div>
                  </div>
                )}
                {pullState?.done && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--good)" }}>Downloaded successfully.</div>
                )}
                {pullState?.error && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "var(--bad)" }}>{pullState.error}</div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
