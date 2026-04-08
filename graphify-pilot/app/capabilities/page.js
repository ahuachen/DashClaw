'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Wrench, Plus, Search, RotateCw, ShieldAlert, Clock, DollarSign, Activity } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';

const riskVariant = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const healthDot = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-zinc-500',
};

const RISK_LEVELS = ['all', 'low', 'medium', 'high', 'critical'];

export default function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const fetchCapabilities = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (riskFilter !== 'all') params.set('risk_level', riskFilter);
      params.set('limit', '100');
      const res = await fetch(`/api/capabilities?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCapabilities(data.capabilities || []);
      }
    } catch (err) {
      console.error('Failed to fetch capabilities:', err);
    } finally {
      setLoading(false);
    }
  }, [search, riskFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchCapabilities, 200);
    return () => clearTimeout(debounce);
  }, [fetchCapabilities]);

  const createStarter = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Send Slack Message',
          description: 'Posts a message to a configured Slack channel',
          category: 'messaging',
          source_type: 'http_api',
          auth_type: 'oauth',
          risk_level: 'medium',
          requires_approval: false,
          tags: ['notify', 'slack'],
          health_status: 'healthy',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create capability');
      }
      await fetchCapabilities();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const hasPricing = (cap) => cap.pricing && Object.keys(cap.pricing).length > 0;

  return (
    <PageLayout
      title="Capability Registry"
      subtitle="Governed registry of callable capabilities with risk, approval, and health metadata"
      breadcrumbs={['Studio', 'Capabilities']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchCapabilities}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
          >
            <RotateCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link
            href="/capabilities/new"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
          >
            <Plus size={14} /> Register Capability
          </Link>
        </div>
      }
    >
      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, description, tags..."
            className="w-full pl-9 pr-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
          />
        </div>
        <div className="flex items-center gap-1">
          {RISK_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setRiskFilter(level)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                riskFilter === level
                  ? 'bg-brand text-white'
                  : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      ) : capabilities.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No capabilities match"
          description={
            search || riskFilter !== 'all'
              ? 'Try clearing filters or searching for a different term.'
              : 'Register callable capabilities with risk, approval, and health metadata. Workflows can then reference them by id or tag.'
          }
          action={
            !search && riskFilter === 'all' ? (
              <Link
                href="/capabilities/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
              >
                <Plus size={14} /> Register your first capability
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap) => (
            <Card key={cap.capability_id} className="h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${healthDot[cap.health_status] || healthDot.unknown}`}
                        title={`health: ${cap.health_status}`}
                      />
                      <div className="text-sm font-semibold text-white truncate">{cap.name}</div>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono truncate mt-0.5">{cap.slug}</div>
                  </div>
                  <Badge variant={riskVariant[cap.risk_level] || 'default'}>{cap.risk_level}</Badge>
                </div>

                {cap.description && (
                  <div className="text-xs text-zinc-400 line-clamp-2 mb-3">{cap.description}</div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {cap.category && (
                    <Badge size="xs">{cap.category}</Badge>
                  )}
                  {cap.requires_approval && (
                    <Badge size="xs" variant="warning">
                      <ShieldAlert size={10} className="mr-1" /> approval
                    </Badge>
                  )}
                  {hasPricing(cap) && (
                    <Badge size="xs" variant="info">
                      <DollarSign size={10} className="mr-1" /> priced
                    </Badge>
                  )}
                  <Badge size="xs">{cap.source_type}</Badge>
                </div>

                {cap.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cap.tags.slice(0, 4).map((tag) => (
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
          ))}
        </div>
      )}
    </PageLayout>
  );
}
