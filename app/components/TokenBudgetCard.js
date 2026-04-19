'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Gauge, Cpu, ArrowRight, TrendingUp, ArrowDown, ArrowUp, RotateCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { StatCompact } from './ui/Stat';
import { CardSkeleton } from './ui/Skeleton';
import { EmptyState } from './ui/EmptyState';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useRealtime } from '../hooks/useRealtime';
import { HelpIcon } from './HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';

export default function TokenBudgetCard() {
  const { agentId } = useAgentFilter();
  const [data, setData] = useState({
    todayTokensIn: 0,
    todayTokensOut: 0,
    todayTokens: 0,
    todayCost: 0,
    compactions: 0,
    model: 'loading...',
    status: 'loading',
    snapshots: 0,
  });
  const [projectedCost, setProjectedCost] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  useRealtime((event, payload) => {
    if (event === 'token.usage') {
      if (agentId && payload.agent_id !== agentId) return;
      
      setData(prev => ({
        ...prev,
        todayTokensIn: prev.todayTokensIn + (payload.tokens_in || 0),
        todayTokensOut: prev.todayTokensOut + (payload.tokens_out || 0),
        todayTokens: prev.todayTokens + (payload.total_tokens || 0),
        todayCost: prev.todayCost + (payload.estimated_cost || 0),
        model: payload.model || prev.model,
        status: 'ok'
      }));
      setLastUpdated(new Date().toLocaleTimeString());
    }
  });

  const fetchData = useCallback(async () => {
    try {
      const url = agentId ? `/api/tokens?agent_id=${encodeURIComponent(agentId)}` : '/api/tokens';
      const res = await fetch(url);
      const json = await res.json();

      // Compute 24h cost projection from history + today's partial spend
      const history = json.history || [];
      const today = json.today;
      if (history.length >= 1 || today) {
        const costs = history.map(d => d.estimatedCost || 0).filter(c => c > 0);
        if (costs.length > 0) {
          const avgDailyCost = costs.reduce((a, b) => a + b, 0) / costs.length;
          const now = new Date();
          const hoursElapsed = now.getHours() + now.getMinutes() / 60;
          const todayCost = today?.estimatedCost || 0;
          const todayExtrapolated = hoursElapsed > 1 ? (todayCost / hoursElapsed) * 24 : avgDailyCost;
          const projected = hoursElapsed > 1
            ? todayExtrapolated * 0.6 + avgDailyCost * 0.4
            : avgDailyCost;
          setProjectedCost(projected);
        } else {
          setProjectedCost(null);
        }
      } else {
        setProjectedCost(null);
      }

      const current = json.current;
      const todayData = json.today;

      if (current || todayData) {
        setData({
          todayTokensIn: todayData?.tokensIn || 0,
          todayTokensOut: todayData?.tokensOut || 0,
          todayTokens: todayData?.totalTokens || 0,
          todayCost: todayData?.estimatedCost || 0,
          compactions: current?.compactions || 0,
          model: current?.model || 'unknown',
          snapshots: todayData?.snapshots || 0,
          status: 'ok',
        });
        setLastUpdated(new Date(current?.updatedAt || Date.now()).toLocaleTimeString());
      } else {
        setData(prev => ({ ...prev, status: 'no-data' }));
        setLastUpdated('No data yet');
      }
    } catch (error) {
      console.error('Failed to fetch token data:', error);
      setData(prev => ({ ...prev, status: 'error' }));
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCost = (cost) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  if (data.status === 'loading') {
    return <CardSkeleton />;
  }

  const viewAllLink = (
    <Link href="/tokens" className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1">
      Details <ArrowRight size={12} />
    </Link>
  );

  const getStatusBadge = () => {
    if (data.status === 'error') return <Badge variant="default" size="sm">Error</Badge>;
    if (data.status === 'no-data') return <Badge variant="default" size="sm">Awaiting Data</Badge>;
    return null;
  };

  return (
    <Card className="h-full">
      <CardHeader title={<span className="flex items-center">Token Usage<HelpIcon sectionKey="token-budget" tip={HELP_TIPS['token-budget']} /></span>} icon={Gauge} action={viewAllLink}>
        {getStatusBadge()}
      </CardHeader>

      <CardContent className="space-y-4">
        {data.status === 'no-data' ? (
          <EmptyState
            icon={Gauge}
            title="No token data reported yet"
            description="Use the SDK's reportTokenUsage() or POST /api/tokens to report usage"
          />
        ) : (
          <>
            {/* Compact stat row */}
            <div className="bg-surface-tertiary rounded-lg px-3 py-2.5">
              <div className="grid grid-cols-3 gap-2">
                <StatCompact label="Today" value={formatTokens(data.todayTokens)} color="text-white" />
                <StatCompact label="Cost" value={formatCost(data.todayCost)} color="text-success" />
                <StatCompact label="Compacts" value={data.compactions} color="text-secondary" />
              </div>
            </div>

            {/* Token In / Out Breakdown */}
            <div className="flex gap-3">
              <div className="flex-1 bg-surface-tertiary rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowDown size={11} className="text-success" />
                  <span className="text-[10px] text-tertiary uppercase tracking-wider">Input</span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-success">
                  {formatTokens(data.todayTokensIn)}
                </div>
              </div>
              <div className="flex-1 bg-surface-tertiary rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowUp size={11} className="text-info" />
                  <span className="text-[10px] text-tertiary uppercase tracking-wider">Output</span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-info">
                  {formatTokens(data.todayTokensOut)}
                </div>
              </div>
            </div>

            {/* Cost Projection */}
            {projectedCost !== null && (
              <div className="bg-surface-tertiary rounded-lg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={11} className="text-tertiary" />
                    <span className="text-[10px] text-tertiary uppercase tracking-wider">24h Projected</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${projectedCost > data.todayCost * 2 ? 'text-warning' : 'text-secondary'}`}>
                    {formatCost(projectedCost)}
                  </span>
                </div>
              </div>
            )}

            {/* Model + Last Updated */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Cpu size={11} className="text-disabled" />
                <span className="font-mono text-xs text-tertiary">{data.model}</span>
              </div>
              {lastUpdated && (
                <span className="text-xs text-disabled">{lastUpdated}</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
