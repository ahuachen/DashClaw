'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, CheckCircle2, XCircle, HelpCircle, Clock,
} from 'lucide-react';
import Link from 'next/link';
import PageLayout from '../components/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { isDemoMode } from '../lib/isDemoMode';

const STATUS_CONFIG = {
  validated: { icon: CheckCircle2, color: 'text-emerald-400', variant: 'success' },
  invalidated: { icon: XCircle, color: 'text-red-400', variant: 'error' },
  pending: { icon: HelpCircle, color: 'text-amber-400', variant: 'warning' },
  awaiting_validation: { icon: Clock, color: 'text-blue-400', variant: 'info' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'awaiting_validation', label: 'Awaiting validation' },
  { value: 'validated', label: 'Validated' },
  { value: 'invalidated', label: 'Invalidated' },
];

export default function AssumptionsPage() {
  const { selectedAgentId } = useAgentFilter();
  const [assumptions, setAssumptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const demo = isDemoMode();

  const fetchAssumptions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAgentId) params.set('agent_id', selectedAgentId);
      if (filter !== 'all') params.set('status', filter);
      params.set('limit', '50');

      const res = await fetch(`/api/actions/assumptions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssumptions(data.assumptions || []);
      }
    } catch (err) {
      console.error('Failed to fetch assumptions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId, filter]);

  useEffect(() => {
    if (!demo) fetchAssumptions();
    else setLoading(false);
  }, [demo, fetchAssumptions]);

  const stats = {
    total: assumptions.length,
    validated: assumptions.filter(a => a.status === 'validated').length,
    invalidated: assumptions.filter(a => a.status === 'invalidated').length,
    pending: assumptions.filter(a => a.status === 'pending' || a.status === 'awaiting_validation').length,
  };

  return (
    <PageLayout
      title="Assumptions"
      subtitle="Decision basis tracking — what agents believe while acting"
      breadcrumbs={['Governance', 'Assumptions']}
    >
      {/* Instrument rail — one container, divided columns */}
      <div className="mb-8 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface-secondary md:grid-cols-4 md:divide-y-0">
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Total</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{stats.total}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Validated</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">{stats.validated}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Invalidated</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-red-400">{stats.invalidated}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Pending</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{stats.pending}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div role="tablist" className="mb-6 flex items-center gap-1 border-b border-border">
        {FILTER_OPTIONS.map(opt => {
          const isActive = filter === opt.value;
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(opt.value)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}
              {isActive && (
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : assumptions.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="No assumptions recorded"
          description="Agents record assumptions using dc.recordAssumption() when making decisions based on uncertain information."
        />
      ) : (
        <div className="space-y-3">
          {assumptions.map((a) => {
            const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={a.id} hover={false}>
                <div className="flex items-start gap-4 p-4">
                  <div className={`mt-0.5 shrink-0 ${cfg.color}`}>
                    <StatusIcon size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 text-sm font-medium text-white">{a.assumption}</div>
                    {a.basis && (
                      <div className="mb-2 text-xs text-zinc-500">Basis: {a.basis}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span className="font-mono text-zinc-400">{a.agent_id}</span>
                      {a.action_id && (
                        <Link
                          href={`/actions/${a.action_id}`}
                          className="font-mono text-brand transition-colors hover:text-brand-hover"
                        >
                          {a.action_id.slice(0, 16)}…
                        </Link>
                      )}
                      {a.created_at && (
                        <span className="tabular-nums">{new Date(a.created_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={cfg.variant} size="xs">
                    {(a.status || 'pending').replace(/_/g, ' ')}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
