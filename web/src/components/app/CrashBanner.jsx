import React, { useEffect, useState } from "react";
import { Icon } from "../ui/index.jsx";

// F4: CrashBanner — polls /api/crash-reports/latest on mount; shows dismissable banner if a crash
// report exists newer than the last dismissed timestamp stored in sessionStorage.
export const CrashBanner = () => {
  const [report, setReport]       = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    fetch("/api/crash-reports/latest")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.timestamp) return;
        // Only show if not already dismissed this session for this timestamp
        const key = `crash-dismissed-${data.timestamp}`;
        if (sessionStorage.getItem(key)) return;
        setReport(data);
      })
      .catch(() => {});
  }, []);

  if (!report || dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem(`crash-dismissed-${report.timestamp}`, "1");
    setDismissed(true);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div style={{
      margin: "8px 24px 0",
      padding: "12px 16px",
      background: "var(--bad-soft)",
      border: "1px solid var(--bad)",
      borderRadius: 8,
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
    }}>
      <Icon name="alert" size={16} style={{ color: "var(--bad)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--bad)", marginBottom: 4 }}>
          AgentSuiteLocal crashed on last run
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--font-mono)", marginBottom: 8, lineHeight: 1.6 }}>
          {report.summary || report.error || "See crash report for details."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={copyReport}>
            <Icon name="copy" size={11} /> {copied ? "Copied!" : "Copy report"}
          </button>
          <button className="btn btn-sm" onClick={dismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
};
