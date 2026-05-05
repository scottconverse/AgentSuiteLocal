/**
 * UX-1: ScreenOllamaModel — combined Ollama runtime check + model download (step 4 of 5).
 * Replaces ScreenOllama (step 5) + ScreenModelDownload (step 6).
 *
 * State machine:
 *   checking_ollama → ollama_not_found | ollama_ready
 *   ollama_not_found → ollama_installing → ollama_ready
 *   ollama_ready → model_checking → model_ready | model_pulling
 *   model_pulling → model_verifying → done | error
 */
import React, { useEffect, useRef, useState } from "react";
import { Icon, ProgressBar } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";
import { MODELS } from "../../data.js";

const MAX_RETRIES = 3;

export const ScreenOllamaModel = ({ onBack, onNext, tier, totalSteps }) => {
  const model = MODELS.find(m => m.id === tier) || MODELS[1];

  // Ollama phase
  const [ollamaPhase, setOllamaPhase] = useState("checking"); // checking | not_found | installing | ready | error
  const [ollamaVersion, setOllamaVersion]   = useState(null);
  const [ollamaPlatform, setOllamaPlatform] = useState("win32");
  const [ollamaInstallMsg, setOllamaInstallMsg] = useState("");
  const [ollamaInstallPct, setOllamaInstallPct] = useState(0);
  const [ollamaError, setOllamaError] = useState(null);

  // Model phase (only active once Ollama is ready)
  const [modelPhase, setModelPhase]     = useState("idle"); // idle | checking | pulling | retrying | verifying | done | error
  const [modelPct, setModelPct]         = useState(0);
  const [modelStatusLine, setModelStatusLine] = useState("");
  const [modelDownloadedMB, setModelDownloadedMB] = useState(0);
  const [modelTotalMB, setModelTotalMB] = useState(parseFloat(model.size) * 1024);
  const [modelSpeedMBs, setModelSpeedMBs] = useState(null);
  const [modelAttempt, setModelAttempt] = useState(0);
  const [modelRetryCountdown, setModelRetryCountdown] = useState(0);
  const [modelError, setModelError]     = useState(null);

  const ollamaCtrlRef = useRef(null);
  const modelCtrlRef  = useRef(null);
  const lastBytesRef  = useRef(0);
  const lastTimeRef   = useRef(Date.now());

  // ── Ollama detection ────────────────────────────────────────────────────────
  const checkOllama = () => {
    setOllamaPhase("checking");
    fetch("/api/ollama/status")
      .then(r => r.json())
      .then(data => {
        if (data.platform) setOllamaPlatform(data.platform);
        if (data.running) {
          setOllamaVersion(data.version || null);
          setOllamaPhase("ready");
          checkModel(data);
        } else {
          setOllamaPhase("not_found");
        }
      })
      .catch(() => setOllamaPhase("not_found"));
  };

  // ── Ollama silent install (Windows) ─────────────────────────────────────────
  const installOllama = () => {
    setOllamaPhase("installing");
    setOllamaInstallPct(0);
    setOllamaInstallMsg("Starting…");
    setOllamaError(null);
    const ctrl = new AbortController();
    ollamaCtrlRef.current = ctrl;
    fetch("/api/install/ollama", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}), signal: ctrl.signal })
      .then(async res => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n"); buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6);
            try {
              const evt = JSON.parse(raw);
              if (evt.type === "error") { setOllamaError(evt.message); setOllamaPhase("error"); return; }
              if (evt.message) setOllamaInstallMsg(evt.message);
              if (evt.pct != null) setOllamaInstallPct(evt.pct);
              if (evt.type === "done") { setOllamaInstallPct(100); setOllamaPhase("ready"); checkModel({}); }
            } catch { /* skip */ }
          }
        }
      })
      .catch(e => { if (e.name !== "AbortError") { setOllamaError(e.message); setOllamaPhase("error"); } });
  };

  // ── Model check — is the model already downloaded? ──────────────────────────
  const checkModel = (_ollamaData) => {
    setModelPhase("checking");
    setModelStatusLine("Checking model cache…");
    fetch(`/api/model/verify/${encodeURIComponent(model.model)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setModelPhase("done");
          setModelPct(100);
          setModelStatusLine("Model ready.");
        } else {
          pullModel(1);
        }
      })
      .catch(() => pullModel(1));
  };

  // ── Model pull with retry ────────────────────────────────────────────────────
  const verifyModel = async () => {
    setModelPhase("verifying");
    setModelStatusLine("Verifying model…");
    try {
      const r = await fetch(`/api/model/verify/${encodeURIComponent(model.model)}`);
      const d = await r.json();
      if (d.ok) {
        setModelPhase("done");
        setModelPct(100);
        setModelStatusLine("Model ready.");
      } else {
        setModelPhase("error");
        setModelError(d.error || "Model verification failed — try re-downloading.");
      }
    } catch (e) {
      setModelPhase("error");
      setModelError("Verify request failed: " + e.message);
    }
  };

  const pullModel = (attemptNum = 1) => {
    setModelAttempt(attemptNum);
    setModelPhase("pulling");
    setModelPct(0);
    setModelError(null);
    setModelStatusLine("Connecting…");
    lastBytesRef.current = 0;
    lastTimeRef.current  = Date.now();
    if (modelCtrlRef.current) modelCtrlRef.current.abort();
    const ctrl = new AbortController();
    modelCtrlRef.current = ctrl;

    fetch("/api/model/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.model }),
      signal: ctrl.signal,
    }).then(async res => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          if (line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "error") throw new Error(evt.message);
            if (evt.status) setModelStatusLine(evt.status);
            if (evt.total && evt.completed != null) {
              const totalB = evt.total, doneB = evt.completed;
              setModelTotalMB(Math.round(totalB / 1024 / 1024));
              setModelDownloadedMB(Math.round(doneB / 1024 / 1024));
              const now = Date.now(), dtSec = (now - lastTimeRef.current) / 1000;
              if (dtSec > 0.5) {
                setModelSpeedMBs(Math.round(((doneB - lastBytesRef.current) / 1024 / 1024) / dtSec * 10) / 10);
                lastBytesRef.current = doneB;
                lastTimeRef.current  = now;
              }
              setModelPct(Math.round((doneB / totalB) * 100));
            }
            if (evt.status === "success") { await verifyModel(); return; }
          } catch (innerErr) {
            if (innerErr.name === "AbortError") return;
            if (attemptNum < MAX_RETRIES) { scheduleRetry(attemptNum, innerErr.message); }
            else { setModelPhase("error"); setModelError(`Failed after ${MAX_RETRIES} attempts: ${innerErr.message}`); }
            return;
          }
        }
      }
      await verifyModel();
    }).catch(e => {
      if (e.name === "AbortError") return;
      if (attemptNum < MAX_RETRIES) scheduleRetry(attemptNum, e.message);
      else { setModelPhase("error"); setModelError(`Failed after ${MAX_RETRIES} attempts: ${e.message}`); }
    });
  };

  const scheduleRetry = (attemptNum, errMsg) => {
    setModelPhase("retrying");
    setModelError(errMsg);
    let cd = 5;
    setModelRetryCountdown(cd);
    setModelStatusLine(`Retrying in 5s (${attemptNum}/${MAX_RETRIES})…`);
    const iv = setInterval(() => {
      cd--;
      setModelRetryCountdown(cd);
      if (cd <= 0) { clearInterval(iv); pullModel(attemptNum + 1); }
    }, 1000);
  };

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkOllama();
    return () => {
      ollamaCtrlRef.current?.abort();
      modelCtrlRef.current?.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = modelPhase === "done";
  const totalGB = (modelTotalMB / 1024).toFixed(1);
  const doneGB  = (modelDownloadedMB / 1024).toFixed(1);
  const eta     = isDone ? "Done"
    : modelSpeedMBs && modelSpeedMBs > 0
    ? `~${Math.max(1, Math.round((modelTotalMB - modelDownloadedMB) / modelSpeedMBs / 60))} min left`
    : "Calculating…";

  return (
    <InstallerShell step={4} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={!isDone}>
      <SectionHeader eyebrow="Step 04" title="Ollama & model"
        sub="We install the Ollama runtime and download your selected model. This is a one-time setup." />

      {/* ── Ollama section ─────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: ollamaPhase === "ready" ? 0 : 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: ollamaPhase === "ready" ? "var(--good-soft)" : "var(--bg-tint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={ollamaPhase === "ready" ? "check" : "server"} size={18} stroke={ollamaPhase === "ready" ? 2.4 : 1.6} style={{ color: ollamaPhase === "ready" ? "var(--good)" : "var(--ink-2)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Ollama runtime</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>localhost:11434</div>
          </div>
          {ollamaPhase === "checking"  && <span className="chip"><span className="dot pulse-dot" /> Detecting</span>}
          {ollamaPhase === "not_found" && <span className="chip chip-warn">Not found</span>}
          {ollamaPhase === "installing"&& <span className="chip chip-info"><span className="dot pulse-dot" /> Installing</span>}
          {ollamaPhase === "ready"     && <span className="chip chip-good">Ready{ollamaVersion ? ` · ${ollamaVersion}` : ""}</span>}
          {ollamaPhase === "error"     && <span className="chip chip-bad">Failed</span>}
        </div>

        {ollamaPhase === "not_found" && ollamaPlatform !== "darwin" && (
          <button className="btn btn-primary btn-sm" onClick={installOllama}>
            <Icon name="download" size={13} /> Install Ollama (~280 MB)
          </button>
        )}
        {ollamaPhase === "not_found" && ollamaPlatform === "darwin" && (
          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
            Install via <span className="mono">brew install ollama</span> or from <strong>ollama.com/download</strong>, then click
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={checkOllama}>Check again</button>
          </div>
        )}
        {ollamaPhase === "installing" && (
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={ollamaInstallPct} label={ollamaInstallMsg} accent />
          </div>
        )}
        {ollamaPhase === "error" && (
          <div style={{ fontSize: 12, color: "var(--bad)", marginTop: 8 }}>
            {ollamaError}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={checkOllama}>Retry</button>
          </div>
        )}
      </div>

      {/* ── Model section (shown once Ollama is ready) ──────────────────────── */}
      {(ollamaPhase === "ready") && (
        <div className="card fade-up" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: modelPhase === "done" ? 0 : 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--ink)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <Icon name="package" size={18} />
              <div style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: `${modelPct}%`, background: "var(--accent)", transition: "width 0.3s" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{model.tier} · Gemma 4</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{model.model} · {model.size}</div>
              {modelAttempt > 1 && modelPhase !== "done" && (
                <div style={{ fontSize: 10, color: "var(--warn)" }}>Attempt {modelAttempt} of {MAX_RETRIES}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              {(modelPhase === "pulling" || modelPhase === "retrying") && (
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, color: "var(--accent)" }}>
                  {modelPct}<span style={{ fontSize: 13, color: "var(--ink-3)" }}>%</span>
                </div>
              )}
              {modelPhase === "done" && <span className="chip chip-good">Ready</span>}
              {modelPhase === "checking" && <span className="chip"><span className="dot pulse-dot" /> Checking</span>}
              {modelPhase === "verifying" && <span className="chip chip-info"><span className="dot pulse-dot" /> Verifying</span>}
              {modelPhase === "error" && <span className="chip chip-bad">Error</span>}
            </div>
          </div>

          {(modelPhase === "pulling" || modelPhase === "retrying") && (
            <>
              <ProgressBar value={modelPct} accent />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
                <span className="mono" style={{ color: "var(--ink-3)" }}>{doneGB} / {totalGB} GB</span>
                <span className="mono" style={{ color: "var(--ink-3)" }}>{modelSpeedMBs != null ? `${modelSpeedMBs} MB/s` : "—"}</span>
                <span className="mono" style={{ color: "var(--ink-2)", fontWeight: 500 }}>{eta}</span>
              </div>
              <div className="mono" style={{ marginTop: 10, fontSize: 10, color: modelPhase === "retrying" ? "var(--warn)" : "var(--ink-3)" }}>
                {modelStatusLine}
                {modelPhase === "retrying" && modelRetryCountdown > 0 && ` (${modelRetryCountdown}s)`}
              </div>
            </>
          )}

          {modelPhase === "error" && (
            <div style={{ fontSize: 12, color: "var(--bad)", lineHeight: 1.5 }}>
              <strong>Download failed:</strong> {modelError}
              <div><button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => pullModel(1)}>
                <Icon name="refresh" size={12} /> Retry
              </button></div>
            </div>
          )}

          {modelPhase === "done" && (
            <div style={{ fontSize: 12, color: "var(--good)", fontWeight: 500 }}>Model is cached and verified — ready to run.</div>
          )}
        </div>
      )}

      {modelPhase === "idle" && ollamaPhase !== "ready" && (
        <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: 12 }}>
          Model download starts automatically once Ollama is ready.
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Icon name="info" size={12} style={{ marginTop: 2 }} />
        <span>Model is stored in <span className="mono">~/.ollama/models</span> — shared with any other Ollama app. Subsequent launches are instant.</span>
      </div>
    </InstallerShell>
  );
};
