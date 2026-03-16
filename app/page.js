import Link from 'next/link';
import { ShieldAlert, ArrowRight, Terminal, BookOpen, Package, Scale, FileCheck, Network, Shield, FolderKanban, BarChart3, MessageSquare, Activity, FileJson, History, Lock, Bot, Database, XCircle, Radar, Zap, Compass } from 'lucide-react';
import DashClawLogo from './components/DashClawLogo';
import PublicNavbar from './components/PublicNavbar';
import PublicFooter from './components/PublicFooter';
import HeroScreenshot from './components/HeroScreenshot';
import InlineCopyCommand from './components/InlineCopyCommand';
import GuardSimulation from './components/GuardSimulation';
import { allScreenshots } from './screenshotData';

import {
  coreFeatures,
  platformFeatures,
  corePrimitives,
  operationalFeatures,
  signals,
  agentToolCategories,
  platformCoverage,
  shippedHighlights,
  frameworkQuickstarts,
} from './landingData';

/* ─── page ─── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white text-base">
      {/* ── 1. Navbar ── */}
      <PublicNavbar />

      {/* ── 2. Hero ── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.08)] text-brand text-xs font-medium mb-6">
            <ShieldAlert size={14} />
            Open-source AI governance runtime
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            Intercept agent actions before they reach production.
          </h1>
          <p className="mt-6 text-brand font-semibold text-xl sm:text-2xl">
            DashClaw is the policy firewall for AI agents.
          </p>
          <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            DashClaw governs the moment agent intent becomes real-world action. Enforce policies, require human approval, and record verifiable evidence in one runtime.
          </p>
          <p className="mt-4 text-sm text-zinc-500 font-medium">
            Works with OpenAI, Claude, CrewAI, LangChain, AutoGen, OpenClaw, or any custom agent.
          </p>
          <p className="mt-4 text-sm text-zinc-500 font-medium italic opacity-80">MIT Licensed. Self-host in seconds.</p>

          {/* Tiny Architecture Diagram */}
          <div className="mt-12 mb-8 flex items-center justify-center gap-3 sm:gap-6 max-w-lg mx-auto">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-lg">
                <Bot size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Agent Intent</span>
            </div>
            
            <div className="flex flex-col justify-center animate-pulse">
              <ArrowRight className="text-zinc-600" size={24} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 flex items-center justify-center rounded-2xl bg-brand/10 border border-brand/40 text-brand shadow-[0_0_25px_rgba(249,115,22,0.2)] ring-1 ring-brand/20">
                <Shield size={28} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-brand font-extrabold">DashClaw Guard</span>
            </div>

            <div className="flex flex-col justify-center animate-pulse delay-75">
              <ArrowRight className="text-zinc-600" size={24} />
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-lg">
                <Database size={20} />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Production System</span>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
            <InlineCopyCommand command="npx dashclaw-demo" highlight={true} className="scale-110 shadow-[0_0_30px_rgba(249,115,22,0.15)]" />
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/demo" className="px-8 py-3 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand-hover transition-all hover:scale-105 inline-flex items-center gap-2 shadow-xl shadow-brand/20">
                <Terminal size={18} /> Run 1-Minute Demo
              </Link>
              <Link href="/self-host" className="px-8 py-3 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-zinc-300 text-sm font-medium hover:bg-[#222] hover:text-white transition-all inline-flex items-center gap-2">
                Deploy Your Own
              </Link>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
            <InlineCopyCommand command="npm install dashclaw" />
            <InlineCopyCommand command="pip install dashclaw" />
            <InlineCopyCommand command="docker compose up -d" />
          </div>

          <div className="mt-20 mb-12">
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.2em] mb-8 animate-pulse">Decision Interception Demo</h3>
            <GuardSimulation />
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-brand"></div> MIT Licensed
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-brand"></div> Self-hosted
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-brand"></div> Zero-dependency SDK
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-brand"></div> Node + Python
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. The Interception Layer ── */}
      <section className="py-20 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">The interception layer for AI agents</h2>
            <p className="mt-4 text-brand font-medium">
              DashClaw governs the moment where agent intent becomes real-world action.
            </p>
            <p className="mt-2 text-zinc-400 max-w-2xl mx-auto">
              This interception is where trust is created.
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            <HeroScreenshot
              src="/images/screenshots/replay2.png"
              alt="DashClaw Interception Replay - detailed evidence of a governed decision"
              className="shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_rgba(0,0,0,0.55)]"
              items={allScreenshots}
            />
          </div>

          <div className="mt-12 text-center max-w-2xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
                <p className="text-brand font-semibold text-sm">Agents retain autonomy.</p>
              </div>
              <div className="p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
                <p className="text-brand font-semibold text-sm">Organizations retain control.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Architecture Section ── */}
      <section className="py-24 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0c0c0c]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">DashClaw sits between agents and the systems they control</h2>
            <p className="mt-4 text-zinc-400">DashClaw intercepts actions before they reach real-world systems.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111] text-center">
              <div className="text-xs font-mono text-zinc-500 mb-4 uppercase tracking-widest">Autonomous Actor</div>
              <div className="text-lg font-bold text-white mb-2">AI Agent</div>
              <div className="text-xs text-zinc-400 leading-relaxed">
                OpenAI &middot; Claude &middot; CrewAI &middot; OpenClaw
              </div>
            </div>

            <div className="flex md:flex-col items-center justify-center gap-4">
              <div className="h-px w-8 md:w-px md:h-12 bg-zinc-800"></div>
              <div className="p-1 rounded-full bg-brand/20 border border-brand/30">
                <ArrowRight className="text-brand md:rotate-90" size={16} />
              </div>
              <div className="h-px w-8 md:w-px md:h-12 bg-zinc-800"></div>
            </div>

            <div className="hidden md:block"></div>

            <div className="hidden md:block"></div>
            
            <div className="relative p-8 rounded-2xl border-2 border-brand/30 bg-brand/5 text-center shadow-[0_0_40px_rgba(249,115,22,0.1)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand text-[10px] font-bold text-white uppercase tracking-widest">
                DashClaw Runtime
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-white">Policy Engine</div>
                <div className="text-sm font-semibold text-white">Approval Routing</div>
                <div className="text-sm font-semibold text-white">Evidence Ledger</div>
              </div>
            </div>

            <div className="hidden md:block"></div>

            <div className="hidden md:block"></div>

            <div className="flex md:flex-col items-center justify-center gap-4">
              <div className="h-px w-8 md:w-px md:h-12 bg-zinc-800"></div>
              <div className="p-1 rounded-full bg-brand/20 border border-brand/30">
                <ArrowRight className="text-brand md:rotate-90" size={16} />
              </div>
              <div className="h-px w-8 md:w-px md:h-12 bg-zinc-800"></div>
            </div>

            <div className="p-6 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111] text-center">
              <div className="text-xs font-mono text-zinc-500 mb-4 uppercase tracking-widest">Real-world Targets</div>
              <div className="text-lg font-bold text-white mb-2">External Systems</div>
              <div className="text-xs text-zinc-400 leading-relaxed">
                GitHub &middot; APIs &middot; Databases &middot; Infrastructure
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. The Runtime Problem ── */}
      <section className="py-20 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0c0c0c]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">AI agents introduce a new runtime problem</h2>
          <div className="mt-8 space-y-4 text-lg text-zinc-400 leading-relaxed text-left max-w-2xl mx-auto">
            <p>Traditional software executes deterministic code paths.</p>
            <p>AI agents generate actions from goals and context.</p>
            <p>Debugging alone is no longer enough.</p>
            <p>Developers need governance over agent decisions.</p>
          </div>
        </div>
      </section>

      {/* ── 5. The Decision Runtime ── */}
      <section className="py-24 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0d0d0d]">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">The Decision Runtime</h2>
          <p className="mt-3 text-zinc-400 mb-16">DashClaw is built around five primitives that form a decision runtime for autonomous systems.</p>
          
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent -translate-y-1/2 z-0"></div>
            
            {corePrimitives.map((primitive, idx) => {
              const Icon = primitive.icon;
              return (
                <div key={primitive.title} className="relative z-10 flex flex-col items-center group w-full md:w-1/5">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#111] border border-white/5 shadow-xl group-hover:border-brand/40 transition-all group-hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] ring-4 ring-[#0d0d0d] relative">
                    <Icon size={24} className="text-brand" />
                    
                    {/* Hover Cards for all Primitives */}
                    <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-52 p-3 rounded-xl bg-black border border-zinc-800 shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 scale-90 group-hover:scale-100 origin-bottom">
                      
                      {primitive.title === 'Intent' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 tracking-tight uppercase">Agent Intent</span>
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-200 mb-1 leading-tight">Sync local data to Neon dashboard</div>
                          <div className="text-[9px] text-zinc-500 mb-2">Actor: moltfire</div>
                          <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
                            <span className="text-[9px] text-zinc-500 italic">Confidence: 50%</span>
                          </div>
                        </>
                      )}

                      {primitive.title === 'Guard' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 tracking-tight uppercase">Guard Policy</span>
                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-[8px] text-green-400 font-bold uppercase tracking-tighter">active</span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-200 mb-1 leading-tight">Block if risk &gt; 80</div>
                          <div className="text-[10px] font-mono text-brand mb-2">Risk &gt;= 80 → block</div>
                          <div className="text-[8px] font-mono text-zinc-600 truncate">gp_0423d9749de847b8be38ff3a</div>
                        </>
                      )}

                      {primitive.title === 'Approval' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 tracking-tight uppercase tracking-tighter">Human Approval</span>
                            <span className="px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[8px] text-orange-400 font-bold uppercase tracking-tighter">pending</span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-200 mb-1 leading-tight">REVIEW: data alerting</div>
                          <div className="text-[9px] text-zinc-500 mb-2">Agent: api-monitor</div>
                          <div className="flex justify-between items-center pt-2 border-t border-zinc-800/50">
                            <span className="text-[10px] font-bold text-red-400 font-mono">96% RISK</span>
                            <div className="flex gap-1">
                              <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40"></div>
                              <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40"></div>
                            </div>
                          </div>
                        </>
                      )}

                      {primitive.title === 'Action' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 tracking-tight uppercase">Execution</span>
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[8px] text-blue-400 font-bold uppercase tracking-tighter">success</span>
                          </div>
                          <div className="text-[11px] font-bold text-green-400 mb-1 tracking-tight">ACTION SUCCESSFUL</div>
                          <div className="text-[9px] text-zinc-400 mb-2 leading-tight italic">Synced 80 rows + 6 calendar events</div>
                          <div className="pt-2 border-t border-zinc-800/50 text-[9px] text-zinc-500">
                            Duration: 6.25s
                          </div>
                        </>
                      )}

                      {primitive.title === 'Evidence' && (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-zinc-400 tracking-tight uppercase">Decision Proof</span>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[8px] text-cyan-400 font-bold uppercase tracking-tighter">verified</span>
                          </div>
                          <div className="text-[11px] font-bold text-zinc-200 mb-1 leading-tight">Cryptographically Signed</div>
                          <div className="text-[8px] font-mono text-zinc-500 mb-2 truncate">act_1386c4ee-2529-4c79-9455</div>
                          <div className="pt-2 border-t border-zinc-800/50">
                            <div className="text-[7px] font-mono text-zinc-600 break-all leading-[8px]">dc_sig_v1_eyJpZCI6I...</div>
                          </div>
                        </>
                      )}

                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tighter mb-2">{primitive.title}</h3>
                  <p className="text-xs text-zinc-500 max-w-[140px] leading-relaxed mx-auto">{primitive.description}</p>
                  
                  {/* Visual Arrow (Desktop) */}
                  {idx < corePrimitives.length - 1 && (
                    <div className="hidden md:block absolute top-7 -right-4 translate-x-1/2">
                      <ArrowRight size={24} className="text-zinc-700" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <p className="mt-20 text-zinc-500 text-sm italic font-medium">
            Governance logic belongs in the runtime, not hardcoded in your agents.
          </p>
        </div>
      </section>

      {/* ── 6. Framework Quickstarts ── */}
      <section className="py-24 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">Works with your agent stack</h2>
            <p className="text-zinc-400">DashClaw is the governance layer for existing agent frameworks.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {frameworkQuickstarts.map(qs => (
              <div key={qs.id} className="flex flex-col rounded-2xl border border-white/5 bg-[#111] overflow-hidden shadow-2xl group/qs">
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-brand"></div>
                    <span className="text-xs font-bold text-white tracking-tight uppercase">{qs.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium group-hover/qs:text-brand transition-colors">{qs.label}</span>
                </div>
                <div className="p-5 font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto bg-black/40 h-full">
                  <pre>{qs.code}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Quickstart ── */}
      <section id="sdk" className="py-20 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0c0c0c]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(249,115,22,0.08)] border border-[rgba(249,115,22,0.2)] text-brand text-xs font-medium mb-4">
                <Package size={12} />
                One SDK. Full decision infrastructure.
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Get governance in 60 seconds</h2>
              <p className="mt-3 text-zinc-400 leading-relaxed">
                Zero-dependency Node.js and Python clients. Adding governance requires only a small wrapper around risky actions.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <InlineCopyCommand command="npx dashclaw-demo" highlight={true} className="px-3 py-1.5" />
                <InlineCopyCommand command="npm install dashclaw" className="px-3 py-1.5" />
                <InlineCopyCommand command="pip install dashclaw" className="px-3 py-1.5" />
                <div className="w-full h-px bg-zinc-800/50 my-1"></div>
                <InlineCopyCommand command="docker compose up -d" className="px-3 py-1.5" />
              </div>
              <Link href="/docs" className="mt-6 inline-flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors">
                View full SDK docs <ArrowRight size={14} />
              </Link>
            </div>
            <div>
              <div className="text-xs text-zinc-500 font-mono mb-2 uppercase tracking-wider">SDK Example</div>
              <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-5 font-mono text-sm overflow-x-auto shadow-2xl">
                <div className="text-zinc-500 mb-3">{'// 1. Initialize DashClaw'}</div>
                <div>
                  <span className="text-purple-400">const</span>
                  <span className="text-zinc-300"> claw = </span>
                  <span className="text-purple-400">new</span>
                  <span className="text-yellow-300"> DashClaw</span>
                  <span className="text-zinc-300">()</span>
                </div>

                <div className="mt-6 text-zinc-500">{'// 2. Intercept before you act'}</div>
                <div>
                  <span className="text-purple-400">const</span>
                  <span className="text-zinc-300">{' { decision } = '}</span>
                  <span className="text-purple-400">await</span>
                  <span className="text-zinc-300"> claw.</span>
                  <span className="text-yellow-300">guard</span>
                  <span className="text-zinc-300">({'{'}</span>
                </div>
                <div className="text-zinc-300 pl-4">
                  actionType: <span className="text-green-400">&apos;deploy&apos;</span>,
                </div>
                <div className="text-zinc-300 pl-4">
                  riskScore: <span className="text-cyan-300">85</span>
                </div>
                <div className="text-zinc-300">{'})'}</div>
                
                <div className="mt-6 text-zinc-500">{'// 3. Follow the decision'}</div>
                <div className="text-zinc-300">
                  <span className="text-purple-400">if</span> (decision === <span className="text-green-400">&apos;allowed&apos;</span>) {'{'}
                </div>
                <div className="text-zinc-300 pl-4 text-zinc-500">
                  {'// execute real-world action'}
                </div>
                <div className="text-zinc-300">{'}'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Real Use Cases ── */}
      <section className="py-24 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">What developers use DashClaw for</h2>
            <p className="mt-4 text-zinc-400">Practical scenarios where decision governance creates trust.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-xl font-bold">Prevent risky deployments</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Intercept deploy commands from agents and require approval when risk thresholds are exceeded.
              </p>
              <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4 font-mono text-[11px] overflow-x-auto text-zinc-300 shadow-lg">
                <span className="text-purple-400">const</span> decision = <span className="text-purple-400">await</span> claw.guard({'{'}
                <div className="pl-4">actionType: <span className="text-green-400">&quot;deploy&quot;</span>,</div>
                <div className="pl-4">environment: <span className="text-green-400">&quot;production&quot;</span>,</div>
                <div className="pl-4">riskScore: <span className="text-cyan-300">92</span></div>
                {'}'})
              </div>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li className="flex items-center gap-2">&bull; Request human approval</li>
                <li className="flex items-center gap-2">&bull; Pause execution</li>
                <li className="flex items-center gap-2">&bull; Record evidence for audit</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Lock size={20} />
                </div>
                <h3 className="text-xl font-bold">Control autonomous API usage</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Agents interacting with third-party APIs can be governed with policies.
              </p>
              <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4 font-mono text-[11px] overflow-x-auto text-zinc-300 shadow-lg">
                <span className="text-purple-400">await</span> claw.guard({'{'}
                <div className="pl-4">actionType: <span className="text-green-400">&quot;external_api_call&quot;</span>,</div>
                <div className="pl-4">provider: <span className="text-green-400">&quot;stripe&quot;</span>,</div>
                <div className="pl-4">amount: <span className="text-cyan-300">2000</span></div>
                {'}'})
              </div>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li className="flex items-center gap-2">&bull; Limit spending thresholds</li>
                <li className="flex items-center gap-2">&bull; Block dangerous actions</li>
                <li className="flex items-center gap-2">&bull; Trigger approval workflows</li>
              </ul>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                  <Activity size={20} />
                </div>
                <h3 className="text-xl font-bold">Detect agent reasoning drift</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Track assumptions agents rely on and detect when they become invalid. DashClaw records agent assumptions and decision context.
              </p>
              <div className="p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)] text-xs text-zinc-400 space-y-2">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-2">
                  <span>Assumptions Divergence</span>
                  <span className="text-orange-400 font-mono">DRIFT DETECTED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Logic Baseline</span>
                  <span className="text-zinc-500">v1.2.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current Context</span>
                  <span className="text-zinc-500">Unverified state</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed italic">
                When assumptions diverge from reality, the system flags drift immediately.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                  <FileJson size={20} />
                </div>
                <h3 className="text-xl font-bold">Produce audit trails</h3>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Every governed action generates structured evidence records ready for compliance and review.
              </p>
              <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4 font-mono text-[10px] overflow-x-auto text-green-400/80 shadow-lg">
                <pre>{`{
  "agent": "deployment-bot",
  "action": "deploy",
  "riskScore": 85,
  "policy": "production_guard",
  "approval": "granted"
}`}</pre>
              </div>
              <ul className="space-y-2 text-xs text-zinc-500">
                <li className="flex items-center gap-2">&bull; Compliance reporting</li>
                <li className="flex items-center gap-2">&bull; Debugging agent failures</li>
                <li className="flex items-center gap-2">&bull; Governance review</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Platform Visibility ── */}
      <section id="features" className="py-24 px-6 border-t border-[rgba(255,255,255,0.06)]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">When governance becomes operations</h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Once decisions are governed, DashClaw provides the operational visibility required to run agent fleets at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
            {[
              { icon: Radar, title: 'Mission Control', description: 'Real-time control tower for fleet posture and active interventions.' },
              { icon: Zap, title: 'Decision Replay', description: 'Visual causal chains that explain exactly why an agent chose an action.' },
              { icon: Shield, title: 'Policy Engine', description: 'Semantic guardrails that evolve with your organization without code changes.' },
              { icon: Activity, title: 'Risk Signals', description: 'Automated detection of autonomy spikes, drift, and failure loops.' },
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="p-6 rounded-2xl bg-[#111] border border-white/5 hover:border-brand/30 transition-all text-left group">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon size={20} className="text-brand" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-tight">{feature.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-20">
            {/* Compliance Suite Merge */}
            <div className="rounded-2xl bg-gradient-to-b from-[rgba(249,115,22,0.06)] to-transparent p-8 sm:p-12 border border-[rgba(249,115,22,0.12)]">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(249,115,22,0.3)] bg-[rgba(249,115,22,0.08)] text-brand text-xs font-medium mb-4">
                  <DashClawLogo size={12} />
                  AI Governance Suite
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Every governed decision produces audit-ready evidence.</h2>
                <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm font-semibold text-zinc-300">
                  <span className="px-3 py-1 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.06)]">SOC 2</span>
                  <span className="px-3 py-1 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.06)]">ISO 27001</span>
                  <span className="px-3 py-1 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.06)]">GDPR</span>
                  <span className="px-3 py-1 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.06)]">NIST AI RMF</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-6 rounded-xl bg-[#111]/80 border border-[rgba(255,255,255,0.06)] text-center">
                  <Scale size={20} className="text-brand mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2 text-sm">Compliance Engine</h3>
                  <p className="text-xs text-zinc-400">Control-level gap analysis with remediation priorities.</p>
                </div>
                <div className="p-6 rounded-xl bg-[#111]/80 border border-[rgba(255,255,255,0.06)] text-center">
                  <FileCheck size={20} className="text-brand mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2 text-sm">Policy Testing</h3>
                  <p className="text-xs text-zinc-400">Run tests against all active guard policies.</p>
                </div>
                <div className="p-6 rounded-xl bg-[#111]/80 border border-[rgba(255,255,255,0.06)] text-center">
                  <Network size={20} className="text-brand mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2 text-sm">Audit Evidence</h3>
                  <p className="text-xs text-zinc-400">Generate audit-ready evidence from live behavior.</p>
                </div>
              </div>
            </div>

            {/* Signals Showcase Merge */}
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Detect when agent autonomy goes wrong</h2>
                <p className="mt-3 text-zinc-400">Automatic detection of autonomy breaches and logic drift.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                {signals.map((signal, i) => (
                  <div key={signal.name} className="flex items-start gap-4 p-4 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)]">
                    <div className="w-7 h-7 rounded-lg bg-[rgba(239,68,68,0.1)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldAlert size={14} className="text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{signal.name}</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">{signal.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Tools Merge */}
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Local Agent Toolkit</h2>
                <p className="mt-3 text-zinc-400">DashClaw also ships local tools that run alongside agents to manage memory, goals, and security.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
                {agentToolCategories.slice(0, 3).map((cat) => (
                  <div key={cat.title} className="p-5 rounded-xl bg-[#111] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-colors">
                    <h3 className="text-sm font-semibold text-white mb-1.5">{cat.title}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mb-3">{cat.desc}</p>
                    <pre className="bg-[#0a0a0a] rounded-lg px-3 py-2 text-[10px] text-zinc-300 font-mono overflow-x-auto">{cat.example}</pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Mission Control ── */}
      <section className="py-20 px-6 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Operational visibility for agent fleets</h2>
              <p className="mt-4 text-zinc-400 leading-relaxed">
                Once decisions are governed, Mission Control provides the operational visibility required to run fleets at scale.
              </p>
              <div className="mt-8 space-y-4 text-zinc-400 leading-relaxed">
                <p className="text-sm font-semibold text-white">Live operational data:</p>
                <ul className="space-y-1.5 list-disc list-inside text-sm">
                  <li>live actions</li>
                  <li>policy decisions</li>
                  <li>pending approvals</li>
                  <li>integrity signals</li>
                  <li>agent health</li>
                </ul>
              </div>
            </div>
            <div className="lg:col-span-3">
              <HeroScreenshot
                src="/images/screenshots/Mission Control.png"
                alt="DashClaw Mission Control - strategic overview of your agent fleet"
                className="shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_rgba(0,0,0,0.55)]"
                items={allScreenshots}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Bottom CTA ── */}
      <section className="py-20 px-6 border-t border-[rgba(255,255,255,0.06)]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Run agents with permissioned autonomy.
          </h2>
          <p className="mt-3 text-zinc-400">
            DashClaw lets agents move fast without giving up control. Intercept risky actions. Require approval when needed. Prove every decision afterward.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/self-host" className="px-6 py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors inline-flex items-center gap-2">
              Deploy DashClaw
            </Link>
            <Link href="/demo" className="px-6 py-2.5 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-zinc-300 text-sm font-medium hover:bg-[#222] hover:text-white transition-colors inline-flex items-center gap-2">
              Explore the Demo <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. Footer ── */}
      <PublicFooter />
    </div>
  );
}
