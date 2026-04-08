'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldAlert, ShieldCheck, Activity } from 'lucide-react';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useRealtime } from '../hooks/useRealtime';

// POSTURE LOGIC: Standardized across the platform
export function computePosture(redCount, amberCount) {
  if (redCount >= 1) return { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', pulse: true };
  if (amberCount >= 1) return { label: 'ELEVATED', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', pulse: true };
  return { label: 'NOMINAL', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pulse: false };
}

export default function SystemStatusBar() {
  const { agentId } = useAgentFilter();
  const [signals, setSignals] = useState(null);

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/actions/signals${agentId ? `?agent_id=${agentId}` : ''}`);
      if (!res.ok) return;
      const data = await res.json();
      setSignals(data.signals || []);
    } catch {
      // Silently fail — bar just won't render
    }
  }, [agentId]);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  useRealtime(useCallback((event) => {
    if (event === 'signal.detected') {
      fetchSignals();
    }
  }, [fetchSignals]));

  // APPLY DISMISSAL FILTER (Consistency with Mission Control)
  const getSignalHash = (s) =>
    `${s.type || s.signal_type || ''}:${s.agent_id || ''}:${s.action_id || ''}:${s.loop_id || ''}:${s.assumption_id || ''}`;

  const activeSignals = useMemo(() => {
    if (!signals) return [];
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('dashclaw_dismissed_signals') : null;
      const dismissedSet = stored ? new Set(JSON.parse(stored)) : new Set();
      return signals.filter(s => !dismissedSet.has(getSignalHash(s)));
    } catch { return signals; }
  }, [signals]);

  if (!signals) return null;

  const redCount = activeSignals.filter(s => s.severity === 'red').length;
  const amberCount = activeSignals.filter(s => s.severity === 'amber').length;
  const totalCount = activeSignals.length;

  const state = computePosture(redCount, amberCount);

  return (
    <div className="flex items-center justify-between px-6 py-1.5 bg-surface-primary border-b border-[rgba(255,255,255,0.04)] text-xs">
      <div className="flex items-center gap-4">
        {/* System Posture Badge */}
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${state.bg} border ${state.border}`}>
          <Activity size={10} className={`${state.color} ${state.pulse ? 'animate-pulse' : ''}`} />
          <span className={`font-black tracking-widest text-[9px] ${state.color}`}>{state.label}</span>
        </div>

        {/* Signal Counts */}
        <div className="flex items-center gap-3 text-zinc-500">
          {redCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-400 font-medium">{redCount} Critical</span>
            </span>
          )}
          {amberCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-amber-400 font-medium">{amberCount} Amber</span>
            </span>
          )}
          {redCount === 0 && amberCount === 0 && (
            <span className="flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-500" />
              <span className="text-emerald-400 uppercase font-black text-[9px] tracking-widest">All clear</span>
            </span>
          )}
        </div>
      </div>

      {/* Total count */}
      <span className="text-zinc-600 tabular-nums font-medium">
        {totalCount} ACTIVE GOVERNANCE SIGNAL{totalCount !== 1 ? 'S' : ''}
      </span>
    </div>
  );
}
