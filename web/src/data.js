export const AGENTS = [
  {
    id: "founder", name: "Founder", icon: "rocket",
    tagline: "Brand system, voice, positioning",
    desc: "Turns loose intent into a complete brand and identity system. Walks five stages, writes 26 artifacts, persists everything to disk.",
    artifactCount: 26, runtime: "~14 min", primary: true,
  },
  {
    id: "design", name: "Design", icon: "palette",
    tagline: "Brief generation, brand QA",
    desc: "Translates a Founder kernel into design briefs and QA-scored creative work.",
    artifactCount: 18, runtime: "~9 min",
  },
  {
    id: "product", name: "Product", icon: "target",
    tagline: "Intent → UI spec → handoff",
    desc: "Converts product intent into structured UI specs and a coding handoff your IDE can consume.",
    artifactCount: 17, runtime: "~12 min",
  },
  {
    id: "engineering", name: "Engineering", icon: "code",
    tagline: "ADRs, system design, runbooks",
    desc: "Architecture decisions, system design, API specs, security review, deployment, runbook, tech-debt register.",
    artifactCount: 17, runtime: "~16 min",
  },
  {
    id: "marketing", name: "Marketing", icon: "megaphone",
    tagline: "Campaign briefs & launch plans",
    desc: "Audience profile, messaging framework, content calendar, channel strategy, SEO, competitive positioning.",
    artifactCount: 18, runtime: "~11 min",
  },
  {
    id: "trust_risk", name: "Trust / Risk", icon: "shield",
    tagline: "Threat models, controls, compliance",
    desc: "Threat model, risk register, control framework, IR plan, compliance matrix, vendor risk, audit readiness.",
    artifactCount: 17, runtime: "~13 min",
  },
  {
    id: "cio", name: "CIO", icon: "briefcase",
    tagline: "IT strategy & roadmap",
    desc: "IT strategy, technology roadmap, vendor portfolio, governance, enterprise architecture, budget allocation.",
    artifactCount: 17, runtime: "~14 min",
  },
];

export const MODELS = [
  {
    id: "light", tier: "Light", model: "gemma4:e2b",
    size: "3.1 GB", ram: "8 GB", quality: 2,
    blurb: "Laptop-class. Fastest. Quality is rough — best for first drafts and exploration.",
    // UX-2: plain-English consequence copy shown in ScreenTier and ModelView
    consequence: "Shorter, simpler output. Best for quick drafts.",
    speed: "Fast (~30 tok/s)",
  },
  {
    id: "balanced", tier: "Balanced", model: "gemma4:e4b",
    size: "5.4 GB", ram: "16 GB", quality: 3, recommended: true,
    blurb: "Best general-purpose pick. Solid output for all 7 agents on a typical modern machine.",
    consequence: "Full-length artifacts across all 7 agents. Recommended.",
    speed: "Medium (~18 tok/s)",
  },
  {
    id: "pro", tier: "Pro", model: "gemma4:26b-moe",
    size: "15.2 GB", ram: "32 GB", quality: 5,
    blurb: "Workstation-class. Highest fidelity. Slower but closest to frontier-API quality.",
    consequence: "Highest fidelity output. Takes 2–3× longer per run.",
    speed: "Slow (~6 tok/s)",
  },
];

export const STAGES = [
  { id: "intake",  label: "Intake",   desc: "Validate request, manifest inputs",          artifacts: 1  },
  { id: "extract", label: "Extract",  desc: "Pull structured context from your inputs",    artifacts: 1  },
  { id: "spec",    label: "Spec",     desc: "Generate the artifact library",               artifacts: 10 },
  { id: "execute", label: "Execute",  desc: "Build brief templates + manifest",            artifacts: 12 },
  { id: "qa",      label: "QA",       desc: "9-dimension rubric, score & gate",            artifacts: 2  },
];

export const SAMPLE_ARTIFACTS = [
  { name: "brand-system.md",               kind: "spec",    size: "12.4 KB", primary: true  },
  { name: "founder-voice-guide.md",         kind: "spec",    size: "8.7 KB"                  },
  { name: "product-positioning.md",         kind: "spec",    size: "6.1 KB"                  },
  { name: "audience-map.md",                kind: "spec",    size: "9.3 KB"                  },
  { name: "claims-and-proof-library.md",    kind: "spec",    size: "7.8 KB"                  },
  { name: "visual-style-guide.md",          kind: "spec",    size: "11.2 KB"                 },
  { name: "campaign-production-workflow.md",kind: "spec",    size: "5.4 KB"                  },
  { name: "asset-qa-checklist.md",          kind: "spec",    size: "3.9 KB"                  },
  { name: "reusable-prompt-library.md",     kind: "spec",    size: "14.6 KB"                 },
  { name: "consistency_report.json",        kind: "spec",    size: "2.1 KB"                  },
  { name: "brief-template-library/",        kind: "execute", size: "11 files", folder: true  },
  { name: "export-manifest-template.json",  kind: "execute", size: "1.4 KB"                  },
  { name: "qa_report.md",                   kind: "qa",      size: "6.8 KB"                  },
  { name: "qa_scores.json",                 kind: "qa",      size: "1.1 KB"                  },
];

export const RECENT_RUNS = [
  { id: "run-fbk7c", agent: "founder",     project: "myco-pivot",  status: "approved", score: 8.4, time: "2 hours ago", duration: "13m 48s" },
  { id: "run-9hx2v", agent: "engineering", project: "myco-pivot",  status: "approval", score: 7.1, time: "yesterday",   duration: "16m 02s" },
  { id: "run-mq5jp", agent: "founder",     project: "novella-app", status: "approved", score: 8.9, time: "3 days ago",  duration: "12m 35s" },
  { id: "run-tk0rs", agent: "design",      project: "novella-app", status: "approved", score: 8.1, time: "3 days ago",  duration: "9m 14s"  },
  { id: "run-a1nzx", agent: "marketing",   project: "novella-app", status: "running",  score: null,time: "now",         duration: "4m 02s"  },
  { id: "run-dq38e", agent: "trust_risk",  project: "atlas-api",   status: "rejected", score: 6.2, time: "1 week ago",  duration: "11m 28s" },
];

export const PROJECTS = [
  { slug: "myco-pivot",  name: "Myco Pivot", agents: 4, runs: 11, lastTouch: "2 hours ago", artifacts: 81  },
  { slug: "novella-app", name: "Novella",    agents: 5, runs: 14, lastTouch: "3 days ago",  artifacts: 96  },
  { slug: "atlas-api",   name: "Atlas API",  agents: 3, runs: 7,  lastTouch: "1 week ago",  artifacts: 47  },
];

export const QA_DIMENSIONS = [
  { name: "Specificity",          score: 9.1 },
  { name: "Voice consistency",    score: 8.6 },
  { name: "Audience fit",         score: 8.4 },
  { name: "Evidence",             score: 7.9 },
  { name: "Internal consistency", score: 8.8 },
  { name: "Reusability",          score: 8.2 },
  { name: "Actionability",        score: 7.6 },
  { name: "Originality",          score: 7.4 },
  { name: "Coverage",             score: 8.5 },
];
