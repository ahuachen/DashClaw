'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Wrench } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const SOURCE_TYPES = ['internal_sdk', 'http_api', 'webhook', 'human_approval', 'external_marketplace'];

export default function NewCapabilityPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    source_type: 'internal_sdk',
    auth_type: 'none',
    risk_level: 'medium',
    requires_approval: false,
    tags: '',
    docs_url: '',
    health_status: 'unknown',
  });

  const update = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category: form.category.trim() || undefined,
          source_type: form.source_type,
          auth_type: form.auth_type.trim() || 'none',
          risk_level: form.risk_level,
          requires_approval: form.requires_approval,
          tags: tags.length > 0 ? tags : undefined,
          docs_url: form.docs_url.trim() || undefined,
          health_status: form.health_status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register capability');
      }
      const { capability } = await res.json();
      router.push(`/capabilities`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="Register Capability"
      subtitle="Add a callable capability to the governed registry"
      breadcrumbs={['Studio', 'Capabilities', 'New']}
      actions={
        <Link href="/capabilities" className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <Card>
          <CardHeader title="Capability Details" icon={Wrench} />
          <CardContent className="p-5 pt-0 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Name <span className="text-red-400">*</span></label>
              <input type="text" value={form.name} onChange={update('name')} required
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Send Slack Message" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={form.description} onChange={update('description')} rows={2}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Posts to a configured Slack channel" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Category</label>
                <input type="text" value={form.category} onChange={update('category')}
                  className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                  placeholder="messaging" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Auth type</label>
                <input type="text" value={form.auth_type} onChange={update('auth_type')}
                  className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                  placeholder="oauth, api_key, none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Source type</label>
                <select value={form.source_type} onChange={update('source_type')}
                  className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand">
                  {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Risk level</label>
                <select value={form.risk_level} onChange={update('risk_level')}
                  className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand">
                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Health status</label>
                <select value={form.health_status} onChange={update('health_status')}
                  className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand">
                  <option value="unknown">unknown</option>
                  <option value="healthy">healthy</option>
                  <option value="degraded">degraded</option>
                  <option value="unhealthy">unhealthy</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" checked={form.requires_approval} onChange={update('requires_approval')}
                    className="rounded border-white/20 bg-surface-tertiary" />
                  Requires approval
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Tags <span className="text-zinc-600">(comma-separated)</span></label>
              <input type="text" value={form.tags} onChange={update('tags')}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="notify, slack, messaging" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Docs URL</label>
              <input type="url" value={form.docs_url} onChange={update('docs_url')}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="https://docs.example.com/slack" />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} /> {saving ? 'Registering...' : 'Register Capability'}
          </button>
          <Link href="/capabilities" className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</Link>
        </div>
      </form>
    </PageLayout>
  );
}
