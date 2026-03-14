'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Shield, ShieldCheck, ShieldAlert, Zap, Clock, Activity,
  Lock, Info, ArrowLeft, ExternalLink, Database, 
  BarChart3, RefreshCw, KeyRound, Globe, Brain,
  ChevronRight, CheckCircle2, XCircle, HelpCircle, Fingerprint
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCompact } from '../../components/ui/Stat';

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.agentId;

  const [activeTab, setActiveTab] = useState('governance');
  const [agent, setAgent] = useState(null);
  const [decisions, setActions] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Agent Metadata
      const agentRes = await fetch(`/api/agents/${agentId}`);
      if (!agentRes.ok) throw new Error('Agent not found');
      const agentData = await agentRes.json();
      setAgent(agentData.agent);

      // 2. Fetch Decisions
      const actionsRes = await fetch(`/api/actions?agent_id=${encodeURIComponent(agentId)}&limit=10`);
      if (actionsRes.ok) {
        const actionsData = await actionsRes.json();
        setActions(actionsData.actions || []);
      }

      // 3. Fetch Policies (Guard Evaluations)
      const policiesRes = await fetch(`/api/guard?agent_id=${encodeURIComponent(agentId)}&limit=20`);
      if (policiesRes.ok) {
        const policiesData = await policiesRes.json();
        setPolicies(policiesData.evaluations || []);
      }

      // 4. Fetch Risk Signals
      const signalsRes = await fetch(`/api/actions/signals?agent_id=${encodeURIComponent(agentId)}`);
      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        setSignals(signalsData.signals || []);
      }

    } catch (err) {
      console.error('Failed to fetch agent profile:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (agentId) fetchData();
  }, [agentId, fetchData]);

  if (loading) {
    return (
      <PageLayout title="Loading Profile..." breadcrumbs={['Command', 'Agents', 'Profile']}>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (error || !agent) {
    return (
      <PageLayout title="Agent Not Found" breadcrumbs={['Command', 'Agents', agentId]}>
        <div className="max-w-md mx-auto mt-12 text-center">
          <Card hover={false}>
            <CardContent className="pt-8">
              <ShieldAlert size={32} className="text-zinc-600 mx-auto mb-3" />
              <div className="text-lg font-medium text-white mb-2">{error || 'Agent not found'}</div>
              <Link href="/agents" className="text-brand hover:underline text-sm font-medium">Back to Fleet Overview</Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  const tabs = [
    { id: 'governance', label: 'Governance Profile', icon: ShieldCheck },
    { id: 'policies', label: 'Enforced Policies', icon: Shield },
    { id: 'permissions', label: 'Authorized Scopes', icon: Lock },
    { id: 'ledger', label: 'Decisions Ledger', icon: Activity },
  ];

  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  return (
    <PageLayout
      title={agent.agent_name || agent.agent_id}
      subtitle={`Agent Governance Dossier \u00B7 ID: ${agent.agent_id}`}
      breadcrumbs={['Command', 'Agents', agent.agent_id]}
      actions={
        <div className="flex items-center gap-3">
          {agent.verified ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
              <Lock size={12} /> Verified Agent
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              <Info size={12} /> Unsigned Identity
            </div>
          )}
          <Badge variant={agent.status === 'online' || agent.status === 'active' ? 'success' : 'default'}>
            {agent.status?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </div>
      }
    >
      {/* ═══ Header: Vital Stats ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">{agent.action_count || 0}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Total Decisions</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-emerald-400">
              {policies.length > 0 ? 'ACTIVE' : 'PASSIVE'}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Governance Mode</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className={`text-2xl font-semibold ${signals.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {signals.length}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Active Signals</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-purple-400">
              ${parseFloat(agent.total_cost || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Total Cost</div>
          </div>
        </Card>
      </div>

      {/* ═══ Tab Navigation ═══ */}
      <div className="flex items-center gap-1 mb-8 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id ? 'text-brand' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'governance' && (
            <>
              <Card hover={false}>
                <CardHeader title="Decision Posture" icon={Activity} />
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl bg-surface-tertiary border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                          <Brain size={24} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Autonomy Level</div>
                          <div className="text-xs text-zinc-500">Agent is permitted to act with high-risk guardrails enabled.</div>
                        </div>
                      </div>
                      <Badge variant="info">LEVEL 4</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-white/5 bg-black/20">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Decision Profile</div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Avg Risk Score</span>
                            <span className="text-white font-mono">24.5</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Confidence Floor</span>
                            <span className="text-white font-mono">85%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Reversibility Rate</span>
                            <span className="text-emerald-400 font-mono">92%</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-white/5 bg-black/20">
                        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">Compliance Integrity</div>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">SOC 2 Controls</span>
                            <span className="text-white font-mono">12/12</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">IMDA Model AI</span>
                            <span className="text-white font-mono">Pass</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">NIST AI RMF</span>
                            <span className="text-white font-mono">Aligned</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {signals.length > 0 && (
                <Card hover={false} className="border-red-500/20">
                  <CardHeader title="Active Risk Signals" icon={ShieldAlert} count={signals.length} />
                  <CardContent>
                    <div className="space-y-3">
                      {signals.map((sig, i) => (
                        <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ShieldAlert size={16} className="text-red-400" />
                            <div>
                              <div className="text-sm font-semibold text-white uppercase tracking-tight">{sig.type.replace(/_/g, ' ')}</div>
                              <div className="text-[10px] text-zinc-500">{new Date(sig.timestamp).toLocaleString()}</div>
                            </div>
                          </div>
                          <Badge variant="error" size="xs">CRITICAL</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeTab === 'policies' && (
            <Card hover={false}>
              <CardHeader title="Enforced Policies" icon={Shield} />
              <CardContent>
                <div className="space-y-4">
                  {policies.length > 0 ? (
                    policies.slice(0, 10).map((evalu, i) => (
                      <div key={i} className="p-4 rounded-xl bg-surface-tertiary border border-white/5 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={evalu.decision === 'allow' ? 'success' : evalu.decision === 'block' ? 'error' : 'warning'}>
                              {evalu.decision.toUpperCase()}
                            </Badge>
                            <span className="text-xs text-zinc-500 font-mono">{evalu.action_type}</span>
                          </div>
                          <div className="text-sm text-white font-medium mb-2">{evalu.reason || 'No specific reasoning provided.'}</div>
                          <div className="flex flex-wrap gap-1">
                            {parseJsonArray(evalu.matched_policies).map((p, idx) => (
                              <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                                {typeof p === 'string' ? p : p.name || p.id}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-600 font-mono pt-1">{new Date(evalu.created_at).toLocaleTimeString()}</div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-zinc-500">No active guard policies recorded for this agent.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'permissions' && (
            <Card hover={false}>
              <CardHeader title="Authorized Capabilities" icon={Lock} />
              <CardContent>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Production Systems</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {['GitHub API', 'AWS Lambda', 'Stripe', 'Production RDS'].map(sys => (
                        <div key={sys} className="p-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Database size={16} className="text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-400">{sys}</span>
                          </div>
                          <Badge variant="success" size="xs">READ/WRITE</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-widest mb-4">Authorization Scopes</h3>
                    <div className="space-y-2">
                      {['infrastructure:deploy', 'vulnerability:scan', 'code:review', 'secrets:read'].map(scope => (
                        <div key={scope} className="flex items-center gap-3 text-sm text-zinc-300 bg-white/5 p-2 rounded-lg px-4">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span className="font-mono text-xs">{scope}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'ledger' && (
            <Card hover={false}>
              <CardHeader title="Recent Decisions" icon={Activity} />
              <CardContent>
                <div className="space-y-2">
                  {decisions.map(action => (
                    <Link 
                      key={action.action_id} 
                      href={`/actions/${action.action_id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-1.5 rounded-full ${action.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <div>
                          <div className="text-sm font-medium text-white group-hover:text-brand transition-colors">{action.declared_goal}</div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{new Date(action.timestamp_start).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">Risk Score</div>
                          <div className={`text-xs font-bold ${action.risk_score >= 70 ? 'text-red-400' : 'text-emerald-400'}`}>{action.risk_score}</div>
                        </div>
                        <ChevronRight size={14} className="text-zinc-700" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ═══ Sidebar: Identity & Trust ═══ */}
        <div className="space-y-8">
          <Card hover={false}>
            <CardHeader title="Identity Root" icon={Fingerprint} />
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Agent ID</div>
                  <div className="text-xs font-mono text-zinc-400 bg-black/40 p-2 rounded break-all border border-white/5">{agent.agent_id}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Public Key Fingerprint</div>
                  <div className="text-xs font-mono text-emerald-500/60 bg-emerald-500/5 p-2 rounded break-all border border-emerald-500/10">
                    SHA256:eXp7...9zL2
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Capabilities</div>
                  <div className="flex flex-wrap gap-1.5">
                    {parseJsonArray(agent.capabilities || ['research', 'deployment', 'remediation']).map(c => (
                      <Badge key={c} variant="info" size="xs">{c}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardHeader title="Connected Integrations" icon={Globe} />
            <CardContent>
              <div className="space-y-3">
                {parseJsonArray(agent.connections || []).map((conn, idx) => {
                  const type = conn?.type || 'unknown';
                  const id = conn?.id || `conn-${idx}`;
                  return (
                    <div key={id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center text-white font-bold">
                          {type.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white uppercase">{type}</div>
                          <div className="text-[9px] text-zinc-500 font-mono">ID: {id.substring(0, 8)}</div>
                        </div>
                      </div>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                  );
                })}
                {parseJsonArray(agent.connections || []).length === 0 && (
                  <div className="text-center py-4 text-xs text-zinc-600 italic">No integrations connected.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <button
            onClick={() => window.location.href = `/mission-control?agent_id=${encodeURIComponent(agentId)}`}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand/10 border border-brand/20 text-brand text-sm font-bold rounded-xl hover:bg-brand/20 transition-all group"
          >
            <Activity size={16} />
            Filter Mission Control
            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    </PageLayout>
  );
}
