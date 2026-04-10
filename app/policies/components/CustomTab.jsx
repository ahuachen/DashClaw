'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Upload, Sparkles, Trash2, Play, Copy, Check, Pencil,
  ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import PolicyAuthoringPanel from './PolicyAuthoringPanel';
import PolicyAdvancedImportPanel from './PolicyAdvancedImportPanel';
import {
  createDefaultPolicyFormState,
  compilePolicyPayload,
  decompilePolicyForm,
  buildPolicySummary,
} from '../lib/policyFormModel';
import { PACK_PREVIEWS } from '../../lib/policyPackPreviews.js';

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

function formatRules(policy) {
  const type = policy.policy_type;
  let rules;
  try { rules = JSON.parse(policy.rules || '{}'); } catch { return type; }
  switch (type) {
    case 'risk_threshold': return `Risk >= ${rules.threshold} \u2192 ${rules.action || 'block'}`;
    case 'require_approval': return `${(rules.action_types || []).join(', ')} \u2192 require approval`;
    case 'block_action_type': return `${(rules.action_types || []).join(', ')} \u2192 block`;
    case 'rate_limit': return `Max ${rules.max_actions} / ${rules.window_minutes}min \u2192 ${rules.action || 'warn'}`;
    case 'webhook_check': { try { return `Webhook \u2192 ${new URL(rules.url).hostname}`; } catch { return 'Webhook'; } }
    case 'semantic_check': return `Semantic: "${(rules.instruction || '').slice(0, 50)}..."`;
    default: return type;
  }
}

function parseAgentIds(policy) {
  if (!policy.agent_ids) return [];
  try { const p = JSON.parse(policy.agent_ids); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function CustomTab() {
  const [policies, setPolicies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // Authoring form state
  const [showAuthoring, setShowAuthoring] = useState(false);
  const [authoringForm, setAuthoringForm] = useState(createDefaultPolicyFormState());
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [authoringError, setAuthoringError] = useState(null);

  // Import panel state
  const [showImport, setShowImport] = useState(false);
  const [importMode, setImportMode] = useState('pack');
  const [importPack, setImportPack] = useState('enterprise-strict');
  const [importYaml, setImportYaml] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Row actions
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const [policiesRes, agentsRes] = await Promise.all([
        fetch('/api/policies'),
        fetch('/api/agents'),
      ]);
      if (policiesRes.ok) {
        const data = await policiesRes.json();
        setPolicies(data.policies || []);
      }
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const filtered = policies.filter(p => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && p.policy_type !== filterType) return false;
    if (filterActive === 'active' && p.active !== 1) return false;
    if (filterActive === 'inactive' && p.active !== 0) return false;
    return true;
  });

  // Authoring actions
  const openCreate = () => {
    setEditingId(null);
    setAuthoringForm(createDefaultPolicyFormState());
    setAuthoringError(null);
    setShowAuthoring(true);
    setShowImport(false);
  };

  const openEdit = (policy) => {
    setEditingId(policy.id);
    setAuthoringForm(decompilePolicyForm(policy));
    setAuthoringError(null);
    setShowAuthoring(true);
    setShowImport(false);
  };

  const closeAuthoring = () => {
    setShowAuthoring(false);
    setEditingId(null);
    setAuthoringForm(createDefaultPolicyFormState());
    setAuthoringError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setAuthoringError(null);
    try {
      const payload = compilePolicyPayload(authoringForm);
      const isEdit = Boolean(editingId);
      const res = await fetch('/api/policies', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { id: editingId, ...payload } : payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthoringError(json.error || 'Failed to save policy');
      } else {
        closeAuthoring();
        await fetchPolicies();
      }
    } catch {
      setAuthoringError('Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  // Import actions
  const openImport = () => {
    setImportResult(null);
    setShowImport(true);
    setShowAuthoring(false);
  };

  const closeImport = () => {
    setShowImport(false);
    setImportResult(null);
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
        await fetchPolicies();
      } else {
        setImportResult({ error: json.error || 'Import failed' });
      }
    } catch {
      setImportResult({ error: 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  // Row actions
  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await fetch(`/api/policies?id=${id}`, { method: 'DELETE' });
      await fetchPolicies();
    } catch { /* ignore */ } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const handleToggleActive = async (policy) => {
    await fetch('/api/policies', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: policy.id, active: policy.active === 1 ? 0 : 1 }),
    });
    await fetchPolicies();
  };

  const handleExport = async (policy) => {
    const json = JSON.stringify(
      { name: policy.name, policy_type: policy.policy_type, rules: policy.rules, agent_ids: policy.agent_ids },
      null,
      2,
    );
    await navigator.clipboard.writeText(json);
    setCopiedId(policy.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleSimulate = async (policy) => {
    let rules;
    try { rules = JSON.parse(policy.rules); } catch { return; }
    const res = await fetch('/api/policies/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy_type: policy.policy_type, rules, days: 7 }),
    });
    if (res.ok) {
      const data = await res.json();
      const s = data.summary || {};
      alert(`Simulation (7d): ${s.matches || 0} matches \u2014 ${s.block || 0} blocks, ${s.warn || 0} warns, ${s.require_approval || 0} approvals`);
    }
  };

  const summary = buildPolicySummary(authoringForm);
  const isFormInvalid = !authoringForm.name?.trim();

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs text-brand hover:border-brand/60 transition-colors"
        >
          <Plus size={12} /> New Policy
        </button>
        <button
          onClick={openImport}
          className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
        >
          <Upload size={12} /> Import
        </button>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
        >
          <Sparkles size={12} /> AI Generator
        </button>
      </div>

      {/* Authoring panel — inline controlled form */}
      {showAuthoring && (
        <div className="rounded-2xl border border-brand/20 bg-[#0d0d0d] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">
              {editingId ? 'Edit Policy' : 'New Policy'}
            </div>
            <button onClick={closeAuthoring} className="text-zinc-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          <PolicyAuthoringPanel
            form={authoringForm}
            policyTypes={POLICY_TYPES}
            actionOptions={ACTION_OPTIONS}
            agents={agents}
            summary={summary}
            onChange={setAuthoringForm}
          />

          {authoringError && (
            <div className="text-xs text-red-400">{authoringError}</div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || isFormInvalid}
              className="rounded-lg bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Policy'}
            </button>
            <button
              onClick={closeAuthoring}
              className="rounded-lg border border-white/5 px-4 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import panel */}
      <PolicyAdvancedImportPanel
        open={showImport}
        onClose={closeImport}
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

      {/* Search + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Search policies..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-white/5 bg-surface-tertiary px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50"
        />
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50"
        >
          <option value="">All types</option>
          <option value="risk_threshold">Risk Threshold</option>
          <option value="require_approval">Require Approval</option>
          <option value="block_action_type">Block Action Type</option>
          <option value="rate_limit">Rate Limit</option>
          <option value="webhook_check">Webhook Check</option>
          <option value="semantic_check">Semantic Check</option>
        </select>
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-brand/50"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Policy list */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Plus}
              title="No policies"
              description="Create your first policy or import a template pack."
            />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map(p => {
              const agentCount = parseAgentIds(p).length;
              return (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{p.name}</span>
                      <Badge size="xs">{p.policy_type}</Badge>
                      <Badge variant={p.active === 1 ? 'success' : 'default'} size="xs">
                        {p.active === 1 ? 'active' : 'inactive'}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500 truncate">
                      {formatRules(p)} &middot; {agentCount === 0 ? 'All agents' : `${agentCount} agents`} &middot; {p.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className="text-zinc-500 hover:text-white"
                      title={p.active === 1 ? 'Deactivate' : 'Activate'}
                    >
                      {p.active === 1
                        ? <ToggleRight size={16} className="text-brand" />
                        : <ToggleLeft size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="text-zinc-500 hover:text-white"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleSimulate(p)}
                      className="text-zinc-500 hover:text-white"
                      title="Simulate"
                    >
                      <Play size={13} />
                    </button>
                    <button
                      onClick={() => handleExport(p)}
                      className="text-zinc-500 hover:text-white"
                      title="Export JSON"
                    >
                      {copiedId === p.id
                        ? <Check size={13} className="text-emerald-400" />
                        : <Copy size={13} />}
                    </button>
                    {confirmDeleteId === p.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {deleting ? '...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-zinc-400 hover:text-white"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="text-zinc-500 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
