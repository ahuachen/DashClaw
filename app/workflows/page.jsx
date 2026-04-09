'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Workflow, Plus, RotateCw, FileText, CheckSquare, Trash2, Sparkles, Pencil } from 'lucide-react';
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

function toggleSelection(selectedIds, templateId) {
  return selectedIds.includes(templateId)
    ? selectedIds.filter((id) => id !== templateId)
    : [...selectedIds, templateId];
}

function WorkflowCard({ t, selected, selectionMode, onToggleSelect, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cardContent = (
    <Card className={`h-full ${selected ? 'ring-1 ring-brand' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-2 gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{t.name}</div>
            <div className="text-xs text-zinc-500 font-mono truncate">{t.slug}</div>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode && (
              <input
                type="checkbox"
                aria-label={`Select ${t.name}`}
                checked={selected}
                onChange={() => onToggleSelect(t.template_id)}
                onClick={(event) => event.stopPropagation()}
              />
            )}
            <Badge variant={statusVariant[t.status] || 'default'}>{t.status}</Badge>
          </div>
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
        {!selectionMode && (
          <div className="flex items-center gap-2 mt-3">
            <Link
              href={`/workflows/${t.template_id}`}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
              aria-label={`Edit ${t.name}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil size={11} /> Edit
            </Link>
            {confirmDelete ? (
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="text-red-400">Delete?</span>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleting(true);
                    await onDelete?.(t.template_id);
                    setDeleting(false);
                    setConfirmDelete(false);
                  }}
                  disabled={deleting}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
                  className="text-zinc-400 hover:text-white"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(true); }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-red-400"
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect(t.template_id)}
        className="text-left"
      >
        {cardContent}
      </button>
    );
  }

  return (
    <Link href={`/workflows/${t.template_id}`}>
      {cardContent}
    </Link>
  );
}

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = useCallback(async (templateId) => {
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(body.error || 'Failed to delete template');
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.template_id !== templateId));
    } catch (err) {
      console.error(err.message || 'Failed to delete template');
    }
  }, []);

  async function handleDeleteSelected() {
    if (selectedIds.length === 0 || deleting) return;
    if (typeof window !== 'undefined' && !window.confirm(`Delete ${selectedIds.length} workflow template${selectedIds.length === 1 ? '' : 's'}?`)) {
      return;
    }

    setDeleting(true);
    try {
      const results = await Promise.all(
        selectedIds.map((templateId) => fetch(`/api/workflows/templates/${templateId}`, {
          method: 'DELETE',
          headers: { 'x-org-role': 'admin' },
        }))
      );

      const deletedIds = selectedIds.filter((_, index) => results[index].ok);
      setTemplates((prev) => prev.filter((template) => !deletedIds.includes(template.template_id)));
      setSelectedIds([]);
      setSelectionMode(false);
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = templates.length > 0 && selectedIds.length === templates.length;

  return (
    <PageLayout
      title="Workflow Templates"
      subtitle="Reusable, governed workflow packaging"
      breadcrumbs={['Studio', 'Workflows']}
      maturity="beta"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchTemplates(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode((value) => !value);
              setSelectedIds([]);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
          >
            <CheckSquare size={14} />
            {selectionMode ? 'Cancel selection' : 'Select multiple'}
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
      {!loading && templates.length > 0 && (
        <div className="mb-4 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Workflow operations</div>
              <p className="mt-1 text-sm text-zinc-400">
                {selectionMode
                  ? 'Select the workflow templates you want to delete. This is the fastest way to clean up old test workflows.'
                  : 'Need a new workflow quickly? You can also describe it in plain English from the workflow builder with Generate with AI.'}
              </p>
            </div>
            {selectionMode ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(allSelected ? [] : templates.map((template) => template.template_id))}
                  className="px-3 py-1.5 text-sm text-zinc-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                >
                  {allSelected ? 'Clear all' : 'Select all'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={selectedIds.length === 0 || deleting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {deleting ? 'Deleting...' : `Delete selected${selectedIds.length ? ` (${selectedIds.length})` : ''}`}
                </button>
              </div>
            ) : (
              <Link
                href="/workflows/new"
                className="inline-flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-sm text-orange-200 transition-colors hover:bg-orange-500/20"
              >
                <Sparkles size={14} />
                Open AI workflow builder
              </Link>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="No workflow templates yet"
          description="Package repeatable operational patterns into reusable, versioned assets. Link them to policies, knowledge, capabilities, and a model strategy."
          action={(
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/workflows/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
              >
                <Plus size={14} />
                Create your first template
              </Link>
              <Link
                href="/workflows/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-orange-200 bg-orange-500/10 hover:bg-orange-500/20 rounded-lg transition-colors"
              >
                <Sparkles size={14} />
                Generate with AI
              </Link>
            </div>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <WorkflowCard
              key={t.template_id}
              t={t}
              selected={selectedIds.includes(t.template_id)}
              selectionMode={selectionMode}
              onToggleSelect={(id) => setSelectedIds((prev) => toggleSelection(prev, id))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
