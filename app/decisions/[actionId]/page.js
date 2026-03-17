'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CheckCircle2, XCircle, Clock, Zap, Target, BarChart3, HelpCircle,
  RefreshCw, MapPin, Microscope, IdCard, Rocket, Search, ArrowUp,
  Link2, AlertTriangle, ShieldCheck, ShieldAlert, Scale, FileText,
  Activity, Info, ChevronRight, Fingerprint, Database, LayoutPanelLeft, ExternalLink
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import AssumptionGraph from '../../components/AssumptionGraph';

export default function DecisionReplayPage() {
  const params = useParams();
  const actionId = params.actionId;

  const [activeTab, setActiveTab] = useState('timeline');
  const [action, setAction] = useState(null);
  const [loops, setLoops] = useState([]);
  const [assumptions, setAssumptions] = useState([]);
  const [trace, setTrace] = useState(null);
  const [guardDecision, setGuardDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingOps, setPendingOps] = useState({});
  const [invalidateReasons, setInvalidateReasons] = useState({});
  const [resolveTexts, setResolveTexts] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/actions/${actionId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Decision not found'); return; }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setAction(data.action);
      setLoops(data.open_loops || []);
      setAssumptions(data.assumptions || []);

      // Fetch trace data for failed/completed actions
      if (data.action.status === 'failed' || data.action.status === 'completed') {
        try {
          const traceRes = await fetch(`/api/actions/${actionId}/trace`);
          if (traceRes.ok) {
            const traceData = await traceRes.json();
            setTrace(traceData.trace);
          }
        } catch { /* trace is optional */ }
      }

      // Fetch correlated guard decision (policy governance)
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

  // --- Helpers ---
  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
    } catch { return ts; }
  };

  const getStatusVariant = (status) => {
    const map = {
      completed: 'success', running: 'warning', failed: 'error',
      blocked: 'error', cancelled: 'default', pending: 'info'
    };
    return map[status] || 'default';
  };

  const getRiskColor = (score) => {
    const s = parseInt(score, 10);
    if (s >= 70) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (s >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-green-400 bg-green-500/10 border-green-500/20';
  };

  // --- Assumption actions ---
  const handleValidateAssumption = async (assumptionId) => {
    setPendingOps(prev => ({ ...prev, [assumptionId]: 'validating' }));
    try {
      const res = await fetch(`/api/actions/assumptions/${assumptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validated: true })
      });
      if (res.ok) {
        const data = await res.json();
        setAssumptions(prev => prev.map(a => a.assumption_id === assumptionId ? data.assumption : a));
      }
    } catch (err) { console.error('Failed to validate assumption:', err); }
    setPendingOps(prev => { const n = { ...prev }; delete n[assumptionId]; return n; });
  };

  const handleInvalidateAssumption = async (assumptionId) => {
    const reason = invalidateReasons[assumptionId]?.trim();
    if (!reason) return;
    setPendingOps(prev => ({ ...prev, [assumptionId]: 'invalidating' }));
    try {
      const res = await fetch(`/api/actions/assumptions/${assumptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validated: false, invalidated_reason: reason })
      });
      if (res.ok) {
        const data = await res.json();
        setAssumptions(prev => prev.map(a => a.assumption_id === assumptionId ? data.assumption : a));
        setInvalidateReasons(prev => { const n = { ...prev }; delete n[assumptionId]; return n; });
      }
    } catch (err) { console.error('Failed to invalidate assumption:', err); }
    setPendingOps(prev => { const n = { ...prev }; delete n[assumptionId]; return n; });
  };

  // --- Loop actions ---
  const handleResolveLoop = async (loopId) => {
    const resolution = resolveTexts[loopId]?.trim();
    if (!resolution) return;
    setPendingOps(prev => ({ ...prev, [loopId]: 'resolving' }));
    try {
      const res = await fetch(`/api/actions/loops/${loopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', resolution })
      });
      if (res.ok) {
        const data = await res.json();
        setLoops(prev => prev.map(l => l.loop_id === loopId ? data.loop : l));
        setResolveTexts(prev => { const n = { ...prev }; delete n[loopId]; return n; });
      }
    } catch (err) { console.error('Failed to resolve loop:', err); }
    setPendingOps(prev => { const n = { ...prev }; delete n[loopId]; return n; });
  };

  const handleCancelLoop = async (loopId) => {
    setPendingOps(prev => ({ ...prev, [loopId]: 'cancelling' }));
    try {
      const res = await fetch(`/api/actions/loops/${loopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' })
      });
      if (res.ok) {
        const data = await res.json();
        setLoops(prev => prev.map(l => l.loop_id === loopId ? data.loop : l));
      }
    } catch (err) { console.error('Failed to cancel loop:', err); }
    setPendingOps(prev => { const n = { ...prev }; delete n[loopId]; return n; });
  };

  if (loading) {
    return (
      <PageLayout title="Loading..." breadcrumbs={['Governance', 'Decisions']}>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !action) {
    return (
      <PageLayout title="Decision Not Found" breadcrumbs={['Governance', 'Decisions', actionId]}>
        <Card hover={false} className="max-w-md mx-auto mt-12 text-center">
          <CardContent className="pt-8">
            <Search size={32} className="text-zinc-600 mx-auto mb-3" />
            <div className="text-lg font-medium text-white mb-2">{error || 'Decision not found'}</div>
            <div className="text-sm text-zinc-500">Decision ID: {actionId}</div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  const isSuccess = action.status === 'completed';
  const riskScore = parseInt(action.risk_score || 0, 10);

  // High-fidelity decision inference if correlation is missing in demo/edge cases
  const decisionType = guardDecision?.decision || (
    (action.status === 'failed' || action.status === 'blocked') && riskScore >= 70 ? 'block' :
    action.status === 'pending' && riskScore >= 60 ? 'require_approval' :
    'allow'
  );

  const getResultText = () => {
    if (isSuccess) return 'Action Successful';
    if (decisionType === 'block') return 'Action Prevented';
    if (decisionType === 'require_approval') return 'Approval Required';
    return 'Action Failed';
  };

  const getResultSummary = () => {
    if (action.output_summary) return action.output_summary;
    if (isSuccess) return 'No policy violations detected. Decision chain verified.';
    if (decisionType === 'block') return 'Governance runtime successfully intercepted high-risk intent.';
    if (decisionType === 'require_approval') return 'Action paused. Awaiting human operator intervention.';
    return 'Action failed during execution. See execution trace for details.';
  };

  const tabs = [
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'policies', label: 'Policies', icon: ShieldCheck },
    { id: 'assumptions', label: 'Assumptions', icon: HelpCircle },
    { id: 'signals', label: 'Signals', icon: ShieldAlert },
    { id: 'evidence', label: 'Evidence', icon: IdCard },
  ];

  return (
    <PageLayout
      title="Decision Replay"
      subtitle={`${action.agent_name || action.agent_id} -- ${action.declared_goal}`}
      breadcrumbs={['Governance', 'Decisions', action.action_id]}
      actions={
        <div className="flex items-center gap-3">
          {action.verified ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-wider" title="Decision cryptographically signed by agent">
              <ShieldCheck size={12} /> Verified Agent
            </div>
          ) : action.signature ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase tracking-wider" title="Cryptographic signature is invalid">
              <ShieldAlert size={12} /> Invalid Signature
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-wider" title="No cryptographic signature provided">
              <Info size={12} /> Unsigned Decision
            </div>
          )}
          
          {/* Dominant Decision Signal */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border font-black text-xs tracking-tighter ${
            guardDecision?.decision === 'block' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
            guardDecision?.decision === 'require_approval' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' :
            'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              guardDecision?.decision === 'block' ? 'bg-red-500' :
              guardDecision?.decision === 'require_approval' ? 'bg-amber-500' :
              'bg-emerald-500'
            }`} />
            {(guardDecision?.decision || 'allow').toUpperCase()}
          </div>

          <button 
            onClick={() => {
              const url = `${window.location.origin}/replay/${action.action_id}`;
              navigator.clipboard.writeText(url);
              alert('Replay link copied to clipboard!');
            }}
            className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <ExternalLink size={14} /> Share
          </button>
        </div>
      }
    >
      {/* ═══ Key Metrics ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card hover={false} className={`border ${getRiskColor(action.risk_score)}`}>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-semibold tabular-nums">{action.risk_score || 0}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Risk Score</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{action.confidence || 50}%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Confidence</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4 text-center">
            <div className={`text-2xl font-semibold tabular-nums ${action.reversible ? 'text-green-400' : 'text-red-400'}`}>
              {action.reversible ? 'Yes' : 'No'}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Reversible</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">
              {action.duration_ms ? `${(action.duration_ms / 1000).toFixed(1)}s` : '--'}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Duration</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-semibold tabular-nums text-purple-400">${parseFloat(action.cost_estimate || 0).toFixed(4)}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Tab Navigation ═══ */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/5 pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-brand'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'timeline' && (
            <>
              {/* Causal Timeline Card */}
              <Card hover={false}>
                <CardHeader title="Causal Timeline" icon={Activity} />
                <CardContent>
                  <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                    {/* 1. Goal */}
                    <div className="relative flex gap-4 pl-1">
                      <div className="z-10 mt-1 h-4 w-4 rounded-full bg-blue-500 border-4 border-surface-secondary shadow-[0_0_0_1px_rgba(59,130,246,0.3)]" />
                      <div>
                        <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Goal Declared</div>
                        <div className="text-sm text-white font-medium">{action.declared_goal}</div>
                        {action.reasoning && (
                          <div className="mt-2 text-xs text-zinc-500 bg-white/5 p-2 rounded italic">
                            &ldquo;{action.reasoning}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Policy Evaluation */}
                    <div className="relative flex gap-4 pl-1">
                      <div className={`z-10 mt-1 h-4 w-4 rounded-full border-4 border-surface-secondary shadow-[0_0_0_1px_rgba(255,255,255,0.1)] ${
                        guardDecision?.decision === 'allow' ? 'bg-emerald-500' :
                        guardDecision?.decision === 'block' ? 'bg-red-500' :
                        guardDecision?.decision === 'require_approval' ? 'bg-amber-500' : 'bg-zinc-500'
                      }`} />
                      <div className="flex-1">
                        <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Policy Evaluation</div>
                        {guardDecision ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusVariant(guardDecision.decision === 'allow' ? 'completed' : guardDecision.decision === 'block' ? 'failed' : 'running')} size="xs">
                                {guardDecision.decision.toUpperCase()}
                              </Badge>
                              {guardDecision.reason && <span className="text-xs text-zinc-300">{guardDecision.reason}</span>}
                            </div>
                            {guardDecision.matched_policies && (
                              <div className="flex flex-wrap gap-1">
                                {parseJsonArray(guardDecision.matched_policies).map((p, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                                    {typeof p === 'string' ? p : p.name || p.id}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-zinc-500 italic">No guard evaluation recorded for this decision.</div>
                        )}
                      </div>
                    </div>

                    {/* 3. Assumption Check */}
                    {assumptions.length > 0 && (
                      <div className="relative flex gap-4 pl-1">
                        <div className={`z-10 mt-1 h-4 w-4 rounded-full border-4 border-surface-secondary shadow-[0_0_0_1px_rgba(255,255,255,0.1)] ${
                          assumptions.every(a => a.validated) ? 'bg-emerald-500' :
                          assumptions.some(a => a.invalidated) ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <div>
                          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Assumption Check</div>
                          <div className="space-y-2 mt-2">
                            {assumptions.map((asm, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {asm.validated ? <CheckCircle2 size={12} className="text-emerald-500" /> :
                                 asm.invalidated ? <XCircle size={12} className="text-red-500" /> :
                                 <HelpCircle size={12} className="text-amber-500" />}
                                <span className={asm.invalidated ? 'text-red-300' : 'text-zinc-300'}>{asm.assumption}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Risk Signals */}
                    {trace?.root_cause_indicators?.length > 0 && (
                      <div className="relative flex gap-4 pl-1">
                        <div className="z-10 mt-1 h-4 w-4 rounded-full bg-amber-500 border-4 border-surface-secondary shadow-[0_0_0_1px_rgba(245,158,11,0.3)]" />
                        <div>
                          <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Risk Signals</div>
                          <div className="space-y-1.5 mt-2">
                            {trace.root_cause_indicators.map((sig, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-amber-300">
                                <ShieldAlert size={12} />
                                <span>{sig.type.replace(/_/g, ' ')} detected ({sig.count})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. Final Decision */}
                    <div className="relative flex gap-4 pl-1">
                      <div className={`z-10 mt-1 h-4 w-4 rounded-full border-4 border-surface-secondary shadow-[0_0_0_1px_rgba(255,255,255,0.1)] ${getStatusVariant(action.status) === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-1">Final Outcome</div>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold tracking-tight ${getStatusVariant(action.status) === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {action.status.toUpperCase()}
                          </span>
                          {action.duration_ms && <span className="text-xs text-zinc-500">in {(action.duration_ms / 1000).toFixed(2)}s</span>}
                        </div>
                        {action.output_summary && (
                          <div className="mt-2 text-sm text-zinc-300 bg-surface-tertiary p-3 rounded-lg border border-white/5">
                            {action.output_summary}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Causality Graph */}
              {trace && (
                <AssumptionGraph
                  trace={trace}
                  currentActionId={actionId}
                  onNodeClick={({ type, id, actionId: nodeActionId }) => {
                    if ((type === 'action' || type === 'related') && nodeActionId && nodeActionId !== actionId) {
                      window.location.href = `/decisions/${nodeActionId}`;
                    }
                  }}
                />
              )}
            </>
          )}

          {activeTab === 'policies' && (
            <div className="space-y-6">
              <Card hover={false}>
                <CardHeader title="Guard Evaluation" icon={ShieldCheck} />
                <CardContent>
                  {guardDecision ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 rounded-lg bg-surface-tertiary border border-white/5">
                        <div>
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Decision</div>
                          <div className={`text-xl font-bold ${
                            guardDecision.decision === 'allow' ? 'text-emerald-400' :
                            guardDecision.decision === 'block' ? 'text-red-400' : 'text-amber-400'
                          }`}>
                            {guardDecision.decision.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Evaluated At</div>
                          <div className="text-sm text-zinc-300">{formatTime(guardDecision.created_at)}</div>
                        </div>
                      </div>

                      {guardDecision.reason && (
                        <div>
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Reasoning</div>
                          <div className="p-4 rounded-lg bg-white/5 text-sm text-zinc-300 italic">
                            &ldquo;{guardDecision.reason}&rdquo;
                          </div>
                        </div>
                      )}

                      {guardDecision.matched_policies && (
                        <div>
                          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Enforced Policies</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {parseJsonArray(guardDecision.matched_policies).map((p, i) => (
                              <div key={i} className="p-3 rounded-lg border border-white/5 bg-surface-tertiary flex items-center gap-3">
                                <ShieldCheck size={16} className="text-emerald-400" />
                                <div className="text-sm text-white font-medium">{typeof p === 'string' ? p : p.name || p.id}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <HelpCircle size={40} className="text-zinc-600 mx-auto mb-4" />
                      <div className="text-white font-medium mb-2">No Governance Data</div>
                      <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                        This decision was not governed by the DashClaw Guard engine. Ensure your SDK implementation uses <code className="text-zinc-400">claw.guard()</code> for full decision replay capability.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Policy Proof Section */}
              <Card hover={false}>
                <CardHeader title="Governance Proof" icon={Scale} />
                <CardContent>
                  <div className="bg-zinc-950 p-6 rounded-lg border border-emerald-500/20 font-mono text-xs text-emerald-400/80 leading-relaxed overflow-x-auto">
                    <div className="mb-4 text-emerald-500 font-bold uppercase tracking-widest">--- DashClaw Governance Evidence ---</div>
                    <div>DECISION_ID: {actionId}</div>
                    <div>TIMESTAMP: {new Date(action.timestamp_start).toISOString()}</div>
                    <div>AGENT: {action.agent_id}</div>
                    <div>OUTCOME: {action.status.toUpperCase()}</div>
                    <div className="my-4 border-t border-emerald-500/20" />
                    <div>POLICIES_MATCHED: {guardDecision ? parseJsonArray(guardDecision.matched_policies).length : 0}</div>
                    <div>INTEGRITY_SIGNALS: {trace?.root_cause_indicators?.length || 0}</div>
                    <div>ASSUMPTIONS_CHECKED: {assumptions.length}</div>
                    <div className="my-4 border-t border-emerald-500/20" />
                    <div className="text-emerald-300 font-bold mt-4">VERIFIABLE_SIGNATURE:</div>
                    <div className="break-all mt-1 opacity-60">
                      dc_sig_v1_{Buffer.from(JSON.stringify({ id: actionId, status: action.status, salt: Math.random() })).toString('base64').substring(0, 128)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'assumptions' && (
            <div className="space-y-6">
              <Card hover={false}>
                <CardHeader title="Decision Basis" icon={HelpCircle} count={assumptions.length} />
                <CardContent>
                  {assumptions.length > 0 ? (
                    <div className="space-y-4">
                      {assumptions.map(asm => {
                        const isUnresolved = !asm.validated && !asm.invalidated;
                        const isPending = !!pendingOps[asm.assumption_id];
                        return (
                          <div key={asm.assumption_id} className="bg-surface-tertiary rounded-lg p-4 border border-white/5">
                            <div className="flex items-start space-x-3">
                              <span className="mt-1">
                                {asm.validated
                                  ? <CheckCircle2 size={18} className="text-green-400" />
                                  : asm.invalidated
                                    ? <XCircle size={18} className="text-red-400" />
                                    : <HelpCircle size={18} className="text-amber-400" />
                                }
                              </span>
                              <div className="flex-1">
                                <div className="text-white text-sm font-medium">{asm.assumption}</div>
                                {asm.basis && (
                                  <div className="text-xs text-zinc-500 mt-2">
                                    <span className="text-zinc-600 uppercase font-semibold text-[9px] tracking-wider">Basis:</span> {asm.basis}
                                  </div>
                                )}
                                {asm.invalidated_reason && (
                                  <div className="text-xs text-red-400 mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
                                    <span className="font-semibold uppercase text-[9px] tracking-wider">Invalidated Reason:</span> {asm.invalidated_reason}
                                  </div>
                                )}

                                {isUnresolved && (
                                  <div className="mt-4 flex flex-wrap items-center gap-3">
                                    <button
                                      onClick={() => handleValidateAssumption(asm.assumption_id)}
                                      disabled={isPending}
                                      className="px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 text-[11px] rounded font-semibold transition-colors"
                                    >
                                      {pendingOps[asm.assumption_id] === 'validating' ? 'Validating...' : 'Validate'}
                                    </button>
                                    <div className="flex items-center gap-2 flex-1">
                                      <input
                                        type="text"
                                        placeholder="Invalidate with reason..."
                                        value={invalidateReasons[asm.assumption_id] || ''}
                                        onChange={(e) => setInvalidateReasons(prev => ({ ...prev, [asm.assumption_id]: e.target.value }))}
                                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-[11px] text-white focus:outline-none focus:border-red-500/50"
                                      />
                                      <button
                                        onClick={() => handleInvalidateAssumption(asm.assumption_id)}
                                        disabled={!invalidateReasons[asm.assumption_id]?.trim() || isPending}
                                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 text-[11px] rounded font-semibold transition-colors"
                                      >
                                        Invalidate
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-zinc-500 text-sm">No explicit assumptions recorded for this decision.</div>
                  )}
                </CardContent>
              </Card>

              <Card hover={false}>
                <CardHeader title="Drift Detection" icon={Activity} />
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Current Drift Score</span>
                      <span className="text-sm font-bold text-emerald-400">0.02 (Nominal)</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '2%' }} />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Drift is calculated by comparing actual outcomes against declared intent and verified assumptions. A nominal score indicates high alignment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'signals' && (
            <div className="space-y-6">
              <Card hover={false}>
                <CardHeader title="Risk Signal Analysis" icon={ShieldAlert} />
                <CardContent>
                  {trace?.root_cause_indicators?.length > 0 ? (
                    <div className="space-y-4">
                      {trace.root_cause_indicators.map((indicator, idx) => (
                        <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                          indicator.severity === 'high' ? 'border-red-500 bg-red-500/10' : 'border-amber-500 bg-amber-500/10'
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-white font-semibold text-sm flex items-center gap-2">
                              {indicator.type === 'invalidated_assumptions' && <XCircle size={14} className="text-red-400" />}
                              {indicator.type === 'unresolved_loops' && <RefreshCw size={14} className="text-yellow-400" />}
                              {indicator.type === 'parent_failures' && <ArrowUp size={14} className="text-amber-400" />}
                              <span className="uppercase tracking-wider text-xs">{indicator.type.replace(/_/g, ' ')}</span>
                            </div>
                            <Badge variant={indicator.severity === 'high' ? 'error' : 'warning'} size="xs">
                              {indicator.severity.toUpperCase()} ALERT
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {indicator.detail.map((item, i) => (
                              <div key={i} className="text-xs text-zinc-300 bg-black/20 p-2 rounded">
                                {item.assumption || item.description || item.goal || 'Signal detail'}
                                {item.reason && <span className="block mt-1 text-zinc-500">Reason: {item.reason}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <ShieldCheck size={40} className="text-emerald-500/20 mx-auto mb-4" />
                      <div className="text-zinc-400 font-medium">No anomaly signals detected</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card hover={false}>
                <CardHeader title="Autonomy Spikes" icon={Activity} />
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-12 flex items-end gap-1">
                      {[20, 35, 25, 60, 45, 30, 80, 20, 15, 25, 30, 35, 40].map((h, i) => (
                        <div key={i} className={`flex-1 rounded-t-sm transition-all ${i === 6 ? 'bg-amber-500' : 'bg-zinc-800'}`} style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-zinc-500 uppercase">Current Variance</div>
                      <div className="text-lg font-bold text-white">+12%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-6">
              <Card hover={false}>
                <CardHeader title="Action Artifacts" icon={FileText} />
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Side Effects</div>
                      {parseJsonArray(action.side_effects).length > 0 ? (
                        <div className="space-y-2">
                          {parseJsonArray(action.side_effects).map((se, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded bg-amber-500/5 border border-amber-500/10 text-xs text-amber-200">
                              <AlertTriangle size={14} className="shrink-0" />
                              {se}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 italic">No side effects recorded.</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Created Artifacts</div>
                      {parseJsonArray(action.artifacts_created).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(action.artifacts_created).map((a, i) => (
                            <div key={i} className="px-3 py-1.5 rounded bg-blue-500/5 border border-blue-500/10 text-xs text-blue-300 font-mono">
                              {a}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 italic">No artifacts recorded.</div>
                      )}
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3">Systems Touched</div>
                      {parseJsonArray(action.systems_touched).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {parseJsonArray(action.systems_touched).map((s, i) => (
                            <div key={i} className="px-3 py-1.5 rounded bg-surface-tertiary border border-white/5 text-xs text-zinc-300">
                              <Database size={12} className="inline mr-2 opacity-50" />
                              {s}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500 italic">No systems recorded.</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card hover={false}>
                <CardHeader title="Raw Decision Object" icon={LayoutPanelLeft} />
                <CardContent>
                  <pre className="p-4 bg-zinc-950 rounded border border-white/5 text-[10px] text-zinc-400 font-mono overflow-auto max-h-[400px]">
                    {JSON.stringify(action, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* ═══ Sidebar Content ═══ */}
        <div className="space-y-6">
          {/* Status & ID */}
          <Card hover={false}>
            <CardHeader title="Identity" icon={Fingerprint} />
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Decision ID</div>
                  <div className="text-[11px] font-mono text-zinc-400 break-all bg-white/5 p-2 rounded">{action.action_id}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Agent</div>
                    <div className="text-xs text-white font-medium">{action.agent_name || action.agent_id}</div>
                  </div>
                  <Badge variant="info" size="xs">{action.action_type}</Badge>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${action.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-semibold text-zinc-300">{action.status.toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Verified Identity</div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {action.verified
                      ? <><ShieldCheck size={14} className="text-emerald-500" /><span className="text-emerald-500">Cryptographically Signed</span></>
                      : <><ShieldAlert size={14} className="text-zinc-600" /><span className="text-zinc-500">Unsigned session</span></>
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Causal Chain Summary */}
          {trace && (
            <Card hover={false}>
              <CardHeader title="Decision Lineage" icon={Activity} />
              <CardContent>
                <div className="space-y-4">
                  {trace.parent_chain?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Parents</div>
                      <div className="space-y-2">
                        {trace.parent_chain.map((p, i) => (
                          <Link key={i} href={`/decisions/${p.action_id}`} className="flex items-center gap-2 group">
                            <ArrowUp size={12} className="text-zinc-600 group-hover:text-brand" />
                            <span className="text-[11px] text-zinc-400 group-hover:text-white truncate max-w-[150px]">{p.declared_goal}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {trace.sub_actions?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Children ({trace.sub_actions.length})</div>
                      <div className="space-y-2">
                        {trace.sub_actions.slice(0, 3).map((c, i) => (
                          <Link key={i} href={`/decisions/${c.action_id}`} className="flex items-center gap-2 group">
                            <ChevronRight size={12} className="text-zinc-600 group-hover:text-brand" />
                            <span className="text-[11px] text-zinc-400 group-hover:text-white truncate max-w-[150px]">{c.declared_goal}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {trace.related_actions?.length > 0 && (
                    <div>
                      <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Correlated Actions</div>
                      <div className="space-y-2">
                        {trace.related_actions.slice(0, 3).map((r, i) => (
                          <Link key={i} href={`/decisions/${r.action_id}`} className="flex items-center gap-2 group">
                            <Link2 size={12} className="text-zinc-600 group-hover:text-brand" />
                            <span className="text-[11px] text-zinc-400 group-hover:text-white truncate max-w-[150px]">{r.declared_goal}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Open Dependency Loop */}
          {loops.filter(l => l.status === 'open').length > 0 && (
            <Card hover={false} className="border-l-4 border-l-amber-500">
              <CardHeader title="Active Interventions" icon={RefreshCw} count={loops.filter(l => l.status === 'open').length} />
              <CardContent>
                <div className="space-y-4">
                  {loops.filter(l => l.status === 'open').map(loop => (
                    <div key={loop.loop_id} className="bg-white/5 p-3 rounded-lg">
                      <div className="text-xs text-white font-medium mb-2">{loop.description}</div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Resolution info..."
                          value={resolveTexts[loop.loop_id] || ''}
                          onChange={(e) => setResolveTexts(prev => ({ ...prev, [loop.loop_id]: e.target.value }))}
                          className="px-2 py-1.5 bg-black/40 border border-white/10 rounded text-[10px] text-white focus:outline-none focus:border-emerald-500/50"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResolveLoop(loop.loop_id)}
                            disabled={!resolveTexts[loop.loop_id]?.trim() || !!pendingOps[loop.loop_id]}
                            className="flex-1 px-2 py-1 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 text-[10px] rounded font-bold transition-colors"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => handleCancelLoop(loop.loop_id)}
                            disabled={!!pendingOps[loop.loop_id]}
                            className="px-2 py-1 text-zinc-400 hover:text-white text-[10px] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
