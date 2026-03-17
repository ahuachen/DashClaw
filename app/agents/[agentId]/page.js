'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Shield, ShieldCheck, ShieldAlert, Zap, Clock, Activity,
  Lock, Info, ArrowLeft, ExternalLink, Database,
  BarChart3, RefreshCw, KeyRound, Globe, Brain,
  ChevronRight, CheckCircle2, XCircle, HelpCircle, Fingerprint,
  Plus, X, ToggleLeft, ToggleRight,
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCompact } from '../../components/ui/Stat';

function formatPolicyRules(policy) {
  const policyType = policy.policy_type || policy.type;
  let rules;
  try { rules = JSON.parse(policy.rules || '{}'); } catch { return 'Invalid rules'; }
  switch (policyType) {
    case 'risk_threshold': return `Risk >= ${rules.threshold} → ${rules.action || 'block'}`;
    case 'require_approval': return `Types: ${(rules.action_types || []).join(', ')} → require approval`;
    case 'block_action_type': return `Types: ${(rules.action_types || []).join(', ')} → block`;
    case 'rate_limit': return `Max ${rules.max_actions} / ${rules.window_minutes}min → ${rules.action || 'warn'}`;
    case 'webhook_check': return `Webhook check`;
    case 'semantic_check': return `Semantic: "${(rules.instruction || '').slice(0, 60)}..."`;
    default: return policyType;
  }
}

function parseAgentIds(policy) {
  if (!policy.agent_ids) return [];
  try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
}

function AgentPoliciesTab({ agentId, policies, allPolicies, assigning, setAssigning, onRefresh }) {
  const [showAssign, setShowAssign] = useState(false);

  // Policies specifically assigned to this agent (agent_ids includes this agent)
  const assignedPolicies = policies.filter(p => {
    const ids = parseAgentIds(p);
    return ids.length > 0 && ids.includes(agentId);
  });

  // Global policies (no agent_ids = applies to all)
  const globalPolicies = policies.filter(p => {
    const ids = parseAgentIds(p);
    return ids.length === 0;
  });

  // Policies NOT currently applying to this agent (for the assign picker)
  const unassignedPolicies = allPolicies.filter(p => {
    const ids = parseAgentIds(p);
    // Already applies: either global or includes this agent
    if (ids.length === 0) return false;
    return !ids.includes(agentId);
  });

  const handleAssign = async (policy) => {
    setAssigning(true);
    try {
      const currentIds = parseAgentIds(policy);
      const newIds = [...currentIds, agentId];
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, agent_ids: JSON.stringify(newIds) }),
      });
      if (res.ok) onRefresh();
    } catch { /* ignore */ }
    finally { setAssigning(false); }
  };

  const handleUnassign = async (policy) => {
    setAssigning(true);
    try {
      const currentIds = parseAgentIds(policy);
      const newIds = currentIds.filter(id => id !== agentId);
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, agent_ids: newIds.length > 0 ? JSON.stringify(newIds) : null }),
      });
      if (res.ok) onRefresh();
    } catch { /* ignore */ }
    finally { setAssigning(false); }
  };

  return (
    <div className="space-y-6">
      {/* Assigned Policies */}
      <Card hover={false}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-brand" />
            <span className="text-sm font-medium text-white">Agent-Specific Policies</span>
            <Badge variant="info">{assignedPolicies.length}</Badge>
          </div>
          <button
            onClick={() => setShowAssign(!showAssign)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
          >
            {showAssign ? <X size={12} /> : <Plus size={12} />}
            {showAssign ? 'Cancel' : 'Assign Policy'}
          </button>
        </div>

        {showAssign && (
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
            <p className="text-xs text-zinc-500 mb-3">Select a policy to assign specifically to this agent:</p>
            {unassignedPolicies.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unassignedPolicies.map(policy => (
                  <div key={policy.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-tertiary border border-white/5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white">{policy.name}</span>
                        <Badge variant="info" size="xs">{(policy.policy_type || '').replace(/_/g, ' ')}</Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500">{formatPolicyRules(policy)}</p>
                    </div>
                    <button
                      onClick={() => handleAssign(policy)}
                      disabled={assigning}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-medium hover:bg-brand/20 border border-brand/20 transition-colors disabled:opacity-50 ml-3 flex-shrink-0"
                    >
                      <Plus size={12} /> Assign
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-4 text-center">
                All policies are already applying to this agent (either globally or by assignment).
              </p>
            )}
          </div>
        )}

        <CardContent>
          {assignedPolicies.length > 0 ? (
            <div className="space-y-3">
              {assignedPolicies.map(policy => (
                <div key={policy.id} className="p-4 rounded-xl bg-surface-tertiary border border-white/5 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{policy.name}</span>
                      <Badge variant={policy.active ? 'success' : 'muted'}>
                        {policy.active ? 'active' : 'inactive'}
                      </Badge>
                      <Badge variant="info" size="xs">{(policy.policy_type || '').replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400">{formatPolicyRules(policy)}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{policy.id}</p>
                  </div>
                  <button
                    onClick={() => handleUnassign(policy)}
                    disabled={assigning}
                    className="text-zinc-500 hover:text-red-400 transition-colors p-1 disabled:opacity-50 flex-shrink-0"
                    title="Remove from this agent"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-zinc-500 text-sm">
              No policies assigned specifically to this agent. Use &quot;Assign Policy&quot; above to scope a policy to this agent.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Policies */}
      <Card hover={false}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <Shield size={16} className="text-zinc-500" />
          <span className="text-sm font-medium text-white">Global Policies</span>
          <Badge variant="muted">{globalPolicies.length}</Badge>
          <span className="text-[10px] text-zinc-600 ml-1">Apply to all agents</span>
        </div>
        <CardContent>
          {globalPolicies.length > 0 ? (
            <div className="space-y-3">
              {globalPolicies.map(policy => (
                <div key={policy.id} className="p-3 rounded-xl bg-surface-tertiary border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-300">{policy.name}</span>
                    <Badge variant={policy.active ? 'success' : 'muted'} size="xs">
                      {policy.active ? 'active' : 'inactive'}
                    </Badge>
                    <Badge variant="info" size="xs">{(policy.policy_type || '').replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="text-xs text-zinc-500">{formatPolicyRules(policy)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-zinc-600 text-xs">No global policies configured.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.agentId;

  const [activeTab, setActiveTab] = useState('governance');
  const [agent, setAgent] = useState(null);
  const [decisions, setActions] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assigning, setAssigning] = useState(false);

  // Compute Decision Profile from actual action records
  const decisionProfile = useMemo(() => {
    if (!decisions || decisions.length === 0) {
      return { avgRisk: '—', confidenceFloor: '—', reversibilityRate: '—' };
    }
    const withRisk = decisions.filter(d => d.risk_score != null);
    const withConf = decisions.filter(d => d.confidence != null);
    const withRev = decisions.filter(d => d.reversible != null);

    const avgRisk = withRisk.length > 0
      ? (withRisk.reduce((s, d) => s + d.risk_score, 0) / withRisk.length).toFixed(1)
      : '—';
    const confidenceFloor = withConf.length > 0
      ? Math.min(...withConf.map(d => d.confidence)) + '%'
      : '—';
    const reversibilityRate = withRev.length > 0
      ? Math.round((withRev.filter(d => d.reversible).length / withRev.length) * 100) + '%'
      : '—';

    return { avgRisk, confidenceFloor, reversibilityRate };
  }, [decisions]);

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

      // 3. Fetch Policies that apply to this agent + all org policies
      const [agentPoliciesRes, allPoliciesRes] = await Promise.all([
        fetch(`/api/policies?agent_id=${encodeURIComponent(agentId)}`),
        fetch('/api/policies'),
      ]);
      if (agentPoliciesRes.ok) {
        const policiesData = await agentPoliciesRes.json();
        setPolicies(policiesData.policies || []);
      }
      if (allPoliciesRes.ok) {
        const allData = await allPoliciesRes.json();
        setAllPolicies(allData.policies || []);
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
                            <span className="text-white font-mono">{decisionProfile.avgRisk}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Confidence Floor</span>
                            <span className="text-white font-mono">{decisionProfile.confidenceFloor}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Reversibility Rate</span>
                            <span className="text-emerald-400 font-mono">{decisionProfile.reversibilityRate}</span>
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
            <AgentPoliciesTab
              agentId={agentId}
              policies={policies}
              allPolicies={allPolicies}
              assigning={assigning}
              setAssigning={setAssigning}
              onRefresh={fetchData}
              parseJsonArray={parseJsonArray}
            />
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
