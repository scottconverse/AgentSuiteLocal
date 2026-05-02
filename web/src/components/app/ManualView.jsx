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
          { title: "Dashboard",     desc: "Overview of all projects, recent runs, and any runs waiting on your approval. If a run is waiting, the Review button appears at the top — that's your primary action." },
          { title: "Agents",        desc: "The seven specialist agents. Click one to start a new run. Run Founder first — its kernel feeds every downstream agent. The “What’s a kernel?” button opens this manual." },
          { title: "New Run",       desc: "Set your goal (one sentence), project slug, and optional inputs folder (a path to markdown notes or brand docs). Hit Start run — the pipeline starts immediately in the background." },
          { title: "Live Run",      desc: "Watches the five-stage pipeline in real time via SSE. The stage timeline tracks progress; the live output pane streams token output as it happens. Closing this view does not stop the run." },
          { title: "Approval Gate", desc: "Three-pane view: file tree on the left, artifact preview in the center, QA scores on the right. Review each artifact, then Approve & promote to push everything to the kernel — or Reject to discard. Reject requires two clicks." },
          { title: "Kernel",        desc: "All approved artifacts organized by project and agent. These are loaded into every future run as canonical context. Use the Reveal path button to find them on disk — they're plain markdown files, version-control them." },
          { title: "Pipelines",     desc: "Chain agents end-to-end. Each step's output feeds the next. Use for a full launch sequence: Founder → Design → Marketing → Engineering. Each step pauses at an approval gate before advancing." },
          { title: "Settings",      desc: "Swap the model tier, enable/disable individual agents, toggle \"open browser on launch\", and set an Anthropic API key for cloud fallback. The API key field requires an explicit Save click — navigate-away does not auto-save it." },
          { title: "Runs",          desc: "Full run history. Waiting runs are highlighted — click any waiting row to open its Approval Gate. Error rows show a Re-run button. The list auto-refreshes every 10 seconds while any run is active." },
        ].map(s => (
          <div key={s.title} style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{s.desc}</div>
          </div>
        ))}

        <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 28, marginBottom: 10 }}>Common questions</h3>
        {[
          { q: "What's the kernel?", a: "The kernel is the folder of approved artifacts at ~/AgentSuite/.agentsuite/_kernel/. Every future run reads it as canonical context — so the more you approve, the more informed each run becomes. Think of it as your AI's long-term memory." },
          { q: "Why did my run get a score below 7.0?", a: "The QA stage scores output on 9 dimensions (accuracy, completeness, brand fit, etc.) and flags runs below 7.0 as needing improvement. The most common cause is an under-specified goal. Try re-running with a more focused, concrete one-sentence goal." },
          { q: "Can I edit the artifacts before approving?", a: "Yes — find them at ~/AgentSuite/.agentsuite/runs/{run-id}/ and edit them directly on disk. The approval gate re-reads the files on load, so edits made before approving are what gets promoted." },
          { q: "What happens if I reject a run?", a: "The run is marked rejected and its artifacts stay in the run folder but are never promoted to the kernel. You can start a new run at any time." },
          { q: "Can I run without Ollama?", a: "Only if you provide an Anthropic API key in Settings. Without a key or Ollama, runs fail at the LLM call with an actionable error message." },
        ].map(s => (
          <div key={s.q} style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.q}</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{s.a}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
