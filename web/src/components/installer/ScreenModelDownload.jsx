import React, { useEffect, useRef, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";

export const ScreenModelDownload = ({ onBack, onNext, tier }) => {
  const model = MODELS.find(m => m.id === tier) || MODELS[1];
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | pulling | done | error
  const [statusLine, setStatusLine] = useState("Starting…");
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(parseFloat(model.size) * 1024);
  const [speedMBs, setSpeedMBs] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    setStatus("pulling");

    const ctrl = new AbortController();

    fetch("/api/model/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.model }),
      signal: ctrl.signal,
    }).then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          // SSE "data: " prefix
          const raw = line.startsWith("data: ") ? line.slice(6) : line;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "error") {
              setStatus("error");
              setErrorMsg(evt.message);
              return;
            }
            // Ollama pull progress events
            if (evt.status) {
              setStatusLine(evt.status);
            }
            if (evt.total && evt.completed != null) {
              const totalB = evt.total;
              const doneB = evt.completed;
              setTotalMB(Math.round(totalB / 1024 / 1024));
              setDownloadedMB(Math.round(doneB / 1024 / 1024));

              const now = Date.now();
              const dtSec = (now - lastTimeRef.current) / 1000;
              if (dtSec > 0.5) {
                const delta = doneB - lastBytesRef.current;
                setSpeedMBs(Math.round((delta / 1024 / 1024) / dtSec * 10) / 10);
                lastBytesRef.current = doneB;
                lastTimeRef.current = now;
              }

              const p = Math.round((doneB / totalB) * 100);
              setPct(p);
            }
            if (evt.status === "success") {
              setPct(100);
              setStatus("done");
              setStatusLine("Model ready.");
            }
          } catch {
            // non-JSON line — ignore
          }
        }
      }
      if (status !== "done" && status !== "error") {
        setStatus("done");
        setPct(100);
        setStatusLine("Model ready.");
      }
    }).catch(e => {
      if (e.name !== "AbortError") {
        setStatus("error");
        setErrorMsg(e.message);
      }
    });

    return () => ctrl.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalGB = (totalMB / 1024).toFixed(1);
  const doneGB = (downloadedMB / 1024).toFixed(1);
  const eta = status === "done" ? "Done" : speedMBs && speedMBs > 0
    ? `~${Math.max(1, Math.round((totalMB - downloadedMB) / speedMBs / 60))} min left`
    : "Calculating…";

  return (
    <InstallerShell step={6} totalSteps={12} onBack={onBack} onNext={onNext} nextDisabled={status !== "done"}>
      <SectionHeader eyebrow="Step 06" title="Downloading model"
        sub="One-time download. The model is shared with any other Ollama-based app you install later." />

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <Icon name="package" size={26} />
            <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${pct}%`, background: "var(--accent)", transition: "width 0.3s" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{model.tier} · Gemma 4</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{model.model} · {model.size}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 28, color: "var(--accent)", letterSpacing: "-0.02em" }}>
              {pct}<span style={{ fontSize: 16, color: "var(--ink-3)" }}>%</span>
            </div>
          </div>
        </div>

        <ProgressBar value={pct} accent />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12 }}>
          <span className="mono" style={{ color: "var(--ink-3)" }}>{doneGB} / {totalGB} GB</span>
          <span className="mono" style={{ color: "var(--ink-3)" }}>{speedMBs != null ? `${speedMBs} MB/s` : "—"}</span>
          <span className="mono" style={{ color: "var(--ink-2)", fontWeight: 500 }}>{eta}</span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{statusLine}</div>
        </div>
      </div>

      {status === "error" && (
        <div className="card" style={{ marginTop: 16, padding: 14, borderColor: "var(--bad)", background: "var(--bad-soft)", fontSize: 13, color: "var(--bad)" }}>
          <strong>Download failed:</strong> {errorMsg}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-2)" }}>Make sure Ollama is running and you have an internet connection, then go back and try again.</div>
        </div>
      )}

      {status !== "error" && (
        <div style={{ marginTop: 16, padding: 14, background: "var(--bg-tint)", borderRadius: 8, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Icon name="info" size={14} style={{ color: "var(--ink-3)", marginTop: 2 }} />
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--ink)" }}>Brew yourself a coffee.</strong> This is the only big download.
            Once it's local, every future run is fully offline.
          </div>
        </div>
      )}
    </InstallerShell>
  );
};
