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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
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

          {/* MCP Server - Zero Code Path */}
          <section className="mt-12 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Fastest path</p>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand border border-brand/20">Under 2 minutes</span>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">MCP Server <span className="text-zinc-500 font-normal">(Zero Code)</span></h2>
            <p className="mt-2 text-sm text-zinc-400">
              Connect any MCP-compatible client — Claude Code, Claude Desktop, or Claude Managed Agents — to DashClaw governance with one config line. No SDK, no hooks, no code changes.
            </p>

            <div className="mt-6 space-y-4">
              {/* Claude Code / Claude Desktop */}
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5">
                <h3 className="text-sm font-semibold text-zinc-300">Claude Code / Claude Desktop</h3>
                <p className="mt-1 text-xs text-zinc-500">Add to your <code className="text-zinc-400 bg-zinc-800 px-1 py-0.5 rounded">claude_desktop_config.json</code> or Claude Code settings:</p>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] p-4 text-xs text-zinc-300 leading-relaxed">{`{
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
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5">
                <h3 className="text-sm font-semibold text-zinc-300">Claude Managed Agents</h3>
                <p className="mt-1 text-xs text-zinc-500">Pass DashClaw as an MCP server when creating your agent:</p>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-[#0a0a0a] border border-[rgba(255,255,255,0.06)] p-4 text-xs text-zinc-300 leading-relaxed">{`agent = client.beta.agents.create(
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
            <div className="mt-4 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">What you get</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-1.5">8 Governance Tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['guard', 'record', 'invoke', 'capabilities_list', 'policies_list', 'wait_for_approval', 'session_start', 'session_end'].map((tool) => (
                      <span key={tool} className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs font-mono text-zinc-400">{tool}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400 mb-1.5">4 Resources</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['policies', 'capabilities', 'agent history', 'status'].map((res) => (
                      <span key={res} className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs font-mono text-zinc-400">{res}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Framework Guides - per D-10 */}
          <section className="mt-6 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Framework guides</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white">Connect your framework</h2>
            <p className="mt-2 text-sm text-zinc-400">Step-by-step guides for popular agent frameworks. Each takes under 20 minutes.</p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link href="/guides/claude-code" className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5 transition-colors hover:border-brand/30">
                <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors">Claude Code</h3>
                <p className="mt-1 text-sm text-zinc-400">Govern Bash, Edit, Write, and MultiEdit tool calls via PreToolUse hooks. Zero SDK code required.</p>
              </Link>
              <Link href="/guides/openai-agents-sdk" className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5 transition-colors hover:border-brand/30">
                <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors">OpenAI Agents SDK</h3>
                <p className="mt-1 text-sm text-zinc-400">Add guard-record-outcome governance to your OpenAI agent tools with the Node.js SDK.</p>
              </Link>
              <Link href="/guides/langgraph" className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5 transition-colors hover:border-brand/30">
                <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors">LangGraph</h3>
                <p className="mt-1 text-sm text-zinc-400">Add a governance node to your LangGraph StateGraph with the Python SDK. Includes runnable example.</p>
              </Link>
              <Link href="/guides/crewai" className="group rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-5 transition-colors hover:border-brand/30">
                <h3 className="text-base font-semibold text-white group-hover:text-brand transition-colors">CrewAI</h3>
                <p className="mt-1 text-sm text-zinc-400">Govern CrewAI tool calls using the @tool decorator pattern with the Python SDK. Includes runnable example.</p>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

