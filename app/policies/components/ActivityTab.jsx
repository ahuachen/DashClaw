'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';

const decisionVariant = {
  block: 'error',
  require_approval: 'warning',
  warn: 'info',
  allow: 'success',
};

const decisionDot = {
  block: 'bg-red-500',
  require_approval: 'bg-amber-500',
  warn: 'bg-yellow-500',
  allow: 'bg-emerald-500',
};

function formatRelativeTime(isoString) {
  if (!isoString) return '\u2014';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityTab() {
  const [decisions, setDecisions] = useState([]);
  const [stats, setStats] = useState({ blocks: 0, approvals: 0, warns: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterDecision, setFilterDecision] = useState('');
  const [offset, setOffset] = useState(0);

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('offset', offset.toString());
      if (filterDecision) params.set('decision', filterDecision);
      const res = await fetch(`/api/guard/decisions?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setDecisions(data.decisions || []);
        } else {
          setDecisions(prev => [...prev, ...(data.decisions || [])]);
        }
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch guard decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDecision, offset]);

  useEffect(() => { setOffset(0); }, [filterDecision]);
  useEffect(() => { fetchDecisions(); }, [fetchDecisions]);

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span><span className="text-red-400 font-medium">{stats.blocks}</span> blocks (7d)</span>
        <span>&middot;</span>
        <span><span className="text-amber-400 font-medium">{stats.approvals}</span> approvals (7d)</span>
        <span>&middot;</span>
        <span><span className="text-yellow-400 font-medium">{stats.warns}</span> warns (7d)</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select
          value={filterDecision}
          onChange={e => setFilterDecision(e.target.value)}
          className="rounded-lg border border-white/5 bg-surface-tertiary px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-brand/50"
        >
          <option value="">All decisions</option>
          <option value="block">Blocked</option>
          <option value="require_approval">Require Approval</option>
          <option value="warn">Warn</option>
          <option value="allow">Allowed</option>
        </select>
      </div>

      {/* Feed */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111]">
        {loading && decisions.length === 0 ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-500">No guard decisions yet.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {decisions.map(d => (
              <div key={d.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${decisionDot[d.decision] || 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={decisionVariant[d.decision] || 'default'} size="xs">{d.decision}</Badge>
                      <span className="text-xs text-zinc-500">{d.action_type}</span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-400">{d.agent_name || d.agent_id || 'unknown'}</span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-500">{formatRelativeTime(d.created_at)}</span>
                    </div>
                    {d.matched_policies?.length > 0 && (
                      <div className="mt-1 text-xs text-zinc-500">
                        Policy: <span className="text-zinc-300">{d.matched_policies.join(', ')}</span>
                      </div>
                    )}
                    {d.risk_score != null && (
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Risk: <span className={`font-mono ${d.risk_score >= 70 ? 'text-red-400' : d.risk_score >= 30 ? 'text-amber-400' : 'text-zinc-300'}`}>{d.risk_score}</span>
                      </div>
                    )}
                    {d.declared_goal && (
                      <div className="mt-1 text-xs text-zinc-400 truncate">{d.declared_goal}</div>
                    )}
                    {d.reason && (
                      <div className="mt-0.5 text-xs text-zinc-500">{d.reason}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {decisions.length < total && (
          <div className="border-t border-white/[0.04] px-5 py-3 text-center">
            <button
              onClick={() => setOffset(decisions.length)}
              disabled={loading}
              className="text-xs text-brand hover:text-brand/80 disabled:opacity-50"
            >
              {loading ? 'Loading...' : `Load more (${decisions.length} of ${total})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
