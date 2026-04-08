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
    'Canonical golden path for connecting a real Node or Python agent to DashClaw and validating the first live action.',
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

          {/* Framework Guides - per D-10 */}
          <section className="mt-12 rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6 sm:p-8">
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

