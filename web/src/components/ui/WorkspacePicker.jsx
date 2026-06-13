import React, { useEffect, useState } from "react";
import { Icon } from "./index.jsx";

export const WorkspacePicker = ({
  value,
  onChange,
  onSave,
  saving = false,
  compact = false,
}) => {
  const [draft, setDraft] = useState(value || "");
  const [defaults, setDefaults] = useState(null);
  const [pickerError, setPickerError] = useState(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    fetch("/api/system/default-folders")
      .then(r => r.json())
      .then(setDefaults)
      .catch(() => {});
  }, []);

  const setPath = (path) => {
    setPickerError(null);
    setDraft(path);
    onChange?.(path);
  };

  const browse = async () => {
    setPickerError(null);
    try {
      const res = await fetch("/api/system/select-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initial: draft || value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.cancelled && data.path) setPath(data.path);
    } catch (err) {
      setPickerError(err?.message || "Folder picker unavailable");
    }
  };

  const dirty = draft !== (value || "");
  const desktop = defaults?.desktop_workspace || "~/Desktop/AgentSuiteLocal";
  const downloads = defaults?.downloads_workspace || "~/Downloads/AgentSuiteLocal";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={e => setPath(e.target.value)}
          className="mono"
          aria-label="Workspace folder"
          style={{
            flex: 1,
            minWidth: 0,
            padding: compact ? "7px 9px" : "8px 10px",
            fontSize: 12,
            border: "1px solid var(--line-2)",
            borderRadius: 8,
            background: "var(--bg)",
          }}
        />
        <button className="btn btn-sm" onClick={browse} type="button">
          <Icon name="folder" size={14} /> Browse
        </button>
        {onSave && (
          <button className="btn btn-sm btn-accent" onClick={() => onSave(draft)} disabled={!dirty || saving} type="button">
            Save folder
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn btn-sm" onClick={() => setPath(desktop)} type="button">Desktop</button>
        <button className="btn btn-sm" onClick={() => setPath(downloads)} type="button">Downloads</button>
      </div>
      {pickerError && (
        <div style={{ fontSize: 11, color: "var(--bad)", lineHeight: 1.4 }}>
          {pickerError}. You can still paste a full folder path.
        </div>
      )}
    </div>
  );
};
