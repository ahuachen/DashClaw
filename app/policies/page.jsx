'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, AlertTriangle,
  Upload, Play, FileDown, Copy, Check, ChevronUp,
  Pencil, X, Square, CheckSquare, Users, BookOpen, Sparkles,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { isDemoMode } from '../lib/isDemoMode';
import { useRealtime } from '../hooks/useRealtime';
import { PACK_PREVIEWS } from '../lib/policyPackPreviews.js';
import PolicyAuthoringPanel from './components/PolicyAuthoringPanel';
import PolicyAdvancedImportPanel from './components/PolicyAdvancedImportPanel';
import {
  buildPolicySummary,
  compilePolicyPayload,
  createDefaultPolicyFormState,
  decompilePolicyForm,
} from './lib/policyFormModel';

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

const DECISION_COLORS = {
  allow: 'success',
  warn: 'warning',
  block: 'danger',
  require_approval: 'info',
};

const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand';
const selectClass = 'w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand';

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

/** Parse agent_ids JSON from a policy */
function parseAgentIds(policy) {
  if (!policy.agent_ids) return [];
  try {
    const parsed = JSON.parse(policy.agent_ids);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function formatPolicySummary(policy) {
  try {
    return buildPolicySummary(decompilePolicyForm(policy));
  } catch {
    return formatRules(policy);
  }
}

function isWebhookConfigInvalid(form) {
  if (form.type !== 'webhook_check') return false;
  try {
    const url = new URL(form.webhookUrl);
    return url.protocol !== 'https:' || !url.hostname;
  } catch {
    return true;
  }
}

function isAuthoringFormInvalid(form) {
  if (!form.name?.trim()) return true;
  if ((form.type === 'require_approval' || form.type === 'block_action_type') && form.actionTypes.length === 0) return true;
  if (isWebhookConfigInvalid(form)) return true;
  if (form.type === 'semantic_check' && !form.instruction.trim()) return true;
  return false;
}

/** Parse rules from a policy into form-friendly shape */
function parseRulesForEdit(policy) {
  let rules;
  try { rules = JSON.parse(policy.rules || policy.config || '{}'); } catch { rules = {}; }
  const policyType = policy.policy_type || policy.type;
  return {
    name: policy.name || '',
    type: policyType,
    action: rules.action || 'block',
    threshold: rules.threshold ?? 80,
    actionTypes: rules.action_types || [],
    maxActions: rules.max_actions || 50,
    windowMinutes: rules.window_minutes || 60,
    webhookUrl: rules.url || '',
    webhookTimeout: rules.timeout_ms || 5000,
    webhookOnTimeout: rules.on_timeout || 'allow',
    instruction: rules.instruction || '',
    fallback: rules.fallback || 'allow',
    agentIds: parseAgentIds(policy),
  };
}

/** Build rules JSON string from form state */
function buildRulesJson(form) {
  switch (form.type) {
    case 'risk_threshold':
      return JSON.stringify({ threshold: Number(form.threshold) || 0, action: form.action });
    case 'require_approval':
      return JSON.stringify({ action_types: form.actionTypes, action: 'require_approval' });
    case 'block_action_type':
      return JSON.stringify({ action_types: form.actionTypes, action: 'block' });
    case 'rate_limit':
      return JSON.stringify({ max_actions: form.maxActions, window_minutes: form.windowMinutes, action: form.action });
    case 'webhook_check':
      return JSON.stringify({ url: form.webhookUrl, timeout_ms: form.webhookTimeout, on_timeout: form.webhookOnTimeout });
    case 'semantic_check':
      return JSON.stringify({ instruction: form.instruction, fallback: form.fallback });
    default:
      return '{}';
  }
}

/** Shared form fields for create and edit */
function PolicyFormFields({ form, setForm }) {
  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleActionType = (type) => {
    setForm(prev => ({
      ...prev,
      actionTypes: prev.actionTypes.includes(type)
        ? prev.actionTypes.filter(t => t !== type)
        : [...prev.actionTypes, type],
    }));
  };

  return (
    <>
      {form.type === 'risk_threshold' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Risk Threshold (0-100)</label>
            <input
              type="number" min="0" max="100"
              value={form.threshold}
              onChange={(e) => updateField('threshold', e.target.value === '' ? '' : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Action</label>
            <select value={form.action} onChange={(e) => updateField('action', e.target.value)} className={selectClass}>
              {DECISION_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {(form.type === 'require_approval' || form.type === 'block_action_type') && (
        <div>
          <label className="block text-xs text-zinc-400 mb-2">Action Types</label>
          <div className="flex flex-wrap gap-2">
            {ACTION_OPTIONS.map(type => (
              <button
                key={type} type="button"
                onClick={() => toggleActionType(type)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                  form.actionTypes.includes(type)
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

      {form.type === 'rate_limit' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Max Actions</label>
            <input type="number" min="1" value={form.maxActions} onChange={(e) => updateField('maxActions', parseInt(e.target.value, 10) || 1)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Window (minutes)</label>
            <input type="number" min="1" value={form.windowMinutes} onChange={(e) => updateField('windowMinutes', parseInt(e.target.value, 10) || 1)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Action</label>
            <select value={form.action} onChange={(e) => updateField('action', e.target.value)} className={selectClass}>
              {DECISION_ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {form.type === 'webhook_check' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-3">
            <label className="block text-xs text-zinc-400 mb-1">Webhook URL (HTTPS required)</label>
            <input type="url" value={form.webhookUrl} onChange={(e) => updateField('webhookUrl', e.target.value)} placeholder="https://your-api.example.com/guard" required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Timeout (ms)</label>
            <input type="number" min="1000" max="10000" step="500" value={form.webhookTimeout} onChange={(e) => updateField('webhookTimeout', parseInt(e.target.value, 10) || 5000)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">On Timeout</label>
            <select value={form.webhookOnTimeout} onChange={(e) => updateField('webhookOnTimeout', e.target.value)} className={selectClass}>
              <option value="allow">Allow (fail-open)</option>
              <option value="block">Block (fail-closed)</option>
            </select>
          </div>
        </div>
      )}

      {form.type === 'semantic_check' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Instruction (Natural Language)</label>
            <textarea value={form.instruction} onChange={(e) => updateField('instruction', e.target.value)} placeholder="e.g. Do not allow the agent to delete files in the /system directory." required rows={3} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Fallback Action (if LLM is unavailable)</label>
            <select value={form.fallback} onChange={(e) => updateField('fallback', e.target.value)} className={selectClass}>
              <option value="allow">Allow (Fail Open - Recommended)</option>
              <option value="block">Block (Fail Closed)</option>
            </select>
            <p className="text-[10px] text-zinc-500 mt-1">
              To enable this, set <code className="text-zinc-400">GUARD_LLM_KEY</code> (or OPENAI_API_KEY) in your environment variables.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Agent scope picker — select which agents a policy applies to */
function PolicyAgentScope({ agentIds, setAgentIds, agents }) {
  const isAllAgents = agentIds.length === 0;

  const toggleAgent = (id) => {
    setAgentIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
        <Users size={12} />
        Agent Scope
      </label>
      <div className="flex items-center gap-3 mb-2">
        <button
          type="button"
          onClick={() => setAgentIds([])}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isAllAgents
              ? 'bg-brand text-white'
              : 'bg-[#1a1a1a] text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white'
          }`}
        >
          All Agents
        </button>
        <span className="text-[10px] text-zinc-600">or pick specific agents:</span>
      </div>
      {agents.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {agents.map(agent => (
            <button
              key={agent.agent_id}
              type="button"
              onClick={() => toggleAgent(agent.agent_id)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                agentIds.includes(agent.agent_id)
                  ? 'bg-brand text-white'
                  : 'bg-[#1a1a1a] text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white'
              }`}
            >
              {agent.agent_name || agent.agent_id}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-zinc-600">No agents discovered yet. Policies will apply to all agents by default.</p>
      )}
    </div>
  );
}

export default function PoliciesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin' || isDemoMode();
  const isDemo = isDemoMode();
  const canEdit = isAdmin;

  const [policies, setPolicies] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create form
  const [showAddForm, setShowAddForm] = useState(false);
  const [createForm, setCreateForm] = useState(createDefaultPolicyFormState);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Multi-select
  const [selectedPolicies, setSelectedPolicies] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Simulation
  const [simResults, setSimResults] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simDays, setSimDays] = useState(7);
  const [simContext, setSimContext] = useState(''); // 'create' or policy id

  // Import
  const [importPack, setImportPack] = useState('enterprise-strict');
  const [importYaml, setImportYaml] = useState('');
  const [importMode, setImportMode] = useState('pack');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showAdvancedImport, setShowAdvancedImport] = useState(false);

  // Template Gallery
  const [showGallery, setShowGallery] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [installPreview, setInstallPreview] = useState(null); // { packId, preview }
  const [installing, setInstalling] = useState(null); // packId being installed
  const [installResults, setInstallResults] = useState({}); // packId -> result

  // Test Runner
  const [testResults, setTestResults] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [expandedTests, setExpandedTests] = useState({});

  // Proof Report
  const [proofReport, setProofReport] = useState('');
  const [proofFormat, setProofFormat] = useState('markdown');
  const [generatingProof, setGeneratingProof] = useState(false);

  const handleBrowseTemplates = async () => {
    if (showGallery) { setShowGallery(false); return; }
    setShowGallery(true);
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/policies/templates');
      const json = await res.json();
      if (res.ok) setTemplates(json.templates || []);
      else setError(json.error || 'Failed to load templates');
    } catch {
      setError('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleInstallPreview = async (packId) => {
    setInstallPreview(null);
    try {
      const res = await fetch('/api/policies/import?preview=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const json = await res.json();
      if (res.ok) setInstallPreview({ packId, preview: json });
      else setError(json.error || 'Failed to preview pack');
    } catch {
      setError('Failed to preview pack');
    }
  };

  const handleInstallConfirm = async () => {
    if (!installPreview) return;
    const { packId } = installPreview;
    setInstalling(packId);
    setInstallPreview(null);
    try {
      const res = await fetch('/api/policies/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack: packId }),
      });
      const json = await res.json();
      if (res.ok) {
        setInstallResults(prev => ({ ...prev, [packId]: json }));
        fetchData();
      } else {
        setError(json.error || 'Install failed');
      }
    } catch {
      setError('Install failed');
    } finally {
      setInstalling(null);
    }
  };

  const handleSimulate = async (customRules = null, customType = null, context = 'create') => {
    setSimulating(true);
    setSimResults(null);
    setSimContext(context);

    let rules = customRules;
    let type = customType;

    if (!rules) {
      const payload = compilePolicyPayload(createForm);
      rules = JSON.parse(payload.rules);
      type = payload.policy_type;
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
      const [policiesRes, decisionsRes, agentsRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/guard?limit=20'),
        fetch('/api/agents'),
      ]);
      const policiesJson = await policiesRes.json();
      const decisionsJson = await decisionsRes.json();

      if (policiesRes.ok) setPolicies(policiesJson.policies || []);
      if (decisionsRes.ok) {
        setDecisions(decisionsJson.decisions || []);
        setStats(decisionsJson.stats || {});
      }
      if (agentsRes.ok) {
        const agentsJson = await agentsRes.json();
        setAgents(agentsJson.agents || []);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = compilePolicyPayload(createForm);
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to create policy');
      } else {
        setShowAddForm(false);
        setCreateForm(createDefaultPolicyFormState());
        fetchData();
      }
    } catch {
      setError('Failed to create policy');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (policy) => {
    setEditingId(policy.id);
    setEditForm(decompilePolicyForm(policy));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (policyId) => {
    setSaving(true);
    try {
      const payload = compilePolicyPayload(editForm);
      const res = await fetch('/api/policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: policyId,
          ...payload,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to update policy');
      } else {
        setEditingId(null);
        setEditForm({});
        fetchData();
      }
    } catch {
      setError('Failed to update policy');
    } finally {
      setSaving(false);
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
      if (res.ok) {
        setSelectedPolicies(prev => { const next = new Set(prev); next.delete(policyId); return next; });
        fetchData();
      }
    } catch { /* ignore */ }
  };

  const handleBulkDelete = async () => {
    if (selectedPolicies.size === 0) return;
    const msg = `Delete ${selectedPolicies.size} selected ${selectedPolicies.size === 1 ? 'policy' : 'policies'}? This cannot be undone.`;
    if (!confirm(msg)) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedPolicies).join(',');
      const res = await fetch(`/api/policies?ids=${ids}`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedPolicies(new Set());
        fetchData();
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to delete policies');
      }
    } catch {
      setError('Failed to delete policies');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectPolicy = (id) => {
    setSelectedPolicies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPolicies.size === policies.length) {
      setSelectedPolicies(new Set());
    } else {
      setSelectedPolicies(new Set(policies.map(p => p.id)));
    }
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
        const r = json.results || {};
        setTestResults({
          totalPolicies: r.total_policies || 0,
          totalTests: r.total_tests || 0,
          passed: r.passed || 0,
          failed: r.failed || 0,
          success: r.success,
          results: (r.details || []).map(d => ({
            policyId: d.policy_id,
            policyName: d.policy_name,
            failCount: d.tests?.filter(t => !t.passed).length || 0,
            tests: d.tests || [],
          })),
        });
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
    try { await navigator.clipboard.writeText(proofReport); } catch { /* ignore */ }
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
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium text-white">Guard Policies</h2>
            {selectedPolicies.size > 0 && canEdit && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 size={12} />
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedPolicies.size} selected`}
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBrowseTemplates}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-zinc-300 text-xs font-medium hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                <BookOpen size={14} />
                {showGallery ? 'Hide Templates' : 'Browse Templates'}
              </button>
              <a
                href="/policies/generate"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.08)] text-zinc-300 text-xs font-medium hover:bg-[rgba(255,255,255,0.08)] transition-colors"
              >
                <Sparkles size={14} />
                Generate with AI
              </a>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
              >
                {showAddForm ? <ChevronDown size={14} /> : <Plus size={14} />}
                {showAddForm ? 'Cancel' : 'Add Policy'}
              </button>
              <button
                onClick={() => setShowAdvancedImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium border border-[rgba(255,255,255,0.08)] hover:bg-zinc-700 transition-colors"
              >
                <Upload size={14} />
                Advanced import
              </button>
            </div>
          )}
        </div>

        {/* Add form */}
        {showAddForm && canEdit && (
          <form onSubmit={handleCreate} className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] space-y-4 bg-[rgba(255,255,255,0.02)]">
            <PolicyAuthoringPanel
              form={createForm}
              policyTypes={POLICY_TYPES}
              actionOptions={ACTION_OPTIONS}
              agents={agents}
              summary={buildPolicySummary(createForm)}
              onChange={setCreateForm}
            />

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={creating || isAuthoringFormInvalid(createForm)}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Policy'}
              </button>
              <button
                type="button"
                onClick={() => handleSimulate(null, null, 'create')}
                disabled={simulating || isAuthoringFormInvalid(createForm)}
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
                  className="bg-[#111] border border-[rgba(255,255,255,0.1)] rounded px-1 py-0.5 focus:outline-none text-white"
                >
                  <option value="1">1 day</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>
            </div>
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
              {/* Select all row */}
              {canEdit && policies.length > 1 && (
                <div className="py-2 flex items-center gap-2">
                  <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-white transition-colors p-0.5">
                    {selectedPolicies.size === policies.length
                      ? <CheckSquare size={16} className="text-brand" />
                      : <Square size={16} />}
                  </button>
                  <span className="text-xs text-zinc-500">
                    {selectedPolicies.size === policies.length ? 'Deselect all' : 'Select all'}
                  </span>
                </div>
              )}

              {policies.map(policy => {
                const isEditing = editingId === policy.id;

                return (
                  <div key={policy.id} className="py-3">
                    {isEditing ? (
                      /* ===== EDIT MODE ===== */
                      <div className="space-y-4 p-3 bg-[rgba(255,255,255,0.02)] rounded-lg border border-brand/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-brand font-medium uppercase tracking-wider">Editing Policy</span>
                          <button onClick={handleCancelEdit} className="text-zinc-500 hover:text-white transition-colors">
                            <X size={16} />
                          </button>
                        </div>
                        <PolicyAuthoringPanel
                          form={editForm}
                          policyTypes={POLICY_TYPES}
                          actionOptions={ACTION_OPTIONS}
                          agents={agents}
                          summary={buildPolicySummary(editForm)}
                          onChange={setEditForm}
                          typeLocked
                        />
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSaveEdit(policy.id)}
                            disabled={saving || isAuthoringFormInvalid(editForm)}
                            className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ===== DISPLAY MODE ===== */
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          {canEdit && (
                            <button
                              onClick={() => toggleSelectPolicy(policy.id)}
                              className="text-zinc-500 hover:text-white transition-colors mt-0.5 p-0.5 flex-shrink-0"
                            >
                              {selectedPolicies.has(policy.id)
                                ? <CheckSquare size={16} className="text-brand" />
                                : <Square size={16} />}
                            </button>
                          )}
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
                            <p className="text-xs text-zinc-400">{formatPolicySummary(policy)}</p>
                            {parseAgentIds(policy).length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Users size={10} className="text-zinc-500" />
                                <span className="text-[10px] text-zinc-500">
                                  {parseAgentIds(policy).map(id => {
                                    const agent = agents.find(a => a.agent_id === id);
                                    return agent?.agent_name || id;
                                  }).join(', ')}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-zinc-600 mt-0.5 font-mono">{policy.id}</p>
                          </div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                const rules = JSON.parse(policy.rules || policy.config || '{}');
                                handleSimulate(rules, policy.policy_type || policy.type, policy.id);
                              }}
                              className="text-zinc-500 hover:text-brand transition-colors p-1"
                              title="Simulate historical impact"
                              disabled={simulating}
                            >
                              <Play size={14} />
                            </button>
                            <button
                              onClick={() => handleStartEdit(policy)}
                              className="text-zinc-500 hover:text-brand transition-colors p-1"
                              title="Edit"
                              aria-label={`Edit ${policy.name}`}
                            >
                              <Pencil size={14} />
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Gallery */}
      {showGallery && canEdit && (
        <Card className="mb-6">
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <BookOpen size={14} className="text-zinc-400" />
              Policy Template Gallery
            </h2>
            <button onClick={() => setShowGallery(false)} className="text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <CardContent>
            {templatesLoading ? (
              <div className="text-sm text-zinc-500 py-8 text-center">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="text-sm text-zinc-500 py-8 text-center">No templates available.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map(pack => {
                  const isExpanded = expandedTemplate === pack.id;
                  const result = installResults[pack.id];
                  const alreadyInstalled = result ? result.imported === 0 && result.skipped > 0 : false;
                  const isInstalling = installing === pack.id;

                  return (
                    <div
                      key={pack.id}
                      className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
                    >
                      {/* Card header — click to expand */}
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                        onClick={() => setExpandedTemplate(isExpanded ? null : pack.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-white">{pack.name}</span>
                            <Badge variant="info">{pack.policy_count} {pack.policy_count === 1 ? 'policy' : 'policies'}</Badge>
                            {alreadyInstalled && <Badge variant="success">Installed</Badge>}
                          </div>
                          <p className="text-xs text-zinc-400 mb-1">{pack.description}</p>
                          {pack.recommended_for && (
                            <p className="text-[10px] text-zinc-600">For: {pack.recommended_for}</p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <ChevronRight size={14} className="text-zinc-500 flex-shrink-0 mt-0.5" />
                        )}
                      </button>

                      {/* Expanded policy list */}
                      {isExpanded && (
                        <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-3 space-y-2">
                          {(pack.policies || []).map((p, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <Badge
                                variant={p.policy_type === 'require_approval' ? 'warning' : p.policy_type === 'block_action_type' ? 'error' : 'info'}
                                size="xs"
                              >
                                {p.policy_type === 'require_approval' ? 'approval' : p.policy_type === 'block_action_type' ? 'block' : p.policy_type?.replace(/_/g, ' ') || 'policy'}
                              </Badge>
                              <span className="text-zinc-300 leading-relaxed">{p.name}</span>
                            </div>
                          ))}

                          {/* Install button */}
                          <div className="pt-2">
                            {result ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {result.imported > 0 && <Badge variant="success">{result.imported} imported</Badge>}
                                {result.skipped > 0 && <Badge variant="warning">{result.skipped} skipped</Badge>}
                                {result.errors?.length > 0 && <Badge variant="error">{result.errors.length} errors</Badge>}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleInstallPreview(pack.id)}
                                disabled={isInstalling}
                                className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isInstalling ? 'Installing...' : 'Install Pack'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Install Preview Modal */}
      {installPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-[#161616] border border-[rgba(255,255,255,0.1)] shadow-2xl">
            <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Review Installation</h3>
              <button onClick={() => setInstallPreview(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="success">{installPreview.preview.would_create} will be created</Badge>
                {installPreview.preview.would_skip > 0 && (
                  <Badge variant="warning">{installPreview.preview.would_skip} already exist, will skip</Badge>
                )}
              </div>
              {installPreview.preview.policies?.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {installPreview.preview.policies.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {p.conflict ? (
                        <Badge variant="muted" size="xs">skip</Badge>
                      ) : (
                        <Badge variant="success" size="xs">new</Badge>
                      )}
                      <span className={p.conflict ? 'text-zinc-500 line-through' : 'text-zinc-300'}>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.06)] flex items-center gap-3">
              <button
                onClick={handleInstallConfirm}
                disabled={installPreview.preview.would_create === 0}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {installPreview.preview.would_create === 0 ? 'Nothing to install' : 'Confirm Install'}
              </button>
              <button
                onClick={() => setInstallPreview(null)}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation Results — shown outside the add form so both create and per-policy simulate work */}
      {simResults && (
        <Card className="mb-6">
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
              <Shield size={16} />
              Simulation Results
              {simContext !== 'create' && (
                <span className="text-xs text-zinc-500 font-normal ml-2">
                  for {policies.find(p => p.id === simContext)?.name || simContext}
                </span>
              )}
            </h3>
            <button onClick={() => setSimResults(null)} className="text-zinc-400 hover:text-white text-xs">&times; Close</button>
          </div>
          <CardContent>
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

            {simResults.matches.length > 0 ? (
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
            ) : (
              <p className="text-center text-xs text-zinc-500 py-2">No historical matches found. This policy would not have triggered any actions.</p>
            )}
          </CardContent>
        </Card>
      )}

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
                  {testResults.totalPolicies} policies, {testResults.totalTests} tests
                </span>
                <Badge variant={testResults.failed === 0 ? 'success' : 'error'}>
                  {testResults.totalPolicies === 0 ? 'No policies to test' : testResults.failed === 0 ? 'ALL PASS' : `${testResults.failed} FAILURES`}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {testResults.passed} passed, {testResults.failed} failed
                </span>
              </div>

              {/* Per-policy details */}
              {testResults.results && testResults.results.length > 0 && (
                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {testResults.results.map((pr, i) => {
                    const pId = pr.policyId || `test-${i}`;
                    const pName = pr.policyName || pId;
                    const fCount = pr.failCount ?? 0;

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
                                {!t.passed && t.reason && (
                                  <span className="text-zinc-600 ml-1">({t.reason})</span>
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

      {canEdit && (
        <PolicyAdvancedImportPanel
          open={showAdvancedImport}
          onClose={() => setShowAdvancedImport(false)}
          importMode={importMode}
          setImportMode={setImportMode}
          importPack={importPack}
          setImportPack={setImportPack}
          importYaml={importYaml}
          setImportYaml={setImportYaml}
          importing={importing}
          importResult={importResult}
          handleImport={handleImport}
          packPreviews={PACK_PREVIEWS}
        />
      )}
    </PageLayout>
  );
}
