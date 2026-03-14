'use client';

import { useState, useEffect, useCallback } from 'react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useRealtime } from '../hooks/useRealtime';
import { 
  Activity, Zap, Shield, Clock, Search, Terminal,
  ChevronRight, Box, Cpu, AlertTriangle, CheckCircle2,
  Info, KeyRound, Settings, Webhook, UsersRound
} from 'lucide-react';
import { getAgentColor } from '../lib/colors';

const categoryIconMap = {
  decision: Zap,
  guard: Shield,
  audit: Terminal,
  signal: AlertTriangle,
};

export default function GlobalActivityFeed() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchInitialData = useCallback(async () => {
    try {
      // Pull recent data from multiple sources to seed the activity feed
      const [actionsRes, guardRes, auditRes] = await Promise.all([
        fetch('/api/actions?limit=15'),
        fetch('/api/guard?limit=15'),
        fetch('/api/activity?limit=10')
      ]);

      const actions = (await actionsRes.json()).actions || [];
      const guards = (await guardRes.json()).evaluations || [];
      const audits = (await auditRes.json()).logs || [];

      // Normalize into unified event format
      const normalized = [
        ...actions.map(a => ({
          id: `act-${a.action_id}`,
          timestamp: a.timestamp_start,
          category: 'decision',
          label: a.status === 'completed' ? 'Decision Finalized' : 'Intent Declared',
          actor: a.agent_name || a.agent_id,
          actorId: a.agent_id,
          detail: a.declared_goal,
          status: a.status,
          link: `/decisions/${a.action_id}`
        })),
        ...guards.map(g => ({
          id: `grd-${g.id}`,
          timestamp: g.created_at,
          category: 'guard',
          label: 'Policy Evaluation',
          actor: g.agent_name || g.agent_id,
          actorId: g.agent_id,
          detail: `${g.decision.toUpperCase()}: ${g.reason}`,
          status: g.decision,
          link: `/decisions` // Guard doesn't have deep detail yet
        })),
        ...audits.map(l => ({
          id: `aud-${l.id}`,
          timestamp: l.created_at,
          category: 'audit',
          label: 'System Event',
          actor: l.actor_name || 'System',
          actorId: l.actor_id,
          detail: `${l.action.replace(/\./g, ' ')}`,
          status: 'info',
          link: `/audit-log`
        }))
      ];

      // Sort by time
      normalized.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEvents(normalized.slice(0, 50));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to seed activity feed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle real-time updates
  useRealtime((event, payload) => {
    let newEvt = null;

    if (event === 'decision.created' || event === 'action.created') {
      newEvt = {
        id: `act-${payload.action_id}-${Date.now()}`,
        timestamp: payload.timestamp_start || new Date().toISOString(),
        category: 'decision',
        label: 'Intent Declared',
        actor: payload.agent_name || payload.agent_id,
        actorId: payload.agent_id,
        detail: payload.declared_goal,
        status: 'running',
        link: `/decisions`
      };
    } else if (event === 'guard.decision.created') {
      newEvt = {
        id: `grd-${payload.id}-${Date.now()}`,
        timestamp: payload.created_at || new Date().toISOString(),
        category: 'guard',
        label: 'Policy Evaluation',
        actor: payload.agent_name || payload.agent_id,
        actorId: payload.agent_id,
        detail: `${payload.decision.toUpperCase()}: ${payload.reason}`,
        status: payload.decision,
        link: `/decisions`
      };
    }

    if (newEvt) {
      setEvents(prev => [newEvt, ...prev].slice(0, 50));
      setLastUpdated(new Date().toLocaleTimeString());
    }
  });

  const getStatusColor = (category, status) => {
    if (category === 'guard') {
      if (status === 'block') return 'text-red-400 bg-red-400/10 border-red-400/20';
      if (status === 'warn') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      if (status === 'require_approval') return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    }
    if (status === 'completed' || status === 'success') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (status === 'failed' || status === 'error') return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (status === 'running' || status === 'pending') return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';
  };

  const formatTime = (ts) => {
    try {
      const date = new Date(ts);
      return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return '--'; }
  };

  return (
    <PageLayout
      title="Activity Stream"
      subtitle={`Real-time operational telemetry across decisions, governance, and system events \u00B7 Updated ${lastUpdated}`}
      breadcrumbs={['Command', 'Activity']}
    >
      <div className="max-w-4xl mx-auto">
        <Card hover={false}>
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-medium text-white uppercase tracking-wider">Live Feed</h2>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">RETENTION: 50 EVENTS</div>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="p-12">
                <EmptyState icon={Activity} title="No activity recorded" description="Waiting for agent actions or system events..." />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {events.map((evt) => {
                  const Icon = categoryIconMap[evt.category] || Activity;
                  return (
                    <div key={evt.id} className="group p-4 hover:bg-white/[0.01] transition-colors relative">
                      <div className="flex items-start gap-4">
                        {/* Time & Icon */}
                        <div className="flex flex-col items-center gap-2 min-w-[60px] pt-1">
                          <span className="text-[10px] text-zinc-600 font-mono">{formatTime(evt.timestamp)}</span>
                          <div className={`p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] group-hover:border-white/[0.1] transition-colors`}>
                            <Icon size={14} className="text-zinc-400" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">{evt.label}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${getAgentColor(evt.actorId)}`}>
                              {evt.actor}
                            </span>
                          </div>
                          <div className="text-sm text-zinc-200 line-clamp-2 leading-relaxed">
                            {evt.detail}
                          </div>
                        </div>

                        {/* Status & Action */}
                        <div className="flex flex-col items-end gap-3 pt-1">
                          <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border ${getStatusColor(evt.category, evt.status)}`}>
                            {evt.status}
                          </div>
                          {evt.link && (
                            <a 
                              href={evt.link}
                              className="text-[10px] text-zinc-600 hover:text-brand flex items-center gap-1 transition-colors uppercase font-bold tracking-tighter"
                            >
                              Details <ChevronRight size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

