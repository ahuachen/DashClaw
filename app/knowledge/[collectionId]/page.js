'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, BookOpen, FileText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const statusVariant = {
  pending: 'warning',
  indexed: 'success',
  failed: 'error',
};

export default function KnowledgeCollectionDetailPage() {
  const { collectionId } = useParams();
  const [collection, setCollection] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newItemUri, setNewItemUri] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');

  const fetchCollection = useCallback(async () => {
    try {
      const [cRes, iRes] = await Promise.all([
        fetch(`/api/knowledge/collections/${collectionId}`),
        fetch(`/api/knowledge/collections/${collectionId}/items`),
      ]);
      if (!cRes.ok) {
        if (cRes.status === 404) { setError('Collection not found'); return; }
        throw new Error('Failed to fetch');
      }
      const { collection: c } = await cRes.json();
      setCollection(c);
      if (iRes.ok) {
        const { items: its } = await iRes.json();
        setItems(its || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    if (collectionId) fetchCollection();
  }, [collectionId, fetchCollection]);

  const addItem = async () => {
    if (!newItemUri.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/knowledge/collections/${collectionId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_uri: newItemUri.trim(),
          title: newItemTitle.trim() || undefined,
        }),
      });
      if (res.ok) {
        setNewItemUri('');
        setNewItemTitle('');
        await fetchCollection();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <PageLayout title="Loading..." breadcrumbs={['Studio', 'Knowledge']}>
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      </PageLayout>
    );
  }

  if (error && !collection) {
    return (
      <PageLayout title="Collection Not Found" breadcrumbs={['Studio', 'Knowledge', collectionId]}>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="p-6 text-center">
            <div className="text-lg font-medium text-white mb-2">{error}</div>
            <div className="text-sm text-zinc-500">{collectionId}</div>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={collection.name}
      subtitle={collection.description || 'Knowledge collection'}
      breadcrumbs={['Studio', 'Knowledge', collection.name]}
      actions={
        <Link
          href="/knowledge"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      }
    >
      {/* Metadata row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">{collection.doc_count}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Items</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-xs font-mono text-zinc-300">{collection.source_type}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Source type</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <Badge variant={collection.ingestion_status === 'synced' ? 'success' : 'default'}>
              {collection.ingestion_status}
            </Badge>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-2">Ingestion</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="p-4 text-center">
            <div className="text-xs text-zinc-300">{collection.tags?.join(', ') || '—'}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Tags</div>
          </CardContent>
        </Card>
      </div>

      {/* Add item form */}
      <Card className="mb-4">
        <CardHeader title="Add Item" icon={Plus} />
        <CardContent className="p-5 pt-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemUri}
              onChange={(e) => setNewItemUri(e.target.value)}
              placeholder="source URI (e.g. https://docs.example.com/runbook.md)"
              className="flex-1 px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
            />
            <input
              type="text"
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              placeholder="title (optional)"
              className="w-60 px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
            />
            <button
              onClick={addItem}
              disabled={adding || !newItemUri.trim()}
              className="px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Items list */}
      <Card>
        <CardHeader title="Items" icon={BookOpen} count={items.length} />
        <CardContent className="p-5 pt-0">
          {items.length === 0 ? (
            <div className="text-sm text-zinc-500 py-6 text-center">No items yet.</div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.item_id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText size={14} className="text-zinc-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{item.title || item.source_uri}</div>
                      <div className="text-xs text-zinc-500 font-mono truncate">{item.source_uri}</div>
                    </div>
                  </div>
                  <Badge variant={statusVariant[item.status] || 'default'}>{item.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
