'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BookOpen, Plus, RotateCw, FileText, Globe, Archive, StickyNote } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const sourceIcons = {
  files: FileText,
  urls: Globe,
  external: Archive,
  notes: StickyNote,
};

const ingestionVariant = {
  empty: 'default',
  pending: 'warning',
  syncing: 'info',
  synced: 'success',
  failed: 'error',
};

function timeAgo(dateString) {
  if (!dateString) return 'never';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function KnowledgePage() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/collections?limit=100');
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const createStarter = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Runbook library',
          description: 'Incident response runbooks',
          source_type: 'files',
          tags: ['ops', 'oncall'],
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create collection');
      }
      await fetchCollections();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout
      title="Knowledge Collections"
      subtitle="Named knowledge sources that workflows and agents can bind to"
      breadcrumbs={['Studio', 'Knowledge']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchCollections(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={createStarter}
            disabled={creating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus size={14} /> {creating ? 'Creating...' : 'New Collection'}
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      ) : collections.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No knowledge collections yet"
          description="Collections are named containers for documents, URLs, and notes that workflows can bind to. Phase 1 is metadata-only — vector retrieval comes later."
          action={
            <button
              onClick={createStarter}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
            >
              <Plus size={14} /> Create starter collection
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((c) => {
            const Icon = sourceIcons[c.source_type] || FileText;
            return (
              <Link key={c.collection_id} href={`/knowledge/${c.collection_id}`}>
                <Card className="h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                          {c.description && (
                            <div className="text-xs text-zinc-500 truncate">{c.description}</div>
                          )}
                        </div>
                      </div>
                      <Badge variant={ingestionVariant[c.ingestion_status] || 'default'}>
                        {c.ingestion_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-zinc-500 uppercase tracking-wider">
                      <span>{c.doc_count} items</span>
                      <span>Synced {timeAgo(c.last_synced_at)}</span>
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-mono"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
