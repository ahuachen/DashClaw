'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Brain, CheckCircle2, XCircle, HelpCircle, RefreshCw,
  AlertTriangle, Clock, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">{stats.total}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Total</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-emerald-400">{stats.validated}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Validated</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-red-400">{stats.invalidated}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Invalidated</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-amber-400">{stats.pending}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">Pending</div>
          </div>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/5">
        {['all', 'awaiting_validation', 'validated', 'invalidated'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors relative ${
              filter === f ? 'text-brand' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f === 'all' ? 'All' : f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            {filter === f && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
          </button>
        ))}
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
                <div className="p-4 flex items-start gap-4">
                  <div className={`mt-0.5 ${cfg.color}`}>
                    <StatusIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white mb-1">{a.assumption}</div>
                    {a.basis && (
                      <div className="text-xs text-zinc-500 mb-2">Basis: {a.basis}</div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                      <span className="font-mono">{a.agent_id}</span>
                      {a.action_id && (
                        <Link href={`/actions/${a.action_id}`} className="text-brand hover:underline">
                          {a.action_id.slice(0, 16)}...
                        </Link>
                      )}
                      {a.created_at && <span>{new Date(a.created_at).toLocaleString()}</span>}
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
