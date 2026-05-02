import React, { useEffect, useState } from "react";
import { Icon, Toggle } from "../ui/index.jsx";
import { TopBar } from "../shell/index.jsx";
import { AGENTS, MODELS } from "../../data.js";

export const SettingsView = () => {
  const [settings, setSettings] = useState(null);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // QA-007: separate draft state so API key save is explicit, not onBlur
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  // UX-022: inline info instead of alert()
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()).catch(() => ({})),
      fetch("/api/ollama/status").then(r => r.json()).catch(() => null),
    ]).then(([s, o]) => {
      setSettings(s);
      setOllamaStatus(o);
      // QA-007: initialize draft — API key comes back as "****" if set, empty string if not
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

  // QA-007: explicit save for API key only
  const saveApiKey = async () => {
    await patch({ api_key: apiKeyDraft || null });
    setApiKeyDirty(false);
  };

  const toggleAgent = (id) => {
    const enabled = settings?.enabled_agents || [];
    const next = enabled.includes(id) ? enabled.filter(a => a !== id) : [...enabled, id];
    patch({ enabled_agents: next });
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

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <TopBar
        title="Settings"
        subtitle="Configure agents, model, costs, and behavior"
        actions={saved ? <span style={{ fontSize: 12, color: "var(--good)" }}>✓ Saved</span> : saving ? <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Saving…</span> : null}
      />
      <div style={{ padding: 24, maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* LLM Engine */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>LLM Engine</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--bg-tint)", borderRadius: 8 }}>
            <Icon name="server" size={20} style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{loadedModel || currentModel.model} · Ollama</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                localhost:11434 · {currentModel.size} · {ollamaOk ? "running" : "not detected"}
              </div>
            </div>
            <span className={`chip chip-${ollamaOk ? "good" : "bad"}`}>
              <span className="dot" /> {ollamaOk ? "Healthy" : "Offline"}
            </span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", marginBottom: 8 }}>Model tier</div>
            <div style={{ display: "flex", gap: 8 }}>
              {MODELS.map(m => (
                <button key={m.id}
                  className={`btn btn-sm ${settings.model_tier === m.id ? "btn-accent" : ""}`}
                  onClick={() => patch({ model_tier: m.id, model_name: m.model })}>
                  {m.tier}
                  {m.recommended && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>★</span>}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8 }}>{currentModel.blurb}</div>
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
            { key: "open_on_launch", l: "Open browser on launch",              sub: "Auto-open dashboard at localhost:8765"         },
            { key: "telemetry",      l: "Send anonymous performance telemetry", sub: "Off by default. We don't collect anything."   },
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

        {/* Workspace */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Workspace</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Where artifacts and runs are stored. Set via AGENTSUITE_WORKSPACE env var.</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input readOnly value="~/AgentSuite" className="mono"
              style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg-tint)" }} />
            {/* UX-022: inline info card instead of alert() */}
            <button className="btn btn-sm" onClick={() => setShowWorkspaceInfo(v => !v)}>Change</button>
          </div>
          {showWorkspaceInfo && (
            <div style={{ marginTop: 10, padding: 12, background: "var(--info-soft)", borderRadius: 8, border: "1px solid var(--info)", fontSize: 12, color: "var(--info)", lineHeight: 1.55 }}>
              <strong>To change the workspace path:</strong> set the <span className="mono">AGENTSUITE_WORKSPACE</span> environment variable before starting AgentSuiteLocal, then restart the app.
              <br />Example: <span className="mono">AGENTSUITE_WORKSPACE=~/my-workspace</span>
            </div>
          )}
        </div>

        {/* Cloud fallback */}
        <div className="card" style={{ padding: 18 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>Cloud fallback (optional)</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>Paste an Anthropic API key to use Claude as a fallback for difficult prompts. The app works fully local without this.</div>
          {/* QA-007: explicit Save button; onBlur was unreliable on navigate-away */}
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="password"
              placeholder={settings.api_key === "****" ? "Key stored — enter new key to replace" : "sk-ant-…"}
              value={apiKeyDraft}
              onChange={e => { setApiKeyDraft(e.target.value); setApiKeyDirty(true); }}
              className="mono"
              style={{ flex: 1, padding: "8px 10px", fontSize: 12, border: `1px solid ${apiKeyDirty ? "var(--accent)" : "var(--line-2)"}`, borderRadius: 8, background: "var(--bg)" }}
            />
            {apiKeyDirty && (
              <button className="btn btn-sm btn-accent" onClick={saveApiKey} disabled={saving}>Save</button>
            )}
            {!apiKeyDirty && settings.api_key && (
              <button className="btn btn-sm" onClick={() => { setApiKeyDraft(""); setApiKeyDirty(true); }}>Clear</button>
            )}
          </div>
          {apiKeyDirty && (
            <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4 }}>Unsaved changes — click Save to persist.</div>
          )}
        </div>

      </div>
    </div>
  );
};
