'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Rocket, Copy, FileText, ShieldCheck, BookOpen, Wrench, Cpu, ExternalLink,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

// Dynamic import avoids SSR for React Flow (canvas-heavy, browser-only)
const WorkflowEditor = dynamic(() => import('../../components/WorkflowEditor'), { ssr: false });

const statusVariant = {
  draft: 'default',
  active: 'success',
  archived: 'info',
};

export default function WorkflowTemplateDetailPage() {
  const router = useRouter();
  const { templateId } = useParams();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState(null);
  const [duplicating, setDuplicating] = useState(false);
  const [stepsView, setStepsView] = useState('visual'); // 'visual' | 'source'
  const [pendingSteps, setPendingSteps] = useState(null);
  const [savingSteps, setSavingSteps] = useState(false);
  const [linkedResources, setLinkedResources] = useState({
    strategy: null,
    knowledge: [],
    capabilities: [],
  });

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Template not found'); return; }
        throw new Error('Failed to fetch template');
      }
      const { template: t } = await res.json();
      setTemplate(t);

      // Hydrate linked resources (best-effort, don't block on failures)
      const hydrated = { strategy: null, knowledge: [], capabilities: [] };
      try {
        const fetches = [];
        if (t.model_strategy_id) {
          fetches.push(
            fetch(`/api/model-strategies/${t.model_strategy_id}`)
              .then((r) => r.ok ? r.json() : null)
              .then((d) => { if (d?.strategy) hydrated.strategy = d.strategy; })
              .catch(() => {})
          );
        }
        if (t.linked_knowledge_collection_ids?.length) {
          for (const id of t.linked_knowledge_collection_ids) {
            fetches.push(
              fetch(`/api/knowledge/collections/${id}`)
                .then((r) => r.ok ? r.json() : null)
                .then((d) => { if (d?.collection) hydrated.knowledge.push(d.collection); })
                .catch(() => {})
            );
          }
        }
        if (t.linked_capability_ids?.length) {
          for (const id of t.linked_capability_ids) {
            fetches.push(
              fetch(`/api/capabilities/${id}`)
                .then((r) => r.ok ? r.json() : null)
                .then((d) => { if (d?.capability) hydrated.capabilities.push(d.capability); })
                .catch(() => {})
            );
          }
        }
        await Promise.all(fetches);
      } catch { /* hydration is best-effort */ }
      setLinkedResources(hydrated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (templateId) fetchTemplate();
  }, [templateId, fetchTemplate]);

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Launch failed');
      }
      const { launch } = await res.json();
      setLaunchResult(launch);
      fetchTemplate();
    } catch (err) {
      setLaunchResult({ error: err.message });
    } finally {
      setLaunching(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const { template: dup } = await res.json();
        router.push(`/workflows/${dup.template_id}`);
        return;
      }
    } catch { /* noop */ }
    setDuplicating(false);
  };

  if (loading) {
    return (
      <PageLayout title="Loading..." breadcrumbs={['Studio', 'Workflows']}>
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      </PageLayout>
    );
  }

  if (error || !template) {
    return (
      <PageLayout title="Template Not Found" breadcrumbs={['Studio', 'Workflows', templateId]}>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-medium text-white mb-2">{error || 'Template not found'}</div>
            <div className="text-sm text-zinc-500">{templateId}</div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={template.name}
      subtitle={template.description || 'Workflow template'}
      breadcrumbs={['Studio', 'Workflows', template.slug]}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/workflows"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <Copy size={14} /> {duplicating ? 'Duplicating...' : 'Duplicate'}
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
          >
            <Rocket size={14} /> {launching ? 'Launching...' : 'Launch'}
          </button>
        </div>
      }
    >
      {/* Metadata row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">v{template.version}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Version</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <Badge variant={statusVariant[template.status] || 'default'} size="sm">{template.status}</Badge>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-2">Status</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">{template.steps?.length || 0}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Steps</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-xs font-mono text-zinc-300 truncate">{template.slug}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Slug</div>
          </CardContent>
        </Card>
      </div>

      {/* Launch result banner */}
      {launchResult && !launchResult.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center justify-between">
            <div className="text-sm text-emerald-300">
              Launched as action <span className="font-mono">{launchResult.action_id}</span>
              {launchResult.resolved_strategy && ' · strategy snapshotted'}
            </div>
            <Link
              href={`/decisions/${launchResult.action_id}`}
              className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200"
            >
              <ExternalLink size={12} /> View replay
            </Link>
          </div>
        </div>
      )}
      {launchResult?.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          Launch failed: {launchResult.error}
        </div>
      )}

      {/* Workflow Steps Editor */}
      <Card className="mb-4">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-200 uppercase tracking-wider">Steps</span>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setStepsView('visual')}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${stepsView === 'visual' ? 'bg-brand text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                Visual
              </button>
              <button
                onClick={() => setStepsView('source')}
                className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${stepsView === 'source' ? 'bg-brand text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                Source
              </button>
            </div>
          </div>
          {pendingSteps && (
            <button
              onClick={async () => {
                setSavingSteps(true);
                try {
                  const res = await fetch(`/api/workflows/templates/${templateId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ steps: pendingSteps }),
                  });
                  if (res.ok) {
                    setPendingSteps(null);
                    fetchTemplate();
                  }
                } catch { /* noop */ }
                setSavingSteps(false);
              }}
              disabled={savingSteps}
              className="px-3 py-1.5 text-xs text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {savingSteps ? 'Saving...' : 'Save Steps'}
            </button>
          )}
        </div>
        <CardContent className="p-5 pt-0">
          {stepsView === 'visual' ? (
            <div className="relative">
              <WorkflowEditor
                steps={template.steps}
                onChange={(newSteps) => setPendingSteps(newSteps)}
              />
            </div>
          ) : (
            <pre className="text-xs text-zinc-300 bg-black/40 rounded-lg p-3 overflow-auto max-h-[420px] font-mono">
              {JSON.stringify(pendingSteps || template.steps, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Objective + linked resources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Objective" icon={FileText} />
          <CardContent className="p-5 pt-0">
            <div className="text-sm text-zinc-300 whitespace-pre-wrap">
              {template.objective || <span className="text-zinc-500">No objective defined.</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Linked Resources" icon={ShieldCheck} />
          <CardContent className="p-5 pt-0 space-y-3">
            {/* Model strategy — hydrated */}
            <LinkedRow icon={Cpu} label="Model strategy"
              value={linkedResources.strategy
                ? `${linkedResources.strategy.name} (${linkedResources.strategy.config?.primary?.provider || '?'}/${linkedResources.strategy.config?.primary?.model || '?'})`
                : template.model_strategy_id}
              href={template.model_strategy_id ? `/model-strategies/${template.model_strategy_id}` : null}
            />
            <LinkedRow icon={ShieldCheck} label="Policies" value={template.linked_policy_ids} />
            {/* Knowledge — hydrated */}
            <LinkedRow icon={BookOpen} label="Knowledge"
              value={linkedResources.knowledge.length > 0
                ? linkedResources.knowledge.map((k) => `${k.name} (${k.doc_count} items)`)
                : template.linked_knowledge_collection_ids}
            />
            {/* Capabilities — hydrated */}
            <LinkedRow icon={Wrench} label="Capabilities"
              value={linkedResources.capabilities.length > 0
                ? linkedResources.capabilities.map((c) => `${c.name} [${c.risk_level}]`)
                : template.linked_capability_ids}
            />
            <LinkedRow icon={FileText} label="Prompts" value={template.linked_prompt_template_ids} />
            <LinkedRow icon={Wrench} label="Capability tags" value={template.linked_capability_tags} />
          </CardContent>
        </Card>
      </div>

      {/* Strategy snapshot */}
      {template.model_strategy_snapshot && (
        <Card className="mt-4">
          <CardHeader title="Last launched strategy snapshot" icon={Cpu} />
          <CardContent className="p-5 pt-0">
            <pre className="text-xs text-zinc-300 bg-black/40 rounded-lg p-3 overflow-auto max-h-[320px]">
              {JSON.stringify(template.model_strategy_snapshot, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}

function LinkedRow({ icon: Icon, label, value, href }) {
  const isArray = Array.isArray(value);
  const empty = isArray ? value.length === 0 : !value;
  const display = isArray ? value.join(', ') : value;
  return (
    <div className="flex items-start gap-2">
      <Icon size={14} className="text-zinc-500 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
        {empty ? (
          <div className="text-xs text-zinc-600">None linked</div>
        ) : href ? (
          <Link href={href} className="text-xs text-brand hover:text-brand/80 font-mono truncate block transition-colors">
            {display}
          </Link>
        ) : (
          <div className="text-xs text-zinc-300 font-mono truncate">{display}</div>
        )}
      </div>
    </div>
  );
}
