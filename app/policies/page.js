'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, AlertTriangle,
  Upload, Play, FileDown, Copy, Check, ChevronUp,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { isDemoMode } from '../lib/isDemoMode';
import { useRealtime } from '../hooks/useRealtime';

const POLICY_TYPES = [
  { value: 'risk_threshold', label: 'Risk Threshold', desc: 'Block or warn when risk score exceeds a threshold' },
  { value: 'require_approval', label: 'Require Approval', desc: 'Require approval for specific action types' },
  { value: 'block_action_type', label: 'Block Action Type', desc: 'Block specific action types entirely' },
  { value: 'rate_limit', label: 'Rate Limit', desc: 'Warn or block when an agent exceeds action frequency' },
  { value: 'webhook_check', label: 'Webhook Check', desc: 'Call an external endpoint for custom decision logic' },
  { value: 'semantic_check', label: 'Semantic Check', desc: 'Use an LLM to evaluate action intent against natural language rules' },
];

const ACTION_OPTIONS = [
  'build', 'deploy', 'post', 'apply', 'security', 'message', 'api',
  'calendar', 'research', 'review', 'fix', 'refactor', 'test', 'config',
  'monitor', 'alert', 'cleanup', 'sync', 'migrate', 'other',
];

const DECISION_ACTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'warn', label: 'Warn' },
  { value: 'require_approval', label: 'Require Approval' },
];

const PACK_PREVIEWS = {
  'enterprise-strict': {
    name: 'Enterprise Strict',
    description: 'Maximum security — all external actions blocked or gated, zero autonomous risk',
    policies: [
      { name: 'Every external communication requires human approval with no exceptions', type: 'require_approval' },
      { name: 'All destructive operations are blocked with no exceptions', type: 'block_action_type' },
      { name: 'Shell command execution is completely blocked', type: 'block_action_type' },
      { name: 'Content containing secrets, PII, or sensitive data must be blocked', type: 'block_action_type' },
      { name: 'Any data export or download operation requires approval', type: 'require_approval' },
    ],
  },
  'smb-safe': {
    name: 'SMB Safe',
    description: 'Balanced protection for small-to-medium teams — blocks destructive ops, gates external comms',
    policies: [
      { name: 'All external communications require human approval', type: 'require_approval' },
      { name: 'File deletion and destructive commands are blocked', type: 'block_action_type' },
      { name: 'Shell commands restricted to safe operations only', type: 'block_action_type' },
      { name: 'Web requests limited to approved domains', type: 'block_action_type' },
    ],
  },
  'startup-growth': {
    name: 'Startup Growth',
    description: 'Permissive with guardrails — gates customer-facing comms, allows internal messaging',
    policies: [
      { name: 'External communications to customers require approval', type: 'require_approval' },
      { name: 'Destructive operations require approval instead of being blocked', type: 'require_approval' },
      { name: 'Internal Slack messages are allowed without approval', type: 'block_action_type' },
      { name: 'Content containing secrets or API keys must be blocked', type: 'block_action_type' },
    ],
  },
  'development': {
    name: 'Development',
    description: 'Minimal guardrails for dev environments — warns on destructive ops, blocks production access',
    policies: [
      { name: 'Warn on destructive file and database operations', type: 'require_approval' },
      { name: 'Block any access to production databases or APIs', type: 'block_action_type' },
    ],
  },
};

const DECISION_COLORS = {
  allow: 'success',
  warn: 'warning',
  block: 'danger',
  require_approval: 'info',
};

function formatRules(policy) {
  const policyType = policy.policy_type || policy.type;
  let rules;
  try { rules = JSON.parse(policy.rules || policy.config || '{}'); } catch { return 'Invalid rules'; }

  switch (policyType) {
    case 'risk_threshold':
      return `Risk >= ${rules.threshold} → ${rules.action || 'block'}`;
    case 'require_approval':
      return `Types: ${(rules.action_types || []).join(', ')} → require approval`;
    case 'block_action_type':
      return `Types: ${(rules.action_types || []).join(', ')} → block`;
    case 'rate_limit':
      return `Max ${rules.max_actions} actions / ${rules.window_minutes}min → ${rules.action || 'warn'}`;
    case 'webhook_check': {
      const host = (() => { try { return new URL(rules.url).hostname; } catch { return rules.url; } })();
      return `Webhook → ${host} (timeout: ${rules.timeout_ms || 5000}ms, on_timeout: ${rules.on_timeout || 'allow'})`;
    }
    case 'semantic_check':
      return `Semantic: "${rules.instruction}" (fallback: ${rules.fallback || 'allow'})`;
    default:
      return JSON.stringify(rules);
  }
}

export default function PoliciesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || isDemoMode(); // Allow admin-like actions in demo
  const isDemo = isDemoMode();
  const canEdit = isAdmin;

  const [policies, setPolicies] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('risk_threshold');
  const [formAction, setFormAction] = useState('block');
  const [formThreshold, setFormThreshold] = useState(80);
  const [formActionTypes, setFormActionTypes] = useState([]);
  const [formMaxActions, setFormMaxActions] = useState(50);
  const [formWindowMinutes, setFormWindowMinutes] = useState(60);
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formWebhookTimeout, setFormWebhookTimeout] = useState(5000);
  const [formWebhookOnTimeout, setFormWebhookOnTimeout] = useState('allow');
  // Semantic Check State
  const [formInstruction, setFormInstruction] = useState('');
  const [formFallback, setFormFallback] = useState('allow');
  const [creating, setCreating] = useState(false);

  // Policy Simulation state
  const [simResults, setSimResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simDays, setSimDays] = useState(7);

  // Import Policy Pack state
  const [importPack, setImportPack] = useState('enterprise-strict');
  const [importYaml, setImportYaml] = useState('');
  const [importMode, setImportMode] = useState('pack'); // 'pack' or 'yaml'
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // Policy Test Runner state
  const [testResults, setTestResults] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [expandedTests, setExpandedTests] = useState({});
  // Proof Report state
  const [proofReport, setProofReport] = useState('');
  const [proofFormat, setProofFormat] = useState('markdown');
  const [generatingProof, setGeneratingProof] = useState(false);

  const handleSimulate = async (customRules = null, customType = null) => {
    setSimulating(true);
    setSimResults(null);
    
    let rules = customRules;
    let type = customType;

    if (!rules) {
      switch (formType) {
        case 'risk_threshold':
          rules = { threshold: Number(formThreshold) || 0, action: formAction };
          break;
        case 'require_approval':
          rules = { action_types: formActionTypes, action: 'require_approval' };
          break;
        case 'block_action_type':
          rules = { action_types: formActionTypes, action: 'block' };
          break;
        case 'rate_limit':
          rules = { max_actions: formMaxActions, window_minutes: formWindowMinutes, action: formAction };
          break;
        case 'webhook_check':
          rules = { url: formWebhookUrl, timeout_ms: formWebhookTimeout, on_timeout: formWebhookOnTimeout };
          break;
        case 'semantic_check':
          rules = { instruction: formInstruction, fallback: formFallback };
          break;
        default:
          rules = {};
      }
      type = formType;
    }

    try {
      const res = await fetch('/api/policies/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_type: type, rules, days: simDays }),
      });
      const json = await res.json();
      if (res.ok) {
        setSimResults(json);
      } else {
        setError(json.error || 'Simulation failed');
      }
    } catch {
      setError('Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  useRealtime((event, payload) => {
    if (event === 'guard.decision.created') {
      setDecisions(prev => [payload, ...prev].slice(0, 20));
      setStats(prev => ({
        ...prev,
        total_24h: (parseInt(prev.total_24h || 0, 10) + 1).toString(),
        blocks_24h: (parseInt(prev.blocks_24h || 0, 10) + (payload.decision === 'block' ? 1 : 0)).toString(),
        warns_24h: (parseInt(prev.warns_24h || 0, 10) + (payload.decision === 'warn' ? 1 : 0)).toString(),
        approvals_24h: (parseInt(prev.approvals_24h || 0, 10) + (payload.decision === 'require_approval' ? 1 : 0)).toString(),
      }));
    }
  });

  const fetchData = useCallback(async () => {
    try {
      const [policiesRes, decisionsRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/guard?limit=20'),
      ]);
      const policiesJson = await policiesRes.json();
      const decisionsJson = await decisionsRes.json();

      if (policiesRes.ok) setPolicies(policiesJson.policies || []);
      if (decisionsRes.ok) {
        setDecisions(decisionsJson.decisions || []);
        setStats(decisionsJson.stats || {});
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);

    let rules;
    switch (formType) {
      case 'risk_threshold':
        rules = JSON.stringify({ threshold: Number(formThreshold) || 0, action: formAction });
        break;
      case 'require_approval':
        rules = JSON.stringify({ action_types: formActionTypes, action: 'require_approval' });
        break;
      case 'block_action_type':
        rules = JSON.stringify({ action_types: formActionTypes, action: 'block' });
        break;
      case 'rate_limit':
        rules = JSON.stringify({ max_actions: formMaxActions, window_minutes: formWindowMinutes, action: formAction });
        break;
      case 'webhook_check':
        rules = JSON.stringify({ url: formWebhookUrl, timeout_ms: formWebhookTimeout, on_timeout: formWebhookOnTimeout });
        break;
      case 'semantic_check':
        rules = JSON.stringify({ instruction: formInstruction, fallback: formFallback });
        break;
      default:
        rules = '{}';
    }

    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, policy_type: formType, rules }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to create policy');
      } else {
        setShowAddForm(false);
        setFormName('');
        setFormType('risk_threshold');
        setFormActionTypes([]);
        setFormWebhookUrl('');
        setFormWebhookTimeout(5000);
        setFormWebhookOnTimeout('allow');
        setFormInstruction('');
        setFormFallback('allow');
        fetchData();
      }
    } catch {
      setError('Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (policy) => {
    try {
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: policy.id, active: policy.active ? 0 : 1 }),
      });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleDelete = async (policyId) => {
    if (!confirm('Delete this policy?')) return;
    try {
      const res = await fetch(`/api/policies?id=${policyId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleActionTypeToggle = (type) => {
    setFormActionTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const body = importMode === 'pack' ? { pack: importPack } : { yaml: importYaml };
      const res = await fetch('/api/policies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        setImportResult(json);
        fetchData();
      } else {
        setError(json.error || 'Import failed');
      }
    } catch {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleRunTests = async () => {
    setTestRunning(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/policies/test', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setTestResults(json);
      } else {
        setError(json.error || 'Test run failed');
      }
    } catch {
      setError('Test run failed');
    } finally {
      setTestRunning(false);
    }
  };

  const handleGenerateProof = async () => {
    setGeneratingProof(true);
    setProofReport('');
    try {
      const res = await fetch(`/api/policies/proof?format=${proofFormat}`);
      const json = await res.json();
      if (res.ok) {
        if (proofFormat === 'json') {
          try { setProofReport(JSON.stringify(JSON.parse(json.report), null, 2)); }
          catch { setProofReport(json.report); }
        } else {
          setProofReport(json.report);
        }
      } else {
        setError(json.error || 'Failed to generate proof');
      }
    } catch {
      setError('Failed to generate proof');
    } finally {
      setGeneratingProof(false);
    }
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(proofReport);
    } catch { /* ignore */ }
  };

  const handleDownloadReport = () => {
    const ext = proofFormat === 'json' ? 'json' : 'md';
    const blob = new Blob([proofReport], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proof-report.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleTestExpand = (policyId) => {
    setExpandedTests(prev => ({ ...prev, [policyId]: !prev[policyId] }));
  };

  const activePolicies = policies.filter(p => p.active);

  return (
    <PageLayout
      title="Policies"
      subtitle="Guard rules that govern agent behavior before actions execute"
      breadcrumbs={['Policies']}
    >
      {isDemo && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-300 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> Demo mode: policies are read-only.
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCompact label="Total Policies" value={policies.length} />
        <StatCompact label="Active" value={activePolicies.length} />
        <StatCompact label="Blocks (24h)" value={parseInt(stats.blocks_24h || 0, 10)} />
        <StatCompact label="Evaluations (24h)" value={parseInt(stats.total_24h || 0, 10)} />
      </div>

      {/* Policy List */}
      <Card className="mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm font-medium text-white">Guard Policies</h2>
          {canEdit && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
            >
              {showAddForm ? <ChevronDown size={14} /> : <Plus size={14} />}
              {showAddForm ? 'Cancel' : 'Add Policy'}
            </button>
          )}
        </div>

        {/* Add form */}
        {showAddForm && canEdit && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] space-y-4 bg-[rgba(255,255,255,0.02)]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Policy Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Block high-risk deploys"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Policy Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                >
                  {POLICY_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>{pt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">
                  {POLICY_TYPES.find(pt => pt.value === formType)?.desc}
                </p>
              </div>
            </div>

            {/* Dynamic fields per type */}
            {formType === 'risk_threshold' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Risk Threshold (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value === '' ? '' : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Action</label>
                  <select
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  >
                    {DECISION_ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {(formType === 'require_approval' || formType === 'block_action_type') && (
              <div>
                <label className="block text-xs text-zinc-400 mb-2">Action Types</label>
                <div className="flex flex-wrap gap-2">
                  {ACTION_OPTIONS.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleActionTypeToggle(type)}
                      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                        formActionTypes.includes(type)
                          ? 'bg-brand text-white'
                          : 'bg-[#1a1a1a] text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formType === 'rate_limit' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Max Actions</label>
                  <input
                    type="number"
                    min="1"
                    value={formMaxActions}
                    onChange={(e) => setFormMaxActions(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Window (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={formWindowMinutes}
                    onChange={(e) => setFormWindowMinutes(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Action</label>
                  <select
                    value={formAction}
                    onChange={(e) => setFormAction(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  >
                    {DECISION_ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {formType === 'webhook_check' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3">
                  <label className="block text-xs text-zinc-400 mb-1">Webhook URL (HTTPS required)</label>
                  <input
                    type="url"
                    value={formWebhookUrl}
                    onChange={(e) => setFormWebhookUrl(e.target.value)}
                    placeholder="https://your-api.example.com/guard"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    max="10000"
                    step="500"
                    value={formWebhookTimeout}
                    onChange={(e) => setFormWebhookTimeout(parseInt(e.target.value, 10) || 5000)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">On Timeout</label>
                  <select
                    value={formWebhookOnTimeout}
                    onChange={(e) => setFormWebhookOnTimeout(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  >
                    <option value="allow">Allow (fail-open)</option>
                    <option value="block">Block (fail-closed)</option>
                  </select>
                </div>
              </div>
            )}

            {formType === 'semantic_check' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Instruction (Natural Language)</label>
                  <textarea
                    value={formInstruction}
                    onChange={(e) => setFormInstruction(e.target.value)}
                    placeholder="e.g. Do not allow the agent to delete files in the /system directory."
                    required
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Fallback Action (if LLM is unavailable)</label>
                  <select
                    value={formFallback}
                    onChange={(e) => setFormFallback(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  >
                    <option value="allow">Allow (Fail Open - Recommended)</option>
                    <option value="block">Block (Fail Closed)</option>
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    To enable this, set <code className="text-zinc-400">GUARD_LLM_KEY</code> (or OPENAI_API_KEY) in your environment variables.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={creating || !formName.trim() || ((formType === 'require_approval' || formType === 'block_action_type') && formActionTypes.length === 0) || (formType === 'webhook_check' && (() => { try { const u = new URL(formWebhookUrl); return u.protocol !== 'https:' || !u.hostname; } catch { return true; } })()) || (formType === 'semantic_check' && !formInstruction.trim())}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Policy'}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate()}
                disabled={simulating || ((formType === 'require_approval' || formType === 'block_action_type') && formActionTypes.length === 0) || (formType === 'webhook_check' && (() => { try { const u = new URL(formWebhookUrl); return u.protocol !== 'https:' || !u.hostname; } catch { return true; } })()) || (formType === 'semantic_check' && !formInstruction.trim())}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Play size={14} />
                {simulating ? 'Simulating...' : 'Simulate impact'}
              </button>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>over last</span>
                <select 
                  value={simDays} 
                  onChange={(e) => setSimDays(parseInt(e.target.value, 10))}
                  className="bg-[#111] border border-[rgba(255,255,255,0.1)] rounded px-1 py-0.5 focus:outline-none"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
            </div>

            {simResults && (
              <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                    <Shield size={16} />
                    Simulation Results
                  </h3>
                  <button onClick={() => setSimResults(null)} className="text-blue-400 hover:text-blue-300 text-xs">&times; Close</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">{simResults.summary.total}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Actions Checked</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${simResults.summary.block > 0 ? 'text-red-400' : 'text-zinc-400'}`}>{simResults.summary.block}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Would Block</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${simResults.summary.warn > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>{simResults.summary.warn}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Would Warn</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${simResults.summary.require_approval > 0 ? 'text-blue-400' : 'text-zinc-400'}`}>{simResults.summary.require_approval}</div>
                    <div className="text-[10px] text-zinc-500 uppercase">Would Gate</div>
                  </div>
                </div>
                
                {simResults.matches.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {simResults.matches.slice(0, 10).map((match, i) => (
                      <div key={i} className="text-[11px] p-2 rounded bg-white/5 border border-white/5 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-300 truncate">{match.goal}</div>
                          <div className="text-zinc-500 truncate">{match.agent_name} • {new Date(match.timestamp).toLocaleDateString()}</div>
                        </div>
                        <Badge variant={DECISION_COLORS[match.simulated_action]} size="xs">{match.simulated_action}</Badge>
                      </div>
                    ))}
                    {simResults.matches.length > 10 && (
                      <div className="text-center text-[10px] text-zinc-500 pt-1">
                        + {simResults.matches.length - 10} more matches
                      </div>
                    )}
                  </div>
                )}
                
                {simResults.matches.length === 0 && (
                  <p className="text-center text-xs text-zinc-500 py-2">No historical matches found. This policy would not have triggered any actions.</p>
                )}
              </div>
            )}
          </form>
        )}

        <CardContent>
          {loading ? (
            <div className="text-sm text-zinc-500 py-8 text-center">Loading policies...</div>
          ) : policies.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No policies configured"
              description={isAdmin ? 'Create your first guard policy to control agent behavior.' : 'No policies have been configured yet. Ask an admin to set up guard policies.'}
            />
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {policies.map(policy => (
                <div key={policy.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${policy.active ? 'text-white' : 'text-zinc-500'}`}>
                        {policy.name}
                      </span>
                      <Badge variant={policy.active ? 'success' : 'muted'}>
                        {policy.active ? 'active' : 'inactive'}
                      </Badge>
                      <Badge variant="info">{(policy.policy_type || policy.type || 'custom_policy').replace(/_/g, ' ')}</Badge>
                    </div>
                    <p className="text-xs text-zinc-400">{formatRules(policy)}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 font-mono">{policy.id}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleSimulate(JSON.parse(policy.rules || policy.config || '{}'), policy.policy_type || policy.type)}
                        className="text-zinc-500 hover:text-brand transition-colors p-1"
                        title="Simulate historical impact"
                        disabled={simulating}
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => handleToggle(policy)}
                        className="text-zinc-500 hover:text-white transition-colors"
                        title={policy.active ? 'Disable' : 'Enable'}
                      >
                        {policy.active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id)}
                        className="text-zinc-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Guard Decisions */}
      <Card className="mb-6">
        <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm font-medium text-white">Recent Guard Decisions</h2>
        </div>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No guard evaluations yet. Decisions appear when agents call the guard endpoint.</p>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {decisions.map(d => (
                <div key={d.id} className="py-2.5 flex items-center gap-3">
                  <Badge variant={DECISION_COLORS[d.decision] || 'muted'}>{d.decision}</Badge>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-300">{d.agent_id || 'unknown'}</span>
                    {d.action_type && (
                      <span className="text-xs text-zinc-500 ml-2">{d.action_type}</span>
                    )}
                    {d.reason && (
                      <p className="text-xs text-zinc-500 truncate">{d.reason}</p>
                    )}
                  </div>
                  {d.risk_score != null && (
                    <span className={`text-xs font-mono ${d.risk_score >= 80 ? 'text-red-400' : d.risk_score >= 50 ? 'text-yellow-400' : 'text-zinc-500'}`}>
                      risk:{d.risk_score}
                    </span>
                  )}
                  <span className="text-xs text-zinc-600 font-mono flex-shrink-0">
                    {new Date(d.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Policy Pack */}
      {canEdit && (
        <Card className="mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-sm font-medium text-white">Import Policy Pack</h2>
            <Upload size={14} className="text-zinc-400" />
          </div>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setImportMode('pack')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    importMode === 'pack'
                      ? 'bg-brand text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  Select Pack
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('yaml')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    importMode === 'yaml'
                      ? 'bg-brand text-white'
                      : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }`}
                >
                  Raw YAML
                </button>
              </div>

              {importMode === 'pack' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Policy Pack</label>
                    <select
                      value={importPack}
                      onChange={(e) => setImportPack(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                    >
                      <option value="enterprise-strict">Enterprise Strict</option>
                      <option value="smb-safe">SMB Safe</option>
                      <option value="startup-growth">Startup Growth</option>
                      <option value="development">Development</option>
                    </select>
                  </div>

                  {/* Pack preview */}
                  {PACK_PREVIEWS[importPack] && (
                    <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-white">{PACK_PREVIEWS[importPack].name}</span>
                        <Badge variant="info">{PACK_PREVIEWS[importPack].policies.length} policies</Badge>
                      </div>
                      <p className="text-[10px] text-zinc-500 mb-3">{PACK_PREVIEWS[importPack].description}</p>
                      <div className="space-y-1.5">
                        {PACK_PREVIEWS[importPack].policies.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Badge variant={p.type === 'require_approval' ? 'warning' : 'error'} size="xs">
                              {p.type === 'require_approval' ? 'approval' : 'block'}
                            </Badge>
                            <span className="text-zinc-300">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">YAML Policy Definition</label>
                  <textarea
                    value={importYaml}
                    onChange={(e) => setImportYaml(e.target.value)}
                    placeholder="Paste your policy YAML here..."
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand font-mono"
                  />
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || !canEdit || (importMode === 'yaml' && !importYaml.trim())}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>

              {importResult && (
                <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">{importResult.imported ?? 0} imported</Badge>
                    {(importResult.skipped ?? 0) > 0 && (
                      <Badge variant="warning">{importResult.skipped} skipped</Badge>
                    )}
                    {(importResult.errors ?? 0) > 0 && (
                      <Badge variant="error">{importResult.errors} errors</Badge>
                    )}
                  </div>
                  {importResult.details && (
                    <p className="text-xs text-zinc-400 mt-1">{importResult.details}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policy Test Runner */}
      <Card className="mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm font-medium text-white">Policy Test Runner</h2>
          <button
            onClick={handleRunTests}
            disabled={testRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
          >
            <Play size={12} />
            {testRunning ? 'Running...' : 'Run Tests'}
          </button>
        </div>
        <CardContent>
          {!testResults ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Click &quot;Run Tests&quot; to validate all policies against their test cases.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-zinc-400">
                  {testResults.totalPolicies ?? 0} policies, {testResults.totalTests ?? 0} tests
                </span>
                <Badge variant={(testResults.failed ?? 0) === 0 ? 'success' : 'error'}>
                  {(testResults.totalPolicies ?? 0) === 0 ? 'No policies to test' : (testResults.failed ?? 0) === 0 ? 'ALL PASS' : `${testResults.failed} FAILURES`}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {testResults.passed ?? 0} passed, {testResults.failed ?? 0} failed
                </span>
              </div>

              {/* Per-policy details */}
              {testResults.results && testResults.results.length > 0 && (
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {testResults.results.map((pr, i) => {
                    const pId = pr.policyId || pr.id || `test-${i}`;
                    const pName = pr.policyName || pr.name || pId;
                    const fCount = pr.failCount ?? (pr.passed ? 0 : 1);

                    return (
                      <div key={pId} className="py-2">
                        <button
                          type="button"
                          onClick={() => toggleTestExpand(pId)}
                          className="flex items-center gap-2 w-full text-left"
                        >
                          {expandedTests[pId] ? (
                            <ChevronUp size={14} className="text-zinc-500" />
                          ) : (
                            <ChevronDown size={14} className="text-zinc-500" />
                          )}
                          <span className="text-sm text-white">{pName}</span>
                          <Badge variant={fCount === 0 ? 'success' : 'error'}>
                            {fCount === 0 ? 'pass' : `${fCount} fail`}
                          </Badge>
                        </button>
                        {expandedTests[pId] && pr.tests && (
                          <div className="mt-2 ml-6 space-y-1">
                            {pr.tests.map((t, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs">
                                {t.passed ? (
                                  <Check size={12} className="text-green-500" />
                                ) : (
                                  <AlertTriangle size={12} className="text-red-400" />
                                )}
                                <span className={t.passed ? 'text-zinc-300' : 'text-red-400'}>
                                  {t.name || `Test ${j + 1}`}
                                </span>
                                {t.message && (
                                  <span className="text-zinc-600 ml-1">{t.message}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof Report */}
      <Card className="mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
          <h2 className="text-sm font-medium text-white">Proof Report</h2>
          <div className="flex items-center gap-2">
            <select
              value={proofFormat}
              onChange={(e) => setProofFormat(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-xs text-white focus:outline-none focus:border-brand"
            >
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
            <button
              onClick={handleGenerateProof}
              disabled={generatingProof}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              <FileDown size={12} />
              {generatingProof ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
        <CardContent>
          {!proofReport ? (
            <p className="text-sm text-zinc-500 py-4 text-center">
              Generate a proof report to document policy compliance status.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors flex items-center gap-1.5"
                >
                  <Copy size={12} />
                  Copy
                </button>
                <button
                  onClick={handleDownloadReport}
                  className="px-3 py-1.5 rounded-lg bg-zinc-700 text-zinc-300 text-xs hover:bg-zinc-600 transition-colors flex items-center gap-1.5"
                >
                  <FileDown size={12} />
                  Download
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs text-zinc-300 bg-[#111] p-4 rounded-lg border border-[rgba(255,255,255,0.06)] max-h-[500px] overflow-y-auto font-mono">
                {proofReport}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
