import Link from 'next/link';
import { Github, Terminal, ArrowLeft, Zap, Brain, Shield, Rocket, HeartPulse, Search, MessageSquare, ClipboardCheck, History } from 'lucide-react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';

const toolCategories = [
  {
    title: 'Operations & Continuity',
    icon: Rocket,
    tools: [
      { name: 'session-handoff', desc: 'Generates structured handover documents for agent session continuity.', example: 'python handoff.py create' },
      { name: 'goal-tracker', desc: 'Tracks goals, milestones, and real-time progress markers.', example: 'python goals.py add "Feature X"' },
      { name: 'daily-digest', desc: 'Aggregates all agent activity into a single daily summary.', example: 'python digest.py generate' },
      { name: 'project-monitor', desc: 'Tracks engagement across different systems and repositories.', example: 'python monitor.py status' },
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
    ]
  },
  {
    title: 'Security & Governance',
    icon: Shield,
    tools: [
      { name: 'outbound-filter', desc: 'Scans agent responses for leaked API keys, tokens, or PII.', example: 'python filter.py scan response.txt' },
      { name: 'session-isolator', desc: 'Ensures agent work remains within specific directory boundaries.', example: 'python isolate.py check .' },
      { name: 'audit-logger', desc: 'Local-first append-only log of all shell commands executed.', example: 'python audit.py tail' },
      { name: 'token-optimizer', desc: 'Analyzes prompt history to suggest context window efficiencies.', example: 'python optimize.py analyze' },
    ]
  },
  {
    title: 'Intelligence & Discovery',
    icon: Search,
    tools: [
      { name: 'memory-extractor', desc: 'Automatically extracts entities and topics from raw memory files.', example: 'python extract.py entities' },
      { name: 'relationship-tracker', desc: 'Mini-CRM for tracking contacts and previous interaction summaries.', example: 'python crm.py contact "Alice"' },
      { name: 'error-logger', desc: 'Identifies recurring failure patterns in agent execution logs.', example: 'python error_log.py analyze' },
      { name: 'communication-analytics', desc: 'Analyzes tone and style consistency across messages.', example: 'python stats.py communication' },
    ]
  }
];

export default function ToolkitPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <PublicNavbar />

      <main className="pt-28 pb-20 px-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-12">
          <Link href="/" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Toolkit</h1>
            <p className="text-zinc-400 mt-1">20+ Python CLI tools for local agent operations and state management.</p>
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

        <div className="mt-20 p-8 rounded-2xl bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-brand/20 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to govern your agent?</h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">Install the toolkit and the SDK to get full decision governance in minutes.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/docs" className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors">
              Install Toolkit
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
