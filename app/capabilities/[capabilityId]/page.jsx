'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Wrench } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { EmptyState } from '../../components/ui/EmptyState';
import CapabilityStatusHero from './components/CapabilityStatusHero';
import CapabilityHealthCards from './components/CapabilityHealthCards';
import CapabilityFactsCard from './components/CapabilityFactsCard';
import CapabilityHistoryTable from './components/CapabilityHistoryTable';
import CapabilityTestPanel from './components/CapabilityTestPanel';

async function readJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'Request failed');
  }
  return body;
}

export default function CapabilityDetailPage({ params }) {
  const capabilityId = params?.capabilityId;
  const [capability, setCapability] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyFilters, setHistoryFilters] = useState({ actionType: 'all', status: 'all' });
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const hasInitializedHistory = useRef(false);

  const loadCapabilityDetail = useCallback(async () => {
    const capabilityBody = await fetch(`/api/capabilities/${capabilityId}`).then(readJson);
    setCapability(capabilityBody.capability || null);
  }, [capabilityId]);

  const loadHealthSummary = useCallback(async () => {
    const healthBody = await fetch(`/api/capabilities/${capabilityId}/health`).then(readJson);
    setHealth(healthBody || null);
  }, [capabilityId]);

  const loadHistory = useCallback(async (filters = historyFilters) => {
    const params = new URLSearchParams();
    if (filters.actionType && filters.actionType !== 'all') {
      params.set('action_type', filters.actionType);
    }
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    params.set('limit', '20');

    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const historyBody = await fetch(`/api/capabilities/${capabilityId}/history?${params.toString()}`).then(readJson);
      setHistory(historyBody.events || []);
    } catch (err) {
      setHistoryError(err.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [capabilityId]);

  const handleRefresh = useCallback(async () => {
    if (!capabilityId) {
      setError('Capability id is required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loadCapabilityDetail();
      await Promise.all([
        loadHealthSummary(),
        loadHistory(historyFilters),
      ]);
      hasInitializedHistory.current = true;
    } catch (err) {
      setError(err.message || 'Failed to load capability');
    } finally {
      setLoading(false);
    }
  }, [capabilityId, historyFilters, loadCapabilityDetail, loadHealthSummary, loadHistory]);

  useEffect(() => {
    hasInitializedHistory.current = false;
    handleRefresh();
  }, [capabilityId]);

  useEffect(() => {
    if (!hasInitializedHistory.current) return;
    loadHistory(historyFilters);
  }, [historyFilters, loadHistory]);

  const handleTestSubmit = useCallback(async ({ error: parseError, payload, declaredGoal }) => {
    if (parseError) {
      setTestResult({ error: parseError });
      return;
    }

    setTestSubmitting(true);
    setTestResult(null);

    try {
      const body = { ...payload };
      if (declaredGoal) {
        body.declared_goal = declaredGoal;
      }

      const response = await fetch(`/api/capabilities/${capabilityId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const resultBody = await response.json().catch(() => ({}));
      setTestResult(resultBody);

      await Promise.all([
        loadHealthSummary(),
        loadHistory(historyFilters),
      ]);
    } catch (err) {
      setTestResult({ error: err.message || 'Failed to run capability test' });
    } finally {
      setTestSubmitting(false);
    }
  }, [capabilityId, historyFilters, loadHealthSummary, loadHistory]);

  return (
    <PageLayout
      title={capability?.name || 'Capability Detail'}
      subtitle="Operator view for capability health, certification, and recent activity"
      breadcrumbs={['Studio', 'Capabilities', capability?.name || capabilityId || 'Detail']}
    >
      {loading ? (
        <div className="text-sm text-zinc-500 py-12 text-center">Loading capability...</div>
      ) : error ? (
        <EmptyState
          icon={Wrench}
          title="Capability unavailable"
          description={error}
          action={(
            <Link
              href="/capabilities"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
            >
              Back to registry
            </Link>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6">
          <div className="space-y-6">
            <CapabilityStatusHero
              capability={capability}
              health={health}
              loading={loading}
              onRefresh={handleRefresh}
              onOpenTest={() => setTestPanelOpen(true)}
            />

            <CapabilityHealthCards health={health} />

            <CapabilityHistoryTable
              events={history}
              filters={historyFilters}
              loading={historyLoading}
              error={historyError}
              onRetry={() => loadHistory(historyFilters)}
              onFiltersChange={(patch) => {
                setHistoryFilters((current) => ({ ...current, ...patch }));
              }}
            />
          </div>

          <div className="space-y-6">
            {testPanelOpen ? (
              <CapabilityTestPanel
                isSubmitting={testSubmitting}
                result={testResult}
                onSubmit={handleTestSubmit}
              />
            ) : null}

            <CapabilityFactsCard capability={capability} health={health} />
          </div>
        </div>
      )}
    </PageLayout>
  );
}
