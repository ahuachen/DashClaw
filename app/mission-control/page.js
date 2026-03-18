'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity, ShieldAlert, ShieldCheck, DollarSign,
  ArrowRight, TrendingUp, TrendingDown, Users, Clock,
  CheckCircle2, AlertTriangle, Minus,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useRealtime } from '../hooks/useRealtime';
import { getAgentColor } from '../lib/colors';
import ActivityTimeline from '../components/ActivityTimeline';
import SwarmActivityLog from '../components/SwarmActivityLog';
import QuickStart from '../components/QuickStart';
import { isDemoMode } from '../lib/isDemoMode';
import { computePosture } from '../components/SystemStatusBar';

/* ---------- Helpers ---------- */

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

function truncateText(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '\u2026' : text;
}

/* ---------- Intervention merging ---------- */

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function buildInterventionList(pendingActions, openLoops) {
  const items = [];

  for (const action of pendingActions) {
    items.push({
      id: `approval:${action.action_id}`,
      kind: 'approval',
      agentId: action.agent_id,
      agentName: action.agent_name || action.agent_id,
      description: action.declared_goal || action.action_type || 'Pending action',
      href: '/approvals',
      sortKey: -1,
    });
  }

  for (const loop of openLoops) {
    const isRelevant = loop.loop_type === 'approval' || loop.priority === 'critical' || loop.priority === 'high';
    if (!isRelevant) continue;
    items.push({
      id: `loop:${loop.loop_id}`,
      kind: 'loop',
      agentId: loop.agent_id,
      agentName: loop.agent_name || loop.agent_id,
      description: loop.description || loop.loop_type || 'Open loop',
      href: '/dashboard',
      sortKey: PRIORITY_ORDER[loop.priority] ?? 2,
    });
  }

  items.sort((a, b) => a.sortKey - b.sortKey);
  return items;
}

/* ---------- Skeleton placeholders ---------- */

function CommandStripSkeleton() {
  return (
    <div className="mb-6 rounded-xl border border-border bg-surface-tertiary px-5 py-3">
      <div className="flex items-center gap-6">
        {[120, 80, 70, 100, 90].map((w, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-white/[0.04]" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function InterventionSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-3 w-28 animate-pulse rounded bg-white/[0.04]" />
      <div className="h-8 w-12 animate-pulse rounded bg-white/[0.04]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-4 w-16 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-4 w-14 animate-pulse rounded bg-white/[0.04]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.04]" />
        </div>
      ))}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
      <div className="h-8 w-16 animate-pulse rounded bg-white/[0.04]" />
      <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
    </div>
  );
}

/* ---------- Main page ---------- */

export default function MissionControlPage() {
  const { agentId, agents } = useAgentFilter();
  const [signals, setSignals] = useState(null);
  const [loops, setLoops] = useState(null);
  const [health, setHealth] = useState(null);
  const [actions, setActions] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [decisionMetrics, setDecisionMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('priority');
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(true);

  const isDemo = isDemoMode();

  const fetchAll = useCallback(async () => {
    const agentParam = agentId ? `agent_id=${encodeURIComponent(agentId)}` : '';
    const withParams = (base, extra = []) => {
      const params = [...extra];
      if (agentParam) params.push(agentParam);
      return `${base}${params.length ? `?${params.join('&')}` : ''}`;
    };

    try {
      const [signalsRes, loopsRes, healthRes, actionsRes, pendingRes, metricsRes] = await Promise.all([
        fetch(withParams('/api/actions/signals')),
        fetch(withParams('/api/actions/loops', ['status=open', 'limit=20'])),
        fetch('/api/health'),
        fetch(withParams('/api/actions', ['limit=12'])),
        fetch(withParams('/api/actions', ['status=pending_approval', 'limit=10'])),
        fetch(withParams('/api/actions/stats')),
      ]);

      if (signalsRes.ok) setSignals(await signalsRes.json());
      if (loopsRes.ok) setLoops(await loopsRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      if (metricsRes.ok) setDecisionMetrics(await metricsRes.json());
      if (actionsRes.ok) {
        const actionsJson = await actionsRes.json();
        setActions(actionsJson.actions || []);
      }
      if (pendingRes.ok) {
        const pendingJson = await pendingRes.json();
        setPendingActions(pendingJson.actions || []);
      }
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
    }
  }, [agentId, fetchAll]));

  /* ---------- Derived state ---------- */

  // Apply the same client-side dismissal filter used by the Security page.
  // Dismissed signal hashes are stored in localStorage under 'dashclaw_dismissed_signals'.
  const getSignalHash = (s) =>
    `${s.type || s.signal_type || ''}:${s.agent_id || ''}:${s.action_id || ''}:${s.loop_id || ''}:${s.assumption_id || ''}`;

  const dismissedSet = useMemo(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('dashclaw_dismissed_signals');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  // Re-evaluate whenever signals change so a dismiss in another tab eventually syncs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals]);

  const activeSignalList = useMemo(() => {
    const list = signals?.signals || [];
    return list.filter(s => !dismissedSet.has(getSignalHash(s)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, dismissedSet]);

  const signalCounts = {
    red: activeSignalList.filter(s => s.severity === 'red').length,
    amber: activeSignalList.filter(s => s.severity === 'amber').length,
    total: activeSignalList.length,
  };
  const posture = computePosture(signalCounts.red, signalCounts.amber);

  const loopList = useMemo(() => loops?.loops || [], [loops]);

  const healthStatus = health?.status || 'unknown';
  const healthDot = healthStatus === 'healthy' ? 'bg-emerald-500' : healthStatus === 'degraded' ? 'bg-amber-500' : 'bg-zinc-500';
  const healthLabel = healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'degraded' ? 'Degraded' : 'Unknown';
  const healthColor = healthStatus === 'healthy' ? 'text-emerald-400' : healthStatus === 'degraded' ? 'text-amber-400' : 'text-zinc-500';

  const lastActivity = actions[0]?.timestamp_start || loopList[0]?.created_at || null;
  const fleetCount = agents.length;

  // Intervention card data
  const interventions = useMemo(
    () => buildInterventionList(pendingActions, loopList),
    [pendingActions, loopList]
  );
  const hasPendingApprovals = pendingActions.length > 0;
  const interventionBorder = hasPendingApprovals
    ? 'border-l-red-500'
    : interventions.length > 0
      ? 'border-l-amber-500'
      : 'border-l-emerald-500/30';

  // Fleet: identify degraded agents by cross-referencing loops + recent actions
  const criticalAgentIds = useMemo(() => {
    const ids = new Set();
    for (const loop of loopList) {
      if (loop.priority === 'critical' && loop.agent_id) ids.add(loop.agent_id);
    }
    return ids;
  }, [loopList]);

  const failedAgentIds = useMemo(() => {
    const ids = new Set();
    const seen = new Set();
    for (const action of actions) {
      if (!action.agent_id || seen.has(action.agent_id)) continue;
      seen.add(action.agent_id);
      if (action.status === 'failed' || action.status === 'blocked') {
        ids.add(action.agent_id);
      }
    }
    return ids;
  }, [actions]);

  const sortedAgents = useMemo(() => {
    return [...agents].sort((a, b) => {
      const aDegraded = criticalAgentIds.has(a.agent_id) || failedAgentIds.has(a.agent_id) || a.status === 'degraded' || a.status === 'blocked';
      const bDegraded = criticalAgentIds.has(b.agent_id) || failedAgentIds.has(b.agent_id) || b.status === 'degraded' || b.status === 'blocked';
      if (aDegraded && !bDegraded) return -1;
      if (!aDegraded && bDegraded) return 1;
      return 0;
    });
  }, [agents, criticalAgentIds, failedAgentIds]);

  const actionButton = (
    <Link
      href="/decisions"
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-4 py-2 text-sm text-brand transition-colors hover:bg-brand/20"
    >
      View Decisions <ArrowRight size={14} />
    </Link>
  );

  return (
    <PageLayout
      title="Mission Control"
      subtitle="Fleet posture, interventions, and decision intelligence"
      breadcrumbs={['Mission Control']}
      actions={actionButton}
    >
      {/* ═══ Activation: Quick Start (Only if no agents or in demo mode for review) ═══ */}
      {!loading && (agents.length === 0 || isDemo) && showQuickStart && (
        <QuickStart onDismiss={() => setShowQuickStart(false)} />
      )}

      {/* ═══ BAND 1: Command Strip ═══ */}
      {loading ? <CommandStripSkeleton /> : (
        <div className="mb-6 rounded-xl border border-border bg-surface-tertiary px-5 py-3">
          <div className="flex flex-wrap items-center gap-y-2 divide-x divide-border/50">
            {/* System Posture */}
            <div className="flex items-center gap-2 pr-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Posture</span>
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${posture.bg} ${posture.border}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${posture.color.replace('text-', 'bg-')} ${posture.pulse ? 'animate-pulse' : ''}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${posture.color}`}>
                  {posture.label}
                </span>
              </div>
            </div>

            {/* Fleet count */}
            <div className="flex items-center gap-2 px-5">
              <Users size={14} className="text-zinc-500" />
              <span className="text-sm font-medium tabular-nums text-white">{fleetCount}</span>
              <span className="text-xs text-zinc-500">agents</span>
            </div>

            {/* DB Health */}
            <div className="flex items-center gap-2 px-5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">DB Health</span>
              <span className={`h-2 w-2 rounded-full ${healthDot}`} />
              <span className={`text-sm font-medium ${healthColor}`}>{healthLabel}</span>
            </div>

            {/* Active interventions */}
            <div className="flex items-center gap-2 px-5">
              <Activity size={14} className="text-zinc-500" />
              <span className="text-sm font-medium tabular-nums text-white">{interventions.length}</span>
              <span className="text-xs text-zinc-500">{interventions.length === 1 ? 'intervention' : 'interventions'}</span>
            </div>

            {/* Last activity */}
            <div className="flex items-center gap-2 pl-5">
              <Clock size={14} className="text-zinc-500" />
              <span className="text-sm text-zinc-400">{formatRelativeTime(lastActivity)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BAND 2: Signal Quadrants ═══ */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 — Intervention Required */}
        <Card className={`border-l-4 ${interventionBorder} !bg-surface-secondary`} hover={false}>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Intervention Required</span>
              {interventions.length > 0 && (
                <Link href="/approvals" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
                  Queue <ArrowRight size={10} />
                </Link>
              )}
            </div>
            {loading ? <InterventionSkeleton /> : interventions.length === 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500/60" />
                <span className="text-sm text-zinc-400">No action required</span>
              </div>
            ) : (
              <>
                <div className="mb-3 text-3xl font-bold tabular-nums text-white">{interventions.length}</div>
                <div className="space-y-1">
                  {interventions.slice(0, 4).map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-white/5"
                    >
                      <Badge
                        variant={item.kind === 'approval' ? 'error' : 'warning'}
                        size="xs"
                      >
                        {item.kind === 'approval' ? 'Approval' : 'Loop'}
                      </Badge>
                      <span className={`max-w-[72px] shrink-0 truncate rounded border px-1 py-0.5 text-[10px] ${getAgentColor(item.agentId)}`}>
                        {(item.agentName || '').substring(0, 12) || item.agentId?.substring(0, 8) || 'system'}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-zinc-300">
                        {truncateText(item.description, 60)}
                      </span>
                      <ArrowRight size={10} className="shrink-0 text-zinc-600" />
                    </Link>
                  ))}
                  {interventions.length > 4 && (
                    <Link href="/approvals" className="block px-2 text-[10px] text-brand transition-colors hover:text-brand-hover">
                      +{interventions.length - 4} more
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Card 2 — Risk Signals */}
        <Card>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Risk Signals</span>
              <Link href="/security" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
                View <ArrowRight size={10} />
              </Link>
            </div>
            {loading ? <MetricSkeleton /> : signalCounts.total === 0 ? (
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500/60" />
                <span className="text-sm text-zinc-400">No signals</span>
              </div>
            ) : (
              <>
                <div className="mb-2 text-3xl font-bold tabular-nums text-white">{signalCounts.total}</div>
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
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Card 4 — Fleet Status */}
        <Card>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Fleet Status</span>
              <Link href="/agents" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
                Manage <ArrowRight size={10} />
              </Link>
            </div>
            {loading ? <MetricSkeleton /> : agents.length === 0 ? (
              <div className="text-sm text-zinc-500">No agents connected</div>
            ) : (
              <div className="space-y-1.5">
                {sortedAgents.slice(0, 5).map((agent) => {
                  const isCritical = criticalAgentIds.has(agent.agent_id);
                  const isDegraded = isCritical || failedAgentIds.has(agent.agent_id) || agent.status === 'degraded' || agent.status === 'blocked';
                  return (
                    <Link
                      key={agent.agent_id}
                      href={`/agents/${encodeURIComponent(agent.agent_id)}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/5"
                    >
                      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isDegraded ? 'bg-amber-500' : 'bg-emerald-500/40'}`} />
                      <span className={`flex-1 truncate text-xs ${isDegraded ? 'text-amber-300' : 'text-zinc-500'}`}>
                        {agent.name || agent.agent_id}
                      </span>
                      {isCritical && <AlertTriangle size={10} className="shrink-0 text-red-400" />}
                    </Link>
                  );
                })}
                {agents.length > 5 && (
                  <Link href="/agents" className="block px-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-400">
                    +{agents.length - 5} more
                  </Link>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Card 4 — Decisions (24h) */}
        <Card>
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Decisions (24h)</span>
              <Link href="/decisions" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
                History <ArrowRight size={10} />
              </Link>
            </div>
            {loading || !decisionMetrics ? <MetricSkeleton /> : (
              <>
                <div className="mb-1 flex items-baseline gap-2">
                  <div className="text-3xl font-bold tabular-nums text-white">{decisionMetrics.total}</div>
                  <div className={`flex items-center gap-0.5 text-xs font-medium ${decisionMetrics.change_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {decisionMetrics.change_percent >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {decisionMetrics.change_percent >= 0 ? '+' : ''}{decisionMetrics.change_percent}%
                  </div>
                </div>
                <div className="mb-4 text-xs text-zinc-500">vs yesterday</div>
                
                <div className="grid grid-cols-2 gap-y-3">
                  <div className="flex items-center justify-between pr-4">
                    <span className="text-xs text-zinc-500">Completed</span>
                    <span className="text-xs font-semibold text-emerald-400">{decisionMetrics.completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Failed</span>
                    <span className="text-xs font-semibold text-red-400">{decisionMetrics.failed}</span>
                  </div>
                  <div className="flex items-center justify-between pr-4 border-t border-white/[0.03] pt-3">
                    <span className="text-xs text-zinc-500">Cancelled</span>
                    <span className="text-xs font-semibold text-amber-400">{decisionMetrics.cancelled}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/[0.03] pt-3">
                    <span className="text-xs text-zinc-500">Approval</span>
                    <span className="text-xs font-semibold text-brand">{decisionMetrics.approval}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ═══ BAND 3: Activity Split (60/40) ═══ */}
      <div className="grid h-[640px] grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Decision Timeline (60%) */}
        <div className="lg:col-span-3">
          <ActivityTimeline
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            showTelemetry={showTelemetry}
            onToggleTelemetry={() => setShowTelemetry((prev) => !prev)}
          />
        </div>

        {/* Mission Feed (40%) */}
        <div className="lg:col-span-2">
          <SwarmActivityLog
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            showTelemetry={showTelemetry}
            onToggleTelemetry={() => setShowTelemetry((prev) => !prev)}
          />
        </div>
      </div>
    </PageLayout>
  );
}

