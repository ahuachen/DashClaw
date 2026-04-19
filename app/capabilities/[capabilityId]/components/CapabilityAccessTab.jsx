'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Trash2 } from 'lucide-react';

const ACCESS_PILL = {
  allow: { label: 'Allow', color: 'bg-emerald-400/10 text-success border-success/20' },
  deny: { label: 'Deny', color: 'bg-red-400/10 text-error border-error/20' },
  require_approval: { label: 'Require Approval', color: 'bg-amber-400/10 text-warning border-warning/20' },
};

export default function CapabilityAccessTab({ capabilityId }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formAgentId, setFormAgentId] = useState('');
  const [formAccess, setFormAccess] = useState('deny');
  const [formReason, setFormReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function loadRules() {
    try {
      const res = await fetch(`/api/capabilities/${capabilityId}/access`);
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules || []);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRules(); }, [capabilityId]);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/capabilities/${capabilityId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: formAgentId.trim() || undefined,
          access: formAccess,
          reason: formReason.trim() || undefined,
        }),
      });
      if (res.ok) {
        setFormAgentId('');
        setFormAccess('deny');
        setFormReason('');
        setShowForm(false);
        await loadRules();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create rule');
      }
    } catch {
      setError('Failed to create rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId) {
    try {
      const res = await fetch(`/api/capabilities/${capabilityId}/access/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.rule_id !== ruleId));
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return <div className="text-sm text-tertiary py-4">Loading access rules...</div>;
  }

  const inputClass = 'w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-tertiary">
          {rules.length === 0 ? 'No access rules — all agents can invoke this capability.' : `${rules.length} rule${rules.length !== 1 ? 's' : ''} configured`}
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Rule
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">Agent ID (leave blank for org-wide default)</label>
            <input
              type="text"
              value={formAgentId}
              onChange={(e) => setFormAgentId(e.target.value)}
              placeholder="e.g. deploy-bot"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">Access Level</label>
            <select
              value={formAccess}
              onChange={(e) => setFormAccess(e.target.value)}
              className={inputClass}
            >
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
              <option value="require_approval">Require Approval</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">Reason (optional)</label>
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="e.g. Production API — restricted access"
              className={inputClass}
            />
          </div>
          {error && <div className="text-xs text-error">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule) => {
            const pill = ACCESS_PILL[rule.access] || ACCESS_PILL.deny;
            return (
              <div key={rule.rule_id} className="flex items-center gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] px-4 py-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${pill.color}`}>
                  {pill.label}
                </span>
                <span className="text-sm text-secondary flex-1">
                  {rule.agent_id || <span className="text-tertiary italic">All agents (default)</span>}
                </span>
                {rule.reason && <span className="text-xs text-tertiary truncate max-w-[200px]">{rule.reason}</span>}
                <button
                  onClick={() => handleDelete(rule.rule_id)}
                  className="text-disabled hover:text-error transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
