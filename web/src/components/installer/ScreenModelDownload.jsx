import React, { useEffect, useRef, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";
import { parseSseStream } from "../../utils/sseStream.js";

// A2: retry loop — 3 attempts, 5s backoff
// A3: verify model with /api/model/verify/{name} before enabling Next
const MAX_RETRIES = 3;

export const ScreenModelDownload = ({ onBack, onNext, tier, totalSteps }) => {
  const model = MODELS.find(m => m.id === tier) || MODELS[1];
  const [pct, setPct] = useState(0);
  const [status, setStatus] = useState("idle"); // idle | pulling | retrying | verifying | done | error
  const [statusLine, setStatusLine] = useState("Starting…");
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(parseFloat(model.size) * 1024);
  const [speedMBs, setSpeedMBs] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [attempt, setAttempt] = useState(0);         // A2: retry counter
  const [verifyError, setVerifyError] = useState(null); // A3: verify failure
  const [retryCountdown, setRetryCountdown] = useState(0); // A2: countdown display
  const lastBytesRef = useRef(0);
  const lastTimeRef  = useRef(Date.now());
  const ctrlRef      = useRef(null);

  // A3: verify model is functional after download
  const verifyModel = async (modelName) => {
    setStatus("verifying");
    setStatusLine("Verifying model…");
    try {
      const r = await fetch(`/api/model/verify/${encodeURIComponent(modelName)}`);
      const d = await r.json();
      if (d.ok) {
        setStatus("done");
        setStatusLine("Model ready.");
        setPct(100);
        setVerifyError(null);
      } else {
        setVerifyError(d.error || "Model verification failed");
        setStatus("error");
        setErrorMsg(d.error || "The model downloaded but failed the smoke check.");
      }
    } catch (e) {
      setVerifyError(e.message);
      setStatus("error");
      setErrorMsg("Verify request failed — " + e.message);
    }
  };

  // A2: pull with retry loop
  const doPull = (attemptNum = 1) => {
    setAttempt(attemptNum);
    setStatus("pulling");
    setPct(0);
    setErrorMsg(null);
    setVerifyError(null);
    setStatusLine("Connecting…");

    if (ctrlRef.current) ctrlRef.current.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    fetch("/api/model/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.model }),
      signal: ctrl.signal,
    }).then(async (res) => {
      try {
        for await (const evt of parseSseStream(res.body.getReader())) {
          if (evt.type === "error") throw new Error(evt.message);
          if (evt.status) setStatusLine(evt.status);
          if (evt.total && evt.completed != null) {
            const totalB = evt.total;
            const doneB  = evt.completed;
            setTotalMB(Math.round(totalB / 1024 / 1024));
            setDownloadedMB(Math.round(doneB / 1024 / 1024));
            const now = Date.now();
            const dtSec = (now - lastTimeRef.current) / 1000;
            if (dtSec > 0.5) {
              const delta = doneB - lastBytesRef.current;
              setSpeedMBs(Math.round((delta / 1024 / 1024) / dtSec * 10) / 10);
              lastBytesRef.current = doneB;
              lastTimeRef.current  = now;
            }
            setPct(Math.round((doneB / totalB) * 100));
          }
          if (evt.status === "success") {
            await verifyModel(model.model);
            return;
          }
        }
        // Stream ended without success event — treat as done and verify
        await verifyModel(model.model);
      } catch (innerErr) {
        if (innerErr.name === "AbortError") return;
        if (attemptNum < MAX_RETRIES) {
          setStatus("retrying");
          setStatusLine(`Attempt ${attemptNum} failed — retrying in 5s (${attemptNum}/${MAX_RETRIES})…`);
          setErrorMsg(innerErr.message);
          let cd = 5;
          setRetryCountdown(cd);
          const iv = setInterval(() => {
            cd--;
            setRetryCountdown(cd);
            if (cd <= 0) {
              clearInterval(iv);
              doPull(attemptNum + 1);
            }
          }, 1000);
        } else {
          setStatus("error");
          setErrorMsg(`Failed after ${MAX_RETRIES} attempts: ${innerErr.message}`);
        }
        return;
      }
    }).catch(e => {
      if (e.name === "AbortError") return;
      if (attemptNum < MAX_RETRIES) {
        setStatus("retrying");
        let cd = 5;
        setRetryCountdown(cd);
        setStatusLine(`Connection lost — retrying in 5s (${attemptNum}/${MAX_RETRIES})…`);
        setErrorMsg(e.message);
        const iv = setInterval(() => {
          cd--;
          setRetryCountdown(cd);
          if (cd <= 0) { clearInterval(iv); doPull(attemptNum + 1); }
        }, 1000);
      } else {
        setStatus("error");
        setErrorMsg(`Failed after ${MAX_RETRIES} attempts: ${e.message}`);
      }
    });

    return () => ctrl.abort();
  };

  useEffect(() => {
    doPull(1);
    return () => { if (ctrlRef.current) ctrlRef.current.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalGB = (totalMB / 1024).toFixed(1);
  const doneGB  = (downloadedMB / 1024).toFixed(1);
  const eta = status === "done" ? "Done"
    : speedMBs && speedMBs > 0
    ? `~${Math.max(1, Math.round((totalMB - downloadedMB) / speedMBs / 60))} min left`
    : "Calculating…";

  return (
    <InstallerShell step={6} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={status !== "done"}>
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
            {/* A2: show attempt count */}
            {attempt > 1 && status !== "done" && (
              <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 2 }}>Attempt {attempt} of {MAX_RETRIES}</div>
            )}
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
          <div className="mono" style={{ fontSize: 11, color: status === "retrying" ? "var(--warn)" : "var(--ink-3)" }}>
            {statusLine}
            {status === "retrying" && retryCountdown > 0 && ` (${retryCountdown}s)`}
          </div>
        </div>
      </div>

      {/* A3: verifying state */}
      {status === "verifying" && (
        <div style={{ marginTop: 12, padding: 12, background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-2)", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="dot pulse-dot" style={{ background: "var(--accent)" }} />
          Verifying model responds correctly…
        </div>
      )}

      {status === "error" && (
        <div className="card" style={{ marginTop: 16, padding: 14, borderColor: "var(--bad)", background: "var(--bad-soft)", fontSize: 13, color: "var(--bad)" }}>
          <strong>Download failed:</strong> {errorMsg}
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-2)" }}>
            Make sure Ollama is running and you have an internet connection.
          </div>
          {/* A2: manual retry button after all auto-retries exhausted */}
          <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => doPull(1)}>
            <Icon name="refresh" size={12} /> Retry download
          </button>
        </div>
      )}

      {status !== "error" && status !== "verifying" && (
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
