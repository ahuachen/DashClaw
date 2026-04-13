import { headers } from 'next/headers';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import ConnectGuideClient from './ConnectGuideClient';
import { getConnectGuideContent } from '../lib/connectGuide.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Connect your first agent - DashClaw',
  description:
    'Connect any agent to DashClaw governance in under 2 minutes via MCP Server, or follow step-by-step guides for Claude Code, OpenAI Agents SDK, LangGraph, and CrewAI.',
};

export default async function ConnectPage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const content = getConnectGuideContent({ host });

  return (
    <div className="min-h-screen bg-surface-primary text-white">
      <PublicNavbar />

      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-300">
              Home
            </Link>
            <ChevronRight size={14} />
            <span className="text-zinc-300">Connect your first agent</span>
          </div>

          <ConnectGuideClient content={content} />

          {/* MCP Server — Zero Code Path */}
          <section className="mt-12 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Fastest path</p>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                Under 2 minutes
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
              MCP Server <span className="font-normal text-zinc-500">(zero code)</span>
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Connect any MCP-compatible client — Claude Code, Claude Desktop, or Claude Managed Agents — to DashClaw governance with one config line. No SDK, no hooks, no code changes.
            </p>

            <div className="mt-6 space-y-4">
              {/* Claude Code / Claude Desktop */}
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Claude Code / Claude Desktop</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Add to your <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[11px] text-zinc-300">claude_desktop_config.json</code> or Claude Code settings:
                </p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": {
        "DASHCLAW_URL": "https://your-dashclaw.vercel.app",
        "DASHCLAW_API_KEY": "oc_live_..."
      }
    }
  }
}`}</pre>
              </div>

              {/* Claude Managed Agents */}
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Claude Managed Agents</h3>
                <p className="mt-1 text-xs text-zinc-500">Pass DashClaw as an MCP server when creating your agent:</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`agent = client.beta.agents.create(
    name="Governed Agent",
    model="claude-sonnet-4-6",
    tools=[{"type": "agent_toolset_20260401"}],
    mcp_servers=[{
        "type": "url",
        "url": "https://your-dashclaw.vercel.app/api/mcp",
        "headers": {"x-api-key": "oc_live_..."},
        "name": "dashclaw"
    }],
)`}</pre>
              </div>
            </div>

            {/* What you get */}
            <div className="mt-4 rounded-2xl border border-border bg-white/[0.02] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">What you get</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400">8 Governance Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['guard', 'record', 'invoke', 'capabilities_list', 'policies_list', 'wait_for_approval', 'session_start', 'session_end'].map((tool) => (
                      <span key={tool} className="rounded-md border border-border bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-zinc-300">{tool}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-400">4 Resources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['policies', 'capabilities', 'agent history', 'status'].map((res) => (
                      <span key={res} className="rounded-md border border-border bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-zinc-300">{res}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Verify with Doctor */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Verify</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Confirm your instance is healthy</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Once the agent is connected, run <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-zinc-200">dashclaw doctor</code> from any terminal. It checks database, configuration, auth, deployment, SDK reachability, governance staleness, and shape drift — and auto-fixes safe issues.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">From any terminal</h3>
                <p className="mt-1 text-xs text-zinc-500">Diagnoses and applies safe fixes via your instance&rsquo;s API.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`npm install -g @dashclaw/cli
dashclaw doctor`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Self-host operator</h3>
                <p className="mt-1 text-xs text-zinc-500">Adds filesystem-level fixes (env writes, migrations, default-policy seed). Backs up <code className="font-mono text-zinc-300">.env</code> before any write.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`npm run doctor`}</pre>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">
              Exit codes: <code className="font-mono text-zinc-300">0</code> healthy, <code className="font-mono text-zinc-300">1</code> warnings or unreachable. Add <code className="font-mono text-zinc-300">--json</code> for CI.
            </p>
          </section>

          {/* Approval channels */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Resolve approvals</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Where humans unblock the agent</h2>
            <p className="mt-2 text-sm text-zinc-400">
              When your agent calls <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-zinc-200">waitForApproval</code>, any of the four surfaces below can resolve the action. They all hit the same <code className="font-mono text-zinc-300">/api/approvals/:id</code> endpoint and sync over SSE within ~1 second.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Dashboard <span className="font-normal text-zinc-500">— always on</span></h3>
                <p className="mt-1 text-xs text-zinc-500">Interactive queue with triggering policy, risk score, and replay link.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`https://<your-instance>/approvals`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">CLI <span className="font-normal text-zinc-500">— for terminal-first devs</span></h3>
                <p className="mt-1 text-xs text-zinc-500">Interactive inbox or targeted approve / deny by action ID.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`npm install -g @dashclaw/cli
dashclaw approvals`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Mobile PWA <span className="font-normal text-zinc-500">— on-call</span></h3>
                <p className="mt-1 text-xs text-zinc-500">Add <code className="font-mono text-zinc-300">/approve</code> to your home screen. One-tap Allow / Deny from the phone.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`https://<your-instance>/approve`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-zinc-200">Telegram bot <span className="font-normal text-zinc-500">— optional</span></h3>
                <p className="mt-1 text-xs text-zinc-500">Inline Approve / Reject buttons pushed to an admin chat. Warn-logs and moves on if Telegram is unreachable.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-zinc-300">{`npm run telegram:setup`}</pre>
              </div>
            </div>
          </section>

          {/* Framework Guides */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Framework guides</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">Connect your framework</h2>
            <p className="mt-2 text-sm text-zinc-400">Step-by-step guides for popular agent frameworks. Each takes under 20 minutes.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { href: '/guides/claude-code', title: 'Claude Code', desc: 'Govern Bash, Edit, Write, and MultiEdit tool calls via PreToolUse hooks. Zero SDK code required.' },
                { href: '/guides/openai-agents-sdk', title: 'OpenAI Agents SDK', desc: 'Add guard-record-outcome governance to your OpenAI agent tools with the Node.js SDK.' },
                { href: '/guides/langgraph', title: 'LangGraph', desc: 'Add a governance node to your LangGraph StateGraph with the Python SDK. Includes runnable example.' },
                { href: '/guides/crewai', title: 'CrewAI', desc: 'Govern CrewAI tool calls using the @tool decorator pattern with the Python SDK. Includes runnable example.' },
              ].map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  className="group rounded-2xl border border-border bg-surface-tertiary p-5 transition-colors hover:border-brand/30"
                >
                  <h3 className="text-base font-semibold text-white transition-colors group-hover:text-brand">{g.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{g.desc}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

