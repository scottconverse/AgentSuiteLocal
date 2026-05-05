import React, { useState } from "react";
import { TopBar } from "../shell/index.jsx";

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const sectionHeader = {
  fontSize: 20,
  fontWeight: 600,
  marginTop: 32,
  marginBottom: 12,
  color: "var(--ink)",
};

const subHeader = {
  fontSize: 15,
  fontWeight: 600,
  marginTop: 24,
  marginBottom: 6,
  color: "var(--ink)",
};

const bodyText = {
  fontSize: 13,
  color: "var(--ink-2)",
  lineHeight: 1.65,
  marginBottom: 10,
};

const code = {
  fontFamily: "var(--font-mono)",
  background: "var(--bg-tint)",
  padding: "1px 6px",
  borderRadius: 4,
  fontSize: 12,
};

const divider = {
  borderTop: "1px solid var(--line)",
  marginTop: 24,
  marginBottom: 24,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
  marginBottom: 16,
};

const thStyle = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--line)",
  color: "var(--ink-3)",
  fontSize: 12,
  fontWeight: 600,
};

const tdStyle = {
  padding: "8px 10px",
  borderBottom: "1px solid var(--line)",
  color: "var(--ink-2)",
  verticalAlign: "top",
};

const tdBold = { ...tdStyle, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const Section = ({ id, title, children }) => (
  <div id={id}>
    <h2 style={sectionHeader}>{title}</h2>
    {children}
  </div>
);

const QA = ({ q, a }) => (
  <div style={{ paddingTop: 12, borderTop: "1px solid var(--line)", marginTop: 12 }}>
    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--ink)" }}>{q}</div>
    <div style={bodyText}>{a}</div>
  </div>
);

const TroubleEntry = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--ink)" }}>{title}</div>
    <div style={bodyText}>{children}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

const TOC_ENTRIES = [
  { id: "mental-model", label: "30-second mental model" },
  { id: "installer", label: "1. Installation walkthrough" },
  { id: "first-run", label: "2. First run" },
  { id: "agents", label: "3. Agent reference" },
  { id: "live-view", label: "4. The live view" },
  { id: "kernel", label: "5. The kernel" },
  { id: "pipelines", label: "6. Pipelines" },
  { id: "models", label: "7. Model management" },
  { id: "settings", label: "8. Settings reference" },
  { id: "troubleshooting", label: "9. Troubleshooting" },
  { id: "faq", label: "10. FAQ" },
];

const TableOfContents = ({ activeId }) => (
  <div
    style={{
      background: "var(--bg-tint)",
      border: "1px solid var(--line)",
      borderRadius: 8,
      padding: "14px 16px",
      marginBottom: 24,
    }}
  >
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", color: "var(--ink-3)", marginBottom: 8, textTransform: "uppercase" }}>
      Contents
    </div>
    {TOC_ENTRIES.map((e) => (
      <a
        key={e.id}
        href={`#${e.id}`}
        style={{
          display: "block",
          fontSize: 13,
          color: activeId === e.id ? "var(--accent)" : "var(--ink-2)",
          textDecoration: "none",
          padding: "3px 0",
          borderLeft: activeId === e.id ? "2px solid var(--accent)" : "2px solid transparent",
          paddingLeft: 8,
          marginLeft: -8,
        }}
      >
        {e.label}
      </a>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ManualView = () => (
  <div style={{ flex: 1, overflow: "auto" }}>
    <TopBar title="User manual" subtitle="What every screen does, in plain language" />
    <div style={{ padding: "24px 24px 48px", maxWidth: 760, margin: "0 auto" }}>

      <TableOfContents />

      {/* ── 30-second mental model ── */}
      <Section id="mental-model" title="The 30-second mental model">
        <p style={bodyText}>
          You give an agent a goal in one sentence. It walks five stages:{" "}
          <strong>intake → extract → spec → execute → QA</strong>. It writes a folder of markdown
          artifacts to your disk. You review them. If you approve, those artifacts get promoted into
          the <span style={code}>_kernel/</span> folder and become canonical context for every
          future run on that project.
        </p>
        <p style={bodyText}>
          That&#x2019;s it. Everything else is a UI on top of <em>that</em> loop.
        </p>
      </Section>

      <div style={divider} />

      {/* ── Installer ── */}
      <Section id="installer" title="1. Installation walkthrough">
        <p style={bodyText}>The installer runs once. It walks <strong>6 short steps</strong>. After launch, it doesn&apos;t appear again unless you reinstall.</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Step</th>
              <th style={thStyle}>Screen</th>
              <th style={thStyle}>What happens</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["1", "Welcome", "Intro screen. Click Get started."],
              ["2", "License & privacy", "Read the license. Check the box. Click I agree."],
              ["3", "Hardware & model tier", "The app probes your CPU, RAM, and disk and recommends a tier (Light / Balanced / Pro). Pick one — Balanced (16 GB RAM, gemma4:e4b) works for most people."],
              ["4", "Ollama & model download", "Confirms Ollama is running, then pulls the model for the tier you chose. The pull includes a 3-attempt retry loop with backoff. If Ollama isn't running yet, click Install Ollama and the screen will unlock automatically."],
              ["5", "Smoke test", "Runs five quick checks: Ollama daemon up, model loaded, /api/generate responding, real inference round-trip through the Python kernel, and workspace writable. Each shows a green tick or a fix card."],
              ["6", "You're set up", "Click Launch AgentSuiteLocal to open the main app."],
            ].map(([step, screen, desc]) => (
              <tr key={step}>
                <td style={{ ...tdStyle, color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{step}</td>
                <td style={tdBold}>{screen}</td>
                <td style={tdStyle}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>Agent selection, cloud fallback API key, and Python runtime checks moved to <strong>Settings</strong> in v0.7.1 — open Settings in the sidebar to configure them.</p>
      </Section>

      <div style={divider} />

      {/* ── Screen guide ── */}
      <Section id="first-run" title="2. First run — from Dashboard to approved artifact">
        <p style={bodyText}><strong>Step 1: Open the app.</strong> You&apos;ll see the Dashboard with an engine status card and a &ldquo;Start a new run&rdquo; prompt.</p>
        <p style={bodyText}><strong>Step 2: Click New run</strong> (or click an agent card in the Agents view). The New Run screen appears.</p>
        <p style={bodyText}><strong>Step 3: Fill in three fields:</strong></p>
        <ul style={{ ...bodyText, paddingLeft: 20 }}>
          <li style={{ marginBottom: 4 }}><strong>Business goal</strong> — one sentence. &ldquo;Launch X for Y in Z&rdquo; works well.</li>
          <li style={{ marginBottom: 4 }}><strong>Project slug</strong> — a short identifier like <span style={code}>my-product-v2</span>. All runs for the same product should share a slug.</li>
          <li style={{ marginBottom: 4 }}><strong>Inputs folder</strong> — optional. Drop your notes, brand docs, or research here.</li>
        </ul>
        <p style={bodyText}><strong>Step 4: Click Start run.</strong> The view switches to the Live Run screen.</p>
        <p style={bodyText}><strong>Step 5: Wait.</strong> The pipeline runs five stages. 9–16 minutes on typical hardware.</p>
        <p style={bodyText}><strong>Step 6: Review.</strong> The Approval Gate opens automatically when QA completes.</p>
        <p style={bodyText}><strong>Step 7: Read the artifacts.</strong> The file tree lists every artifact. Click any file to preview it. QA scores appear in the right panel.</p>
        <p style={bodyText}><strong>Step 8: Approve or reject.</strong> Score ≥ 7.0 enables Approve. Click it to promote artifacts to your kernel. Click Reject to discard and run again with a better goal.</p>
      </Section>

      <div style={divider} />

      {/* ── Agent reference ── */}
      <Section id="agents" title="3. Agent reference">
        <table style={tableStyle}>
          <thead><tr><th style={thStyle}>Agent</th><th style={thStyle}>What it produces</th><th style={thStyle}>Artifacts</th><th style={thStyle}>~Time</th></tr></thead>
          <tbody>
            {[
              ["Founder", "Brand system, voice, positioning", "26", "14 min"],
              ["Design", "Design briefs, brand QA", "18", "9 min"],
              ["Product", "UI specs, handoff docs", "17", "12 min"],
              ["Engineering", "ADRs, system design, runbooks", "17", "16 min"],
              ["Marketing", "Campaign briefs, launch plans", "18", "11 min"],
              ["Trust / Risk", "Threat models, controls, compliance", "17", "13 min"],
              ["CIO", "IT strategy, roadmap", "17", "14 min"],
            ].map(([a, p, n, t]) => (
              <tr key={a}><td style={tdBold}>{a}</td><td style={tdStyle}>{p}</td><td style={tdStyle}>{n}</td><td style={tdStyle}>{t}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>Run <strong>Founder first</strong>. Its output becomes the kernel context that Design, Marketing, and other agents inherit.</p>
      </Section>

      <div style={divider} />

      {/* ── Live view ── */}
      <Section id="live-view" title="4. The live view">
        <p style={bodyText}>The live view shows five stages. Each lights up as it starts and shows a checkmark when complete:</p>
        <table style={tableStyle}>
          <thead><tr><th style={thStyle}>Stage</th><th style={thStyle}>What it does</th></tr></thead>
          <tbody>
            {[
              ["Intake", "Validates the request, manifests inputs"],
              ["Extract", "Pulls structured context from your inputs folder"],
              ["Spec", "Generates the core artifact library (~10 files)"],
              ["Execute", "Builds brief templates and the export manifest"],
              ["QA", "Runs a 9-dimension rubric and produces a score"],
            ].map(([s, d]) => (
              <tr key={s}><td style={tdBold}>{s}</td><td style={tdStyle}>{d}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>The stage timer resets with each stage: &ldquo;Stage: Extraction · 1m 24s&rdquo;. The top bar shows total elapsed time. If a stage runs longer than 10 minutes without completing, check Ollama status in Settings.</p>
        <p style={bodyText}><strong>QA dimensions:</strong> Clarity · Completeness · Coherence · Specificity · Brand alignment · Feasibility · Differentiation · Depth · Actionability. Each scored 0–10. Default gate: 7.0 (configurable in Settings).</p>
        <p style={bodyText}>If fewer than 9 dimensions appear, an amber notice explains: &ldquo;Partial QA scores — the model returned N of 9 dimensions.&rdquo; Common on smaller models. The composite is calculated from what was returned.</p>
      </Section>

      <div style={divider} />

      {/* ── Screens (condensed for 5–10 less-detailed screens) ── */}
      <Section id="screens" title="Main app — screen by screen (overview)">

        <h3 style={subHeader}>Dashboard</h3>
        <p style={bodyText}>The default view. Shows:</p>
        <ul style={{ ...bodyText, paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 4 }}><strong>Pending approval</strong> — any run that&#x2019;s finished and is waiting for your review. This is the thing you should look at first when you open the app.</li>
          <li style={{ marginBottom: 4 }}><strong>Recent runs</strong> — the last few runs across all projects, with status and QA score.</li>
          <li style={{ marginBottom: 4 }}><strong>Projects</strong> — a summary of your workspaces.</li>
          <li style={{ marginBottom: 4 }}><strong>Engine status</strong> — which model is loaded and its current speed.</li>
        </ul>
        <p style={bodyText}>If there&#x2019;s a run waiting on approval, there&#x2019;s a &#x201C;Review run&#x201D; button at the top of the hero card. Click it to go straight to the Approval Gate.</p>

        <h3 style={subHeader}>Agents</h3>
        <p style={bodyText}>The seven specialist agents:</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Agent</th>
              <th style={thStyle}>What it writes</th>
              <th style={thStyle}>Artifacts</th>
              <th style={thStyle}>~Time</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Founder", "Brand system, voice, positioning", "26", "14 min"],
              ["Design", "Design briefs, brand QA", "18", "9 min"],
              ["Product", "UI specs, handoff docs", "17", "12 min"],
              ["Engineering", "ADRs, system design, runbooks", "17", "16 min"],
              ["Marketing", "Campaign briefs, launch plans", "18", "11 min"],
              ["Trust / Risk", "Threat models, controls, compliance", "17", "13 min"],
              ["CIO", "IT strategy, roadmap", "17", "14 min"],
            ].map(([agent, what, artifacts, time]) => (
              <tr key={agent}>
                <td style={tdBold}>{agent}</td>
                <td style={tdStyle}>{what}</td>
                <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 12 }}>{artifacts}</td>
                <td style={{ ...tdStyle, fontFamily: "var(--font-mono)", fontSize: 12 }}>{time}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>Click an agent card to start a new run with that agent. Run <strong>Founder</strong> first — its output becomes the kernel context other agents inherit.</p>

        <h3 style={subHeader}>New Run</h3>
        <p style={bodyText}>Fill in three fields:</p>
        <ul style={{ ...bodyText, paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 4 }}><strong>Business goal</strong> — one sentence. &#x201C;Launch X for Y in Z&#x201D; works well.</li>
          <li style={{ marginBottom: 4 }}><strong>Project slug</strong> — a short identifier like <span style={code}>my-product-v2</span>. All runs for the same product should share a slug.</li>
          <li style={{ marginBottom: 4 }}><strong>Inputs folder</strong> — a folder of notes, brand documents, or markdown files. Leave blank if you don&#x2019;t have any.</li>
        </ul>
        <p style={bodyText}>Click <strong>Start run</strong>. The view switches to the Live Run screen automatically.</p>

        <h3 style={subHeader}>Live Run</h3>
        <p style={bodyText}>Watches the pipeline in real time. Five stages:</p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Stage</th>
              <th style={thStyle}>What it does</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Intake", "Validates the request, manifests inputs"],
              ["Extract", "Pulls structured context from your inputs folder"],
              ["Spec", "Generates the core artifact library (~10 files)"],
              ["Execute", "Builds brief templates and the export manifest"],
              ["QA", "Runs a 9-dimension rubric and produces a score"],
            ].map(([stage, desc]) => (
              <tr key={stage}>
                <td style={tdBold}>{stage}</td>
                <td style={tdStyle}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>The run can take 9&#x2013;16 minutes. Closing this view does not stop the pipeline — it runs in the background. When the pipeline finishes, the view transitions to the Approval Gate automatically.</p>

        <h3 style={subHeader}>Approval Gate</h3>
        <p style={bodyText}>Three-pane view:</p>
        <ul style={{ ...bodyText, paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 4 }}><strong>Left — File tree.</strong> All artifacts from the run. Click any file to preview it.</li>
          <li style={{ marginBottom: 4 }}><strong>Center — Artifact preview.</strong> Markdown rendered inline.</li>
          <li style={{ marginBottom: 4 }}><strong>Right — QA scores.</strong> Nine dimensions scored 0&#x2013;10. The composite score must exceed 7.0 to unlock Approve.</li>
        </ul>
        <p style={bodyText}><strong>Approve &amp; promote</strong> — copies every artifact to <span style={code}>~/AgentSuite/.agentsuite/_kernel/{"{project}/{agent}"}/</span>. This becomes canonical context for every future run on this project.</p>
        <p style={bodyText}><strong>Reject</strong> — marks the run rejected. Artifacts stay on disk under <span style={code}>runs/</span> but are not promoted. Re-run with a better goal if needed.</p>

        <h3 style={subHeader}>Runs</h3>
        <p style={bodyText}>Full run history — every run across all projects, sorted newest first. Shows status, QA score, duration, and which agent ran it. Runs waiting for approval are highlighted — click any waiting row to open its Approval Gate. Error rows show a Re-run button. The list auto-refreshes every 10 seconds while any run is active.</p>

        <h3 style={subHeader}>Kernel</h3>
        <p style={bodyText}>All approved artifacts, organized by project and agent. These are the files that feed every future run as canonical context.</p>
        <p style={bodyText}>You can&#x2019;t delete from the Kernel through the UI in v0.1 — use your file manager at <span style={code}>~/AgentSuite/.agentsuite/_kernel/</span>.</p>

        <h3 style={subHeader}>Pipelines</h3>
        <p style={bodyText}>Chain agents end-to-end. Each step&#x2019;s output feeds the next. Use for a full launch sequence: Founder &#x2192; Design &#x2192; Marketing &#x2192; Engineering. Each step pauses at an approval gate before advancing.</p>

        <h3 style={subHeader}>Settings</h3>
        <ul style={{ ...bodyText, paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 4 }}><strong>Model</strong> — switch between Light / Balanced / Pro tiers.</li>
          <li style={{ marginBottom: 4 }}><strong>Agents</strong> — enable or disable individual agents.</li>
          <li style={{ marginBottom: 4 }}><strong>Auto-approve</strong> — skip the Approval Gate and promote artifacts automatically. Turn it off for anything you&#x2019;ll act on.</li>
          <li style={{ marginBottom: 4 }}><strong>Workspace path</strong> — where runs and the kernel are stored. Defaults to <span style={code}>~/AgentSuite/</span>.</li>
          <li style={{ marginBottom: 4 }}><strong>Cloud fallback</strong> — add or update your Anthropic API key. The API key field requires an explicit Save click.</li>
        </ul>
      </Section>

      <div style={divider} />

      {/* ── Kernel ── */}
      <Section id="kernel" title="5. The kernel — what it is and how to use it">
        <p style={bodyText}>
          The kernel is a folder of approved artifacts at{" "}
          <span style={code}>~/AgentSuite/.agentsuite/_kernel/</span>. Every run loads the kernel
          for its project as context before starting. This means:
        </p>
        <ul style={{ ...bodyText, paddingLeft: 20, marginBottom: 12 }}>
          <li style={{ marginBottom: 4 }}>The second Founder run knows what the first one decided.</li>
          <li style={{ marginBottom: 4 }}>The Design agent inherits the brand system the Founder wrote.</li>
          <li style={{ marginBottom: 4 }}>The Engineering agent knows the product the Product agent specced.</li>
        </ul>
        <p style={bodyText}>
          Without the kernel, each run starts from scratch. With the kernel, each run builds on approved prior work.
        </p>
        <p style={bodyText}>
          <strong>Practical advice:</strong> run Founder first, review carefully, approve the best
          outputs. Then run Design. Then Product. Build the kernel deliberately — it&#x2019;s the durable
          output of the system.
        </p>
        <p style={bodyText}>
          Kernel files are plain markdown. Edit them in any text editor, commit them to git, or run
          them through your own toolchain. The app reads whatever is on disk at run time.
        </p>
      </Section>

      <div style={divider} />

      {/* ── Pipelines ── */}
      <Section id="pipelines" title="6. Pipelines">
        <p style={bodyText}>Pipelines chain multiple agents end-to-end. The output of each agent is passed as context to the next.</p>
        <p style={bodyText}><strong>Creating a pipeline:</strong> In the Pipelines view, select the agents you want to chain and set the order. Typical sequence: Founder → Design → Product → Engineering.</p>
        <p style={bodyText}><strong>Running a pipeline:</strong> Each step pauses at an approval gate before advancing. Approve a step to run the next agent. Enable <em>Auto-approve</em> in Settings to skip the gates.</p>
        <p style={bodyText}><strong>Resuming after error:</strong> If a pipeline step fails, click <strong>Resume from step N</strong> in the Pipelines view to restart from the failed step without re-running earlier steps.</p>
      </Section>

      <div style={divider} />

      {/* ── Model management ── */}
      <Section id="models" title="7. Model management">
        <p style={bodyText}>Open <strong>Settings → Models</strong> (or click <strong>Models</strong> in the sidebar) to manage your local models.</p>
        <p style={bodyText}><strong>Installed models</strong> lists all models Ollama has pulled, with size and last-used date. Use <strong>Set as active</strong> to switch the active model. Use <strong>Delete</strong> (with confirmation) to remove a model from disk.</p>
        <p style={bodyText}><strong>Recommended models:</strong></p>
        <table style={tableStyle}>
          <thead><tr><th style={thStyle}>Tier</th><th style={thStyle}>Model</th><th style={thStyle}>Disk</th><th style={thStyle}>Min RAM</th></tr></thead>
          <tbody>
            {[
              ["Light",    "gemma4:e2b",     "~2 GB",  "8 GB"],
              ["Balanced", "gemma4:e4b",     "~5 GB",  "16 GB"],
              ["Pro",      "gemma4:26b-moe", "~16 GB", "32 GB"],
            ].map(([t, m, d, r]) => (
              <tr key={t}><td style={tdBold}>{t}</td><td style={tdStyle}><span style={code}>{m}</span></td><td style={tdStyle}>{d}</td><td style={tdStyle}>{r}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>Click <strong>Pull</strong> next to any recommended model to download it. A live progress bar shows download progress streamed directly from Ollama.</p>
      </Section>

      <div style={divider} />

      {/* ── Settings reference ── */}
      <Section id="settings" title="8. Settings reference">
        <table style={tableStyle}>
          <thead><tr><th style={thStyle}>Setting</th><th style={thStyle}>Default</th><th style={thStyle}>Description</th></tr></thead>
          <tbody>
            {[
              ["Model tier", "balanced", "Which tier to use for all runs"],
              ["Run timeout", "15 min", "Max time before a run is killed with an error"],
              ["Auto-approve", "off", "Skip the Approval Gate and promote artifacts automatically"],
              ["QA gate threshold", "7.0", "Minimum composite QA score to enable the Approve button"],
              ["Workspace path", "~/AgentSuite", "Where runs and the kernel are stored"],
              ["Desktop notifications", "on", "OS toast when a run reaches a terminal state"],
              ["Telemetry", "off", "Local-only JSONL log of app events"],
            ].map(([s, d, desc]) => (
              <tr key={s}><td style={tdBold}>{s}</td><td style={tdStyle}>{d}</td><td style={tdStyle}>{desc}</td></tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}><strong>Cloud fallback:</strong> when an Anthropic API key is present, a model dropdown appears. Selecting a cloud model routes all future runs through the Anthropic API. A permanent warning reads: &ldquo;Cloud runs send your goal and context to Anthropic&apos;s servers and incur API costs. Local runs are always free.&rdquo;</p>
        <p style={bodyText}><strong>Uninstall:</strong> Settings → Danger zone → <strong>Uninstall AgentSuiteLocal</strong> opens a three-step flow: confirm workspace deletion, confirm Ollama model deletion, then calls the system uninstaller.</p>
      </Section>

      <div style={divider} />

      {/* ── Tips ── */}
      <Section id="tips" title="Tips (quick reference)">
        {[
          {
            title: "Goal quality matters more than anything else.",
            body: "“Launch my app” produces generic output. “Launch a B2B SaaS subscription tool for independent music teachers targeting 18–40 year olds in North America, positioning on ease of use vs. Studio Manager” produces specific, useful output. Invest 5 minutes in the goal sentence — it pays back across every artifact the agent writes.",
          },
          {
            title: "Use the inputs folder.",
            body: "Drop in any markdown notes, prior brand documents, or research you have. The Extract stage pulls structured facts from them. The more real context you give, the more specific the output.",
          },
          {
            title: "QA score of 7.0 is the floor, not the target.",
            body: "8.0+ runs are worth promoting. 7.1 runs might be worth a re-run with a sharper goal. Scores below 7.0 are usually a signal that the goal was too vague.",
          },
          {
            title: "Reject liberally in the early runs.",
            body: "Until you have a solid Founder kernel, downstream agents are working blind. It’s faster to re-run Founder once with a better goal than to promote weak context and have every downstream agent inherit it.",
          },
          {
            title: "You can edit artifacts before approving.",
            body: "Find them at ~/AgentSuite/.agentsuite/runs/{run-id}/ and edit them directly on disk. The approval gate re-reads the files on load, so edits made before approving are what gets promoted.",
          },
        ].map((tip) => (
          <div key={tip.title} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--ink)" }}>{tip.title}</div>
            <div style={bodyText}>{tip.body}</div>
          </div>
        ))}
      </Section>

      <div style={divider} />

      {/* ── Troubleshooting ── */}
      <Section id="troubleshooting" title="9. Troubleshooting">

        <TroubleEntry title="The installer is stuck on 'Ollama runtime' and Continue never lights up">
          The AI engine isn&#x2019;t running yet. Look for an Ollama icon in your system tray (Windows) — it looks like a small llama. If you don&#x2019;t see it, open the Ollama app and wait for it to appear. Once the icon is visible, go back to the installer and it should unlock within a few seconds.
          <br /><br />
          If you haven&#x2019;t installed Ollama yet, go to{" "}
          <a href="https://ollama.ai" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            ollama.ai
          </a>
          , download it, and run it. Then come back to the installer.
        </TroubleEntry>

        <TroubleEntry title="A run starts but immediately shows an error">
          The most reliable fix is to quit the app and run the installer again from the beginning. If it fails at the same step twice,{" "}
          <a href="https://github.com/scottconverse/AgentSuiteLocal/issues" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            open an issue
          </a>{" "}
          and paste the error message — that&#x2019;s enough to diagnose it.
          <div style={{ ...bodyText, background: "var(--bg-tint)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <strong>Note:</strong> The installer smoke test catches most setup problems, but not all of them. Phase 2 will surface these errors inside the app rather than as raw error messages.
          </div>
        </TroubleEntry>

        <TroubleEntry title="The run is working but feels very slow">
          Go to <strong>Settings &#x2192; Model</strong> and switch to the <strong>Light</strong> option. Light uses less memory and runs faster on most machines. The output is a bit rougher but still useful for first drafts.
        </TroubleEntry>

        <TroubleEntry title="The artifacts look cut off or are much shorter than expected">
          Go to <strong>Settings &#x2192; Model</strong> and try <strong>Balanced</strong> or <strong>Pro</strong>. Light-tier models have a smaller working memory — on long runs they can lose context mid-output. Balanced handles the full pipeline reliably on most 16 GB machines.
        </TroubleEntry>

        <TroubleEntry title="I can't find where the files were saved">
          Open <strong>Settings</strong>, then click the folder icon next to the workspace path. That opens your AgentSuite folder in File Explorer (Windows). Your run files are inside the <span style={code}>runs</span> folder; anything you&#x2019;ve approved lives in <span style={code}>_kernel</span>.
        </TroubleEntry>

        <TroubleEntry title="My run disappeared after I restarted the app">
          Completed runs survive restarts — they&apos;re stored at <span style={code}>~/.agentsuitelocal/runs.json</span>. If a run was actively running when the app closed, it will show as errored on restart with message &ldquo;AgentSuiteLocal restarted while this run was in progress.&rdquo; The artifacts written so far remain on disk under <span style={code}>~/AgentSuite/.agentsuite/runs/{"{run-id}"}/</span>. Use the Retry button to restart.
        </TroubleEntry>

        <TroubleEntry title="Run shows 'Timed out after 15 minutes'">
          The model stopped responding mid-run. Options: (a) increase the run timeout in <strong>Settings → Run timeout</strong>, (b) switch to a lighter model tier, (c) reduce the size of your inputs folder, or (d) check that Ollama is still running — it can crash under memory pressure.
        </TroubleEntry>

        <TroubleEntry title="Approve button is grayed out despite a score above 7.0">
          Check the QA gate threshold in <strong>Settings</strong> — it may have been raised above the current score. You can also click <strong>Override &amp; approve</strong> (amber button) to bypass the threshold with a confirmation dialog.
        </TroubleEntry>

        <TroubleEntry title="'Connection lost — reconnecting' banner in the live view">
          The SSE connection to the backend dropped. The app reconnects automatically (up to 10 attempts: 1s → 2s → 4s → … → 30s cap). The run continues in the background. If reconnection fails, navigate to the Runs view to check status.
        </TroubleEntry>

        <TroubleEntry title="Desktop notifications are not appearing">
          On Windows: check Windows Settings → System → Notifications → AgentSuiteLocal. On macOS: System Settings → Notifications → AgentSuiteLocal. Also verify the <strong>Desktop notifications</strong> toggle is on in AgentSuiteLocal Settings.
        </TroubleEntry>

        <TroubleEntry title="The Retry button doesn't pre-fill the goal field">
          Runs created before v0.7.0 may not have a <span style={code}>goal</span> field saved. Fill in the goal manually when retrying. All runs created in v0.7.0 and later save the goal automatically.
        </TroubleEntry>

        <TroubleEntry title="'make build-installer' says 'iscc not found'">
          Inno Setup is not on your PATH. Install Inno Setup 6 from <a href="https://jrsoftware.org/isdl.php" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>jrsoftware.org/isdl.php</a> or run <span style={code}>choco install innosetup</span>.
        </TroubleEntry>

        <TroubleEntry title="pytest fails with import errors on a clean clone">
          Run <span style={code}>pip install -e &quot;.[dev]&quot;</span> from the repo root. This installs the package in editable mode with all dev dependencies.
        </TroubleEntry>

        <TroubleEntry title="Vite build fails with 'top-level await' error">
          Check that <span style={code}>ApprovalGateView.jsx</span> uses static imports for <span style={code}>react-markdown</span> and <span style={code}>remark-gfm</span>, not dynamic <span style={code}>await import()</span>. Dynamic imports at module scope are not supported in the configured Vite target environment.
        </TroubleEntry>

        <TroubleEntry title="Kernel view shows no entries after approving a run">
          A run must be approved before its artifacts appear in the Kernel. If the run shows &ldquo;approved&rdquo; in Runs but the Kernel is empty, check the workspace path in Settings — the kernel is stored under that path, not necessarily <span style={code}>~/AgentSuite/</span>.
        </TroubleEntry>

      </Section>

      <div style={divider} />

      {/* ── FAQ ── */}
      <Section id="faq" title="10. FAQ">
        {[
          { q: "Does any data leave my machine?", a: "No. All processing uses your local Ollama model. The only outbound calls are: an optional GitHub API request to check for updates (no payload), and cloud API calls if you configure an API key and select a cloud model. Telemetry, if enabled, writes only to a local JSONL file." },
          { q: "What's the kernel?", a: "The kernel is the folder of approved artifacts at ~/AgentSuite/.agentsuite/_kernel/. Every future run reads it as canonical context — so the more you approve, the more informed each run becomes. Think of it as your AI's long-term memory." },
          { q: "Why did my run score below 7.0?", a: "The most common cause is an under-specified goal. Try re-running with a more focused, concrete one-sentence goal. Adding an inputs folder with real brand/product notes also helps significantly. Switching to a higher model tier improves scores on the same goal." },
          { q: "The Approve button is grayed out.", a: "The Approve button unlocks only when the composite QA score meets the threshold (default 7.0). Check the threshold in Settings. Or click Override & approve (amber button) to bypass with a confirmation dialog." },
          { q: "Can I run without Ollama?", a: "Only if you provide an Anthropic API key in Settings and select a cloud model. Without a key or Ollama, runs fail at the LLM call with a clear error message." },
          { q: "Can I edit artifacts before approving?", a: "Yes — find them at ~/AgentSuite/.agentsuite/runs/{run-id}/ and edit them directly on disk. The Approval Gate re-reads files on load, so edits made before approving are what gets promoted to the kernel." },
          { q: "What happens if I reject a run?", a: "The run is marked rejected and its artifacts stay in the run folder but are not promoted to the kernel. A Retry button appears on the rejected run so you can re-run with the same setup." },
          { q: "How do I update to a new version?", a: "A non-blocking banner appears at the top of the Dashboard when a new version is available. Click Download to open the GitHub releases page and download the new installer. Run it to update — your workspace is stored separately and will not be overwritten." },
          { q: "How much disk space does it need?", a: "The installed app is ~300 MB. Models are 1.7–4.7 GB depending on tier. Each run produces ~2–5 MB of artifacts. A full kernel for one project across all seven agents is typically 15–30 MB." },
          { q: "Can I run multiple agents in parallel?", a: "Not yet. Agents run sequentially. A pipeline queues them one at a time with approval gates between steps." },
          { q: "How do I back up my kernel?", a: "Copy ~/AgentSuite/.agentsuite/_kernel/ to a safe location. It's plain markdown files — no database, no binary format." },
          { q: "Where are crash reports stored?", a: "At ~/.agentsuitelocal/crash-reports/{timestamp}.json. Each file contains: exception type, message, stack trace, app version, Python version, OS version, and the request path. No request body or user data." },
          { q: "What's the 'Stage decisions so far' panel?", a: "The K1 cross-stage context feature. After each stage completes, the app summarizes the first 500 words of the primary artifact and shows it in a collapsible panel. This is what the next stage sees as prior context." },
          { q: "Can I use a model not on the recommended list?", a: "Yes. Pull it manually with 'ollama pull model-name' in a terminal, then open Settings → Models and click Set as active next to it. Any model in your Ollama library works." },
          { q: "What Python version does it require?", a: "Python 3.11 or 3.12. The bundled executable ships its own Python runtime, so you don't need Python installed to run the distributed build. You only need Python for development." },
          { q: "Does the Retry button carry over my inputs folder?", a: "Yes. Clicking Retry pre-populates the New Run screen with the same agent, goal, project, and inputs folder from the original run. You can edit any field before launching." },
          { q: "Is there a CLI?", a: "The agentsuitelocal command is installed when you 'pip install -e .' for development. But it's the AgentSuite library's CLI, not the desktop app. For the full experience including the UI, run the desktop app." },
          { q: "How do I contribute?", a: "Read CONTRIBUTING.md. The short version: fork the repo, make changes on a feature branch, run pytest and npm run test, then open a pull request." },
          { q: "What's the difference between Reject and starting a new run?", a: "Reject marks the existing run as rejected and preserves its artifacts. Starting a new run creates a new run record. Use Reject to keep a clear record of what you tried; use a new run for a completely different approach." },
          { q: "Can I run AgentSuiteLocal on a server?", a: "It's designed for desktop use — it needs a running Ollama daemon. You could run it headless and connect remotely, but that's not a supported configuration." },
        ].map((item) => (
          <QA key={item.q} q={item.q} a={item.a} />
        ))}
      </Section>

    </div>
  </div>
);
