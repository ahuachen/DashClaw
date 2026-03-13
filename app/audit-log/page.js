'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, KeyRound, Mail, UsersRound, Settings, CreditCard,
  ShieldAlert, Webhook, Bell, Filter, ChevronDown, User, Cog
} from 'lucide-react';
import Image from 'next/image';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchLogs = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({ limit: limit.toString(), offset: currentOffset.toString() });
      if (actionFilter !== 'all') {
        params.set('action', actionFilter);
      }

      const res = await fetch(`/api/activity?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to load activity logs');
        return;
      }

      if (reset) {
        setLogs(json.logs || []);
      } else {
        setLogs((prev) => [...prev, ...(json.logs || [])]);
      }

      setStats(json.stats || { total: 0, today: 0, unique_actors: 0 });
      setHasMore((json.logs || []).length === limit);

      if (!reset) {
        setOffset(currentOffset + limit);
      }
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset, actionFilter, limit]);

  useEffect(() => {
    fetchLogs(true);
  }, [actionFilter, fetchLogs]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(false);
    }
  };

  const getActionIcon = (action) => {
    if (action.startsWith('key.')) return KeyRound;
    if (action.startsWith('invite.')) return Mail;
    if (action.startsWith('member.') || action.startsWith('role.')) return UsersRound;
    if (action.startsWith('setting.')) return Settings;
    if (action.startsWith('usage.')) return BarChart3;
    if (action.startsWith('webhook.')) return Webhook;
    if (action.startsWith('signal.') || action.startsWith('alert.')) return ShieldAlert;
    return Cog;
  };

  const formatActionLabel = (action) => {
    return action
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatRelativeTime = (dateStr) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const parseDetails = (detailsStr) => {
    if (!detailsStr) return null;
    try {
      const parsed = JSON.parse(detailsStr);
      return Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      return null;
    }
  };

  const getActorLabel = (log) => {
    if (log.actor_name) return log.actor_name;
    if (log.actor_type === 'system') return '(system)';
    if (log.actor_type === 'cron') return '(cron)';
    return log.actor_id || 'Unknown';
  };

  const actionTypes = [
    { value: 'all', label: 'All Actions' },
    { value: 'key.created', label: 'API Key Created' },
    { value: 'key.revoked', label: 'API Key Revoked' },
    { value: 'invite.created', label: 'Invite Created' },
    { value: 'invite.revoked', label: 'Invite Revoked' },
    { value: 'invite.accepted', label: 'Invite Accepted' },
    { value: 'role.changed', label: 'Role Changed' },
    { value: 'member.removed', label: 'Member Removed' },
    { value: 'member.left', label: 'Member Left' },
    { value: 'setting.updated', label: 'Setting Updated' },
    { value: 'setting.deleted', label: 'Setting Deleted' },
    { value: 'usage.limit_reached', label: 'Usage Limit Reached' },
    { value: 'webhook.created', label: 'Webhook Created' },
    { value: 'webhook.deleted', label: 'Webhook Deleted' },
    { value: 'webhook.tested', label: 'Webhook Tested' },
    { value: 'webhook.fired', label: 'Webhook Fired' },
    { value: 'signal.detected', label: 'Signal Detected' },
    { value: 'alert.email_sent', label: 'Alert Email Sent' },
  ];

  if (loading) {
    return (
      <PageLayout
        title="Audit Log"
        subtitle="Permanent record of system and administrative events"
        breadcrumbs={['Evidence', 'Audit Log']}
      >        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-zinc-500">Loading activity...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Audit Log"
      subtitle="Permanent record of system and administrative events"
      breadcrumbs={['Evidence', 'Audit Log']}
      actions={
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] text-zinc-300 text-sm font-medium rounded-lg transition-colors"
        >
          <Filter size={14} />
          Filters
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      }
    >
      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Total Events" value={stats?.total || 0} color="text-white" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Today's Events" value={stats?.today || 0} color="text-brand" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Unique Actors" value={stats?.unique_actors || 0} color="text-blue-400" />
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <Card hover={false} className="mb-6 bg-surface-tertiary">
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <label className="text-sm text-zinc-400 font-medium">Action Type:</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="flex-1 bg-surface-secondary border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand transition-colors"
              >
                {actionTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity timeline */}
      <Card hover={false}>
        <CardContent className="pt-0">
          {logs.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={Clock}
                title="No activity logs"
                description="Activity will appear here as changes are made to your workspace."
              />
            </div>
          ) : (
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {logs.map((log) => {
                const ActionIcon = getActionIcon(log.action);
                const details = parseDetails(log.details);

                return (
                  <div key={log.id} className="py-4 flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg bg-surface-tertiary flex items-center justify-center flex-shrink-0 mt-1">
                      <ActionIcon size={14} className="text-zinc-400" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Action label */}
                      <div className="text-sm text-zinc-200 font-medium mb-1">
                        {formatActionLabel(log.action)}
                      </div>

                      {/* Actor */}
                      <div className="flex items-center gap-2 mb-1">
                        {log.actor_image ? (
                          <Image
                            src={log.actor_image}
                            alt=""
                            width={16}
                            height={16}
                            className="w-4 h-4 rounded-full"
                          />
                        ) : (
                          <User size={12} className="text-zinc-600" />
                        )}
                        <span className="text-xs text-zinc-400">
                          {getActorLabel(log)}
                        </span>
                        {(log.actor_type === 'system' || log.actor_type === 'cron') && (
                          <Badge variant="default" size="xs">{log.actor_type}</Badge>
                        )}
                      </div>

                      {/* Resource ID */}
                      {log.resource_id && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                            {log.resource_type}:
                          </span>
                          <code className="font-mono text-xs text-zinc-500">
                            {log.resource_id.length > 24
                              ? `${log.resource_id.substring(0, 24)}...`
                              : log.resource_id}
                          </code>
                        </div>
                      )}

                      {/* Details */}
                      {details && (
                        <div className="mt-2 p-2 bg-surface-tertiary rounded-lg border border-[rgba(255,255,255,0.04)]">
                          <div className="space-y-1">
                            {Object.entries(details).map(([key, value]) => (
                              <div key={key} className="flex items-start gap-2">
                                <span className="text-[10px] text-zinc-600 uppercase tracking-wider min-w-[80px]">
                                  {key}:
                                </span>
                                <span className="text-xs text-zinc-400 flex-1 break-words">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock size={10} />
                        {formatRelativeTime(log.created_at)}
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More */}
          {logs.length > 0 && hasMore && (
            <div className="pt-4 pb-2 text-center border-t border-[rgba(255,255,255,0.04)]">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] text-zinc-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
