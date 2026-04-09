'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Wrench, Plus, Search, RotateCw } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { EmptyState } from '../components/ui/EmptyState';
import CapabilityRegistrySummary from './components/CapabilityRegistrySummary';
import CapabilityRegistryFilters from './components/CapabilityRegistryFilters';
import CapabilityRegistryCard from './components/CapabilityRegistryCard';

const RISK_LEVELS = ['all', 'low', 'medium', 'high', 'critical'];

export default function CapabilitiesPage() {
  const [capabilities, setCapabilities] = useState([]);
  const [healthRows, setHealthRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [healthFilter, setHealthFilter] = useState('all');
  const [staleOnly, setStaleOnly] = useState(false);
  const [uncertifiedOnly, setUncertifiedOnly] = useState(false);
  const [error, setError] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [testStatus, setTestStatus] = useState({});

  const fetchCapabilities = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (riskFilter !== 'all') params.set('risk_level', riskFilter);
      params.set('limit', '100');

      const [capabilityRes, healthRes] = await Promise.all([
        fetch(`/api/capabilities?${params.toString()}`),
        fetch(`/api/capabilities/health?${params.toString()}`),
      ]);

      if (capabilityRes.ok) {
        const data = await capabilityRes.json();
        setCapabilities(data.capabilities || []);
      } else {
        setCapabilities([]);
        setError('Failed to fetch capabilities');
      }

      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealthRows(healthData.capabilities || []);
        setHealthError(null);
      } else {
        setHealthRows([]);
        setHealthError('Capability health unavailable');
      }
    } catch (err) {
      console.error('Failed to fetch capabilities:', err);
      setError(err.message || 'Failed to fetch capabilities');
      setCapabilities([]);
      setHealthRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, riskFilter]);

  useEffect(() => {
    const debounce = setTimeout(fetchCapabilities, 200);
    return () => clearTimeout(debounce);
  }, [fetchCapabilities]);

  const mergedCapabilities = useMemo(() => {
    const healthById = new Map(healthRows.map((row) => [row.capability_id, row]));
    return capabilities.map((capability) => ({
      ...capability,
      ...(healthById.get(capability.capability_id) || {}),
    }));
  }, [capabilities, healthRows]);

  const filteredCapabilities = useMemo(() => {
    return mergedCapabilities.filter((capability) => {
      const currentHealth = capability.status || capability.health_status || 'unknown';
      const certificationStatus = capability.certification_status || 'uncertified';

      if (healthFilter !== 'all' && currentHealth !== healthFilter) return false;
      if (staleOnly && capability.stale_check !== true) return false;
      if (uncertifiedOnly && certificationStatus !== 'uncertified') return false;

      return true;
    });
  }, [mergedCapabilities, healthFilter, staleOnly, uncertifiedOnly]);

  const summaryCounts = useMemo(() => ({
    total: mergedCapabilities.length,
    attention: mergedCapabilities.filter((capability) => ['unhealthy', 'degraded', 'failing'].includes(capability.status || capability.health_status)).length,
    stale: mergedCapabilities.filter((capability) => capability.stale_check === true || capability.certification_status === 'stale').length,
    uncertified: mergedCapabilities.filter((capability) => (capability.certification_status || 'uncertified') === 'uncertified').length,
  }), [mergedCapabilities]);

  const handleRunTest = useCallback(async (capability) => {
    setTestStatus((current) => ({
      ...current,
      [capability.capability_id]: {
        submitting: true,
        message: null,
        error: false,
      },
    }));

    try {
      const response = await fetch(`/api/capabilities/${capability.capability_id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => ({}));
      const message = body.message || body.error || 'Capability test completed';

      setTestStatus((current) => ({
        ...current,
        [capability.capability_id]: {
          submitting: false,
          message,
          error: !response.ok,
        },
      }));

      await fetchCapabilities();
    } catch (err) {
      setTestStatus((current) => ({
        ...current,
        [capability.capability_id]: {
          submitting: false,
          message: err.message || 'Capability test failed',
          error: true,
        },
      }));
    }
  }, [fetchCapabilities]);

  return (
    <PageLayout
      title="Capability Registry"
      subtitle="Governed registry of callable capabilities with risk, approval, and health metadata"
      breadcrumbs={['Studio', 'Capabilities']}
      maturity="stable"
      actions={(
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
      )}
    >
      <CapabilityRegistrySummary counts={summaryCounts} />

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

      <CapabilityRegistryFilters
        healthFilter={healthFilter}
        onHealthFilterChange={setHealthFilter}
        staleOnly={staleOnly}
        onStaleOnlyChange={setStaleOnly}
        uncertifiedOnly={uncertifiedOnly}
        onUncertifiedOnlyChange={setUncertifiedOnly}
      />

      {error ? (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      {healthError ? (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
          {healthError}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading...</div>
      ) : filteredCapabilities.length === 0 ? (
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
          {filteredCapabilities.map((capability) => (
            <CapabilityRegistryCard
              key={capability.capability_id}
              capability={capability}
              onRunTest={handleRunTest}
              testStatus={testStatus[capability.capability_id]}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}
