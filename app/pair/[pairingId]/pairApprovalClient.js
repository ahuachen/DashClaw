'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2, Clock, AlertTriangle, RefreshCw, Link as LinkIcon } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'approved') return <Badge variant="success">Approved</Badge>;
  if (s === 'expired') return <Badge variant="danger">Expired</Badge>;
  if (s === 'pending') return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="info">{status || 'unknown'}</Badge>;
}

export default function PairApprovalClient({ pairingId }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [pairing, setPairing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);

  const fetchPairing = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(pairingId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to load pairing');
        setPairing(null);
        return;
      }
      setPairing(data.pairing);
    } catch {
      setError('Failed to connect to API');
      setPairing(null);
    } finally {
      setLoading(false);
    }
  }, [pairingId]);

  useEffect(() => {
    fetchPairing();
  }, [fetchPairing]);

  const isPending = pairing?.status === 'pending';

  const approve = async () => {
    if (!isAdmin || !isPending) return;
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(pairingId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to approve pairing');
        return;
      }
      await fetchPairing();
    } catch {
      setError('Failed to approve pairing');
    } finally {
      setApproving(false);
    }
  };

  const subtitle = useMemo(() => {
    if (!pairing) return 'Approve an agent enrollment request';
    return `Agent: ${pairing.agent_id}${pairing.agent_name ? ` (${pairing.agent_name})` : ''}`;
  }, [pairing]);

  return (
    <PageLayout
      title="Approve Agent Pairing"
      subtitle={subtitle}
      breadcrumbs={['Dashboard', 'Pairings', pairingId]}
      actions={
        <button
          onClick={fetchPairing}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg text-sm text-zinc-300 hover:text-white hover:border-[rgba(255,255,255,0.12)] transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}

      <Card hover={false}>
        <CardContent className="pt-6">
          {loading ? (
            <div className="text-sm text-zinc-500 py-10 text-center">Loading pairing…</div>
          ) : !pairing ? (
            <div className="text-sm text-zinc-500 py-10 text-center">Pairing not found.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-zinc-400 mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    {statusBadge(pairing.status)}
                    <span className="text-xs text-zinc-500">Expires: {formatDate(pairing.expires_at)}</span>
                  </div>
                </div>
                {isPending && (
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <button
                        onClick={approve}
                        disabled={approving}
                        className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <CheckCircle2 size={16} />
                        {approving ? 'Approving…' : 'Approve'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-amber-300">
                        <AlertTriangle size={14} />
                        Admin required to approve
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)]">
                  <div className="text-xs text-zinc-500 mb-1">Agent ID</div>
                  <div className="text-sm font-mono text-white break-all">{pairing.agent_id}</div>
                </div>
                <div className="p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)]">
                  <div className="text-xs text-zinc-500 mb-1">Algorithm</div>
                  <div className="text-sm font-mono text-white break-all">{pairing.algorithm || 'RSASSA-PKCS1-v1_5'}</div>
                </div>
              </div>

              {pairing.status === 'approved' && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Approved. Your agent can start sending verified actions now.
                </div>
              )}

              {pairing.status === 'pending' && (
                <div className="p-3 rounded-lg bg-white/5 border border-[rgba(255,255,255,0.06)] text-sm text-zinc-300 flex items-start gap-2">
                  <Clock size={16} className="mt-0.5 text-zinc-400" />
                  <div>
                    <div className="text-sm text-white">One click, then the agent comes online.</div>
                    <div className="text-xs text-zinc-500 mt-1">
                      This page is safe to share inside your org. After approval, the agent should stop showing pairing links.
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-zinc-500 flex items-center gap-2">
                <LinkIcon size={14} />
                Pairing ID: <span className="font-mono">{pairing.id}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

