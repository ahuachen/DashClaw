'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Trash2, Cpu } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

export default function ModelStrategyDetailPage() {
  const router = useRouter();
  const { strategyId } = useParams();
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [configText, setConfigText] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchStrategy = useCallback(async () => {
    try {
      const res = await fetch(`/api/model-strategies/${strategyId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Strategy not found'); return; }
        throw new Error('Failed to fetch');
      }
      const { strategy: s } = await res.json();
      setStrategy(s);
      setName(s.name);
      setDescription(s.description || '');
      setConfigText(JSON.stringify(s.config, null, 2));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    if (strategyId) fetchStrategy();
  }, [strategyId, fetchStrategy]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      let config;
      try {
        config = JSON.parse(configText);
      } catch {
        throw new Error('config must be valid JSON');
      }
      const res = await fetch(`/api/model-strategies/${strategyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Save failed');
      }
      await fetchStrategy();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this model strategy? Linked workflow templates will have their reference cleared.')) return;
    try {
      const res = await fetch(`/api/model-strategies/${strategyId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/model-strategies');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <PageLayout title="Loading..." breadcrumbs={['Studio', 'Model Strategies']}>
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      </PageLayout>
    );
  }

  if (error && !strategy) {
    return (
      <PageLayout title="Strategy Not Found" breadcrumbs={['Studio', 'Model Strategies', strategyId]}>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-medium text-white mb-2">{error}</div>
            <div className="text-sm text-zinc-500">{strategyId}</div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={strategy.name}
      subtitle="Model strategy configuration"
      breadcrumbs={['Studio', 'Model Strategies', strategy.name]}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/model-strategies"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Metadata" icon={Cpu} />
          <CardContent className="p-5 pt-0 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
              />
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Strategy ID</div>
              <div className="text-xs font-mono text-zinc-300">{strategy.strategy_id}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Config (JSON)" icon={Cpu} />
          <CardContent className="p-5 pt-0">
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={20}
              className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-brand"
              spellCheck={false}
            />
            <div className="text-[10px] text-zinc-500 mt-2">
              Required: <code className="text-zinc-400">primary.provider</code>, <code className="text-zinc-400">primary.model</code>.
              Optional: <code className="text-zinc-400">fallback</code>, <code className="text-zinc-400">taskModes</code>,{' '}
              <code className="text-zinc-400">costSensitivity</code>, <code className="text-zinc-400">latencySensitivity</code>,{' '}
              <code className="text-zinc-400">maxBudgetUsd</code>, <code className="text-zinc-400">maxRetries</code>.
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
