import Link from 'next/link';
import { Github, Terminal, ArrowLeft, Zap, Brain, Shield, Rocket, HeartPulse, Search, MessageSquare, ClipboardCheck, History, RefreshCw } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';

const toolCategories = [
  {
    title: 'Operations & Continuity',
    icon: Rocket,
    tools: [
      { name: 'session-handoff', desc: 'Generates structured handover documents for agent session continuity.', example: 'python handoff.py create' },
      { name: 'goal-tracker', desc: 'Tracks goals, milestones, and real-time progress markers.', example: 'python goals.py add "Feature X"' },
      { name: 'daily-digest', desc: 'Aggregates all agent activity into a single daily summary.', example: 'python digest.py generate' },
      { name: 'project-monitor', desc: 'Tracks engagement across different systems and repositories.', example: 'python monitor.py status' },
      { name: 'open-loops', desc: 'Tracks commitments made in conversation so nothing falls through the cracks.', example: 'python loops.py add "Follow up with X" --due 2026-02-06' },
      { name: 'api-monitor', desc: 'Tracks external services, rate limits, usage costs, and reliability metrics.', example: 'python apis.py status' },
      { name: 'backup-verify', desc: 'Non-destructive git health checks to verify repo integrity and commit history.', example: 'python verify.py' },
      { name: 'health-check', desc: 'Checks databases, services, critical files, and binaries for system readiness.', example: 'python health_check.py full' },
    ]
  },
  {
    title: 'Knowledge & Learning',
    icon: Brain,
    tools: [
      { name: 'learning-database', desc: 'Logs key decisions and lessons learned with outcome tracking.', example: 'python learner.py log "Decision X"' },
      { name: 'memory-health', desc: 'Scans memory files for duplication, staleness, and knowledge density.', example: 'python scanner.py scan' },
      { name: 'context-manager', desc: 'Manages key points and organizes context into topical threads.', example: 'python context.py capture' },
      { name: 'memory-search', desc: 'Advanced search utility for semantic lookup across agent memory.', example: 'python search.py "auth flow"' },
      { name: 'memory-extractor', desc: 'Turns raw chat logs or notes into structured memory file updates and open-loop drafts.', example: 'python extract.py --input notes.txt' },
      { name: 'automation-library', desc: 'Stores and retrieves reusable code snippets, commands, and workflows.', example: 'python snippets.py search "deploy"' },
    ]
  },
  {
    title: 'Security & Governance',
    icon: Shield,
    tools: [
      { name: 'outbound-filter', desc: 'Scans agent responses for leaked API keys, tokens, or PII.', example: 'python filter.py scan response.txt' },
      { name: 'session-isolator', desc: 'Ensures agent work remains within specific directory boundaries.', example: 'python isolate.py check .' },
      { name: 'audit-logger', desc: 'Local-first append-only log of all shell commands and external actions executed.', example: 'python audit_logger.py tail' },
      { name: 'secret-tracker', desc: 'Tracks API keys, tokens, and credentials and reminds you when to rotate them.', example: 'python secret_tracker.py due' },
      { name: 'data-classifier', desc: 'Tags files and content as sensitive, internal, or public and enforces handling rules.', example: 'python data_classifier.py classify file.txt' },
      { name: 'skill-checker', desc: 'Static safety scan for third-party skills — flags network exfil, exec patterns, and secrets in code.', example: 'python skill_checker.py scan --fail-on high' },
      { name: 'token-optimizer', desc: 'Documents token cost strategies and usage limits to keep agent sessions within budget.', example: 'python session_check.py' },
    ]
  },
  {
    title: 'Token & Efficiency',
    icon: Zap,
    tools: [
      { name: 'token-capture', desc: 'Captures real token usage from DashClaw sessions and stores it in a local SQLite database.', example: 'python capture.py' },
      { name: 'token-tracker', desc: 'Monitors token budget and provides warnings and recommendations during active agent runs.', example: 'python token-tracker.py status' },
      { name: 'cost-estimator', desc: 'Estimates token costs across different models and suggests efficient alternatives.', example: 'python cost-estimator.py estimate --model opus' },
      { name: 'token-efficiency', desc: 'Unified CLI for all token optimization tools — tracks context size, costs, and efficiency.', example: 'python efficiency-cli.py report' },
    ]
  },
  {
    title: 'Intelligence & Discovery',
    icon: Search,
    tools: [
      { name: 'relationship-tracker', desc: 'Mini-CRM for tracking contacts, interactions, follow-ups, and opportunity pipelines.', example: 'python tracker.py due' },
      { name: 'error-logger', desc: 'Identifies recurring failure patterns in agent execution logs.', example: 'python errors.py analyze' },
      { name: 'communication-analytics', desc: 'Logs which message styles and tones get the best responses so agents can learn from patterns.', example: 'python comms.py patterns' },
      { name: 'user-context', desc: 'Records personal preferences, mood, and working style observations in a local-only SQLite database.', example: 'python user_context.py summary' },
    ]
  }
];

export default function ToolkitPage() {
  const totalTools = toolCategories.reduce((sum, cat) => sum + cat.tools.length, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <PublicNavbar />

      <main className="pt-28 pb-20 px-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Toolkit</h1>
            <p className="text-zinc-400 mt-1">{totalTools}+ Python CLI tools for local agent operations and state management.</p>
          </div>
        </div>

        {/* Governance bridge note */}
        <div className="mb-12 p-5 rounded-xl bg-brand/5 border border-brand/20">
          <div className="flex items-start gap-3">
            <RefreshCw size={18} className="text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Each tool runs locally and stores data in a private SQLite database. To push data to your DashClaw governance dashboard, add <code className="text-brand font-mono text-xs bg-brand/10 px-1.5 py-0.5 rounded">--push</code> to any write command, or run <code className="text-brand font-mono text-xs bg-brand/10 px-1.5 py-0.5 rounded">sync_to_dashclaw.py</code> to bulk-sync all categories at once. Sync uses <code className="text-zinc-400 font-mono text-xs">DASHCLAW_BASE_URL</code> and <code className="text-zinc-400 font-mono text-xs">DASHCLAW_API_KEY</code> from your environment.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-16">
          {toolCategories.map((cat) => {
            const CategoryIcon = cat.icon;
            return (
              <section key={cat.title}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center">
                    <CategoryIcon size={20} className="text-brand" />
                  </div>
                  <h2 className="text-xl font-semibold">{cat.title}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cat.tools.map((tool) => (
                    <div key={tool.name} className="p-5 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)] hover:border-brand/30 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-zinc-100 group-hover:text-brand transition-colors">{tool.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 font-mono">CLI</span>
                      </div>
                      <p className="text-sm text-zinc-400 leading-relaxed mb-4">{tool.desc}</p>
                      <div className="bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[rgba(255,255,255,0.03)]">
                        <code className="text-xs text-zinc-500 font-mono">{tool.example}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Install CTA */}
        <div className="mt-20 p-8 rounded-2xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-brand/20">
          <h2 className="text-2xl font-bold mb-2">Install the toolkit</h2>
          <p className="text-zinc-400 mb-6 max-w-xl">Copy the tools into your agent workspace and start capturing governed data in minutes.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div>
              <p className="text-xs text-zinc-500 font-mono mb-2">Mac / Linux</p>
              <div className="bg-[#0a0a0a] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.06)]">
                <code className="text-xs text-zinc-300 font-mono">bash ./agent-tools/install-mac.sh</code>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 font-mono mb-2">Windows (PowerShell)</p>
              <div className="bg-[#0a0a0a] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.06)]">
                <code className="text-xs text-zinc-300 font-mono">powershell -ExecutionPolicy Bypass -File .\agent-tools\install-windows.ps1</code>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs text-zinc-500 font-mono mb-2">Sync all local data to your DashClaw instance</p>
            <div className="bg-[#0a0a0a] rounded-lg px-4 py-3 border border-brand/10">
              <code className="text-xs text-brand font-mono">python sync_to_dashclaw.py</code>
              <span className="text-zinc-600 text-xs font-mono ml-2"># or add --dry-run to preview</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link href="/docs" className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors">
              View SDK Docs
            </Link>
            <a href="https://github.com/ucsandman/DashClaw" target="_blank" rel="noopener noreferrer" className="px-6 py-2.5 rounded-lg bg-zinc-800 text-white text-sm font-medium hover:bg-zinc-700 transition-colors inline-flex items-center gap-2">
              <Github size={16} /> Star on GitHub
            </a>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
