import React, { useState, useEffect } from "react";
import { WindowChrome } from "./components/ui/index.jsx";
import { Sidebar } from "./components/shell/index.jsx";

import { AGENTS } from "./data.js";
import { ScreenWelcome }       from "./components/installer/ScreenWelcome.jsx";
import { ScreenLicense }       from "./components/installer/ScreenLicense.jsx";
import { ScreenHardware }      from "./components/installer/ScreenHardware.jsx";
import { ScreenTier }          from "./components/installer/ScreenTier.jsx";
import { ScreenOllama }        from "./components/installer/ScreenOllama.jsx";
import { ScreenModelDownload } from "./components/installer/ScreenModelDownload.jsx";
import { ScreenPython }        from "./components/installer/ScreenPython.jsx";
import { ScreenAgents }        from "./components/installer/ScreenAgents.jsx";
import { ScreenApiKey }        from "./components/installer/ScreenApiKey.jsx";
import { ScreenSmoke }         from "./components/installer/ScreenSmoke.jsx";
import { ScreenSuccess }       from "./components/installer/ScreenSuccess.jsx";
import { ScreenUninstall }     from "./components/installer/ScreenUninstall.jsx";

import { Dashboard }        from "./components/app/Dashboard.jsx";
import { AgentsView }       from "./components/app/AgentsView.jsx";
import { NewRunView }       from "./components/app/NewRunView.jsx";
import { LiveRunView }      from "./components/app/LiveRunView.jsx";
import { ApprovalGateView } from "./components/app/ApprovalGateView.jsx";
import { KernelView }       from "./components/app/KernelView.jsx";
import { PipelineView }     from "./components/app/PipelineView.jsx";
import { SettingsView }     from "./components/app/SettingsView.jsx";
import { RunsView }         from "./components/app/RunsView.jsx";
import { ManualView }       from "./components/app/ManualView.jsx";
import { ModelView }        from "./components/app/ModelView.jsx";
import { ProjectsView }     from "./components/app/ProjectsView.jsx";
import { CrashBanner }      from "./components/app/CrashBanner.jsx";

// UX-018: 11 actual setup screens (Uninstall is not counted in the setup flow)
const TOTAL_STEPS = 11;

const STEP_LABELS = [
  "", "Welcome", "License", "Hardware check", "Choose tier",
  "Install Ollama", "Download model", "Python runtime", "Select agents",
  "API keys", "Smoke test", "Ready",
];

export default function App() {
  // ── Installer ─────────────────────────────────────────────────────────────
  const [mode, setMode]     = useState("installer");
  const [step, setStep]     = useState(1);
  const [tier, setTier]     = useState("balanced");
  const [agents, setAgents] = useState(() => AGENTS.map(a => a.id));
  // QA-002: capture apiKey during installer so we can persist it to the backend
  const [apiKey, setApiKey] = useState("");

  // ── App ───────────────────────────────────────────────────────────────────
  const [view, setView]             = useState("home");
  const [scene, setScene]           = useState("main");
  const [runId, setRunId]           = useState(null);
  const [agentId, setAgentId]       = useState(null);
  // E1: retry pre-population state
  const [retryGoal, setRetryGoal]   = useState(null);
  const [retryProject, setRetryProject] = useState(null);
  // UX-016: live waiting-run count for Sidebar badge
  const [waitingCount, setWaitingCount] = useState(0);
  // UX-003: short-lived toast after approve/reject
  const [actionToast, setActionToast] = useState(null); // { msg, kind }
  // H2: auto-update banner
  const [updateInfo, setUpdateInfo] = useState(null); // { version, url } | null
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const showToast = (msg, kind = "good") => {
    setActionToast({ msg, kind });
    setTimeout(() => setActionToast(null), 4000);
  };

  useEffect(() => {
    if (mode !== "app") return;
    const poll = () =>
      fetch("/api/runs")
        .then(r => r.json())
        .then(d => setWaitingCount((d.runs || []).filter(r => r.status === "waiting").length))
        .catch(() => {});
    poll();
    const iv = setInterval(poll, 10_000);
    return () => clearInterval(iv);
  }, [mode]);

  // H2: check for update once on app entry
  useEffect(() => {
    if (mode !== "app") return;
    fetch("/api/update/check")
      .then(r => r.json())
      .then(d => { if (d.update_available) setUpdateInfo({ version: d.latest_version, url: d.release_url }); })
      .catch(() => {});
  }, [mode]);

  // ── Installer nav ─────────────────────────────────────────────────────────
  const enterApp = async () => {
    // QA-002: persist all installer-captured config to the backend before entering the app
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_tier: tier,
          enabled_agents: agents,
          ...(apiKey ? { api_key: apiKey } : {}),
        }),
      });
    } catch {
      // settings persist is best-effort; don't block app entry
    }
    setMode("app");
    setScene("main");
    setView("home");
  };

  const goNext = () => step < TOTAL_STEPS ? setStep(s => s + 1) : enterApp();
  const goBack = () => step > 1 && setStep(s => s - 1);

  const installerStep = () => {
    const ts = TOTAL_STEPS;
    switch (step) {
      case 1:  return <ScreenWelcome onNext={goNext} totalSteps={ts} />;
      case 2:  return <ScreenLicense onBack={goBack} onNext={goNext} totalSteps={ts} />;
      case 3:  return <ScreenHardware onBack={goBack} onNext={goNext} totalSteps={ts} />;
      case 4:  return <ScreenTier onBack={goBack} onNext={goNext} tier={tier} setTier={setTier} totalSteps={ts} />;
      case 5:  return <ScreenOllama onBack={goBack} onNext={goNext} totalSteps={ts} />;
      case 6:  return <ScreenModelDownload onBack={goBack} onNext={goNext} tier={tier} totalSteps={ts} />;
      case 7:  return <ScreenPython onBack={goBack} onNext={goNext} totalSteps={ts} />;
      case 8:  return <ScreenAgents onBack={goBack} onNext={goNext} enabled={agents} setEnabled={setAgents} totalSteps={ts} />;
      case 9:  return <ScreenApiKey onBack={goBack} onNext={goNext} apiKey={apiKey} setApiKey={setApiKey} totalSteps={ts} />;
      case 10: return <ScreenSmoke onBack={goBack} onNext={goNext} totalSteps={ts} />;
      case 11: return <ScreenSuccess onBack={goBack} onNext={enterApp} totalSteps={ts} />;
      default: return null;
    }
  };

  // ── App helpers ───────────────────────────────────────────────────────────
  const navTo = (v) => { setScene("main"); setView(v); };

  const openGate = (id) => {
    setRunId(id);
    setScene("gate");
  };

  // E1: startNewRun accepts optional { goal, project } for retry pre-population
  const startNewRun = (selectedAgentId = null, retryOpts = null) => {
    setAgentId(selectedAgentId);
    setRetryGoal(retryOpts?.goal || null);
    setRetryProject(retryOpts?.project || null);
    setScene("newrun");
  };

  const appScene = () => {
    if (scene === "newrun") return (
      <NewRunView
        agentId={agentId}
        initialGoal={retryGoal}
        initialProject={retryProject}
        onCancel={() => setScene("main")}
        onLaunch={(id) => { setRunId(id); setScene("live"); }}
      />
    );
    if (scene === "live") return (
      <LiveRunView
        runId={runId}
        onApprovalReady={() => setScene("gate")}
        onCancel={() => { setScene("main"); setView("home"); setRunId(null); }}
      />
    );
    if (scene === "gate") return (
      <ApprovalGateView
        runId={runId}
        onApprove={() => { setScene("main"); setView("home"); setRunId(null); showToast("Run approved and promoted to kernel"); }}
        onReject={() => { setScene("main"); setView("home"); setRunId(null); showToast("Run rejected", "bad"); }}
      />
    );

    switch (view) {
      case "home":     return <Dashboard onNew={() => startNewRun(null)} onOpen={openGate} />;
      case "agents":   return <AgentsView onPick={(id) => startNewRun(id)} onManual={() => navTo("manual")} />;
      // E1: onRerun receives (agentId, { goal, project })
      case "runs":     return <RunsView onOpen={openGate} onRerun={(aid, opts) => startNewRun(aid, opts)} />;
      case "kernel":   return <KernelView />;
      case "pipeline": return <PipelineView />;
      case "projects": return <ProjectsView />;
      case "models":   return <ModelView onBack={() => navTo("settings")} />;
      case "settings": return <SettingsView onGoToModels={() => navTo("models")} />;
      case "manual":   return <ManualView />;
      default:         return <Dashboard onNew={() => startNewRun(null)} onOpen={openGate} />;
    }
  };

  const showSidebar = mode === "app" && scene === "main";

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-sunk)", padding: 24,
    }}>
      {actionToast && (
        <div className="fade-up" style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          padding: "10px 20px", borderRadius: 10, zIndex: 9999,
          background: actionToast.kind === "bad" ? "var(--bad)" : "var(--good)",
          color: "white", fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
          pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          {actionToast.msg}
        </div>
      )}
      <WindowChrome
        title="AgentSuiteLocal"
        subtitle={mode === "installer" ? `Setup · ${STEP_LABELS[step]}` : "Local AI workspace"}
        height="calc(100vh - 48px)"
      >
        {mode === "installer" ? (
          installerStep()
        ) : (
          <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: "column" }}>
            {/* H2: update available banner */}
            {updateInfo && !updateDismissed && (
              <div style={{
                padding: "8px 24px",
                background: "var(--accent-soft)",
                borderBottom: "1px solid var(--accent)",
                display: "flex", alignItems: "center", gap: 10, fontSize: 12,
              }}>
                <span style={{ flex: 1, color: "var(--ink-2)" }}>
                  AgentSuiteLocal <strong>{updateInfo.version}</strong> is available.{" "}
                  <a href={updateInfo.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>See release notes</a>
                </span>
                <button className="btn btn-sm" onClick={() => setUpdateDismissed(true)}>Dismiss</button>
              </div>
            )}
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              {showSidebar && (
                <Sidebar view={view} setView={navTo} projectSlug="agentsuitelocal" waitingCount={waitingCount} />
              )}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                {/* F4: crash banner shown on first render if crash detected */}
                {showSidebar && <CrashBanner />}
                {appScene()}
              </div>
            </div>
          </div>
        )}
      </WindowChrome>
    </div>
  );
}
