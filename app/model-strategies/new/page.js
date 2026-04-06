'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Cpu } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

const DEFAULT_CONFIG = {
  primary: { provider: 'openai', model: 'gpt-4.1' },
  fallback: [{ provider: 'anthropic', model: 'claude-sonnet-4' }],
  costSensitivity: 'balanced',
  latencySensitivity: 'medium',
  maxBudgetUsd: 0.5,
  maxRetries: 2,
  allowedProviders: [],
  disallowedProviders: [],
};

export default function NewModelStrategyPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [configText, setConfigText] = useState(JSON.stringify(DEFAULT_CONFIG, null, 2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    let config;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('Config must be valid JSON');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/model-strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create strategy');
      }
      const { strategy } = await res.json();
      router.push(`/model-strategies/${strategy.strategy_id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="New Model Strategy"
      subtitle="Define provider, fallback chain, budget cap, and task-mode overrides"
      breadcrumbs={['Studio', 'Model Strategies', 'New']}
      actions={
        <Link href="/model-strategies" className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-4">
        <Card>
          <CardHeader title="Metadata" icon={Cpu} />
          <CardContent className="p-5 pt-0 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Balanced default" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="GPT-4.1 primary, Claude Sonnet 4 fallback" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Config (JSON)" icon={Cpu} />
          <CardContent className="p-5 pt-0">
            <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} rows={18} spellCheck={false}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-brand" />
            <div className="text-[10px] text-zinc-500 mt-2">
              Required: <code className="text-zinc-400">primary.provider</code>, <code className="text-zinc-400">primary.model</code>.
              Optional: <code className="text-zinc-400">fallback</code>, <code className="text-zinc-400">taskModes</code>,{' '}
              <code className="text-zinc-400">costSensitivity</code> (low|balanced|high-quality),{' '}
              <code className="text-zinc-400">latencySensitivity</code> (low|medium|high),{' '}
              <code className="text-zinc-400">maxBudgetUsd</code>, <code className="text-zinc-400">maxRetries</code>.
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">{error}</div>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50">
            <Save size={14} /> {saving ? 'Creating...' : 'Create Strategy'}
          </button>
          <Link href="/model-strategies" className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</Link>
        </div>
      </form>
    </PageLayout>
  );
}
