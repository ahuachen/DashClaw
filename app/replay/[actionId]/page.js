'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, XCircle, Clock, Zap, HelpCircle,
  AlertTriangle, ShieldCheck, ShieldAlert, Scale,
  Activity, Fingerprint, Database, ExternalLink, Shield, Lock, Info
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import DashClawLogo from '../../components/DashClawLogo';
import Link from 'next/link';

export default function PublicReplayPage() {
  const params = useParams();
  const actionId = params.actionId;

  const [action, setAction] = useState(null);
  const [assumptions, setAssumptions] = useState([]);
  const [trace, setTrace] = useState(null);
  const [guardDecision, setGuardDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/actions/${actionId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Decision not found'); return; }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setAction(data.action);
      setAssumptions(data.assumptions || []);

      // Fetch trace data
      try {
        const traceRes = await fetch(`/api/actions/${actionId}/trace`);
        if (traceRes.ok) {
          const traceData = await traceRes.json();
          setTrace(traceData.trace);
        }
      } catch { /* trace is optional */ }

      // Fetch correlated guard decision
      if (data.action.agent_id) {
        try {
          const guardRes = await fetch(`/api/guard?agent_id=${encodeURIComponent(data.action.agent_id)}&limit=10`);
          if (guardRes.ok) {
            const guardData = await guardRes.json();
            const actionStart = new Date(data.action.timestamp_start).getTime();
            const match = (guardData.decisions || []).find(gd =>
              gd.action_type === data.action.action_type &&
              Math.abs(new Date(gd.created_at).getTime() - actionStart) <= 60000
            );
            if (match) setGuardDecision(match);
          }
        } catch { /* guard correlation is optional */ }
      }
    } catch (err) {
      console.error('Failed to fetch decision:', err);
      setError('Failed to load decision details');
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    if (actionId) fetchData();
  }, [actionId, fetchData]);

  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const getStatusVariant = (status) => {
    const map = {
      completed: 'success', running: 'warning', failed: 'error',
      blocked: 'error', cancelled: 'default', pending: 'info'
    };
    return map[status] || 'default';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !action) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <DashClawLogo size={40} className="mb-8 opacity-20" />
        <Card hover={false} className="max-w-md w-full text-center">
          <CardContent className="pt-8">
            <ShieldAlert size={32} className="text-zinc-600 mx-auto mb-3" />
            <div className="text-lg font-medium text-white mb-2">{error || 'Decision Not Found'}</div>
            <p className="text-sm text-zinc-500 mb-6">This decision replay link may have expired or is no longer public.</p>
            <Link href="/" className="text-brand hover:underline text-sm font-medium">Back to DashClaw</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 selection:bg-brand/30 pb-20">
      {/* Public Header */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
            <DashClawLogo size={24} />
            <span className="text-lg font-semibold text-white tracking-tight">DashClaw</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              <Lock size={10} />
              Public Replay
            </div>
            <a 
              href="https://github.com/ucsandman/DashClaw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              Github
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 pt-12">
        {/* Decision Summary */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant={getStatusVariant(action.status)} size="md">
              {action.status.toUpperCase()}
            </Badge>
            <span className="text-zinc-600 text-sm font-mono">{action.action_id}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
            {action.declared_goal}
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-brand/10 flex items-center justify-center text-brand font-bold text-[10px]">
                {action.agent_id.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-zinc-300 font-medium">{action.agent_name || action.agent_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} />
              {new Date(action.timestamp_start).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              {action.verified ? (
                <span className="flex items-center gap-1 text-emerald-500 font-semibold text-xs">
                  <ShieldCheck size={14} /> Verified Agent
                </span>
              ) : (
                <span className="flex items-center gap-1 text-zinc-500 font-semibold text-xs">
                  <Info size={14} /> Unsigned Decision
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Causal Timeline */}
        <div className="space-y-12">
          <section>
            <h2 className="text-xs font-bold text-zinc-600 uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/5" />
              Decision Lifecycle
              <div className="h-px flex-1 bg-white/5" />
            </h2>

            <div className="space-y-10 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
              {/* 1. Intent */}
              <div className="relative flex gap-6 pl-1">
                <div className="z-10 mt-1.5 h-6 w-6 rounded-full bg-blue-500 border-4 border-[#0a0a0a] shadow-[0_0_0_1px_rgba(59,130,246,0.3)] flex items-center justify-center">
                  <Zap size={10} className="text-white" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">1. Agent Intent</div>
                  <div className="text-lg text-white font-medium mb-2">{action.declared_goal}</div>
                  {action.reasoning && (
                    <div className="text-sm text-zinc-400 bg-white/5 p-4 rounded-xl italic border border-white/5">
                      &ldquo;{action.reasoning}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Policy Evaluation */}
              <div className="relative flex gap-6 pl-1">
                <div className={`z-10 mt-1.5 h-6 w-6 rounded-full border-4 border-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center ${
                  guardDecision?.decision === 'allow' ? 'bg-emerald-500' :
                  guardDecision?.decision === 'block' ? 'bg-red-500' :
                  guardDecision?.decision === 'require_approval' ? 'bg-amber-500' : 'bg-zinc-500'
                }`}>
                  <Shield size={10} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">2. Policy Evaluation</div>
                  {guardDecision ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge variant={getStatusVariant(guardDecision.decision === 'allow' ? 'completed' : guardDecision.decision === 'block' ? 'failed' : 'running')} size="sm">
                          {guardDecision.decision.toUpperCase()}
                        </Badge>
                        {guardDecision.reason && <span className="text-sm text-zinc-300 font-medium">{guardDecision.reason}</span>}
                      </div>
                      {guardDecision.matched_policies && (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(guardDecision.matched_policies).map((p, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 font-semibold">
                              {typeof p === 'string' ? p : p.name || p.id}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500 italic py-2">No guard evaluation recorded for this decision.</div>
                  )}
                </div>
              </div>

              {/* 3. Assumption Check */}
              {assumptions.length > 0 && (
                <div className="relative flex gap-6 pl-1">
                  <div className={`z-10 mt-1.5 h-6 w-6 rounded-full border-4 border-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center ${
                    assumptions.every(a => a.validated) ? 'bg-emerald-500' :
                    assumptions.some(a => a.invalidated) ? 'bg-red-500' : 'bg-amber-500'
                  }`}>
                    <HelpCircle size={10} className="text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">3. Assumption Check</div>
                    <div className="space-y-3 mt-3">
                      {assumptions.map((asm, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-white/[0.02] border border-white/5">
                          {asm.validated ? <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" /> :
                           asm.invalidated ? <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" /> :
                           <HelpCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />}
                          <div>
                            <span className={asm.invalidated ? 'text-red-300 font-medium' : 'text-zinc-300 font-medium'}>{asm.assumption}</span>
                            {asm.invalidated_reason && (
                              <div className="mt-1.5 text-xs text-red-400/70">{asm.invalidated_reason}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Risk Signals */}
              {trace?.root_cause_indicators?.length > 0 && (
                <div className="relative flex gap-6 pl-1">
                  <div className="z-10 mt-1.5 h-6 w-6 rounded-full bg-amber-500 border-4 border-[#0a0a0a] shadow-[0_0_0_1px_rgba(245,158,11,0.3)] flex items-center justify-center">
                    <ShieldAlert size={10} className="text-white" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">4. Risk Signals</div>
                    <div className="space-y-2 mt-3">
                      {trace.root_cause_indicators.map((sig, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-amber-400 bg-amber-500/5 p-2 px-3 rounded-full border border-amber-500/10">
                          <ShieldAlert size={12} />
                          <span className="font-bold uppercase tracking-tight">{sig.type.replace(/_/g, ' ')} DETECTED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Outcome */}
              <div className="relative flex gap-6 pl-1">
                <div className={`z-10 mt-1.5 h-6 w-6 rounded-full border-4 border-[#0a0a0a] shadow-[0_0_0_1px_rgba(255,255,255,0.1)] flex items-center justify-center ${getStatusVariant(action.status) === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                  <Activity size={10} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">5. Final Outcome</div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-black tracking-tight ${getStatusVariant(action.status) === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {action.status.toUpperCase()}
                    </span>
                    {action.duration_ms && <span className="text-xs text-zinc-600 font-mono">{(action.duration_ms / 1000).toFixed(2)}s execution</span>}
                  </div>
                  {action.output_summary && (
                    <div className="text-sm text-zinc-300 bg-surface-tertiary p-4 rounded-xl border border-white/5 leading-relaxed">
                      {action.output_summary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="pt-8">
            <Card hover={false} className="border-white/5 bg-black/40">
              <CardHeader title="Evidence & Metadata" icon={Fingerprint} />
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Systems Touched</div>
                      {parseJsonArray(action.systems_touched).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(action.systems_touched).map((s, i) => (
                            <div key={i} className="px-2.5 py-1 rounded bg-white/5 border border-white/5 text-[11px] text-zinc-400 flex items-center gap-2">
                              <Database size={10} />
                              {s}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-600 italic">No systems recorded.</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Artifacts Created</div>
                      {parseJsonArray(action.artifacts_created).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(action.artifacts_created).map((a, i) => (
                            <div key={i} className="px-2.5 py-1 rounded bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-400 font-mono">
                              {a}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-600 italic">No artifacts recorded.</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-xl bg-zinc-950/50 border border-emerald-500/10 font-mono text-[10px] text-emerald-500/60 leading-relaxed overflow-x-auto">
                    <div className="mb-2 text-emerald-500 font-bold uppercase tracking-widest opacity-80">--- DashClaw Governance Proof ---</div>
                    <div>DECISION_ID: {action.action_id}</div>
                    <div>STATUS: {action.status.toUpperCase()}</div>
                    <div>VERIFIED: {action.verified ? 'TRUE' : 'FALSE'}</div>
                    <div className="mt-4 break-all opacity-40">
                      dc_sig_v1_{Buffer.from(JSON.stringify({ id: actionId, status: action.status, salt: 'replay' })).toString('base64').substring(0, 64)}...
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Footer Cta */}
        <div className="mt-20 pt-12 border-t border-white/5 text-center">
          <DashClawLogo size={32} className="mx-auto mb-6 grayscale opacity-20" />
          <h3 className="text-white font-bold mb-2">Govern agent decisions with DashClaw</h3>
          <p className="text-sm text-zinc-500 mb-8 max-w-sm mx-auto">
            The open-source policy firewall and governance runtime for autonomous AI agents.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link 
              href="/"
              className="px-6 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-zinc-200 transition-colors"
            >
              Get Started
            </Link>
            <a 
              href="https://github.com/ucsandman/DashClaw"
              className="px-6 py-2 bg-white/5 border border-white/10 text-white text-sm font-bold rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              View on GitHub <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
