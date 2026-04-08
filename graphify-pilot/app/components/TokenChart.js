'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TrendingUp, BarChart3, ArrowRight } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Card, CardHeader, CardContent } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { CardSkeleton } from './ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { HelpIcon } from './HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const tokens = payload[0]?.value || 0;
    const cost = payload[0]?.payload?.cost || 0;

    return (
      <div className="bg-surface-elevated border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm shadow-lg">
        <p className="text-white font-medium">{label}</p>
        <p className="text-zinc-400 mt-0.5">Tokens: <span className="text-white tabular-nums">{tokens.toLocaleString()}</span></p>
        <p className="text-zinc-500 mt-0.5">Cost: <span className="text-zinc-300 tabular-nums">${cost.toFixed(4)}</span></p>
      </div>
    );
  }
  return null;
}

export default function TokenChart() {
  const { agentId } = useAgentFilter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTokens = useCallback(async () => {
    try {
      const url = agentId ? `/api/tokens?agent_id=${encodeURIComponent(agentId)}` : '/api/tokens';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();

      if (json.history && json.history.length > 0) {
        const points = [...json.history].reverse().map(day => {
          const d = new Date(day.date);
          return {
            date: d.toLocaleDateString('en-US', { weekday: 'short' }),
            tokens: day.totalTokens || (day.tokensIn + day.tokensOut),
            cost: day.estimatedCost || 0
          };
        });
        setData(points);
      } else {
        setData([]);
      }
    } catch (error) {
      console.error('Failed to fetch token data:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    setLoading(true);
    fetchTokens();
  }, [fetchTokens]);

  if (loading) {
    return <CardSkeleton />;
  }

  if (data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader title={<span className="flex items-center">Token Usage (7 Days)<HelpIcon sectionKey="token-budget" tip={HELP_TIPS['token-budget']} /></span>} icon={TrendingUp} />
        <CardContent>
          <EmptyState
            icon={BarChart3}
            title="No token usage data yet"
            description="Report token usage via the SDK's reportTokenUsage() or POST /api/tokens"
          />
        </CardContent>
      </Card>
    );
  }

  const viewAllLink = (
    <Link href="/usage" className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1">
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card className="h-full">
      <CardHeader title={<span className="flex items-center">Token Usage (7 Days)<HelpIcon sectionKey="token-budget" tip={HELP_TIPS['token-budget']} /></span>} icon={TrendingUp} action={viewAllLink} />

      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="date"
                stroke="#71717a"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#71717a"
                fontSize={12}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#tokenGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-center mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-brand rounded-full" />
            <span className="text-zinc-400">Daily Usage</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
