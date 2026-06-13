import React from "react";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { UninstallPanel } from "../app/SettingsView.jsx";

export const ScreenUninstall = ({ onBack }) => (
  <InstallerShell step={1} totalSteps={1} onBack={onBack} hideNav>
    <SectionHeader
      eyebrow="Uninstall"
      title="Remove AgentSuiteLocal"
      sub="This uses the same uninstall routine available from Settings. You can keep or delete your workspace data during the flow."
    />
    <div style={{ marginBottom: 16 }}>
      <button className="btn btn-ghost" onClick={onBack}>Back to setup</button>
    </div>
    <UninstallPanel />
  </InstallerShell>
);
