'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Shield, ShieldCheck, ShieldAlert, Zap, Clock, Activity,
  Lock, Info, ArrowLeft, ExternalLink, Database,
  BarChart3, RefreshCw, KeyRound, Globe, Brain,
  ChevronRight, CheckCircle2, XCircle, HelpCircle, Fingerprint,
  Plus, X, ToggleLeft, ToggleRight, Plug, Trash2, Wifi, WifiOff,
  Eye, EyeOff, Search,
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatCompact } from '../../components/ui/Stat';
import { INTEGRATION_CONFIGS, CATEGORY_ICONS, CATEGORIES } from '../../lib/integrationConfigs';

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
  const [integrations, setIntegrations] = useState([]);
  const [integrationSettings, setIntegrationSettings] = useState({});
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [integrationFormData, setIntegrationFormData] = useState({});
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationCategory, setIntegrationCategory] = useState('all');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [showFieldValues, setShowFieldValues] = useState({});
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

      // 4. Fetch Risk Signals + Integrations + Integration Settings
      const [signalsRes, integrationsRes, intSettingsRes] = await Promise.all([
        fetch(`/api/actions/signals?agent_id=${encodeURIComponent(agentId)}`),
        fetch(`/api/integrations?agent_id=${encodeURIComponent(agentId)}`),
        fetch(`/api/settings?category=integration&agent_id=${encodeURIComponent(agentId)}`),
      ]);
      if (signalsRes.ok) {
        const signalsData = await signalsRes.json();
        setSignals(signalsData.signals || []);
      }
      if (integrationsRes.ok) {
        const intData = await integrationsRes.json();
        setIntegrations(intData.integrations || intData.connections || []);
      }
      if (intSettingsRes.ok) {
        const intSettingsData = await intSettingsRes.json();
        const settingsMap = {};
        (intSettingsData.settings || []).forEach(s => {
          settingsMap[s.key] = s;
        });
        setIntegrationSettings(settingsMap);
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
    { id: 'integrations', label: 'Integrations', icon: Plug },
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

          {activeTab === 'integrations' && (() => {
            const getAgentIntegrationStatus = (integrationKey) => {
              const config = INTEGRATION_CONFIGS[integrationKey];
              const requiredFields = config.fields.filter(f => f.required);
              return requiredFields.every(f => integrationSettings[f.key]?.hasValue) ? 'connected' : 'not_configured';
            };

            const isIntegrationInherited = (integrationKey) => {
              const config = INTEGRATION_CONFIGS[integrationKey];
              return config.fields.some(f => integrationSettings[f.key]?.is_inherited && integrationSettings[f.key]?.hasValue);
            };

            const hasAgentOverride = (integrationKey) => {
              const config = INTEGRATION_CONFIGS[integrationKey];
              return config.fields.some(f => integrationSettings[f.key]?.hasValue && !integrationSettings[f.key]?.is_inherited);
            };

            const allIntegrations = Object.entries(INTEGRATION_CONFIGS);
            const filteredIntegrations = allIntegrations.filter(([key, config]) => {
              const matchesCategory = integrationCategory === 'all' || config.category === integrationCategory;
              const matchesSearch = !integrationSearch ||
                config.name.toLowerCase().includes(integrationSearch.toLowerCase()) ||
                config.description.toLowerCase().includes(integrationSearch.toLowerCase());
              return matchesCategory && matchesSearch;
            });

            const openIntegrationEditor = (integrationKey) => {
              const config = INTEGRATION_CONFIGS[integrationKey];
              const initialData = {};
              config.fields.forEach(f => {
                initialData[f.key] = integrationSettings[f.key]?.value || '';
              });
              setIntegrationFormData(initialData);
              setEditingIntegration(integrationKey);
              setShowFieldValues({});
            };

            const handleIntegrationSave = async () => {
              setIntegrationSaving(true);
              try {
                const config = INTEGRATION_CONFIGS[editingIntegration];
                for (const field of config.fields) {
                  if (integrationFormData[field.key] !== undefined) {
                    await fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        key: field.key,
                        value: integrationFormData[field.key],
                        category: 'integration',
                        encrypted: field.type === 'password',
                        agent_id: agentId,
                      }),
                    });
                  }
                }
                // Refetch integration settings
                const res = await fetch(`/api/settings?category=integration&agent_id=${encodeURIComponent(agentId)}`);
                if (res.ok) {
                  const data = await res.json();
                  const settingsMap = {};
                  (data.settings || []).forEach(s => { settingsMap[s.key] = s; });
                  setIntegrationSettings(settingsMap);
                }
                setEditingIntegration(null);
                setIntegrationFormData({});
              } catch (err) {
                console.error('Failed to save integration override:', err);
              } finally {
                setIntegrationSaving(false);
              }
            };

            const handleRemoveOverride = async () => {
              setIntegrationSaving(true);
              try {
                const config = INTEGRATION_CONFIGS[editingIntegration];
                for (const field of config.fields) {
                  await fetch(`/api/settings?key=${encodeURIComponent(field.key)}&agent_id=${encodeURIComponent(agentId)}`, {
                    method: 'DELETE',
                  });
                }
                // Refetch integration settings
                const res = await fetch(`/api/settings?category=integration&agent_id=${encodeURIComponent(agentId)}`);
                if (res.ok) {
                  const data = await res.json();
                  const settingsMap = {};
                  (data.settings || []).forEach(s => { settingsMap[s.key] = s; });
                  setIntegrationSettings(settingsMap);
                }
                setEditingIntegration(null);
                setIntegrationFormData({});
              } catch (err) {
                console.error('Failed to remove override:', err);
              } finally {
                setIntegrationSaving(false);
              }
            };

            return (
              <div className="space-y-6">
                {/* Search Bar */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search integrations..."
                    value={integrationSearch}
                    onChange={(e) => setIntegrationSearch(e.target.value)}
                    className="w-full bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors"
                  />
                </div>

                {/* Category Filter Pills */}
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const CatIcon = CATEGORY_ICONS[cat.id];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setIntegrationCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 ${
                          integrationCategory === cat.id
                            ? 'bg-brand text-white'
                            : 'bg-surface-tertiary text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[rgba(255,255,255,0.12)]'
                        }`}
                      >
                        <CatIcon size={14} />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {/* Results count */}
                {(integrationCategory !== 'all' || integrationSearch) && (
                  <p className="text-xs text-zinc-500">
                    Showing {filteredIntegrations.length} of {allIntegrations.length} integrations
                  </p>
                )}

                {/* Integration Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredIntegrations.map(([key, config]) => {
                    const status = getAgentIntegrationStatus(key);
                    const inherited = isIntegrationInherited(key);
                    const overridden = hasAgentOverride(key);
                    const CatIcon = CATEGORY_ICONS[config.category] || Plug;

                    return (
                      <div
                        key={key}
                        className="rounded-xl bg-surface-tertiary border border-white/5 p-5 group hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-black/30 rounded-lg flex items-center justify-center">
                              <CatIcon size={16} className="text-zinc-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{config.name}</div>
                              <div className="text-xs text-zinc-500">{config.description}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-zinc-500'}`} />
                          <span className="text-xs text-zinc-500">{status === 'connected' ? 'Connected' : 'Not Set'}</span>
                          {inherited && (
                            <Badge variant="success" size="xs">Inherited from org</Badge>
                          )}
                          {overridden && (
                            <Badge variant="brand" size="xs">Agent override</Badge>
                          )}
                        </div>

                        <button
                          onClick={() => openIntegrationEditor(key)}
                          className={`w-full py-2 rounded-lg text-xs font-medium transition-colors ${
                            inherited && !overridden
                              ? 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5'
                              : 'bg-brand text-white hover:bg-brand-hover'
                          }`}
                        >
                          {inherited && !overridden ? 'Override' : 'Configure'}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {filteredIntegrations.length === 0 && (
                  <div className="py-12 text-center">
                    <Plug size={32} className="text-zinc-700 mx-auto mb-3" />
                    <div className="text-sm text-zinc-500">No integrations match your search.</div>
                  </div>
                )}

                {/* Configure Modal */}
                {editingIntegration && (() => {
                  const config = INTEGRATION_CONFIGS[editingIntegration];
                  const inherited = isIntegrationInherited(editingIntegration);
                  const overridden = hasAgentOverride(editingIntegration);

                  return (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                      <div className="bg-surface-elevated border border-[rgba(255,255,255,0.06)] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-surface-tertiary rounded-lg flex items-center justify-center">
                                <Plug size={16} className="text-zinc-400" />
                              </div>
                              <div>
                                <h2 className="text-lg font-semibold text-white">{config.name}</h2>
                                <p className="text-sm text-zinc-400">{config.description}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setEditingIntegration(null); setIntegrationFormData({}); }}
                              className="text-zinc-400 hover:text-white transition-colors"
                            >
                              <X size={20} />
                            </button>
                          </div>

                          {/* Inherited note */}
                          {inherited && !overridden && (
                            <div className="mb-5 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-sm text-emerald-400">
                              Currently using org default. Save to create an agent-specific override.
                            </div>
                          )}

                          {/* Form Fields */}
                          <div className="space-y-4">
                            {config.fields.map((field) => (
                              <div key={field.key}>
                                {field.type === 'toggle' ? (
                                  <div className="flex items-center justify-between py-1">
                                    <label className="text-sm font-medium text-zinc-300">{field.label}</label>
                                    <button
                                      type="button"
                                      onClick={() => setIntegrationFormData(prev => ({
                                        ...prev,
                                        [field.key]: prev[field.key] === 'true' ? 'false' : 'true',
                                      }))}
                                      className={`relative w-10 h-5 rounded-full transition-colors ${
                                        integrationFormData[field.key] === 'true' ? 'bg-brand' : 'bg-zinc-600'
                                      }`}
                                    >
                                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                                        integrationFormData[field.key] === 'true' ? 'translate-x-5' : ''
                                      }`} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">
                                      {field.label}
                                      {field.required && <span className="text-red-400 ml-1">*</span>}
                                    </label>
                                    <div className="relative">
                                      <input
                                        type={showFieldValues[field.key] ? 'text' : field.type}
                                        value={integrationFormData[field.key] || ''}
                                        onChange={(e) => setIntegrationFormData(prev => ({
                                          ...prev,
                                          [field.key]: e.target.value,
                                        }))}
                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                                        className="w-full bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors"
                                      />
                                      {field.type === 'password' && (
                                        <button
                                          type="button"
                                          onClick={() => setShowFieldValues(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                                        >
                                          {showFieldValues[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">{field.key}</p>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-3 mt-6">
                            {overridden && (
                              <button
                                onClick={handleRemoveOverride}
                                disabled={integrationSaving}
                                className="px-4 py-2.5 text-sm text-red-400 hover:text-red-300 bg-red-500/5 border border-red-500/10 rounded-lg hover:bg-red-500/10 transition-colors font-medium disabled:opacity-50"
                              >
                                Remove Override
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingIntegration(null); setIntegrationFormData({}); }}
                              className="flex-1 px-3 py-2.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleIntegrationSave}
                              disabled={integrationSaving}
                              className="flex-1 bg-brand hover:bg-brand-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {integrationSaving ? 'Saving...' : 'Save Override'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

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

          {(() => {
            const connectedIntegrations = Object.entries(INTEGRATION_CONFIGS).filter(([, config]) => {
              const requiredFields = config.fields.filter(f => f.required);
              return requiredFields.every(f => integrationSettings[f.key]?.hasValue);
            });
            const displayIntegrations = connectedIntegrations.slice(0, 3);

            return (
              <Card hover={false}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-brand" />
                    <span className="text-sm font-medium text-white">Connected Integrations</span>
                    <Badge variant="info" size="xs">{connectedIntegrations.length}</Badge>
                  </div>
                  <button
                    onClick={() => setActiveTab('integrations')}
                    className="text-[10px] text-brand hover:underline font-medium"
                  >
                    View All
                  </button>
                </div>
                <CardContent>
                  <div className="space-y-3">
                    {displayIntegrations.map(([key, config]) => {
                      const inherited = config.fields.some(f => integrationSettings[f.key]?.is_inherited && integrationSettings[f.key]?.hasValue);
                      const CatIcon = CATEGORY_ICONS[config.category] || Plug;
                      return (
                        <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                              <CatIcon size={14} className="text-zinc-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white uppercase">{config.name}</div>
                              <div className="text-[9px] text-zinc-500">{config.category}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {inherited && (
                              <span className="text-[9px] text-emerald-400/60">org</span>
                            )}
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                          </div>
                        </div>
                      );
                    })}
                    {connectedIntegrations.length === 0 && (
                      <div className="text-center py-4 text-xs text-zinc-600 italic">No integrations connected.</div>
                    )}
                    {connectedIntegrations.length > 3 && (
                      <button
                        onClick={() => setActiveTab('integrations')}
                        className="w-full text-center text-xs text-zinc-500 hover:text-brand transition-colors py-1"
                      >
                        +{connectedIntegrations.length - 3} more
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

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
