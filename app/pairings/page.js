'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PairingsInboxPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [pairings, setPairings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const [error, setError] = useState(null);

  const fetchPairings = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/pairings?status=pending&limit=200');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load pairings');
        setPairings([]);
        return;
      }
      setPairings(data.pairings || []);
    } catch {
      setError('Failed to connect to API');
      setPairings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPairings();
  }, [fetchPairings]);

  const approveOne = async (id) => {
    if (!isAdmin) return;
    setError(null);
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Failed to approve ${id}`);
        return;
      }
      await fetchPairings();
    } catch {
      setError(`Failed to approve ${id}`);
    }
  };

  const approveAll = async () => {
    if (!isAdmin || pairings.length === 0) return;
    setApprovingAll(true);
    setError(null);
    try {
      for (const p of pairings) {
        // Best-effort: continue even if one fails.
        // Any errors are surfaced in the UI.
        // eslint-disable-next-line no-await-in-loop
        await approveOne(p.id);
      }
    } finally {
      setApprovingAll(false);
    }
  };

  const subtitle = useMemo(() => {
    return 'Approve agents that are requesting enrollment';
  }, []);

  return (
    <PageLayout
      title="Pairings"
      subtitle={subtitle}
      breadcrumbs={['Dashboard', 'Pairings']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPairings}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg text-sm text-zinc-300 hover:text-white hover:border-[rgba(255,255,255,0.12)] transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {isAdmin && (
            <button
              onClick={approveAll}
              disabled={approvingAll || pairings.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <CheckCircle2 size={16} />
              {approvingAll ? 'Approving…' : `Approve All (${pairings.length})`}
            </button>
          )}
        </div>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300 flex items-center gap-2">
          <AlertTriangle size={16} />
          Admin role required to approve pairings.
        </div>
      )}

      <Card hover={false}>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-sm text-zinc-500 py-10 text-center">Loading pairings…</div>
          ) : pairings.length === 0 ? (
            <div className="text-sm text-zinc-500 py-10 text-center">No pending pairings.</div>
          ) : (
            <div className="space-y-2">
              {pairings.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{p.agent_id}</span>
                      {p.agent_name && <span className="text-xs text-zinc-500">({p.agent_name})</span>}
                      <Badge variant="warning">Pending</Badge>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">
                      Expires: {formatDate(p.expires_at)} • Algorithm: <span className="font-mono">{p.algorithm || 'RSASSA-PKCS1-v1_5'}</span>
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-1 font-mono break-all">{p.id}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/pair/${encodeURIComponent(p.id)}`}
                      className="px-3 py-2 text-sm text-zinc-300 hover:text-white rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] bg-white/0 hover:bg-white/5 transition-colors"
                    >
                      View
                    </a>
                    {isAdmin && (
                      <button
                        onClick={() => approveOne(p.id)}
                        className="px-3 py-2 text-sm text-white rounded-lg bg-brand hover:bg-brand/90 transition-colors"
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}


