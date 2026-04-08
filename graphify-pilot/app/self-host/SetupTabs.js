'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Database, Cloud, Github, Zap, KeyRound } from 'lucide-react';
import SecretGenerator from '../components/SecretGenerator';
import CopyMarkdownButton from '../components/CopyMarkdownButton';
import CopyableCodeBlock from '../components/CopyableCodeBlock';

function StepCard({ n, title, desc, icon: Icon, children }) {
  return (
    <div className="rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)] p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[rgba(249,115,22,0.1)] flex items-center justify-center shrink-0">
          <Icon size={18} className="text-brand" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center">{n}</span>
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">{desc}</p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export default function SetupTabs() {
  const [activeTab, setActiveTab] = useState('quick');

  return (
    <div className="space-y-6">
      {/* Callout Banner */}
      <div className="bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.2)] rounded-lg px-4 py-3">
        <p className="text-sm text-zinc-300">
          No OAuth required to get started. Use Quick Start to deploy solo in under 10 minutes.
          Switch to Team Setup when you&apos;re ready to invite teammates.
        </p>
      </div>

      {/* Tabs Toggle */}
      <div className="flex p-1 bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'quick'
              ? 'bg-[#1a1a1a] text-brand border border-[rgba(255,255,255,0.08)] shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Quick Start
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'team'
              ? 'bg-[#1a1a1a] text-brand border border-[rgba(255,255,255,0.08)] shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Team Setup
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* Step 1: Neon - Common to both */}
        <StepCard
          n="1"
          title="Create a free Neon database"
          desc="Neon gives you a serverless Postgres database on their free tier — no credit card required."
          icon={Database}
        >
          <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1.5 mb-4">
            <li>Sign up at <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-hover transition-colors">neon.tech</a></li>
            <li>Create a new project (any name, e.g. &quot;dashclaw&quot;)</li>
            <li>Copy the connection string — it looks like <code className="text-zinc-300 font-mono text-xs">postgresql://user:pass@ep-xyz.neon.tech/neondb</code></li>
          </ol>
          <p className="text-xs text-zinc-500">
            You&apos;ll paste this as <code className="font-mono text-zinc-300">DATABASE_URL</code> in the next step.
          </p>
        </StepCard>

        {/* Step 2: Vercel - Common to both */}
        <StepCard
          n="2"
          title="Deploy to Vercel"
          desc="Fork the repo and import it into Vercel. Add the environment variables and deploy."
          icon={Cloud}
        >
          <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1.5 mb-4">
            <li>Fork <a href="https://github.com/ucsandman/DashClaw" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-hover transition-colors">ucsandman/DashClaw</a> to your GitHub account</li>
            <li>Go to <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-hover transition-colors">vercel.com/new</a> and import your fork</li>
            <li>Generate your secrets, then paste them into Vercel&apos;s environment variables:</li>
          </ol>
          <SecretGenerator />
          <div className="mt-3 rounded-lg bg-[rgba(249,115,22,0.05)] border border-brand/10 px-4 py-3 text-xs text-zinc-400">
            <strong className="text-zinc-300">About the API key:</strong> <code className="font-mono text-zinc-300">DASHCLAW_API_KEY</code> is your bootstrap admin key — it authenticates agents and seeds your first organization. After you sign in, you can create and manage additional API keys from the dashboard at <code className="font-mono text-zinc-300">/api-keys</code>.
          </div>
          <p className="mt-2 text-xs text-zinc-500">Tables are created automatically on first request.</p>
        </StepCard>

        {/* Step 3: Conditional */}
        {activeTab === 'quick' ? (
          <StepCard
            n="3"
            title="Set your admin password"
            desc="No OAuth app required. Add one environment variable in Vercel and you can sign in immediately."
            icon={KeyRound}
          >
            <p className="text-sm text-zinc-400 mb-3">
              In your Vercel project → Settings → Environment Variables, add:
            </p>
            <div className="bg-[#0a0a0a] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.06)] font-mono text-sm mb-3">
              <span className="text-brand">DASHCLAW_LOCAL_ADMIN_PASSWORD</span> = your-strong-password-here
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              Then redeploy. Visit your app and sign in with your password on the login page.
            </p>
            <p className="text-zinc-500 text-xs">
              Use a strong password. This grants full admin access. You can add OAuth later when you want to invite teammates.
            </p>
          </StepCard>
        ) : (
          <StepCard
            n="3"
            title="Set up GitHub OAuth"
            desc="Create a GitHub OAuth app so you can sign in to your dashboard."
            icon={Github}
          >
            <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1.5 mb-4">
              <li>Go to <a href="https://github.com/settings/developers" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-hover transition-colors">GitHub Developer Settings</a> → OAuth Apps → New OAuth App</li>
              <li>Set <strong className="text-zinc-200">Homepage URL</strong> to <code className="font-mono text-zinc-300 text-xs">https://your-app.vercel.app</code></li>
              <li>Set <strong className="text-zinc-200">Authorization callback URL</strong> to <code className="font-mono text-zinc-300 text-xs">https://your-app.vercel.app/api/auth/callback/github</code></li>
              <li>Copy the Client ID and Client Secret into your Vercel env vars as <code className="font-mono text-zinc-300">GITHUB_ID</code> and <code className="font-mono text-zinc-300">GITHUB_SECRET</code></li>
              <li>Redeploy from the Vercel dashboard</li>
            </ol>
            <p className="text-xs text-zinc-500">
              Replace <code className="font-mono text-zinc-300">your-app.vercel.app</code> with your actual Vercel domain.
            </p>
          </StepCard>
        )}

        {/* Step 4: Redis - Common */}
        <StepCard
          n="4"
          title="Enable Live Updates (Redis)"
          desc="Use Upstash Redis to bridge Vercel's serverless functions for real-time dashboard events."
          icon={Zap}
        >
          <ol className="list-decimal list-inside text-sm text-zinc-400 space-y-1.5 mb-4">
            <li>Sign up for a free account at <a href="https://upstash.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-hover transition-colors">upstash.com</a></li>
            <li>Create a new Redis database (Global or in the same region as your Vercel app)</li>
            <li>Copy the <strong className="text-zinc-200">REST URL</strong> and <strong className="text-zinc-200">REST Token</strong>, or the raw <strong className="text-zinc-200">Redis URL</strong></li>
            <li>Add these environment variables to Vercel:
              <ul className="list-disc list-inside ml-4 mt-1 text-zinc-500 text-xs font-mono">
                <li>REALTIME_BACKEND=redis</li>
                <li>REDIS_URL=&lt;redis-connection-string&gt;</li>
                <li>REALTIME_ENFORCE_REDIS=true</li>
              </ul>
            </li>
            <li>Redeploy your Vercel app to apply the changes</li>
          </ol>
          <p className="text-xs text-zinc-500">
            The 30MB free tier at Upstash is more than enough for DashClaw&apos;s live event buffer.
          </p>
        </StepCard>

        {/* Step 5: Agents - Common */}
        <StepCard
          n="5"
          title="Connect your agents"
          desc="Agents only need a base URL + API key. Once connected, they can record decisions, enforce policies, score outputs, define quality profiles, manage prompts, and track learning -- all through the SDK."
          icon={KeyRound}
        >
          <div className="mb-4">
            <CopyMarkdownButton
              href="/api/prompts/agent-connect/raw"
              label="Copy Agent Connect Prompt"
              rawLabel="View prompt"
            />
          </div>

          <h3 className="text-sm font-semibold text-white mt-6 mb-3">Agent environment</h3>
          <CopyableCodeBlock title="Agent environment" copyText={`DASHCLAW_BASE_URL=https://your-app.vercel.app
DASHCLAW_API_KEY=<your-secret-api-key>
DASHCLAW_AGENT_ID=my-agent`}>{`DASHCLAW_BASE_URL=https://your-app.vercel.app
DASHCLAW_API_KEY=<your-secret-api-key>
DASHCLAW_AGENT_ID=my-agent`}</CopyableCodeBlock>
          <p className="text-xs text-zinc-500 mt-2">
            Your Vercel app uses Vercel env vars. Your agent uses its own environment variables.
          </p>

          <h3 className="text-sm font-semibold text-white mt-8 mb-3">Quick integration (Node.js)</h3>
          <CopyableCodeBlock title="agent.js" copyText={`import { DashClaw } from 'dashclaw';

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
  guardMode: 'warn',
});

// Record a decision
const action = await dc.createAction({
  actionType: 'deploy',
  declaredGoal: 'Ship auth-service v2.1',
  riskScore: 40,
});

// Guard check (policy enforcement)
const decision = await dc.guard({
  actionType: 'deploy',
  content: 'Deploying to production',
  riskScore: 40,
});

// Score the output quality
await dc.scoreOutput({
  scorer_id: 'es_your_scorer',
  output: deployResult,
  action_id: action.action_id,
});

// Score against your custom quality profile
const profileScore = await dc.scoreWithProfile('sp_your_profile', {
  duration_ms: deployResult.duration,
  confidence: deployResult.confidence,
  action_id: action.action_id,
});

// Update outcome
await dc.updateOutcome(action.action_id, {
  status: 'completed',
  outputSummary: 'Deployed successfully',
});`}>{`import { DashClaw } from 'dashclaw';

const dc = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
  guardMode: 'warn',
});

// Record a decision
const action = await dc.createAction({
  actionType: 'deploy',
  declaredGoal: 'Ship auth-service v2.1',
  riskScore: 40,
});

// Guard check (policy enforcement)
const decision = await dc.guard({
  actionType: 'deploy',
  content: 'Deploying to production',
  riskScore: 40,
});

// Score the output quality
await dc.scoreOutput({
  scorer_id: 'es_your_scorer',
  output: deployResult,
  action_id: action.action_id,
});

// Score against your custom quality profile
const profileScore = await dc.scoreWithProfile('sp_your_profile', {
  duration_ms: deployResult.duration,
  confidence: deployResult.confidence,
  action_id: action.action_id,
});

// Update outcome
await dc.updateOutcome(action.action_id, {
  status: 'completed',
  outputSummary: 'Deployed successfully',
});`}</CopyableCodeBlock>

          <h3 className="text-sm font-semibold text-white mt-8 mb-3">Quick integration (Python)</h3>
          <CopyableCodeBlock title="agent.py" copyText={`from dashclaw import DashClaw

dc = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent",
    guard_mode="warn",
)

# Record a decision
action = dc.create_action(
    action_type="deploy",
    declared_goal="Ship auth-service v2.1",
    risk_score=40,
)

# Guard check (policy enforcement)
decision = dc.guard(
    action_type="deploy",
    content="Deploying to production",
    risk_score=40,
)

# Score the output quality
dc.score_output(
    scorer_id="es_your_scorer",
    output=deploy_result,
    action_id=action["action_id"],
)

# Score against your custom quality profile
profile_score = dc.score_with_profile("sp_your_profile", {
    "duration_ms": deploy_result["duration"],
    "confidence": deploy_result["confidence"],
    "action_id": action["action_id"],
})

# Update outcome
dc.update_outcome(action["action_id"],
    status="completed",
    output_summary="Deployed successfully",
)`}>{`from dashclaw import DashClaw

dc = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent",
    guard_mode="warn",
)

# Record a decision
action = dc.create_action(
    action_type="deploy",
    declared_goal="Ship auth-service v2.1",
    risk_score=40,
)

# Guard check (policy enforcement)
decision = dc.guard(
    action_type="deploy",
    content="Deploying to production",
    risk_score=40,
)

# Score the output quality
dc.score_output(
    scorer_id="es_your_scorer",
    output=deploy_result,
    action_id=action["action_id"],
)

# Score against your custom quality profile
profile_score = dc.score_with_profile("sp_your_profile", {
    "duration_ms": deploy_result["duration"],
    "confidence": deploy_result["confidence"],
    "action_id": action["action_id"],
})

# Update outcome
dc.update_outcome(action["action_id"],
    status="completed",
    output_summary="Deployed successfully",
)`}</CopyableCodeBlock>
        </StepCard>
      </div>
    </div>
  );
}
