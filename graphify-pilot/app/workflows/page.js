'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Workflow, Plus, RotateCw, FileText } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const statusVariant = {
  draft: 'default',
  active: 'success',
  archived: 'info',
};

function timeAgo(dateString) {
  if (!dateString) return '';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows/templates?limit=100');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to fetch workflow templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <PageLayout
      title="Workflow Templates"
      subtitle="Reusable, governed workflow packaging"
      breadcrumbs={['Studio', 'Workflows']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchTemplates(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <Link
            href="/workflows/new"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
          >
            <Plus size={14} />
            New Template
          </Link>
        </div>
      }
    >
      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflow templates yet"
          description="Package repeatable operational patterns into reusable, versioned assets. Link them to policies, knowledge, capabilities, and a model strategy."
          action={
            <Link
              href="/workflows/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
            >
              <Plus size={14} />
              Create your first template
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Link key={t.template_id} href={`/workflows/${t.template_id}`}>
              <Card className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{t.name}</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{t.slug}</div>
                    </div>
                    <Badge variant={statusVariant[t.status] || 'default'}>{t.status}</Badge>
                  </div>
                  {t.description && (
                    <div className="text-xs text-zinc-400 line-clamp-2 mb-3">{t.description}</div>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1"><FileText size={11} />v{t.version}</span>
                    <span>{(t.linked_policy_ids?.length || 0)} policies</span>
                    <span>{(t.linked_capability_ids?.length || 0)} capabilities</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-2">Updated {timeAgo(t.updated_at)}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
