import React, { useEffect, useState } from "react";
import { Icon, Toggle } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS, MODELS } from "../../data.js";

// A6: Uninstall panel — 3-phase flow
const UninstallPanel = () => {
  const [phase, setPhase] = useState(0); // 0=idle, 1=workspace confirm, 2=model confirm, 3=done
  const [wsInfo, setWsInfo] = useState(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState(false);
  const [deleteModel, setDeleteModel] = useState(false);
  const [working, setWorking] = useState(false);

  const fmt = (bytes) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  const beginUninstall = async () => {
    setWorking(true);
    const info = await fetch("/api/uninstall/workspace-info").then(r => r.json()).catch(() => null);
    setWsInfo(info);
    setWorking(false);
    setPhase(1);
  };

  const phase2 = async () => {
    setWorking(true);
    await fetch("/api/uninstall/phase2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete_workspace: deleteWorkspace }),
    });
    setWorking(false);
    setPhase(2);
  };

  const phase3 = async () => {
    setWorking(true);
    const modelName = localStorage.getItem("active_model") || "gemma2:2b";
    await fetch("/api/uninstall/phase3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delete_model: deleteModel, model_name: modelName }),
    });
    // G4: clear setup flag so next launch shows the installer again
    localStorage.removeItem("agentsuite_setup_complete");
    setWorking(false);
    setPhase(3);
  };

  if (phase === 3) {
    return (
      <div className="card" style={{ padding: 18, borderColor: "var(--bad)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>AgentSuiteLocal has been uninstalled.</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Close this window to finish.</div>
      </div>
    );
  }

  if (phase === 2) {
    return (
      <div className="card" style={{ padding: 18, borderColor: "var(--bad)" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--bad)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Step 3 of 3 — Ollama model</div>
        <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 12 }}>Optionally remove the Ollama model to free disk space.</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginBottom: 16 }}>
          <input type="checkbox" checked={deleteModel} onChange={e => setDeleteModel(e.target.checked)} />
          Delete Ollama model from disk
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary btn-danger" onClick={phase3} disabled={working} style={{ fontSize: 12 }}>
            {working ? "Working..." : "Finish uninstall"}
          </button>
          <button className="btn-ghost" onClick={() => { setPhase(0); setWorking(false); }} style={{ fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (phase === 1) {
    return (
      <div className="card" style={{ padding: 18, borderColor: "var(--bad)" }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--bad)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Step 2 of 3 — Workspace data</div>
        {wsInfo && (
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 12 }}>
            Workspace: <strong>{wsInfo.workspace_path}</strong> ({fmt(wsInfo.workspace_size_bytes)})<br />
            Config: <strong>{wsInfo.config_path}</strong> ({fmt(wsInfo.config_size_bytes)})
          </div>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", marginBottom: 6 }}>
          <input type="checkbox" checked={deleteWorkspace} onChange={e => setDeleteWorkspace(e.target.checked)} />
          Delete all runs, pipelines, and kernel files — <strong>cannot be undone</strong>
        </label>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 16 }}>Leave unchecked to keep your run history.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary btn-danger" onClick={phase2} disabled={working} style={{ fontSize: 12 }}>
            {working ? "Deleting..." : "Continue"}
          </button>
          <button className="btn-ghost" onClick={() => { setPhase(0); setWorking(false); }} style={{ fontSize: 12 }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, borderColor: "var(--bad)" }}>
      <div className="mono" style={{ fontSize: 11, color: "var(--bad)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Danger zone</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Uninstall AgentSuiteLocal</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Stops the backend, optionally removes workspace and Ollama models.</div>
        </div>
        <button className="btn-danger" onClick={beginUninstall} disabled={working} style={{ fontSize: 12, whiteSpace: "nowrap" }}>
          {working ? "Loading..." : "Uninstall..."}
        </button>
      </div>
    </div>
  );
};

// G2: Cloud model options
const CLOUD_MODELS = [
  { id: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku (fast, low cost)" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (balanced)" },
  { id: "claude-opus-4",              label: "Claude Opus 4 (most powerful)" },
];

export const SettingsView = ({ onGoToModels, focusUninstall = false }) => {
  // When the user navigates here via the "Uninstall" sidebar entry, scroll
  // the Danger zone into view on mount so they don't have to scroll a 388-line
  // settings page to find it.
  const uninstallRef = React.useRef(null);
  React.useEffect(() => {
    if (focusUninstall && uninstallRef.current) {
      uninstallRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusUninstall]);
  const [settings, setSettings] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);
  // G1: tier model warning
  const [tierModelWarning, setTierModelWarning] = useState(null);
  // A5: actual bound port (may differ from 8765 if port was in use at launch)
  const [livePort, setLivePort] = useState(8765);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()).catch(() => ({})),
      fetch("/api/ollama/status").then(r => r.json()).catch(() => null),
      fetch("/api/launcher/port").then(r => r.json()).catch(() => ({ port: 8765 })),
    ]).then(([s, o, p]) => {
      setSettings(s);
      setOllamaStatus(o);
      setLivePort(p.port ?? 8765);
      const stored = s.api_key && s.api_key !== "****" ? s.api_key : "";
      setApiKeyDraft(stored);
    });
  }, []);

  const patch = async (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveApiKey = async () => {
    await patch({ api_key: apiKeyDraft || null });
    setApiKeyDirty(false);
  };

  const toggleAgent = (id) => {
    const enabled = settings?.enabled_agents || [];
    const next = enabled.includes(id) ? enabled.filter(a => a !== id) : [...enabled, id];
    patch({ enabled_agents: next });
  };

  // G1: when tier changes, check if mapped model is installed
  const changeTier = async (tierId, modelName) => {
    await patch({ model_tier: tierId, model_name: modelName });
    // Check if model is available in Ollama
    const installed = ollamaStatus?.models || [];
    const modelBase = modelName.split(":")[0];
    const found = installed.some(m => m.startsWith(modelBase));
    if (!found) {
      setTierModelWarning({ tier: tierId, model: modelName });
    } else {
      setTierModelWarning(null);
    }
  };

  if (!settings) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading settings…</div>
      </div>
    );
  }

  const loadedModel = ollamaStatus?.loaded?.[0] || null;
  const ollamaOk = ollamaStatus?.running;
  const currentModel = MODELS.find(m => m.id === settings.model_tier) || MODELS[1];
  const hasApiKey = settings.api_key === "****" || (apiKeyDraft && !apiKeyDirty);
  const isCloudModel = settings.model_name?.startsWith("claude-");

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Settings"
        subtitle="Configure agents, model, costs, and behavior"
        actions={saved ? <span style={{ fontSize: 12, color: "var(--good)" }}>Saved</span> : saving ? <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Saving…</span> : null}
      />
      <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* LLM Engine */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>LLM Engine</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--bg-tint)", borderRadius: 8 }}>
            <Icon name="server" size={20} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{loadedModel || currentModel.model} · {isCloudModel ? "Anthropic Cloud" : "Ollama"}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {isCloudModel ? "Cloud · API costs apply" : `localhost:11434 · ${currentModel.size} · ${ollamaOk ? "running" : "not detected"}`}
              </div>
            </div>
            <span className={`chip chip-${ollamaOk || isCloudModel ? "good" : "bad"}`}>
              <span className="dot" /> {ollamaOk || isCloudModel ? "Healthy" : "Offline"}
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Model tier</div>
            <div style={{ display: "flex", gap: 8 }}>
              {MODELS.map(m => (
                <button key={m.id}
                  className={`btn btn-sm ${settings.model_tier === m.id ? "btn-accent" : ""}`}
                  onClick={() => changeTier(m.id, m.model)}>
                  {m.tier}
                  {m.recommended && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>★</span>}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{currentModel.blurb}</div>
            {/* G1: tier model warning */}
            {tierModelWarning && (
              <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--warn-soft, #fff8e1)", borderRadius: 8, border: "1px solid var(--warn)", fontSize: 12, color: "var(--warn)" }}>
                This tier requires <span className="mono">{tierModelWarning.model}</span>. Go to Model Management to download it.
                {onGoToModels && <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={onGoToModels}>Open Model Management</button>}
              </div>
            )}
          </div>
        </div>

        {/* Enabled agents */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Enabled agents</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {AGENTS.map(a => {
              const enabled = (settings.enabled_agents || []).includes(a.id);
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }}>
                  <Icon name={a.icon} size={14} style={{ color: "var(--ink-2)" }} />
                  <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                  <Toggle checked={enabled} onChange={() => toggleAgent(a.id)} size="sm" label={`Enable ${a.name} agent`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Behavior */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Behavior</div>
          {[
            { key: "open_on_launch", l: "Open browser on launch",  sub: `Auto-open dashboard at localhost:${livePort}${livePort !== 8765 ? " (port 8765 was in use at launch)" : ""}` },
            { key: "notifications",  l: "Desktop notifications",    sub: "Show OS notifications when runs complete. Respects Do Not Disturb." },
            {
              key: "telemetry", l: "Usage telemetry (local only)",
              // S-3: explicit disclosure of what is tracked, where it goes, and how to opt out.
              sub: "Counts run starts, model used, and QA pass/fail. Stored locally only in ~/.agentsuitelocal/usage.jsonl — never transmitted. Disable this toggle to opt out.",
            },
          ].map(r => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--line)", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.l}</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.sub}</div>
              </div>
              <Toggle checked={!!settings[r.key]} onChange={v => patch({ [r.key]: v })} label={r.l} />
            </div>
          ))}
        </div>

        {/* Run timeout (B3) */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Run limits</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Run timeout</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Maximum time a single run may take (60–3600 seconds). Default: 900s (15 min).</div>
            </div>
            <input
              type="number"
              min={60} max={3600}
              value={settings.run_timeout_seconds ?? 900}
              onChange={e => patch({ run_timeout_seconds: parseInt(e.target.value) || 900 })}
              className="mono"
              style={{ width: 80, padding: "6px 8px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)", textAlign: "right" }}
            />
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>s</span>
          </div>
          {/* C1: QA gate threshold */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>QA gate threshold</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Minimum QA score to auto-enable Approve (0.0–10.0). Default: 7.0.</div>
            </div>
            <input
              type="number"
              min={0} max={10} step={0.5}
              value={settings.qa_gate_threshold ?? 7.0}
              onChange={e => patch({ qa_gate_threshold: parseFloat(e.target.value) || 7.0 })}
              className="mono"
              style={{ width: 72, padding: "6px 8px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)", textAlign: "right" }}
            />
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>/10</span>
          </div>
        </div>

        {/* Workspace */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Workspace</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Where artifacts and runs are stored. Set via AGENTSUITE_WORKSPACE env var.</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input readOnly value="~/AgentSuite" className="mono"
              style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg-tint)" }} />
            <button className="btn btn-sm" onClick={() => setShowWorkspaceInfo(v => !v)}>Change</button>
          </div>
          {showWorkspaceInfo && (
            <div style={{ marginTop: 10, padding: 12, background: "var(--info-soft)", borderRadius: 8, border: "1px solid var(--info)", fontSize: 12, color: "var(--info)", lineHeight: 1.55 }}>
              <strong>To change the workspace path:</strong> set the <span className="mono">AGENTSUITE_WORKSPACE</span> environment variable before starting AgentSuiteLocal, then restart.
            </div>
          )}
        </div>

        {/* G2: Cloud fallback */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Cloud fallback (optional)</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Paste an Anthropic API key to use Claude as a fallback. The app works fully local without this.</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password"
              placeholder={settings.api_key === "****" ? "Key stored — enter new key to replace" : "sk-ant-…"}
              value={apiKeyDraft}
              onChange={e => { setApiKeyDraft(e.target.value); setApiKeyDirty(true); }}
              className="mono"
              style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: `1px solid ${apiKeyDirty ? "var(--accent)" : "var(--line-2)"}`, borderRadius: 8, background: "var(--bg)" }}
            />
            {apiKeyDirty && <button className="btn btn-sm btn-accent" onClick={saveApiKey} disabled={saving}>Save</button>}
            {!apiKeyDirty && settings.api_key && <button className="btn btn-sm" onClick={() => { setApiKeyDraft(""); setApiKeyDirty(true); }}>Clear</button>}
          </div>
          {/* G2: cloud model selector */}
          {hasApiKey && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Cloud model</div>
              <select
                value={settings.cloud_model || "claude-3-5-haiku-20241022"}
                onChange={e => patch({ cloud_model: e.target.value, model_name: e.target.value, model_tier: "powerful" })}
                style={{ padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg)", width: "100%" }}
              >
                {CLOUD_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              {/* G2: persistent cost warning */}
              <div style={{ marginTop: 8, padding: "10px 12px", background: "var(--warn-soft, #fff8e1)", borderRadius: 8, border: "1px solid var(--warn)", fontSize: 12, color: "var(--warn)", lineHeight: 1.55 }}>
                <strong>Cloud runs</strong> send your goal and context to Anthropic's servers and incur API costs.
                Local runs are always free.
              </div>
            </div>
          )}
        </div>

        {/* A6: Uninstall — anchored so the sidebar "Uninstall" entry can scroll here */}
        <div ref={uninstallRef}>
          <UninstallPanel />
        </div>

      </div>
    </div>
  );
};
