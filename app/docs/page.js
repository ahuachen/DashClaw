import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Github, ExternalLink, BookOpen,
  Terminal, Zap, CircleDot, Eye, ShieldAlert, BarChart3,
  ChevronRight, Network, FileCheck, Scale, Radio, Users,
  Newspaper, MessageSquare, Download, SlidersHorizontal, Shield, History
} from 'lucide-react';
import DashClawLogo from '../components/DashClawLogo';
import CopyDocsButton from '../components/CopyDocsButton';
import ConnectAgentButton from '../components/ConnectAgentButton';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import DocsSidebarClient from './DocsSidebarClient';
import DocsCodeTabs from './DocsCodeTabs';

export const metadata = {
  title: 'DashClaw SDK Documentation',
  description:
    'Canonical, up-to-date reference for the DashClaw SDK. Install, configure, and govern your AI agents across action recording, behavior guard, evaluation framework, scoring profiles, learning analytics, prompt management, feedback loops, behavioral drift, compliance exports, and more.',
};

/* ─── helpers ─── */

function CodeBlock({ children, title }) {
  return (
    <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] overflow-x-auto">
      {title && (
        <div className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] text-xs text-zinc-500 font-mono">{title}</div>
      )}
      <pre className="p-5 font-mono text-sm leading-relaxed text-zinc-300">{children}</pre>
    </div>
  );
}

function ParamTable({ params }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.06)]">
            <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Parameter</th>
            <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Type</th>
            <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Required</th>
            <th className="text-left py-2 text-zinc-400 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-[rgba(255,255,255,0.03)]">
              <td className="py-2 pr-4 font-mono text-xs text-brand">{p.name}</td>
              <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{p.type}</td>
              <td className="py-2 pr-4 text-xs">{p.required ? <span className="text-red-400">Yes</span> : <span className="text-zinc-600">No</span>}</td>
              <td className="py-2 text-zinc-400 text-xs">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MethodEntry({ id, signature, description, params, returns, example, children }) {
  return (
    <div id={id} className="scroll-mt-20 py-8 border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
      <h3 className="text-lg font-semibold text-white font-mono">{signature}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
      {params && params.length > 0 && (
        <div className="mt-4">
          <ParamTable params={params} />
        </div>
      )}
      {returns && (
        <p className="mt-3 text-xs text-zinc-500"><span className="text-zinc-400 font-medium">Returns:</span> <code className="font-mono text-zinc-400">{returns}</code></p>
      )}
      {example && (
        <div className="mt-4">
          {example}
        </div>
      )}
      {children}
    </div>
  );
}

function SectionNav({ items }) {
  return <DocsSidebarClient items={items} />;
}

/* ─── nav items for sidebar ─── */

const navItems = [
  { href: '#quick-start', label: 'Quick Start' },
  { href: '#constructor', label: 'Constructor' },
  { href: '#behavior-guard', label: 'Behavior Guard' },
  { href: '#guard', label: 'guard', indent: true },
  { href: '#action-recording', label: 'Action Recording' },
  { href: '#createAction', label: 'createAction', indent: true },
  { href: '#waitForApproval', label: 'waitForApproval', indent: true },
  { href: '#updateOutcome', label: 'updateOutcome', indent: true },
  { href: '#recordAssumption', label: 'recordAssumption', indent: true },
  { href: '#signals', label: 'Signals' },
  { href: '#swarm-intelligence', label: 'Swarm Intelligence' },
  { href: '#loops-assumptions', label: 'Loops & Assumptions' },
  { href: '#learning-analytics', label: 'Learning Analytics' },
  { href: '#prompt-management', label: 'Prompt Management' },
  { href: '#evaluation-framework', label: 'Evaluation Framework' },
  { href: '#scoring-profiles', label: 'Scoring Profiles' },
  { href: '#compliance-engine', label: 'Compliance Engine' },
  { href: '#activity-logs', label: 'Activity Logs' },
  { href: '#webhooks', label: 'Webhooks' },
  { href: '#error-handling', label: 'Error Handling' },
  { href: '#agent-tools', label: 'Agent Tools (Python)' },
  { href: '#legacy-v1', label: 'Legacy API (v1)', legacy: true },
  { href: '#real-time-events', label: 'Real-Time Events', indent: true, legacy: true },
  { href: '#user-feedback', label: 'User Feedback', indent: true, legacy: true },
  { href: '#behavioral-drift', label: 'Behavioral Drift', indent: true, legacy: true },
  { href: '#compliance-exports', label: 'Compliance Exports', indent: true, legacy: true },
  { href: '#dashboard-data', label: 'Dashboard Data', indent: true, legacy: true },
  { href: '#session-handoffs', label: 'Session Handoffs', indent: true, legacy: true },
  { href: '#context-manager', label: 'Context Manager', indent: true, legacy: true },
  { href: '#automation-snippets', label: 'Automation Snippets', indent: true, legacy: true },
  { href: '#user-preferences', label: 'User Preferences', indent: true, legacy: true },
  { href: '#daily-digest', label: 'Daily Digest', indent: true, legacy: true },
  { href: '#security-scanning', label: 'Security Scanning', indent: true, legacy: true },
  { href: '#agent-messaging', label: 'Agent Messaging', indent: true, legacy: true },
  { href: '#bulk-sync', label: 'Bulk Sync', indent: true, legacy: true },
  { href: '#policy-testing', label: 'Policy Testing', indent: true, legacy: true },
  { href: '#task-routing', label: 'Task Routing', indent: true, legacy: true },
  { href: '#agent-schedules', label: 'Agent Schedules', indent: true, legacy: true },
  { href: '#agent-pairing', label: 'Agent Pairing', indent: true, legacy: true },
  { href: '#identity-binding', label: 'Identity Binding', indent: true, legacy: true },
  { href: '#org-management', label: 'Organization Management', indent: true, legacy: true },
];

/* ─── page ─── */

export default async function DocsPage({ searchParams }) {
  const params = await searchParams;
  const showLegacy = params?.legacy === 'true';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <PublicNavbar />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-zinc-500 mb-4">
            <Link href="/" className="hover:text-zinc-300 transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-zinc-300">SDK Documentation</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
              <BookOpen size={20} className="text-brand" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">SDK Documentation</h1>
          </div>
          <p className="text-zinc-400 max-w-2xl leading-relaxed">
            Canonical reference for the DashClaw SDK (v2.1.5). Node.js and Python parity across all core governance features.
          </p>
          <Suspense fallback={null}>
            <CopyDocsButton />
          </Suspense>
        </div>
      </section>

      {/* Main content with side nav */}
      <div className="max-w-6xl mx-auto px-6 pb-20 flex gap-12">
        <SectionNav items={navItems} />

        <div className="min-w-0 flex-1">

          {/* ── Quick Start ── */}
          <section id="quick-start" className="scroll-mt-20 pb-12 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Quick Start</h2>

            <div className="space-y-8">
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">1</span>
                  <h3 className="text-base font-semibold">Install</h3>
                </div>
                <div className="pl-10">
                  <DocsCodeTabs 
                    nodeSnippet="npm install dashclaw"
                    pythonSnippet="pip install dashclaw"
                    nodeTitle="npm"
                    pythonTitle="pip"
                  />
                </div>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">2</span>
                  <h3 className="text-base font-semibold">Initialize</h3>
                </div>
                <div className="pl-10">
                  <DocsCodeTabs 
                    nodeSnippet={`import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'https://dashclaw.io',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});`}
                    pythonSnippet={`from dashclaw import DashClaw
import os

claw = DashClaw(
    base_url="https://dashclaw.io",
    api_key=os.getenv("DASHCLAW_API_KEY"),
    agent_id="my-agent"
)`}
                  />
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">3</span>
                  <h3 className="text-base font-semibold">Governance Loop</h3>
                </div>
                <div className="pl-10">
                  <DocsCodeTabs 
                    nodeSnippet={`// 1. Ask permission
const result = await claw.guard({
  action_type: 'deploy',
  risk_score: 85,
  declared_goal: 'Update auth service to v2.1.1'
});

if (result.decision === 'block') {
  throw new Error(\`Blocked: \${result.reasons.join(', ')}\`);
}

// 2. Log intent
const { action_id } = await claw.createAction({
  action_type: 'deploy',
  declared_goal: 'Update auth service to v2.1.1'
});

try {
  // 3. Log evidence
  await claw.recordAssumption({
    action_id,
    assumption: 'Tests passed'
  });

  // ... deploy ...

  // 4. Record outcome
  await claw.updateOutcome(action_id, { status: 'completed' });
} catch (err) {
  await claw.updateOutcome(action_id, { status: 'failed', error_message: err.message });
}`}
                    pythonSnippet={`# 1. Ask permission
result = claw.guard({
    "action_type": "deploy",
    "risk_score": 85,
    "declared_goal": "Update auth service to v2.1.1"
})

if result["decision"] == "block":
    raise Exception(f"Blocked: {', '.join(result['reasons'])}")

# 2. Log intent
action = claw.create_action(
    action_type="deploy",
    declared_goal="Update auth service to v2.1.1"
)
action_id = action["action_id"]

try:
    # 3. Log evidence
    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Tests passed"
    })

    # ... deploy ...

    # 4. Record outcome
    claw.update_outcome(action_id, status="completed")
except Exception as e:
    claw.update_outcome(action_id, status="failed", error_message=str(e))`}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Constructor ── */}
          <section id="constructor" className="scroll-mt-20 py-12 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Constructor</h2>
            <DocsCodeTabs 
              nodeSnippet="const claw = new DashClaw({ baseUrl, apiKey, agentId });"
              pythonSnippet='claw = DashClaw(base_url="...", api_key="...", agent_id="...")'
            />
            <div className="mt-6">
              <ParamTable params={[
                { name: 'baseUrl / base_url', type: 'string', required: true, desc: 'Dashboard URL' },
                { name: 'apiKey / api_key', type: 'string', required: true, desc: 'API Key' },
                { name: 'agentId / agent_id', type: 'string', required: true, desc: 'Unique Agent ID' },
              ]} />
            </div>
          </section>

          {/* ── Behavior Guard ── */}
          <section id="behavior-guard" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(59,130,246,0.1)] flex items-center justify-center">
                <Shield size={16} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Behavior Guard</h2>
            </div>
            <MethodEntry
              id="guard"
              signature="claw.guard(context)"
              description="Evaluate guard policies for a proposed action. Call this before risky operations."
              params={[
                { name: 'action_type', type: 'string', required: true, desc: 'Proposed action type' },
                { name: 'risk_score', type: 'number', required: false, desc: '0-100' },
              ]}
              returns="Promise<{ decision: string, reasons: string[] }>"
              example={
                <DocsCodeTabs 
                  nodeSnippet="const result = await claw.guard({ action_type: 'deploy', risk_score: 85 });"
                  pythonSnippet='result = claw.guard({"action_type": "deploy", "risk_score": 85})'
                />
              }
            />
          </section>

          {/* ── Action Recording ── */}
          <section id="action-recording" className="scroll-mt-20 pt-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Zap size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Action Recording</h2>
            </div>
            <MethodEntry
              id="createAction"
              signature="claw.createAction(action) / claw.create_action(**kwargs)"
              description="Create a new action record."
              returns="Promise<{ action_id: string }>"
              example={
                <DocsCodeTabs 
                  nodeSnippet="const { action_id } = await claw.createAction({ action_type: 'deploy' });"
                  pythonSnippet='action = claw.create_action(action_type="deploy")'
                />
              }
            />
            <MethodEntry
              id="waitForApproval"
              signature="claw.waitForApproval(id) / claw.wait_for_approval(id)"
              description="Poll for human approval."
              example={
                <DocsCodeTabs 
                  nodeSnippet="await claw.waitForApproval(action_id);"
                  pythonSnippet="claw.wait_for_approval(action_id)"
                />
              }
            />
            <MethodEntry
              id="updateOutcome"
              signature="claw.updateOutcome(id, outcome) / claw.update_outcome(id, **kwargs)"
              description="Log final results."
              example={
                <DocsCodeTabs 
                  nodeSnippet="await claw.updateOutcome(action_id, { status: 'completed' });"
                  pythonSnippet='claw.update_outcome(action_id, status="completed")'
                />
              }
            />
            <MethodEntry
              id="recordAssumption"
              signature="claw.recordAssumption(asm) / claw.record_assumption(asm)"
              description="Track agent beliefs."
              example={
                <DocsCodeTabs 
                  nodeSnippet="await claw.recordAssumption({ action_id, assumption: '...' });"
                  pythonSnippet='claw.record_assumption({"action_id": action_id, "assumption": "..."})'
                />
              }
            />
          </section>

          {/* ── Signals ── */}
          <section id="signals" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.1)] flex items-center justify-center">
                <ShieldAlert size={16} className="text-red-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Signals</h2>
            </div>
            <MethodEntry
              id="getSignals"
              signature="claw.getSignals() / claw.get_signals()"
              description="Get current risk signals across all agents."
              returns="Promise<{ signals: Object[] }>"
              example={
                <DocsCodeTabs 
                  nodeSnippet="const { signals } = await claw.getSignals();"
                  pythonSnippet="signals = claw.get_signals()"
                />
              }
            />
          </section>

          {/* ── Swarm Intelligence ── */}
          <section id="swarm-intelligence" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Users size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Swarm Intelligence</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-6">Map your entire fleet as a neural web, highlighting high-risk nodes and message flows.</p>
            
            <MethodEntry
              id="heartbeat"
              signature="claw.heartbeat(status, metadata) / claw.heartbeat(status=...)"
              description="Report agent presence and health to the control plane."
              params={[
                { name: 'status', type: 'string', required: false, desc: 'Agent status (online, busy, offline)' },
                { name: 'metadata', type: 'object', required: false, desc: 'Additional agent state' },
              ]}
              example={
                <DocsCodeTabs 
                  nodeSnippet="await claw.heartbeat('online', { task: 'monitoring' });"
                  pythonSnippet="claw.heartbeat(status='online', metadata={'task': 'monitoring'})"
                />
              }
            />

            <MethodEntry
              id="reportConnections"
              signature="claw.reportConnections(connections) / claw.report_connections(connections)"
              description="Report active provider connections and their status."
              params={[
                { name: 'connections', type: 'Array<Object>', required: true, desc: 'List of provider connection objects' },
              ]}
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.reportConnections([
  { provider: 'openai', status: 'active', plan_name: 'enterprise' }
]);`}
                  pythonSnippet={`claw.report_connections([
    {'provider': 'openai', 'status': 'active', 'plan_name': 'enterprise'}
])`}
                />
              }
            />
          </section>

          {/* ── Loops & Assumptions ── */}
          <section id="loops-assumptions" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <CircleDot size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Loops & Assumptions</h2>
            </div>
            
            <MethodEntry
              id="registerOpenLoop"
              signature="claw.registerOpenLoop(actionId, type, desc) / claw.register_open_loop(...)"
              description="Register an unresolved dependency for a decision. Open loops track work that must be completed before the decision is fully resolved."
              params={[
                { name: 'action_id', type: 'string', required: true, desc: 'Associated action' },
                { name: 'loop_type', type: 'string', required: true, desc: 'The category of the loop' },
                { name: 'description', type: 'string', required: true, desc: 'What needs to be resolved' },
              ]}
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.registerOpenLoop(action_id, 'validation', 'Waiting for PR review');`}
                  pythonSnippet={`claw.register_open_loop(action_id, 'validation', 'Waiting for PR review')`}
                />
              }
            />

            <MethodEntry
              id="resolveOpenLoop"
              signature="claw.resolveOpenLoop(loopId, status, res) / claw.resolve_open_loop(...)"
              description="Resolve a pending loop."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.resolveOpenLoop(loop_id, 'completed', 'Approved');`}
                  pythonSnippet={`claw.resolve_open_loop(loop_id, 'completed', 'Approved')`}
                />
              }
            />

            <MethodEntry
              id="recordAssumption"
              signature="claw.recordAssumption(asm) / claw.record_assumption(asm)"
              description="Record what the agent believed to be true when making a decision."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.recordAssumption({ action_id, assumption: 'User is authenticated' });`}
                  pythonSnippet={`claw.record_assumption({'action_id': action_id, 'assumption': 'User is authenticated'})`}
                />
              }
            />
          </section>

          {/* ── Learning Analytics ── */}
          <section id="learning-analytics" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Zap size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Learning Analytics</h2>
            </div>
            
            <MethodEntry
              id="getLearningVelocity"
              signature="claw.getLearningVelocity() / claw.get_learning_velocity()"
              description="Compute learning velocity (rate of score improvement) for agents."
              returns="Promise<{ velocity: Array<Object> }>"
              example={
                <DocsCodeTabs 
                  nodeSnippet={`const { velocity } = await claw.getLearningVelocity();`}
                  pythonSnippet={`velocity = claw.get_learning_velocity()`}
                />
              }
            />

            <MethodEntry
              id="getLearningCurves"
              signature="claw.getLearningCurves() / claw.get_learning_curves()"
              description="Compute learning curves per action type to measure efficiency gains."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`const curves = await claw.getLearningCurves();`}
                  pythonSnippet={`curves = claw.get_learning_curves()`}
                />
              }
            />
          </section>

          {/* ── Prompt Management ── */}
          <section id="prompt-management" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Newspaper size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Prompt Management</h2>
            </div>
            <MethodEntry 
              id="renderPrompt" 
              signature="claw.renderPrompt() / claw.render_prompt()" 
              description="Fetch rendered prompt from DashClaw."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`const { rendered } = await claw.renderPrompt({
  template_id: 'marketing',
  variables: { company: 'Apple' }
});`}
                  pythonSnippet={`res = claw.render_prompt(
    template_id="marketing",
    variables={"company": "Apple"}
)
rendered = res["rendered"]`}
                />
              }
            />
          </section>

          {/* ── Evaluation Framework ── */}
          <section id="evaluation-framework" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <FileCheck size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Evaluation Framework</h2>
            </div>
            
            <MethodEntry
              id="createScorer"
              signature="claw.createScorer(name, type, config) / claw.create_scorer(...)"
              description="Create a reusable scorer definition for automated evaluation."
              params={[
                { name: 'name', type: 'string', required: true, desc: 'Scorer name' },
                { name: 'scorer_type', type: 'string', required: true, desc: 'Type (llm_judge, regex, range)' },
                { name: 'config', type: 'object', required: false, desc: 'Scorer configuration' },
              ]}
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.createScorer('toxicity', 'regex', { pattern: 'bad-word' });`}
                  pythonSnippet={`claw.create_scorer('toxicity', 'regex', config={'pattern': 'bad-word'})`}
                />
              }
            />
          </section>

          {/* ── Scoring Profiles ── */}
          <section id="scoring-profiles" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <SlidersHorizontal size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Scoring Profiles</h2>
            </div>
            
            <MethodEntry
              id="createScoringProfile"
              signature="claw.createScoringProfile(config) / claw.create_scoring_profile(...)"
              description="Define weighted quality scoring profiles across multiple scorers."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.createScoringProfile({ 
  name: 'prod-quality', 
  dimensions: [{ scorer: 'toxicity', weight: 0.5 }] 
});`}
                  pythonSnippet={`claw.create_scoring_profile(
    name='prod-quality', 
    dimensions=[{'scorer': 'toxicity', 'weight': 0.5}]
)`}
                />
              }
            />
          </section>

          {/* ── Compliance Engine ── */}
          <section id="compliance-engine" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(59,130,246,0.1)] flex items-center justify-center">
                <Scale size={16} className="text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Compliance Engine</h2>
            </div>
            
            <MethodEntry
              id="mapCompliance"
              signature="claw.mapCompliance(framework) / claw.map_compliance(framework)"
              description="Map active policies to a compliance framework's controls."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.mapCompliance('SOC2');`}
                  pythonSnippet={`claw.map_compliance('SOC2')`}
                />
              }
            />

            <MethodEntry
              id="getProofReport"
              signature="claw.getProofReport(format) / claw.get_proof_report(format)"
              description="Generate a compliance proof report from active policies."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`const report = await claw.getProofReport('json');`}
                  pythonSnippet={`report = claw.get_proof_report(format='json')`}
                />
              }
            />
          </section>

          {/* ── Activity Logs ── */}
          <section id="activity-logs" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Eye size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Activity Logs</h2>
            </div>
            
            <MethodEntry
              id="getActivityLogs"
              signature="claw.getActivityLogs(filters) / claw.get_activity_logs(**filters)"
              description="Query the immutable audit trail of all workspace changes and administrative events."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`const logs = await claw.getActivityLogs({ limit: 10 });`}
                  pythonSnippet={`logs = claw.get_activity_logs(limit=10)`}
                />
              }
            />
          </section>

          {/* ── Webhooks ── */}
          <section id="webhooks" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <ExternalLink size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Webhooks</h2>
            </div>
            
            <MethodEntry
              id="createWebhook"
              signature="claw.createWebhook(url, events) / claw.create_webhook(url, events)"
              description="Register an HMAC-signed webhook for real-time exfiltration of governance events."
              example={
                <DocsCodeTabs 
                  nodeSnippet={`await claw.createWebhook('https://api.myapp.com/hooks', ['action.blocked']);`}
                  pythonSnippet={`claw.create_webhook('https://api.myapp.com/hooks', events=['action.blocked'])`}
                />
              }
            />
          </section>

          {/* ── Error Handling ── */}
          <section id="error-handling" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Error Handling</h2>
            <CodeBlock title="Error shape">{`{ message: "Validation failed", status: 400 }`}</CodeBlock>
          </section>

          {/* ── Legacy Section ── */}
          {showLegacy && (
            <div id="legacy-v1" className="mt-20 pt-12 border-t-2 border-dashed border-zinc-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                  <History size={20} />
                </div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Legacy Reference</h2>
                  <p className="text-zinc-500 text-sm">Background v1 utilities and technical helper methods.</p>
                </div>
              </div>

              {/* Real-Time Events */}
              <section id="real-time-events" className="scroll-mt-20 pt-12">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Real-Time Events</h3>
                <MethodEntry 
                  id="events" 
                  signature="claw.events(options?)" 
                  description="Subscribe to real-time SSE events from the DashClaw server. Uses fetch-based SSE parsing for Node 18+ compatibility (no native EventSource required)."
                  params={[
                    { name: 'reconnect', type: 'boolean', required: false, desc: 'Auto-reconnect on disconnect (resumes from last event ID). Default: true.' },
                    { name: 'maxRetries', type: 'number', required: false, desc: 'Max reconnection attempts.' },
                    { name: 'retryInterval', type: 'number', required: false, desc: 'Milliseconds between reconnection attempts. Default: 3000.' },
                  ]}
                  example={
                    <CodeBlock title="Subscribing to updates">
{`const stream = client.events();
stream
  .on('action.created', (data) => console.log('New action:', data))
  .on('action.updated', (data) => console.log('Action updated:', data))
  .on('goal.created', (data) => console.log('New goal:', data))
  .on('policy.updated', (data) => console.log('Policy changed:', data))
  .on('error', (err) => console.error('Stream error:', err));`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* User Feedback */}
              <section id="user-feedback" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">User Feedback</h3>
                <MethodEntry 
                  id="submitFeedback" 
                  signature="claw.submitFeedback(params)" 
                  description="Submit feedback for a specific agent action. Used for human evaluation of agent performance."
                  params={[
                    { name: 'action_id', type: 'string', required: true, desc: 'Target action ID' },
                    { name: 'rating', type: 'number', required: true, desc: '1-5 star rating' },
                    { name: 'comment', type: 'string', required: false, desc: 'Textual feedback' },
                    { name: 'category', type: 'string', required: false, desc: 'Grouping tag' },
                  ]}
                  example={
                    <CodeBlock title="Reporting feedback">
{`await claw.submitFeedback({
  action_id: 'act_4b2s8...',
  rating: 4,
  comment: 'Action was safe and effective but took longer than expected.',
  category: 'performance_review'
});`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* Dashboard Data */}
              <section id="dashboard-data" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Dashboard Data</h3>
                <MethodEntry 
                  id="reportTokenUsage" 
                  signature="claw.reportTokenUsage(usage)" 
                  description="Record a point-in-time token usage snapshot for this agent."
                  params={[
                    { name: 'tokens_in', type: 'number', required: true, desc: 'Input/Prompt tokens' },
                    { name: 'tokens_out', type: 'number', required: true, desc: 'Output/Completion tokens' },
                    { name: 'model', type: 'string', required: false, desc: 'LLM model used' },
                  ]}
                  example={
                    <CodeBlock>
{`await claw.reportTokenUsage({
  tokens_in: 850,
  tokens_out: 215,
  model: 'claude-3-5-sonnet-20250514'
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="createGoal" 
                  signature="claw.createGoal(goal)" 
                  description="Register a high-level goal in the Mission Control UI."
                  params={[
                    { name: 'title', type: 'string', required: true, desc: 'Short name for the goal' },
                    { name: 'status', type: 'string', required: false, desc: 'active|completed|paused' },
                    { name: 'progress', type: 'number', required: false, desc: '0-100 percentage' },
                  ]}
                  example={
                    <CodeBlock>
{`await claw.createGoal({
  title: 'Refactor Auth Layer',
  progress: 75,
  status: 'active'
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="wrapClient" 
                  signature="claw.wrapClient(llmClient, options?)" 
                  description="Wrap an Anthropic or OpenAI client to automatically report token usage after each API call."
                  example={
                    <CodeBlock title="Auto-telemetry wrapping">
{`const anthropic = claw.wrapClient(new Anthropic());
// usage is auto-reported after this call:
const msg = await anthropic.messages.create({ 
  model: 'claude-3-5-sonnet-20250514', 
  max_tokens: 1024, 
  messages: [{ role: 'user', content: 'Hello' }] 
});`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* Behavior Guard (v1) */}
              <section id="legacy-guard" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Behavior Guard (v1)</h3>
                <MethodEntry 
                  id="guard" 
                  signature="claw.guard(context)" 
                  description="Intercept intent and check it against current safety and governance policies."
                  params={[
                    { name: 'action_type', type: 'string', required: true, desc: 'Intent category (deploy, post, build, etc)' },
                    { name: 'risk_score', type: 'number', required: false, desc: '0-100 estimate' },
                    { name: 'declared_goal', type: 'string', required: false, desc: 'Human-readable justification' },
                  ]}
                  example={
                    <CodeBlock title="Checking a dangerous intent">
{`const decision = await claw.guard({
  action_type: 'production_deployment',
  risk_score: 95,
  declared_goal: 'Updating API endpoints for new feature'
});

if (decision.decision === 'block') {
  console.error('Safety policy blocked action:', decision.reasons);
}`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* Agent Messaging */}
              <section id="agent-messaging" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Agent Messaging</h3>
                <MethodEntry 
                  id="sendMessage" 
                  signature="claw.sendMessage(params)" 
                  description="Send a point-to-point message or broadcast to all agents in the organization."
                  params={[
                    { name: 'to', type: 'string', required: false, desc: 'Target agent ID (omit for broadcast)' },
                    { name: 'body', type: 'string', required: true, desc: 'Message content' },
                    { name: 'type', type: 'string', required: false, desc: 'action|info|lesson|question' },
                    { name: 'urgent', type: 'boolean', required: false, desc: 'Mark as high priority' },
                  ]}
                  example={
                    <CodeBlock title="Direct agent-to-agent communication">
{`await claw.sendMessage({
  to: 'scout-agent-01',
  body: 'I have finished indexing the repository. You can start the analysis.',
  type: 'status'
});`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* Session Handoffs */}
              <section id="session-handoffs" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Session Handoffs</h3>
                <MethodEntry 
                  id="createHandoff" 
                  signature="claw.createHandoff(handoff)" 
                  description="Create a session handoff document to persist state between agent sessions or transfer context to another agent."
                  example={
                    <CodeBlock title="Persisting session context">
{`await claw.createHandoff({
  summary: 'Completed initial data collection from Jira.',
  key_decisions: ['Prioritize high-severity bugs', 'Ignore closed tickets'],
  open_tasks: ['Run security scan on src/', 'Draft fix for #123'],
  next_priorities: ['Security audit']
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="getLatestHandoff" 
                  signature="claw.getLatestHandoff()" 
                  description="Retrieve the most recent handoff for the current agent."
                  returns="Promise<Object|null>"
                />
              </section>

              {/* User Preferences */}
              <section id="user-preferences" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">User Preferences</h3>
                <MethodEntry 
                  id="logObservation" 
                  signature="claw.logObservation(obs)" 
                  description="Log a behavioral observation about the user to improve future interactions."
                  example={
                    <CodeBlock>
{`await claw.logObservation({
  observation: 'User prefers concise, bulleted summaries over long paragraphs.',
  importance: 8,
  category: 'communication_style'
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="setPreference" 
                  signature="claw.setPreference(pref)" 
                  description="Explicitly set a learned user preference."
                  example={
                    <CodeBlock>
{`await claw.setPreference({
  preference: 'Always use tabs for indentation in generated Python code.',
  confidence: 100
});`}
                    </CodeBlock>
                  }
                />
              </section>

              {/* Security Scanning */}
              <section id="security-scanning" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Security Scanning</h3>
                <MethodEntry 
                  id="scanContent" 
                  signature="claw.scanContent(text, destination?)" 
                  description="Scan text for sensitive data (API keys, tokens, PII) before it leaves the secure environment."
                  returns="Promise<{clean: boolean, findings: Object[], redacted_text: string}>"
                  example={
                    <CodeBlock title="Safe-guarding outbound data">
{`const { clean, redacted_text } = await claw.scanContent(userOutput, 'slack-webhook');
if (!clean) {
  console.warn('Sensitive data detected and redacted.');
}
await sendToSlack(redacted_text);`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="scanPromptInjection" 
                  signature="claw.scanPromptInjection(text)" 
                  description="Scan untrusted input for potential prompt injection or jailbreak attempts."
                  returns="Promise<{clean: boolean, risk_level: string, recommendation: string}>"
                />
              </section>

              {/* Context Manager */}
              <section id="context-manager" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Context Manager</h3>
                <MethodEntry 
                  id="captureKeyPoint" 
                  signature="claw.captureKeyPoint(point)" 
                  description="Capture a high-importance insight or decision point during a session."
                  example={
                    <CodeBlock>
{`await claw.captureKeyPoint({
  content: 'Switched to using PostgreSQL for the vector store due to performance issues.',
  category: 'decision',
  importance: 9
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="getContextSummary" 
                  signature="claw.getContextSummary()" 
                  description="Get a combined context summary: today's key points + active threads."
                  returns="Promise<{points: Object[], threads: Object[]}>"
                />
              </section>

              {/* Automation Snippets */}
              <section id="automation-snippets" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2 font-mono underline decoration-zinc-700 underline-offset-8">Automation Snippets</h3>
                <MethodEntry 
                  id="saveSnippet" 
                  signature="claw.saveSnippet(snippet)" 
                  description="Save or update a reusable code snippet or automation script."
                  example={
                    <CodeBlock>
{`await claw.saveSnippet({
  name: 'backup-config',
  code: 'cp /etc/app/config.json /backup/config.json',
  language: 'bash',
  tags: ['utility', 'backup']
});`}
                    </CodeBlock>
                  }
                />
                <MethodEntry 
                  id="useSnippet" 
                  signature="claw.useSnippet(snippetId)" 
                  description="Mark a snippet as used (increments telemetry use_count)."
                  returns="Promise<{snippet: Object}>"
                />
              </section>
            </div>
          )}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
