import React, { useState } from "react";
import { WindowChrome } from "./components/ui/index.jsx";
import { Sidebar } from "./components/shell/index.jsx";

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

const TOTAL_STEPS = 12;

const STEP_LABELS = [
  "", "Welcome", "License", "Hardware check", "Choose tier",
  "Install Ollama", "Download model", "Python runtime", "Select agents",
  "API keys", "Smoke test", "Ready", "Uninstall",
];

export default function App() {
  // ── Installer ─────────────────────────────────────────────────────────────
  const [mode, setMode]   = useState("installer"); // "installer" | "app"
  const [step, setStep]   = useState(1);
  const [tier, setTier]   = useState("balanced");
  const [agents, setAgents] = useState(null); // null = all enabled

  // ── App ───────────────────────────────────────────────────────────────────
  const [view, setView]   = useState("home");   // sidebar destination
  const [scene, setScene] = useState("main");   // "main"|"newrun"|"live"|"gate"
  const [runId, setRunId] = useState(null);

  // ── Installer nav ─────────────────────────────────────────────────────────
  const enterApp = () => { setMode("app"); setScene("main"); setView("home"); };

  const goNext = () => step < TOTAL_STEPS ? setStep(s => s + 1) : enterApp();
  const goBack = () => step > 1 && setStep(s => s - 1);

  const installerStep = () => {
    switch (step) {
      case 1:  return <ScreenWelcome onNext={goNext} />;
      case 2:  return <ScreenLicense onBack={goBack} onNext={goNext} />;
      case 3:  return <ScreenHardware onBack={goBack} onNext={goNext} />;
      case 4:  return <ScreenTier onBack={goBack} onNext={goNext} tier={tier} setTier={setTier} />;
      case 5:  return <ScreenOllama onBack={goBack} onNext={goNext} />;
      case 6:  return <ScreenModelDownload onBack={goBack} onNext={goNext} tier={tier} />;
      case 7:  return <ScreenPython onBack={goBack} onNext={goNext} />;
      case 8:  return <ScreenAgents onBack={goBack} onNext={goNext} enabled={agents} setEnabled={setAgents} />;
      case 9:  return <ScreenApiKey onBack={goBack} onNext={goNext} />;
      case 10: return <ScreenSmoke onBack={goBack} onNext={goNext} />;
      case 11: return <ScreenSuccess onBack={goBack} onNext={enterApp} />;
      case 12: return <ScreenUninstall onBack={goBack} />;
      default: return null;
    }
  };

  // ── App scene ─────────────────────────────────────────────────────────────
  const navTo = (v) => { setScene("main"); setView(v); };

  const appScene = () => {
    if (scene === "newrun") return (
      <NewRunView
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
        onApprove={() => { setScene("main"); setView("home"); setRunId(null); }}
        onReject={() => { setScene("main"); setView("home"); setRunId(null); }}
      />
    );

    switch (view) {
      case "home":     return <Dashboard onNew={() => setScene("newrun")} onOpen={() => setScene("gate")} />;
      case "agents":   return <AgentsView onPick={() => setScene("newrun")} />;
      case "runs":     return <RunsView onOpen={() => setScene("gate")} />;
      case "kernel":   return <KernelView />;
      case "pipeline": return <PipelineView />;
      case "settings": return <SettingsView />;
      case "manual":   return <ManualView />;
      default:         return <Dashboard onNew={() => setScene("newrun")} onOpen={() => setScene("gate")} />;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const showSidebar = mode === "app" && scene === "main";

  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-sunk)", padding: 24,
    }}>
      <WindowChrome
        title="AgentSuiteLocal"
        subtitle={mode === "installer" ? `Setup · ${STEP_LABELS[step]}` : "Local AI workspace"}
        height="calc(100vh - 48px)"
      >
        {mode === "installer" ? (
          installerStep()
        ) : (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {showSidebar && (
              <Sidebar view={view} setView={navTo} projectSlug="agentsuitelocal" />
            )}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              {appScene()}
            </div>
          </div>
        )}
      </WindowChrome>
    </div>
  );
}
