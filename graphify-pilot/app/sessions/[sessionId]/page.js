'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Circle, CheckCircle, Play, PauseCircle,
  Flag, XCircle, AlertTriangle, RotateCw,
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';

function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const statusBadge = {
  spawning: 'bg-zinc-500/20 text-zinc-400',
  ready: 'bg-blue-500/20 text-blue-400',
  running: 'bg-emerald-500/20 text-emerald-400',
  blocked: 'bg-amber-500/20 text-amber-400',
  finished: 'bg-zinc-500/20 text-zinc-400',
  failed: 'bg-red-500/20 text-red-400',
};

const eventIcons = {
  spawning: Circle,
  ready: CheckCircle,
  running: Play,
  blocked: PauseCircle,
  finished: Flag,
  failed: XCircle,
};

export default function SessionDetailPage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [sessionRes, eventsRes] = await Promise.all([
        fetch(`/api/sessions/${sessionId}`),
        fetch(`/api/sessions/${sessionId}/events`),
      ]);

      if (sessionRes.ok) {
        const sData = await sessionRes.json();
        setSession(sData.session || null);
      }
      if (eventsRes.ok) {
        const eData = await eventsRes.json();
        setEvents(eData.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch session detail:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <PageLayout
        title="Loading..."
        subtitle={sessionId}
        breadcrumbs={['Observe', 'Sessions', sessionId]}
      >
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </PageLayout>
    );
  }

  if (!session) {
    return (
      <PageLayout
        title="Session Not Found"
        subtitle={sessionId}
        breadcrumbs={['Observe', 'Sessions', sessionId]}
      >
        <div className="text-center py-12">
          <div className="text-sm text-zinc-400">This session does not exist or you don&apos;t have access.</div>
          <Link href="/sessions" className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 transition-colors mt-4">
            <ArrowLeft size={14} /> Back to Sessions
          </Link>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={session.agent_id}
      subtitle={session.id}
      breadcrumbs={['Observe', 'Sessions', session.agent_id]}
      actions={
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
        >
          <RotateCw size={14} />
          Refresh
        </button>
      }
    >
      {/* Back link */}
      <div className="mb-6">
        <Link href="/sessions" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to Sessions
        </Link>
      </div>

      {/* Status + Meta */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium capitalize ${statusBadge[session.status] || 'bg-zinc-500/20 text-zinc-400'}`}>
          {session.status}
        </span>
        {session.workspace && (
          <span className="text-xs text-zinc-400">
            <span className="text-zinc-600">Workspace:</span> {session.workspace}
          </span>
        )}
        {session.branch && (
          <span className="text-xs text-zinc-400">
            <span className="text-zinc-600">Branch:</span> {session.branch}
          </span>
        )}
      </div>

      {/* Blocked Alert */}
      {session.status === 'blocked' && session.blocked_reason && (
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-400">Session Blocked</div>
            <div className="text-xs text-amber-400/80 mt-0.5">{session.blocked_reason}</div>
          </div>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Green Level</div>
            <div className="text-sm font-medium text-white">{session.green_level || '-'}</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Branch Freshness</div>
            <div className="text-sm font-medium text-white">{session.branch_freshness || '-'}</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Commits Behind</div>
            <div className="text-sm font-medium text-white">{session.commits_behind != null ? session.commits_behind : '-'}</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Blocked Reason</div>
            <div className="text-sm font-medium text-white">{session.blocked_reason || '-'}</div>
          </div>
        </Card>
      </div>

      {/* Event Timeline */}
      <Card hover={false}>
        <div className="px-5 pt-5 pb-3">
          <span className="text-sm font-medium text-zinc-200 uppercase tracking-wider">Event Timeline</span>
        </div>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="px-6 pb-6 text-xs text-zinc-500">No events recorded yet.</div>
          ) : (
            <div className="px-6 pb-6">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/5" />

                <div className="space-y-4">
                  {events.map((event) => {
                    const Icon = eventIcons[event.kind] || Circle;
                    return (
                      <div key={event.id || event.seq} className="flex items-start gap-3 relative">
                        <div className="relative z-10 flex-shrink-0 mt-0.5">
                          <Icon size={14} className={`${statusBadge[event.kind] ? statusBadge[event.kind].split(' ')[1] : 'text-zinc-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-300 capitalize">{event.kind}</span>
                            <span className="text-[10px] text-zinc-600">{event.created_at ? timeAgo(event.created_at) : ''}</span>
                          </div>
                          {event.detail && (
                            <div className="text-xs text-zinc-500 mt-0.5">{event.detail}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
