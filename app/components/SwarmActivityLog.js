'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap, MessageSquare, Shield, Activity, Eye, EyeOff,
  Terminal, Target, AlertTriangle, XCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useRealtime } from '../hooks/useRealtime';
import { getAgentColor } from '../lib/colors';
import {
  buildActionEvent,
  buildGuardEvent,
  buildLoopEvent,
  collapseRoutineTelemetry,
} from '../lib/missionControl';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function toLogEntry(item) {
  if (item.kind === 'message') return item;

  const source = item.category === 'governance'
    ? 'guard'
    : item.category === 'intervention'
      ? 'loop'
      : item.category === 'telemetry'
        ? 'telemetry'
        : 'action';

  return {
    id: item.id,
    kind: source,
    agentId: item.agentId,
    text:
      source === 'guard'
        ? `${item.statusLabel}: ${item.outputSummary || item.actionType || item.title}`
        : source === 'loop'
          ? `${item.title}${item.goal ? ` -> ${item.goal}` : ''}`
          : `${item.title}${item.outputSummary ? ` -> ${item.outputSummary}` : ''}`,
    timestamp: item.timestamp,
    lowSignal: item.lowSignal,
    count: item.count || 1,
    status: item.status,
  };
}

export default function SwarmActivityLog() {
  const { agentId } = useAgentFilter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(false);

  useEffect(() => {
    async function fetchInitial() {
      try {
        const agentParam = agentId ? `agent_id=${encodeURIComponent(agentId)}` : '';
        const withPrefix = (base, extra = []) => {
          const params = [...extra];
          if (agentParam) params.push(agentParam);
          return `${base}${params.length ? `?${params.join('&')}` : ''}`;
        };

        const [actionsRes, msgsRes, guardRes, loopsRes] = await Promise.all([
          fetch(withPrefix('/api/actions', ['limit=12'])),
          fetch(withPrefix('/api/messages', ['limit=10'])),
          fetch(withPrefix('/api/guard', ['limit=10'])),
          fetch(withPrefix('/api/actions/loops', ['limit=8'])),
        ]);

        const merged = [];

        if (actionsRes.ok) {
          const d = await actionsRes.json();
          merged.push(...(d.actions || []).map(buildActionEvent).map(toLogEntry));
        }

        if (msgsRes.ok) {
          const d = await msgsRes.json();
          merged.push(...(d.messages || []).map((message) => ({
            id: `message:${message.id}`,
            kind: 'message',
            agentId: message.from_agent_id,
            text: `Message: ${message.subject || message.body?.substring(0, 48) || 'No subject'}`,
            timestamp: message.created_at,
            lowSignal: false,
            status: null,
          })));
        }

        if (guardRes.ok) {
          const d = await guardRes.json();
          merged.push(...(d.decisions || []).map(buildGuardEvent).map(toLogEntry));
        }

        if (loopsRes.ok) {
          const d = await loopsRes.json();
          merged.push(...(d.loops || []).map(buildLoopEvent).map(toLogEntry));
        }

        const collapsed = collapseRoutineTelemetry(
          merged.map((item) => item.kind === 'message' ? { ...item, category: 'message', emphasis: 48 } : item)
        ).map((item) => item.kind ? item : toLogEntry(item));

        setLogs(collapsed.slice(0, 50));
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, [agentId]);

  useRealtime(useCallback((event, payload) => {
    let newEntry = null;

    if (event === 'action.created' || event === 'action.updated') {
      const action = payload.action || payload;
      if (agentId && action.agent_id !== agentId) return;
      newEntry = toLogEntry(buildActionEvent(action));
    } else if (event === 'message.created') {
      const msg = payload.message || payload;
      if (agentId && msg.from_agent_id !== agentId && msg.to_agent_id !== agentId) return;
      newEntry = {
        id: `message:${msg.id}`,
        kind: 'message',
        agentId: msg.from_agent_id,
        text: `Message: ${msg.subject || msg.body?.substring(0, 48) || 'No subject'}`,
        timestamp: msg.created_at,
        lowSignal: false,
        status: null,
      };
    } else if (event === 'guard.decision.created') {
      const guard = payload.guardDecision || payload.decision || payload;
      if (agentId && guard.agent_id !== agentId) return;
      newEntry = toLogEntry(buildGuardEvent(guard));
    } else if (event === 'loop.created' || event === 'loop.updated') {
      const loop = payload.loop || payload;
      if (agentId && loop.agent_id !== agentId) return;
      newEntry = toLogEntry(buildLoopEvent(loop));
    } else if (event === 'goal.created' || event === 'goal.updated') {
      const goal = payload.goal || payload;
      if (agentId && goal.agent_id !== agentId) return;
      newEntry = {
        id: `goal:${goal.id}`,
        kind: 'goal',
        agentId: goal.agent_id,
        text: `${event === 'goal.created' ? 'Goal opened' : 'Goal updated'}: ${goal.title}${goal.progress != null ? ` (${goal.progress}%)` : ''}`,
        timestamp: goal.created_at || new Date().toISOString(),
        lowSignal: false,
        status: goal.status,
      };
    }

    if (!newEntry) return;

    setLogs((prev) => {
      const merged = [newEntry, ...prev.filter((item) => item.id !== newEntry.id)].slice(0, 60);
      const collapsed = collapseRoutineTelemetry(
        merged.map((item) => item.kind === 'message' || item.kind === 'goal'
          ? { ...item, category: item.kind, emphasis: 42 }
          : item)
      ).map((item) => item.kind ? item : toLogEntry(item));

      return collapsed.slice(0, 50);
    });
  }, [agentId]));

  const visibleLogs = showTelemetry ? logs : logs.filter((log) => !log.lowSignal);
  const telemetryCount = logs.filter((log) => log.lowSignal).reduce((sum, log) => sum + (log.count || 1), 0);

  return (
    <Card className="h-full flex flex-col overflow-hidden border-brand/10">
      <CardHeader title="Mission Feed" icon={Terminal} className="bg-brand/5">
        <div className="flex items-center gap-2">
          <Badge variant="brand" size="xs">Live</Badge>
          {telemetryCount > 0 && (
            <button
              type="button"
              onClick={() => setShowTelemetry((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-400 transition-colors hover:text-white"
            >
              {showTelemetry ? <EyeOff size={11} /> : <Eye size={11} />}
              {showTelemetry ? 'Hide telemetry' : `Show ${telemetryCount} telemetry`}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden bg-black/40 p-0 font-mono text-[11px]">
        <div className="h-full overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-zinc-800">
          {loading ? (
            <div className="flex h-full items-center justify-center text-zinc-600 animate-pulse">
              Initialising stream...
            </div>
          ) : visibleLogs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Awaiting governed activity"
              description="Policy interventions, active work, and meaningful outcomes will stream here first. Routine telemetry stays out of the way."
            />
          ) : (
            visibleLogs.map((log) => {
              const agentColor = getAgentColor(log.agentId);
              const Icon =
                log.kind === 'action' ? Zap :
                log.kind === 'message' ? MessageSquare :
                log.kind === 'goal' ? Target :
                log.kind === 'guard' ? Shield :
                log.kind === 'loop' ? AlertTriangle :
                Activity;
              const typeColor =
                log.kind === 'action' ? 'text-sky-400' :
                log.kind === 'message' ? 'text-purple-400' :
                log.kind === 'goal' ? 'text-emerald-400' :
                log.kind === 'guard' ? (log.status === 'block' ? 'text-red-400' : 'text-amber-400') :
                log.kind === 'loop' ? 'text-amber-400' :
                'text-zinc-500';

              return (
                <div key={log.id} className={`group flex items-start gap-3 border-b py-1.5 last:border-0 ${log.lowSignal ? 'border-white/[0.015]' : 'border-white/[0.03]'}`}>
                  <span className="shrink-0 tabular-nums text-zinc-600">[{formatTime(log.timestamp)}]</span>
                  <div className={`mt-0.5 shrink-0 ${typeColor}`}>
                    <Icon size={10} />
                  </div>
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className={`shrink-0 rounded border border-white/6 bg-[rgba(255,255,255,0.03)] px-1 text-[10px] ${agentColor}`}>
                      {log.agentId?.substring(0, 8) || 'system'}
                    </span>
                    <span className={`truncate transition-colors ${log.lowSignal ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-zinc-300 group-hover:text-white'}`}>
                      {log.text}
                    </span>
                    {log.count > 1 && (
                      <Badge variant="default" size="xs">{log.count}x</Badge>
                    )}
                    {log.kind === 'guard' && log.status === 'block' && (
                      <XCircle size={10} className="mt-0.5 shrink-0 text-red-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
