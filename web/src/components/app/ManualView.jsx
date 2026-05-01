import React from "react";
import { TopBar } from "../shell/index.jsx";

export const ManualView = () => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar title="User manual" subtitle="What every screen does, in plain language" />
    <div style={{ padding: 24, maxWidth: 720 }}>
      <div className="card" style={{ padding: 24 }}>
        <h2 className="display" style={{ fontSize: 24, fontWeight: 500, margin: 0, marginBottom: 12 }}>The 30-second mental model</h2>
        <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65 }}>
          You give an agent a goal in one sentence. It walks five stages: <strong>intake → extract → spec → execute → QA</strong>.
          It writes a folder of markdown artifacts to your disk. You review them. If you approve, those artifacts get promoted into the{" "}
          <span className="mono" style={{ background: "var(--bg-tint)", padding: "1px 6px", borderRadius: 4 }}>_kernel/</span> folder
          and become canonical context for every future run on that project.
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65 }}>
          That's it. Everything else is a UI on top of <em>that</em> loop.
        </p>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 10 }}>Screen guide</h3>
        {[
          { title: "Dashboard",     desc: "Overview of all projects, recent runs, and any runs waiting on your approval." },
          { title: "Agents",        desc: "The seven specialist agents. Click one to start a new run with that agent." },
          { title: "New Run",       desc: "Set your goal, project, and inputs folder. Hit Start to kick off the pipeline." },
          { title: "Live Run",      desc: "Watches the five-stage pipeline in real time. SSE streams token output as it happens." },
          { title: "Approval Gate", desc: "Three-pane view: file tree on the left, artifact preview in the center, QA scores on the right. Approve to promote to the kernel." },
          { title: "Kernel",        desc: "All approved artifacts organized by agent. These are loaded into every future run as canonical context." },
          { title: "Pipelines",     desc: "Chain agents end-to-end. Each step's output feeds the next. Use for a full launch sequence." },
          { title: "Settings",      desc: "Swap the model, enable/disable agents, toggle auto-approve, change the workspace path." },
        ].map(s => (
          <div key={s.title} style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
