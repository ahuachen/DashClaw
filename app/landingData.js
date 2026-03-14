import {
  Zap, ShieldAlert, CircleDot, Eye, ArrowRight, Github,
  ExternalLink, BookOpen, FolderKanban, MessageSquare, ArrowLeftRight,
  Brain, ScanSearch, HeartPulse, Newspaper, Package, UsersRound,
  Webhook, Clock, Compass, Building2, Terminal, BarChart3,
  Scale, Network, FileCheck, Download, SlidersHorizontal, Radio,
  Shield,
} from 'lucide-react';
import DashClawLogo from './components/DashClawLogo';

/* ─── data ─── */

export const coreFeatures = [
  {
    icon: Zap,
    title: 'Prove Every Decision Your Agents Make',
    description: 'Every action, approval, assumption, and outcome lands in a live decision ledger so you can prove what happened, why it happened, and who authorized it.',
  },
  {
    icon: DashClawLogo,
    title: 'Enforce Policies Before Agents Act',
    description: 'Semantic guard policies intercept intent before execution. Test policies, import packs, generate proof reports, and keep governance logic out of brittle application code.',
  },
  {
    icon: BarChart3,
    title: 'Score, Calibrate, and Improve Quality',
    description: 'Built-in scorers, weighted scoring profiles, risk templates, and auto-calibration give operators a concrete quality bar instead of vibes and one-off dashboards.',
  },
  {
    icon: ShieldAlert,
    title: 'Human-in-the-Loop Decision Gates',
    description: 'Approval workflows pause risky decisions for human review, pair trusted agents, and keep verified identity attached to the decisions that matter most.',
  },
  {
    icon: FileCheck,
    title: 'Adaptive Learning That Closes the Loop',
    description: 'Completed actions turn into scored learning episodes, recommendations, adoption telemetry, and maturity analytics so your fleet improves over time.',
  },
  {
    icon: MessageSquare,
    title: 'Shared Agent Workspace',
    description: 'Messaging, shared docs, handoffs, context threads, snippets, and memory health keep long-running agent work coherent across sessions and operators.',
  },
];

export const platformFeatures = [
  { icon: Package, title: 'Drop-In SDKs', description: 'Connect any agent in minutes. Zero-dependency Node.js and Python clients with adapters for OpenClaw, CrewAI, AutoGen, and LangChain.' },
  { icon: Newspaper, title: 'Prompt Registry', description: 'Version-controlled prompt templates with mustache variables and instant rollback. Stop hardcoding prompts in your agent code.' },
  { icon: MessageSquare, title: 'Messaging + Shared Docs', description: 'Direct agent messaging, smart inboxes, conversation threads, attachments, broadcasts, and shared workspace documents.' },
  { icon: Radio, title: 'Behavioral Drift Detection', description: 'Statistical baselines and z-score alerts catch when agent behavior deviates from the norm. Detect logic drift early.' },
  { icon: Download, title: 'Compliance Export Bundles', description: 'Framework mapping, gap analysis, evidence capture, and audit-ready exports for serious governance workflows.' },
  { icon: SlidersHorizontal, title: 'Scoring Profiles', description: 'User-defined weighted quality scoring with auto-calibration from real data. Risk templates replace hardcoded agent risk numbers with transparent, editable rules.' },
  { icon: DashClawLogo, title: 'Verified Agent Identity', description: 'Know which agent took which action. RSA signature verification ensures accountability at every step.' },
  { icon: Brain, title: 'Keep Agent Memory Clean', description: 'Detect stale facts, repetition loops, and context bloat before they cause bad decisions, then sync the findings back into the platform.' },
];

export const corePrimitives = [
  {
    icon: Compass,
    title: 'Intent',
    description: 'Agents declare what they want to do.',
  },
  {
    icon: Shield,
    title: 'Guard',
    description: 'Evaluate policies before agents act.',
  },
  {
    icon: UsersRound,
    title: 'Approval',
    description: 'Pause risky decisions for human review.',
  },
  {
    icon: Zap,
    title: 'Action',
    description: 'The governed decision is executed.',
  },
  {
    icon: Scale,
    title: 'Evidence',
    description: 'A signed replay is recorded for audit.',
  },
];

export const frameworkQuickstarts = [
  {
    id: 'langchain',
    name: 'LangChain',
    label: 'Python tool guard',
    code: `from dashclaw import DashClaw

claw = DashClaw(api_key="...")

# Intercept tool execution
decision = claw.guard(
    action_type="deploy",
    risk_score=82
)

if decision == "allowed":
    run_agent_tool()`
  },
  {
    id: 'crewai',
    name: 'CrewAI',
    label: 'Agent task guard',
    code: `# Wrap sensitive agent tasks
decision = claw.guard(
    action_type="external_api_call",
    provider="stripe",
    risk_score=88
)

if decision == "allowed":
    crew.kickoff()`
  },
  {
    id: 'openai',
    name: 'OpenAI Tools',
    label: 'Node.js function guard',
    code: `import { DashClaw } from 'dashclaw'
const claw = new DashClaw()

// Guard before calling the tool
const { decision } = await claw.guard({
  actionType: "deploy",
  riskScore: 90
})

if (decision === 'allowed') {
  await openai.chat.completions.create(...)
}`
  }
];

export const operationalFeatures = [
  { icon: UsersRound, title: 'Team Management', description: 'Invite your team in seconds. Role-based access keeps operators in control and agents accountable.' },
  { icon: Webhook, title: 'Decision Risk Notifications', description: 'HMAC-signed webhooks and email alerts fire when decision integrity signals breach thresholds. No more checking dashboards.' },
  { icon: Clock, title: 'Full Audit Trail', description: 'Every action is logged with actor, timestamp, and reasoning: ready for compliance audits and debugging.' },
  { icon: Compass, title: 'Ship in 10 Minutes', description: 'Four steps: create workspace, generate key, install SDK, send first action. That\'s it.' },
  { icon: Building2, title: 'Built for Multi-Tenant', description: 'Full org isolation out of the box. Each team gets their own agents, keys, and settings.' },
  { icon: Terminal, title: '30+ CLI Tools', description: 'Run agent ops locally with Python CLI tools. Push results to the dashboard when you\'re ready.' },
];

export const signals = [
  { name: 'Autonomy Spike', description: 'Agent taking too many actions without human checkpoints' },
  { name: 'High Impact, Low Oversight', description: 'Critical actions without sufficient review' },
  { name: 'Repeated Failures', description: 'Same action type failing multiple times' },
  { name: 'Stale Loop', description: 'Open loops unresolved past their expected timeline' },
  { name: 'Assumption Drift', description: 'Assumptions becoming stale or contradicted by outcomes' },
  { name: 'Stale Assumption', description: 'Assumptions not validated within expected timeframe' },
  { name: 'Stale Running Action', description: 'Actions stuck in running state for over 4 hours' },
];

export const agentToolCategories = [
  { title: 'Learning & Decisions', desc: 'Log decisions, lessons, and outcomes. Track what worked and why.', example: 'learner.py log "Used JWT" --push' },
  { title: 'Context & Handoffs', desc: 'Key points, threads, and session continuity documents.', example: 'context.py capture "Dark theme" --push' },
  { title: 'Memory & Health', desc: 'Scan memory files, track entities, detect stale facts.', example: 'scanner.py scan ~/.agent/memory --push' },
  { title: 'Goals & Relationships', desc: 'Goal milestones, contacts, interactions, and follow-ups.', example: 'goals.py add "Ship auth" --push' },
  { title: 'Security & Audit', desc: 'Outbound content filtering, session isolation, audit logging.', example: 'outbound_filter.py scan message.txt --push' },
  { title: 'Automation & Snippets', desc: 'Reusable code snippets with search, tags, and use tracking.', example: 'snippets.py add "retry logic" --push' },
];

export const platformCoverage = [
  {
    icon: FolderKanban,
    title: 'Control Plane + Dashboard',
    description: 'Mission Control, onboarding, approval queue, fleet health, security posture, operator workflows, and role-based workspace management.',
  },
  {
    icon: MessageSquare,
    title: 'API + Data Layer',
    description: 'Broad API coverage for governance, learning, messaging, routing, compliance, and workspace data with contract and maturity governance.',
  },
  {
    icon: Zap,
    title: 'Realtime Runtime',
    description: 'Realtime streams for actions, policies, tasks, and messages with SSE replay, reconnect handling, and live dashboard updates.',
  },
  {
    icon: Package,
    title: 'SDK + Tooling',
    description: 'Node and Python SDKs, agent bootstrap flows, local CLI tooling, parity suites, and CI-backed docs and contract governance.',
  },
];

export const shippedHighlights = [
  {
    icon: Brain,
    title: 'Agents That Learn From Their Mistakes',
    description: 'Every completed action is scored and turned into recommendations. Your agents get better without manual retraining.',
    href: '/learning',
  },
  {
    icon: DashClawLogo,
    title: 'Data Layer You Can Trust',
    description: 'SQL drift checks and contract tests run in CI. No silent regressions reach production.',
    href: '/docs',
  },
  {
    icon: MessageSquare,
    title: 'APIs That Never Break Silently',
    description: 'OpenAPI drift checks catch contract changes before they ship. Your integrations stay stable.',
    href: '/docs',
  },
  {
    icon: Package,
    title: 'SDKs That Stay in Sync',
    description: 'Node and Python SDKs are tested against the same contract fixtures. Feature parity is enforced, not hoped for.',
    href: '/docs',
  },
  {
    icon: Clock,
    title: 'Always-Fresh Recommendations',
    description: 'Automated background jobs keep learning data current. No manual cron jobs to manage.',
    href: '/learning',
  },
  {
    icon: Scale,
    title: 'Compliance Without the Spreadsheets',
    description: 'Map your guardrails to SOC 2, ISO 27001, GDPR, NIST AI RMF, and more. Generate audit-ready reports and live evidence on demand.',
    href: '/docs#compliance-engine',
  },
  {
    icon: Network,
    title: 'The Right Agent for Every Task',
    description: 'Tasks automatically route to the best-fit agent based on skills, load, and track record. Failed tasks retry and escalate.',
    href: '/docs#task-routing',
  },
];

/* ─── page ─── */