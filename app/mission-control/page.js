'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, ShieldAlert, ShieldCheck, CircleDot, DollarSign,
  ArrowRight, TrendingUp, TrendingDown, Users, Clock, AlertTriangle,
  PlayCircle, CheckCircle2, Shield, Radar,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useRealtime } from '../hooks/useRealtime';
import ActivityTimeline from '../components/ActivityTimeline';
import SwarmActivityLog from '../components/SwarmActivityLog';
import { buildOperatorBrief, formatMissionStatus } from '../lib/missionControl';

function computeSystemState(redCount, amberCount) {
  if (redCount >= 2) return { label: 'ALERT', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', pulse: true };
  if (redCount === 1) return { label: 'ELEVATED', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', pulse: false };
  if (amberCount >= 3) return { label: 'DRIFTING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', pulse: false };
  if (amberCount > 0) return { label: 'REVIEWING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', pulse: false };
  return { label: 'STABLE', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: false };
}

function formatRelativeTime(ts) {
  if (!ts) return '--';
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatCost(cost) {
  if (!cost || cost === 0) return '$0.00';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

function BriefColumn({ title, icon: Icon, items, emptyLabel, href }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-zinc-400" />
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">{title}</div>
        </div>
        {href && (
          <Link href={href} className="text-[10px] text-zinc-500 transition-colors hover:text-white">
            Open
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-xs leading-5 text-zinc-500">{emptyLabel}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0 text-sm font-medium text-white">{item.title}</div>
                <Badge variant={['failed', 'block'].includes(item.status) ? 'error' : ['pending_approval', 'require_approval', 'warn', 'open', 'running'].includes(item.status) ? 'warning' : 'success'} size="xs">
                  {formatMissionStatus(item.status)}
                </Badge>
              </div>
              <div className="mb-1 text-xs text-zinc-500">
                {item.goal || item.actionType || item.agentName || 'System event'}
              </div>
              {item.outputSummary && (
                <div className="text-xs leading-5 text-zinc-400">{item.outputSummary}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MissionControlPage() {
  const { agentId, agents } = useAgentFilter();
  const [signals, setSignals] = useState(null);
  const [loops, setLoops] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [health, setHealth] = useState(null);
  const [actions, setActions] = useState([]);
  const [guardData, setGuardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const agentParam = agentId ? `agent_id=${encodeURIComponent(agentId)}` : '';
    const withParams = (base, extra = []) => {
      const params = [...extra];
      if (agentParam) params.push(agentParam);
      return `${base}${params.length ? `?${params.join('&')}` : ''}`;
    };

    try {
      const [signalsRes, loopsRes, tokensRes, healthRes, actionsRes, guardRes] = await Promise.all([
        fetch(withParams('/api/actions/signals')),
        fetch(withParams('/api/actions/loops', ['status=open', 'limit=5'])),
        fetch(withParams('/api/tokens')),
        fetch('/api/health'),
        fetch(withParams('/api/actions', ['limit=12'])),
        fetch(withParams('/api/guard', ['limit=10'])),
      ]);

      if (signalsRes.ok) setSignals(await signalsRes.json());
      if (loopsRes.ok) setLoops(await loopsRes.json());
      if (tokensRes.ok) setTokens(await tokensRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (actionsRes.ok) {
        const actionsJson = await actionsRes.json();
        setActions(actionsJson.actions || []);
      }
      if (guardRes.ok) setGuardData(await guardRes.json());
    } catch (error) {
      console.error('Mission Control fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useRealtime(useCallback((event, payload) => {
    if (['action.created', 'action.updated', 'loop.created', 'loop.updated', 'guard.decision.created', 'signal.detected'].includes(event)) {
      if (agentId) {
        const source = payload.action || payload.loop || payload.decision || payload;
        if (source.agent_id && source.agent_id !== agentId) return;
      }
      fetchAll();
    } else if (event === 'token.usage') {
      if (agentId && payload.agent_id !== agentId) return;
      setTokens((prev) => ({
        ...prev,
        today: {
          ...prev?.today,
          estimatedCost: (prev?.today?.estimatedCost || 0) + (payload.estimated_cost || 0),
        },
      }));
    }
  }, [agentId, fetchAll]));

  const signalCounts = signals?.counts || { red: 0, amber: 0, total: 0 };
  const systemState = computeSystemState(signalCounts.red, signalCounts.amber);

  const loopList = loops?.loops || [];
  const openLoopCount = loops?.total || loopList.length;
  const criticalLoops = loopList.filter((l) => l.priority === 'critical').length;
  const highLoops = loopList.filter((l) => l.priority === 'high').length;

  const todayCost = tokens?.today?.estimatedCost || 0;
  const history = tokens?.history || [];
  let projectedCost = null;
  let trendDirection = null;

  if (history.length >= 1) {
    const costs = history.map((d) => d.estimatedCost || 0).filter((c) => c > 0);
    if (costs.length > 0) {
      const avgDailyCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      const now = new Date();
      const hoursElapsed = now.getHours() + now.getMinutes() / 60;
      const todayExtrapolated = hoursElapsed > 1 ? (todayCost / hoursElapsed) * 24 : avgDailyCost;
      projectedCost = hoursElapsed > 1
        ? todayExtrapolated * 0.6 + avgDailyCost * 0.4
        : avgDailyCost;
      trendDirection = todayCost > avgDailyCost * 1.1 ? 'up' : todayCost < avgDailyCost * 0.9 ? 'down' : null;
    }
  }

  const healthStatus = health?.status || 'unknown';
  const healthColor = healthStatus === 'healthy' ? 'text-emerald-400' : healthStatus === 'degraded' ? 'text-amber-400' : 'text-zinc-500';
  const healthDot = healthStatus === 'healthy' ? 'bg-emerald-500' : healthStatus === 'degraded' ? 'bg-amber-500' : 'bg-zinc-500';
  const lastActivity = actions[0]?.timestamp_start || loopList[0]?.created_at || null;
  const fleetCount = agents.length;
  const brief = buildOperatorBrief({ actions, loops: loopList, guardDecisions: guardData?.decisions || [] });

  const actionButton = (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-4 py-2 text-sm text-brand transition-colors hover:bg-brand/20"
    >
      Operations View <ArrowRight size={14} />
    </Link>
  );

  return (
    <PageLayout
      title="Mission Control"
      subtitle="Operational clarity for agent decisions, interventions, and outcomes"
      breadcrumbs={['Mission Control']}
      actions={actionButton}
    >
      <div className="mb-6 rounded-2xl border border-[rgba(255,255,255,0.07)] bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.008))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant={systemState.label === 'STABLE' ? 'success' : systemState.label === 'REVIEWING' || systemState.label === 'DRIFTING' ? 'warning' : 'error'} size="sm">
            {loading ? 'Loading' : systemState.label}
          </Badge>
          <div className="text-sm text-zinc-300">
            DashClaw highlights the decisions that changed operator posture, not every background heartbeat.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <BriefColumn
            title="Needs Attention"
            icon={AlertTriangle}
            items={brief.needsAttention}
            emptyLabel="No blocked decisions, approval holds, or critical loops need operator action right now."
            href="/dashboard"
          />
          <BriefColumn
            title="Currently Running"
            icon={PlayCircle}
            items={brief.running}
            emptyLabel="No governed work is actively running or waiting on approval right now. New in-flight decisions will appear here."
            href="/actions"
          />
          <BriefColumn
            title="Recent Outcomes"
            icon={CheckCircle2}
            items={brief.recentOutcomes}
            emptyLabel="Completed and failed decisions will land here with their final outcome summaries."
            href="/actions"
          />
          <BriefColumn
            title="Interventions"
            icon={Shield}
            items={brief.interventions}
            emptyLabel="Approval requests, warnings, and open governance loops will appear here as soon as policy steps in."
            href="/security"
          />
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-surface-tertiary px-5 py-3">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${systemState.bg} ${systemState.border}`}>
              <Activity size={11} className={`${systemState.color} ${systemState.pulse ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-semibold tracking-wider ${systemState.color}`}>
                {loading ? '...' : systemState.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Users size={14} className="text-zinc-500" />
            <span className="tabular-nums text-sm font-medium text-white">{fleetCount}</span>
            <span className="text-xs text-zinc-500">agents</span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${healthDot}`} />
            <span className={`text-sm font-medium ${healthColor}`}>
              {loading ? '...' : healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'degraded' ? 'Degraded' : 'Unknown'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={14} className="text-zinc-500" />
            <span className="text-sm text-zinc-400">{loading ? '...' : formatRelativeTime(lastActivity)}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Risk Signals" icon={ShieldAlert}>
            <Link href="/security" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
              View all <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? <ListSkeleton rows={2} /> : (
              <div>
                <div className="mb-2 text-3xl font-bold text-white tabular-nums">{signalCounts.total}</div>
                <div className="flex items-center gap-3 text-xs">
                  {signalCounts.red > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span className="font-medium text-red-400">{signalCounts.red} critical</span>
                    </span>
                  )}
                  {signalCounts.amber > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="font-medium text-amber-400">{signalCounts.amber} amber</span>
                    </span>
                  )}
                  {signalCounts.red === 0 && signalCounts.amber === 0 && (
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span className="text-emerald-400">All clear</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Open Loops" icon={CircleDot}>
            <Link href="/dashboard" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
              View all <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? <ListSkeleton rows={3} /> : (
              <div>
                <div className="mb-2 text-3xl font-bold text-white tabular-nums">{openLoopCount}</div>
                <div className="mb-3 flex items-center gap-3 text-xs">
                  {criticalLoops > 0 && <span className="font-medium text-red-400">{criticalLoops} critical</span>}
                  {highLoops > 0 && <span className="font-medium text-amber-400">{highLoops} high</span>}
                  {criticalLoops === 0 && highLoops === 0 && openLoopCount > 0 && (
                    <span className="text-zinc-500">No critical/high</span>
                  )}
                </div>
                {loopList.slice(0, 3).map((loop) => (
                  <div key={loop.loop_id} className="mb-1 truncate text-xs text-zinc-400">
                    {loop.description || loop.loop_type || 'Unnamed loop'}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Cost Velocity" icon={DollarSign}>
            <Link href="/usage" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
              Details <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? <ListSkeleton rows={2} /> : (
              <div>
                <div className="mb-1 text-3xl font-bold text-white tabular-nums">{formatCost(todayCost)}</div>
                <div className="mb-3 text-[10px] uppercase tracking-wider text-zinc-500">Today&#39;s spend</div>
                {projectedCost !== null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">24h projection</span>
                    <span className="font-medium text-zinc-300 tabular-nums">{formatCost(projectedCost)}</span>
                  </div>
                )}
                {trendDirection && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                    {trendDirection === 'up' ? (
                      <TrendingUp size={12} className="text-amber-400" />
                    ) : (
                      <TrendingDown size={12} className="text-emerald-400" />
                    )}
                    <span className={trendDirection === 'up' ? 'text-amber-400' : 'text-emerald-400'}>
                      vs 7-day avg
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Fleet Status" icon={Radar}>
            <Link href="/swarm" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
              Manage <ArrowRight size={10} />
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? <ListSkeleton rows={4} /> : agents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No agents registered"
                description="Register an agent to turn Mission Control into a live decision ledger with approvals, loops, and outcomes."
              />
            ) : (
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
                {agents.slice(0, 8).map((agent) => (
                  <div key={agent.agent_id} className="flex items-center gap-2 py-1">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                    <span className="flex-1 truncate text-xs text-zinc-300">{agent.name || agent.agent_id}</span>
                    <span className="flex-shrink-0 text-[10px] text-zinc-600 tabular-nums">
                      {formatRelativeTime(agent.last_heartbeat || agent.created_at)}
                    </span>
                  </div>
                ))}
                {agents.length > 8 && (
                  <div className="pt-1 text-[10px] text-zinc-600">+{agents.length - 8} more</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid h-[640px] grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityTimeline />
        <SwarmActivityLog />
      </div>
    </PageLayout>
  );
}
