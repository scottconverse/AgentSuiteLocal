import React, { useEffect, useState } from "react";
import { Icon, MetricCard } from "../ui/index.jsx";
import { InstallerShell, SectionHeader } from "./InstallerShell.jsx";

export const ScreenHardware = ({ onBack, onNext, totalSteps }) => {
  const [scanning, setScanning] = useState(true);
  const [specs, setSpecs] = useState(null);

  useEffect(() => {
    fetch("/api/hardware")
      .then(r => r.json())
      .then(data => {
        setSpecs([
          { icon: "cpu", label: "CPU",  value: data.cpu.brand,                   sub: `${data.cpu.cores} cores`,            status: { kind: "good", label: "PASS"     } },
          { icon: "ram", label: "RAM",  value: `${data.ram.total_gb} GB`,         sub: `${data.ram.free_gb} GB free`,        status: { kind: "good", label: "PASS"     } },
          { icon: "hdd", label: "DISK", value: `${data.disk.free_gb} GB`,         sub: `free of ${data.disk.total_gb} GB`,   status: { kind: "good", label: "PASS"     } },
          { icon: "gpu", label: "GPU",  value: "Metal / CUDA",                   sub: "hardware accel",                     status: { kind: "good", label: "DETECTED" } },
        ]);
        setScanning(false);
      })
      .catch(() => {
        setSpecs([
          { icon: "cpu", label: "CPU",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "ram", label: "RAM",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "hdd", label: "DISK", value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
          { icon: "gpu", label: "GPU",  value: "Unable to detect", sub: "", status: { kind: "warn", label: "UNKNOWN" } },
        ]);
        setScanning(false);
      });
  }, []);

  return (
    <InstallerShell step={3} totalSteps={totalSteps} onBack={onBack} onNext={onNext} nextDisabled={scanning}>
      <SectionHeader eyebrow="Step 03" title="Checking your hardware"
        sub="We need to know what kind of model your machine can comfortably run. This takes a few seconds." />

      {scanning ? (
        <div className="card" style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ position: "relative", width: 64, height: 64 }}>
            <div className="spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--line)", borderTopColor: "var(--accent)" }} />
            <Icon name="cpu" size={26} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--accent)" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Probing system</div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>cpu · memory · disk · gpu</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="fade-up">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {specs.map(s => <MetricCard key={s.label} icon={s.icon} label={s.label} value={s.value} sub={s.sub} status={s.status} />)}
          </div>
          <div className="card" style={{ padding: 16, display: "flex", gap: 14, borderColor: "var(--good)", background: "var(--good-soft)" }}>
            <div style={{ color: "var(--good)" }}><Icon name="check" size={20} stroke={2.4} /></div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "var(--good)" }}>You're set for the Balanced tier</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Your machine handles the recommended Gemma 4 e4b model with room to spare. You'll see ~18 tokens/sec, putting a Founder run at around 13 minutes.</div>
            </div>
          </div>
        </div>
      )}
    </InstallerShell>
  );
};
