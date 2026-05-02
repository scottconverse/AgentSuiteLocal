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
  { id: "installer", label: "First launch — the installer" },
  { id: "screens", label: "Main app — screen by screen" },
  { id: "kernel", label: "The kernel" },
  { id: "tips", label: "Tips" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "faq", label: "Common questions" },
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
      <Section id="installer" title="First launch — the installer">
        <p style={bodyText}>The installer runs once. It walks 11 short steps.</p>
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
              ["3", "Checking your hardware", "The app probes your CPU, RAM, and disk. Wait for the results."],
              ["4", "Pick a model", "Choose a model tier based on your hardware. Balanced (16 GB RAM, gemma4:e4b) works for most people."],
              ["5", "Ollama runtime", "Confirms Ollama is running and the model is available. If this step hangs, open a terminal and run ollama serve."],
              ["6", "Downloading model", "Pulls the model if it's not already local. Takes a few minutes depending on connection speed."],
              ["7", "Setting up the runtime", "Confirms Python environment."],
              ["8", "Pick your agents", "Select which agents to enable. All seven are on by default."],
              ["9", "Cloud fallback (optional)", "Paste an Anthropic API key if you want cloud fallback for difficult prompts. This is optional — the app runs fully local without it."],
              ["10", "First-run smoke test", "Runs a quick end-to-end check against your local model."],
              ["11", "You're set up", "Click Launch AgentSuiteLocal to open the main app."],
            ].map(([step, screen, desc]) => (
              <tr key={step}>
                <td style={{ ...tdStyle, color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{step}</td>
                <td style={tdBold}>{screen}</td>
                <td style={tdStyle}>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={bodyText}>After launch, the installer doesn&#x2019;t appear again unless you reinstall.</p>
      </Section>

      <div style={divider} />

      {/* ── Screen guide ── */}
      <Section id="screens" title="Main app — screen by screen">

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
      <Section id="kernel" title="The kernel — what it is and why it matters">
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

      {/* ── Tips ── */}
      <Section id="tips" title="Tips">
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
      <Section id="troubleshooting" title="Troubleshooting">

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
          Completed runs survive restarts — they&#x2019;re stored at <span style={code}>~/.agentsuitelocal/runs.json</span>. If a run was actively running when the app closed, it will show as errored on restart, but the artifacts written so far remain on disk under <span style={code}>~/AgentSuite/.agentsuite/runs/{"{run-id}"}/</span>.
        </TroubleEntry>

      </Section>

      <div style={divider} />

      {/* ── FAQ ── */}
      <Section id="faq" title="Common questions">
        {[
          {
            q: "What's the kernel?",
            a: "The kernel is the folder of approved artifacts at ~/AgentSuite/.agentsuite/_kernel/. Every future run reads it as canonical context — so the more you approve, the more informed each run becomes. Think of it as your AI's long-term memory.",
          },
          {
            q: "Why did my run get a score below 7.0?",
            a: "The QA stage scores output on 9 dimensions (accuracy, completeness, brand fit, etc.) and flags runs below 7.0 as needing improvement. The most common cause is an under-specified goal. Try re-running with a more focused, concrete one-sentence goal.",
          },
          {
            q: "The Approval Gate won't let me click Approve — it's grayed out.",
            a: "The Approve button unlocks only when the composite QA score is 7.0 or above. Re-run with a more specific goal to raise the score.",
          },
          {
            q: "Can I run without Ollama?",
            a: "Only if you provide an Anthropic API key in Settings. Without a key or Ollama, runs fail at the LLM call with an actionable error message.",
          },
          {
            q: "Can I edit the artifacts before approving?",
            a: "Yes — find them at ~/AgentSuite/.agentsuite/runs/{run-id}/ and edit them directly on disk. The approval gate re-reads the files on load, so edits made before approving are what gets promoted.",
          },
          {
            q: "What happens if I reject a run?",
            a: "The run is marked rejected and its artifacts stay in the run folder but are never promoted to the kernel. You can start a new run at any time.",
          },
          {
            q: "How do I update to a new version?",
            a: "Download the new release from the Releases page on GitHub, unzip, and replace your existing app folder with the new one. Your workspace (runs, kernel, settings) is stored separately at ~/AgentSuite/ and ~/.agentsuitelocal/ — it will not be overwritten.",
          },
        ].map((item) => (
          <QA key={item.q} q={item.q} a={item.a} />
        ))}
      </Section>

    </div>
  </div>
);
