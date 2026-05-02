import React from "react";
import { Icon } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

// QA-002: apiKey/setApiKey lifted to App.jsx so enterApp() can persist them to /api/settings
export const ScreenApiKey = ({ onBack, onNext, apiKey, setApiKey }) => (
  <InstallerShell step={9} totalSteps={11} onBack={onBack} onNext={onNext}>
    <SectionHeader eyebrow="Step 09" title="Cloud fallback (optional)"
      sub="If Ollama is unavailable or you want faster output, AgentSuiteLocal can fall back to the Anthropic API. Leave blank to run fully local." />

    <div className="card" style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
          Anthropic API key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="sk-ant-… (optional)"
          style={{
            width: "100%", padding: "9px 12px", fontSize: 13,
            border: "1px solid var(--line-2)", borderRadius: "var(--r-2)",
            background: "var(--bg-elev)", color: "var(--ink)",
          }}
        />
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
          Your key is stored locally in{" "}
          <span className="mono" style={{ background: "var(--bg-tint)", padding: "1px 5px", borderRadius: 3 }}>
            ~/.agentsuitelocal/settings.json
          </span>{" "}
          and never sent anywhere except Anthropic's API.
        </div>
      </div>

      <div style={{ paddingTop: 16, borderTop: "1px solid var(--line)" }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <Icon name="info" size={13} style={{ flexShrink: 0, marginTop: 1, color: "var(--ink-4)" }} />
          <span>
            No Anthropic key? That's fine — skip this step. AgentSuiteLocal uses Ollama and
            the local model you downloaded. A key is only needed for cloud-quality output or
            if Ollama goes offline.
          </span>
        </div>
      </div>
    </div>
  </InstallerShell>
);
