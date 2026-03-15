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
          <CodeBlock>{example}</CodeBlock>
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
            Canonical reference for the DashClaw SDK. Core governance features are visible by default.
          </p>
          <CopyDocsButton />
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
                  <CodeBlock title="terminal">{`npm install dashclaw`}</CodeBlock>
                </div>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">2</span>
                  <h3 className="text-base font-semibold">Initialize</h3>
                </div>
                <div className="pl-10">
                  <CodeBlock title="agent.js">{`import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: 'https://dashclaw.io',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent'
});`}</CodeBlock>
                </div>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">3</span>
                  <h3 className="text-base font-semibold">Governance Loop</h3>
                </div>
                <div className="pl-10">
                  <CodeBlock title="agent.js">{`// 1. Ask permission before a risky action
const result = await claw.guard({
  action_type: 'deploy',
  risk_score: 85,
  declared_goal: 'Update authentication service to v2.1.1'
});

if (result.decision === 'block') {
  throw new Error(\`Action blocked by policy: \${result.reasons.join(', ')}\`);
}

// 2. Log intent once permitted
const { action_id } = await claw.createAction({
  action_type: 'deploy',
  declared_goal: 'Update authentication service to v2.1.1',
  reasoning: 'Critical security patch for session management'
});

try {
  // 3. Log evidence/assumptions during execution
  await claw.recordAssumption({
    action_id,
    assumption: 'All unit tests and staging integration tests passed.'
  });

  // ... perform the actual deployment logic ...

  // 4. Record the final outcome
  await claw.updateOutcome(action_id, {
    status: 'completed',
    output_summary: 'Service successfully updated to v2.1.1'
  });

} catch (err) {
  await claw.updateOutcome(action_id, {
    status: 'failed',
    error_message: err.message
  });
}`}</CodeBlock>
                </div>
              </div>
            </div>
          </section>

          {/* ── Constructor ── */}
          <section id="constructor" className="scroll-mt-20 py-12 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Constructor</h2>
            <CodeBlock>{`const claw = new DashClaw({ baseUrl, apiKey, agentId });`}</CodeBlock>
            <div className="mt-6">
              <ParamTable params={[
                { name: 'baseUrl', type: 'string', required: true, desc: 'Dashboard URL' },
                { name: 'apiKey', type: 'string', required: true, desc: 'API Key' },
                { name: 'agentId', type: 'string', required: true, desc: 'Unique Agent ID' },
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
            <p className="text-sm text-zinc-400 mb-4">
              Check org-level policies before executing risky actions. Returns allow, warn, block, or require_approval based on configured guard policies.
            </p>

            <MethodEntry
              id="guard"
              signature="claw.guard(context)"
              description="Evaluate guard policies for a proposed action. Call this before risky operations to get a go/no-go decision. The agent_id is auto-attached from the SDK constructor."
              params={[
                { name: 'context.action_type', type: 'string', required: true, desc: 'The type of action being proposed' },
                { name: 'context.risk_score', type: 'number', required: false, desc: 'Risk score 0-100' },
                { name: 'context.systems_touched', type: 'string[]', required: false, desc: 'Systems this action will affect' },
                { name: 'context.reversible', type: 'boolean', required: false, desc: 'Whether the action can be undone' },
                { name: 'context.declared_goal', type: 'string', required: false, desc: 'What the action accomplishes' },
              ]}
              returns="Promise<{ decision: string, reasons: string[], warnings: string[], matched_policies: string[], evaluated_at: string }>"
              example={`const result = await claw.guard({
  action_type: 'deploy',
  risk_score: 85,
  systems_touched: ['production-api'],
  reversible: false,
  declared_goal: 'Deploy auth service v2',
});

if (result.decision === 'block') {
  console.log('Blocked:', result.reasons);
  return; // abort the action
}

// proceed with the action
await claw.createAction({ action_type: 'deploy', ... });`}
            />

            <div className="mt-6 p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
              <h4 className="text-sm font-semibold text-white mb-3">Policy Types</h4>
              <div className="space-y-2">
                {[
                  { name: 'risk_threshold', desc: 'Block or warn when an action\'s risk score exceeds a configured threshold' },
                  { name: 'require_approval', desc: 'Require human approval for specific action types (e.g., deploy, security)' },
                  { name: 'block_action_type', desc: 'Unconditionally block specific action types from executing' },
                  { name: 'rate_limit', desc: 'Warn or block when an agent exceeds a configured action frequency' },
                  { name: 'webhook_check', desc: 'Call an external HTTPS endpoint for custom decision logic (can only escalate severity, never downgrade)' },
                ].map((s) => (
                  <div key={s.name} className="flex items-start gap-3">
                    <code className="font-mono text-xs text-brand shrink-0 pt-0.5">{s.name}</code>
                    <span className="text-xs text-zinc-400">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Action Recording ── */}
          <section id="action-recording" className="scroll-mt-20 pt-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Zap size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Action Recording</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Create, update, and query action records. Every agent action gets a full audit trail.</p>

            <MethodEntry
              id="createAction"
              signature="claw.createAction(action)"
              description="Create a new action record. The agent's agentId, agentName, and swarmId are automatically attached."
              params={[
                { name: 'action_type', type: 'string', required: true, desc: 'One of: build, deploy, post, apply, security, message, api, calendar, research, review, fix, refactor, test, config, monitor, alert, cleanup, sync, migrate, other' },
                { name: 'declared_goal', type: 'string', required: true, desc: 'What this action aims to accomplish' },
                { name: 'action_id', type: 'string', required: false, desc: 'Custom action ID (auto-generated act_ UUID if omitted)' },
                { name: 'reasoning', type: 'string', required: false, desc: 'Why the agent decided to take this action' },
                { name: 'systems_touched', type: 'string[]', required: false, desc: 'Systems this action interacts with' },
                { name: 'reversible', type: 'boolean', required: false, desc: 'Whether this action can be undone (default: true)' },
                { name: 'risk_score', type: 'number', required: false, desc: 'Risk score 0-100 (default: 0)' },
                { name: 'confidence', type: 'number', required: false, desc: 'Confidence level 0-100 (default: 50)' },
              ]}
              returns="Promise<{ action: Object, action_id: string }>"
              example={`const { action_id } = await claw.createAction({
  action_type: 'deploy',
  declared_goal: 'Deploy auth service to production',
  risk_score: 70,
  systems_touched: ['kubernetes', 'auth-service'],
  reasoning: 'Scheduled release after QA approval',
});`}
            />

            <MethodEntry
              id="waitForApproval"
              signature="claw.waitForApproval(actionId, options?)"
              description="Poll for human approval when an action enters pending_approval status."
              params={[
                { name: 'actionId', type: 'string', required: true, desc: 'The pending action_id to poll' },
                { name: 'options.timeout', type: 'number', required: false, desc: 'Maximum wait in ms (default: 300000)' },
                { name: 'options.interval', type: 'number', required: false, desc: 'Polling interval in ms (default: 5000)' },
              ]}
              returns="Promise<{ action: Object, action_id: string }>"
              example={`const approval = await claw.waitForApproval(action_id);`}
            />

            <MethodEntry
              id="updateOutcome"
              signature="claw.updateOutcome(actionId, outcome)"
              description="Update the outcome of an existing action."
              params={[
                { name: 'actionId', type: 'string', required: true, desc: 'The action_id to update' },
                { name: 'status', type: 'string', required: false, desc: 'New status: completed, failed, cancelled' },
                { name: 'output_summary', type: 'string', required: false, desc: 'What happened' },
                { name: 'error_message', type: 'string', required: false, desc: 'Error details if failed' },
                { name: 'duration_ms', type: 'number', required: false, desc: 'How long it took in milliseconds' },
              ]}
              returns="Promise<{ action: Object }>"
              example={`await claw.updateOutcome(action_id, {
  status: 'completed',
  output_summary: 'Auth service deployed successfully',
  duration_ms: 45000,
});`}
            />

            <MethodEntry
              id="recordAssumption"
              signature="claw.recordAssumption(assumption)"
              description="Register an assumption made during an action. Track what your agent believes to be true so you can validate or invalidate later."
              params={[
                { name: 'action_id', type: 'string', required: true, desc: 'Parent action ID' },
                { name: 'assumption', type: 'string', required: true, desc: 'The assumption being made' },
              ]}
              returns="Promise<{ assumption: Object, assumption_id: string }>"
              example={`const { assumption_id } = await claw.recordAssumption({
  action_id: 'act_abc123',
  assumption: 'Database schema is unchanged since last deploy',
});`}
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
            <p className="text-sm text-zinc-400 mb-4">
              Automatic detection of problematic agent behavior. Seven signal types fire based on action patterns.
            </p>

            <MethodEntry
              id="getSignals"
              signature="claw.getSignals()"
              description="Get current risk signals across all agents. Returns 7 signal types: autonomy_spike, high_impact_low_oversight, repeated_failures, stale_loop, assumption_drift, stale_assumption, and stale_running_action."
              params={[]}
              returns="Promise<{ signals: Object[], counts: { red: number, amber: number, total: number } }>"
              example={`const { signals, counts } = await claw.getSignals();
console.log(\`\${counts.red} red signals detected\`);`}
            />

            <div className="mt-6 p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
              <h4 className="text-sm font-semibold text-white mb-3">Signal Types</h4>
              <div className="space-y-2">
                {[
                  { name: 'autonomy_spike', desc: 'Agent taking too many actions without human checkpoints' },
                  { name: 'high_impact_low_oversight', desc: 'Critical actions without sufficient review' },
                  { name: 'repeated_failures', desc: 'Same action type failing multiple times' },
                  { name: 'stale_loop', desc: 'Open loops unresolved past their expected timeline' },
                  { name: 'assumption_drift', desc: 'Assumptions becoming stale or contradicted by outcomes' },
                  { name: 'stale_assumption', desc: 'Assumptions not validated within expected timeframe' },
                  { name: 'stale_running_action', desc: 'Actions stuck in running state for over 4 hours' },
                ].map((s) => (
                  <div key={s.name} className="flex items-start gap-3">
                    <code className="font-mono text-xs text-brand shrink-0 pt-0.5">{s.name}</code>
                    <span className="text-xs text-zinc-400">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Swarm Intelligence ── */}
          <section id="swarm-intelligence" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <Users size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Swarm Intelligence</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Visualize multi-agent communication and operational drift in real-time.</p>
            <div className="p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
              <h4 className="text-sm font-semibold text-white mb-3">Swarm Grouping</h4>
              <p className="text-xs text-zinc-400 mb-3">
                Use the <code className="font-mono text-brand">swarmId</code> constructor parameter to group related agents together in the neural web.
              </p>
              <CodeBlock>{`const claw = new DashClaw({
  agentId: 'researcher-1',
  swarmId: 'research-fleet-alpha',
});`}</CodeBlock>
            </div>
          </section>

          {/* ── Loops & Assumptions ── */}
          <section id="loops-assumptions" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center">
                <CircleDot size={16} className="text-brand" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">Loops & Assumptions</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Track unresolved dependencies and log what your agents assume.</p>

            <MethodEntry
              id="registerOpenLoop"
              signature="claw.registerOpenLoop(loop)"
              description="Register an open loop (unresolved dependency, pending approval, etc.) for an action."
              params={[
                { name: 'action_id', type: 'string', required: true, desc: 'Parent action ID' },
                { name: 'loop_type', type: 'string', required: true, desc: 'followup, question, dependency, approval, review, handoff, other' },
                { name: 'description', type: 'string', required: true, desc: 'What needs to be resolved' },
              ]}
              returns="Promise<{ loop_id: string }>"
              example={`// Example: Blocking deployment until manual human review is complete
await claw.registerOpenLoop({
  action_id: 'act_deploy_99',
  loop_type: 'approval',
  description: 'Manager approval required for production database schema migration'
});`}
            />

            <MethodEntry
              id="resolveOpenLoop"
              signature="claw.resolveOpenLoop(loopId, status, resolution?)"
              description="Resolve or cancel an open loop."
              params={[
                { name: 'loopId', type: 'string', required: true, desc: 'Loop ID' },
                { name: 'status', type: 'string', required: true, desc: '"resolved" or "cancelled"' },
                { name: 'resolution', type: 'string', required: false, desc: 'Resolution description' },
              ]}
              example={`// Example: Closing the loop once approval is received
await claw.resolveOpenLoop(
  'loop_123', 
  'resolved', 
  'Approved by @eng-manager via Slack #deploy-approvals'
);`}
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
            <p className="text-sm text-zinc-400 mb-4">Track agent improvement velocity and maturity levels.</p>
            <MethodEntry
              id="getLearningVelocity"
              signature="claw.getLearningVelocity({ agent_id })"
              description="Get agent improvement rate over time."
              returns="Promise<Object>"
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
              id="createPromptTemplate"
              signature="claw.createPromptTemplate({ name, content })"
              description="Create a new version-controlled prompt template."
              params={[
                { name: 'name', type: 'string', required: true, desc: 'Template name' },
                { name: 'content', type: 'string', required: true, desc: 'Mustache template string' },
              ]}
              returns="Promise<Object>"
              example={`// Example: Managing a support agent prompt
await claw.createPromptTemplate({
  name: 'customer-support-v1',
  content: 'You are a helpful assistant for {{company}}. The user name is {{user_name}}.'
});`}
            />
            <MethodEntry
              id="renderPrompt"
              signature="claw.renderPrompt({ template_id, variables })"
              description="Fetch a rendered prompt from the DashClaw server. This allows you to manage prompt strings, personas, and system instructions in the dashboard rather than hardcoding them in your agent's source code. Supports versioning and instant rollbacks."
              params={[
                { name: 'template_id', type: 'string', required: true, desc: 'The ID or slug of the template stored in DashClaw' },
                { name: 'variables', type: 'object', required: true, desc: 'Key-value pairs to inject into the template {{tags}}' },
              ]}
              returns="Promise<{ rendered: string, version_id: string }>"
              example={`// 1. You store a template in DashClaw called "marketing-persona"
// Content: "You are a marketing expert for {{company}}. Generate a tweet about {{product}}."

// 2. Your agent calls it dynamically:
const { rendered } = await claw.renderPrompt({
  template_id: 'marketing-persona',
  variables: { 
    company: 'Apple', 
    product: 'iPhone 16 Pro' 
  }
});

// rendered = "You are a marketing expert for Apple. Generate a tweet about iPhone 16 Pro."
const response = await llm.generate(rendered);`}
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
              signature="claw.createScorer({ name, scorerType, config })"
              description="Create a new evaluation scorer."
              params={[
                { name: 'name', type: 'string', required: true, desc: 'Scorer name' },
                { name: 'scorerType', type: 'string', required: true, desc: 'regex, keywords, numeric_range, llm_judge' },
              ]}
              example={`// Example: Creating a JSON validity scorer
await claw.createScorer({
  name: 'Valid JSON',
  scorerType: 'regex',
  config: { pattern: '^\\\\{.*\\\\}$' }
});`}
            />
            <MethodEntry id="listScorers" signature="claw.getScorers()" description="List all available scorers." />
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
              signature="claw.createScoringProfile({ name, dimensions })"
              description="Define weighted quality scoring rules."
              params={[
                { name: 'name', type: 'string', required: true, desc: 'Profile name' },
                { name: 'dimensions', type: 'array', required: true, desc: 'Weighted scoring dimensions' },
              ]}
              example={`// Example: Weighted profile for code reviews
await claw.createScoringProfile({
  name: 'Code Review Quality',
  dimensions: [
    { name: 'Security', weight: 0.6, scorer_id: 'sc_sec_99' },
    { name: 'Style', weight: 0.4, scorer_id: 'sc_lint_11' }
  ]
});`}
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
              signature="claw.mapCompliance(framework)"
              description="Map active policies to compliance controls."
              params={[{ name: 'framework', type: 'string', required: true, desc: 'nist-ai-rmf, eu-ai-act, etc.' }]}
              example={`// Example: Mapping policies to NIST AI RMF
const { map } = await claw.mapCompliance('nist-ai-rmf');
console.log(\`Coverage: \${map.coverage_percentage}%\`);`}
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
              signature="claw.getActivityLogs(filters?)"
              description="Query the organization activity audit log."
              params={[{ name: 'limit', type: 'number', required: false, desc: 'Max results' }]}
              example={`// Example: Auditing recent admin changes
const { logs } = await claw.getActivityLogs({ 
  limit: 10, 
  resource_type: 'policy' 
});`}
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
              signature="claw.createWebhook({ url, events })"
              description="Register a new webhook endpoint."
              params={[
                { name: 'url', type: 'string', required: true },
                { name: 'events', type: 'string[]', required: false },
              ]}
              example={`// Example: Notifying Slack on blocked actions
await claw.createWebhook({
  url: 'https://hooks.slack.com/services/...',
  events: ['guard.block', 'action.failed']
});`}
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
                <h3 className="text-lg font-semibold text-white mb-2">Real-Time Events</h3>
                <MethodEntry id="events" signature="claw.events()" description="Low-level SSE connection handle." />
              </section>

              {/* User Feedback */}
              <section id="user-feedback" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2">User Feedback</h3>
                <MethodEntry id="submitFeedback" signature="claw.submitFeedback(...)" />
              </section>

              {/* Dashboard Data (Misc recording) */}
              <section id="dashboard-data" className="scroll-mt-20 pt-12 border-t border-[rgba(255,255,255,0.06)]">
                <h3 className="text-lg font-semibold text-white mb-2">Dashboard Data</h3>
                <MethodEntry id="reportTokenUsage" signature="claw.reportTokenUsage(...)" />
                <MethodEntry id="createGoal" signature="claw.createGoal(...)" />
              </section>
            </div>
          )}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
