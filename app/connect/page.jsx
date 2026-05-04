import { headers } from 'next/headers';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import HostedProvisionSection from './HostedProvisionSection';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Connect Claude Code in 5 minutes - DashClaw',
  description:
    'Single-page copy-paste runbook. Install the hook, paste your workspace token, configure Discord for phone approvals. 5 minutes end-to-end.',
};

export default async function ConnectPage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const baseUrl = host === 'dashclaw.io' ? 'https://my-dashclaw.vercel.app' : `https://${host}`;

  return (
    <div className="min-h-screen bg-surface-primary text-text-primary">
      <PublicNavbar />

      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-2 text-sm text-text-tertiary">
            <Link href="/" className="transition-colors hover:text-text-secondary">
              Home
            </Link>
            <ChevronRight size={14} />
            <span className="text-text-secondary">Connect Claude Code</span>
          </div>

          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              Connect Claude Code in 5 minutes.
            </h1>
            <p className="mt-3 text-base text-text-secondary max-w-2xl">
              Top-to-bottom runbook. Copy one command, paste one workspace token, configure Discord for phone approvals. Done.
            </p>
          </header>

          <HostedProvisionSection />

          {/* Linear runbook — D-15 single-page, no multi-step wizard. */}
          <section className="mt-10 space-y-6">
            <article className="rounded-2xl border border-border bg-surface-secondary p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Runbook</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">1. Install the Claude Code hooks</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Clone the repo and run the installer. One command copies the PreToolUse, PostToolUse, and Stop hooks into <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-text-secondary">.claude/hooks/</code> and merges settings.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`git clone https://github.com/ucsandman/DashClaw
cd DashClaw
npm install
npm run hooks:install`}</pre>
            </article>

            <article className="rounded-2xl border border-border bg-surface-secondary p-6 sm:p-8">
              <h2 className="mt-0 text-2xl font-semibold tracking-tight text-text-primary">2. Paste your workspace token</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Generate a workspace token above (hosted trial) or from your self-hosted instance settings. Export it alongside your instance URL:
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`export DASHCLAW_BASE_URL=${baseUrl}
export DASHCLAW_API_KEY=dc_live_...`}</pre>
              <p className="mt-3 text-xs text-text-tertiary">
                Never use https://dashclaw.io as the agent base URL — point at your own instance.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-surface-secondary p-6 sm:p-8">
              <h2 className="mt-0 text-2xl font-semibold tracking-tight text-text-primary">3. Configure Discord for phone approvals</h2>
              <p className="mt-2 text-sm text-text-secondary">
                When Claude Code tries something risky, DashClaw pauses and sends a Discord DM with Approve / Reject buttons. Three env vars unlock the phone loop:
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`DISCORD_BOT_TOKEN=<token>
DISCORD_APPROVER_USER_ID=<your-discord-user-id>
DISCORD_APPROVER_ORG_ID=<your-org-id>`}</pre>
              <p className="mt-3 text-sm text-text-secondary">
                Full bot-setup steps live in the{' '}
                <Link href="/guides/claude-code" className="text-brand hover:text-brand-hover">
                  Claude Code integration guide
                </Link>
                . Takes about 10 minutes end-to-end, one time.
              </p>
            </article>

            <article className="rounded-2xl border border-border bg-surface-secondary p-6 sm:p-8">
              <h2 className="mt-0 text-2xl font-semibold tracking-tight text-text-primary">Verify</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Run <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-text-primary">dashclaw doctor</code> from any terminal. Exit 0 = healthy. Ask Claude Code to run something risky (<code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-text-primary">rm -rf test/</code>) — you should receive a Discord DM within ~1 second.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`npm install -g @dashclaw/cli
dashclaw doctor`}</pre>
            </article>
          </section>

          {/* MCP Server — Zero Code Path */}
          <section className="mt-12 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Fastest path</p>
              <span className="rounded-full border border-brand/20 bg-brand/10 px-2.5 py-0.5 text-[11px] font-medium text-brand">
                Under 2 minutes
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">
              MCP Server <span className="font-normal text-text-tertiary">(zero code)</span>
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Connect any MCP-compatible client — Claude Code, Claude Desktop, or Claude Managed Agents — to DashClaw governance with one config line. No SDK, no hooks, no code changes.
            </p>

            <div className="mt-6 space-y-4">
              {/* Claude Code / Claude Desktop */}
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Claude Code / Claude Desktop</h3>
                <p className="mt-1 text-xs text-text-tertiary">
                  Add to your <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[11px] text-text-secondary">claude_desktop_config.json</code> or Claude Code settings:
                </p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`{
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
                <h3 className="text-sm font-semibold text-text-primary">Claude Managed Agents</h3>
                <p className="mt-1 text-xs text-text-tertiary">Pass DashClaw as an MCP server when creating your agent:</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`agent = client.beta.agents.create(
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
            <div className="mt-4 rounded-2xl border border-border bg-surface-tertiary p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">What you get</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-text-secondary">8 Governance Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['guard', 'record', 'invoke', 'capabilities_list', 'policies_list', 'wait_for_approval', 'session_start', 'session_end'].map((tool) => (
                      <span key={tool} className="rounded-md border border-border bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-text-secondary">{tool}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-text-secondary">4 Resources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['policies', 'capabilities', 'agent history', 'status'].map((res) => (
                      <span key={res} className="rounded-md border border-border bg-surface-tertiary px-2 py-0.5 font-mono text-[11px] text-text-secondary">{res}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Verify with Doctor */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Verify</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">Confirm your instance is healthy</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Once the agent is connected, run <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-text-primary">dashclaw doctor</code> from any terminal. It checks database, configuration, auth, deployment, SDK reachability, governance staleness, and shape drift — and auto-fixes safe issues.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">From any terminal</h3>
                <p className="mt-1 text-xs text-text-tertiary">Diagnoses and applies safe fixes via your instance&rsquo;s API.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`npm install -g @dashclaw/cli
dashclaw doctor`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Self-host operator</h3>
                <p className="mt-1 text-xs text-text-tertiary">Adds filesystem-level fixes (env writes, migrations, default-policy seed). Backs up <code className="font-mono text-text-secondary">.env</code> before any write.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`npm run doctor`}</pre>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-text-tertiary">
              Exit codes: <code className="font-mono text-text-secondary">0</code> healthy, <code className="font-mono text-text-secondary">1</code> warnings or unreachable. Add <code className="font-mono text-text-secondary">--json</code> for CI.
            </p>
          </section>

          {/* Approval channels */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Resolve approvals</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">Where humans unblock the agent</h2>
            <p className="mt-2 text-sm text-text-secondary">
              When your agent calls <code className="rounded border border-border bg-surface-elevated px-1 py-0.5 font-mono text-[12px] text-text-primary">waitForApproval</code>, any of the four surfaces below can resolve the action. They all hit the same <code className="font-mono text-text-secondary">/api/approvals/:id</code> endpoint and sync over SSE within ~1 second.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Dashboard <span className="font-normal text-text-tertiary">— always on</span></h3>
                <p className="mt-1 text-xs text-text-tertiary">Interactive queue with triggering policy, risk score, and replay link.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`https://<your-instance>/approvals`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">CLI <span className="font-normal text-text-tertiary">— for terminal-first devs</span></h3>
                <p className="mt-1 text-xs text-text-tertiary">Interactive inbox or targeted approve / deny by action ID.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`npm install -g @dashclaw/cli
dashclaw approvals`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Mobile PWA <span className="font-normal text-text-tertiary">— on-call</span></h3>
                <p className="mt-1 text-xs text-text-tertiary">Add <code className="font-mono text-text-secondary">/approve</code> to your home screen. One-tap Allow / Deny from the phone.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`https://<your-instance>/approve`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Discord bot <span className="font-normal text-text-tertiary">— phone-first</span></h3>
                <p className="mt-1 text-xs text-text-tertiary">Inline Approve / Deny buttons DM&rsquo;d to the registered user. Fire-and-forget — action creation succeeds even if Discord is unreachable.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`DISCORD_BOT_TOKEN=<token>
DISCORD_APPROVER_USER_ID=<user-id>`}</pre>
              </div>
              <div className="rounded-2xl border border-border bg-surface-tertiary p-5">
                <h3 className="text-sm font-semibold text-text-primary">Telegram bot <span className="font-normal text-text-tertiary">— optional</span></h3>
                <p className="mt-1 text-xs text-text-tertiary">Inline Approve / Reject buttons pushed to an admin chat. Warn-logs and moves on if Telegram is unreachable.</p>
                <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface-primary p-4 text-xs leading-relaxed text-text-secondary">{`npm run telegram:setup`}</pre>
              </div>
            </div>
          </section>

          {/* Framework Guides */}
          <section className="mt-6 rounded-3xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-tertiary">Framework guides</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-primary">Connect your framework</h2>
            <p className="mt-2 text-sm text-text-secondary">Step-by-step guides for popular agent frameworks. Each takes under 20 minutes.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { href: '/guides/claude-code', title: 'Claude Code', desc: 'Govern Bash, Edit, Write, and MultiEdit tool calls via PreToolUse hooks. Zero SDK code required.' },
                { href: '/guides/openai-agents-sdk', title: 'OpenAI Agents SDK', desc: 'Add guard-record-outcome governance to your OpenAI agent tools with the Node.js SDK.' },
                { href: '/guides/langgraph', title: 'LangGraph', desc: 'Add a governance node to your LangGraph StateGraph with the Python SDK. Includes runnable example.' },
                { href: '/guides/crewai', title: 'CrewAI', desc: 'Govern CrewAI tool calls using the @tool decorator pattern with the Python SDK. Includes runnable example.' },
                { href: '/docs#openclaw-plugin', title: 'OpenClaw', desc: 'Framework-native plugin: intercepts PreToolUse / PostToolUse and calls guard, record, and waitForApproval automatically.' },
              ].map((g) => (
                <Link
                  key={g.href}
                  href={g.href}
                  className="group rounded-2xl border border-border bg-surface-tertiary p-5 transition-colors hover:border-border-active"
                >
                  <h3 className="text-base font-semibold text-text-primary transition-colors group-hover:text-brand">{g.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{g.desc}</p>
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

