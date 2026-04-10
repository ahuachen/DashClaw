'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Webhook, Plus, Trash2, Play, Check, Copy, ChevronDown, ChevronRight,
  AlertTriangle, ArrowRight,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { isDemoMode } from '../lib/isDemoMode';
import { demoWebhooks, demoWebhookDeliveries } from '../lib/demoWebhooksData';

const WEBHOOK_TEMPLATES = [
  {
    name: 'Slack',
    description: 'Send notifications to a Slack channel via Incoming Webhook',
    urlPlaceholder: 'https://hooks.slack.com/services/T.../B.../...',
    defaultEvents: ['all'],
  },
  {
    name: 'Discord',
    description: 'Post alerts to a Discord channel via webhook URL',
    urlPlaceholder: 'https://discord.com/api/webhooks/...',
    defaultEvents: ['all'],
  },
  {
    name: 'PagerDuty',
    description: 'Trigger PagerDuty incidents for critical security signals',
    urlPlaceholder: 'https://events.pagerduty.com/v2/enqueue',
    defaultEvents: ['autonomy_spike', 'high_impact_low_oversight', 'repeated_failures'],
  },
  {
    name: 'Microsoft Teams',
    description: 'Post adaptive cards to a Teams channel via connector URL',
    urlPlaceholder: 'https://outlook.office.com/webhook/...',
    defaultEvents: ['all'],
  },
  {
    name: 'Generic REST',
    description: 'Send JSON payloads to any HTTPS endpoint',
    urlPlaceholder: 'https://your-api.example.com/webhook',
    defaultEvents: ['all'],
  },
];

const EVENT_TYPES = [
  { value: 'all', label: 'All Events' },
  { value: 'autonomy_spike', label: 'Autonomy Spike' },
  { value: 'high_impact_low_oversight', label: 'High Impact Low Oversight' },
  { value: 'repeated_failures', label: 'Repeated Failures' },
  { value: 'stale_loop', label: 'Stale Loop' },
  { value: 'assumption_drift', label: 'Assumption Drift' },
  { value: 'stale_assumption', label: 'Stale Assumption' },
  { value: 'stale_running_action', label: 'Stale Running Action' },
];

export default function WebhooksPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';
  const isDemo = isDemoMode();
  const canEdit = isAdmin && !isDemo;

  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add webhook form
  const [showAddForm, setShowAddForm] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState(['all']);
  const [creating, setCreating] = useState(false);

  // Newly created webhook (show secret once)
  const [newSecret, setNewSecret] = useState(null);
  const [copied, setCopied] = useState(false);

  // Test results
  const [testResults, setTestResults] = useState({});

  // Delivery history
  const [expandedWebhook, setExpandedWebhook] = useState(null);
  const [deliveries, setDeliveries] = useState({});
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const fetchWebhooks = useCallback(async () => {
    try {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 600));
        setWebhooks(demoWebhooks);
        setLoading(false);
        return;
      }
      const res = await fetch('/api/webhooks');
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load webhooks');
        setLoading(false);
        return;
      }
      setWebhooks(json.webhooks || []);
    } catch {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleEventToggle = (eventValue) => {
    if (eventValue === 'all') {
      setSelectedEvents(['all']);
    } else {
      const withoutAll = selectedEvents.filter((e) => e !== 'all');
      if (withoutAll.includes(eventValue)) {
        const updated = withoutAll.filter((e) => e !== eventValue);
        setSelectedEvents(updated.length === 0 ? ['all'] : updated);
      } else {
        setSelectedEvents([...withoutAll, eventValue]);
      }
    }
  };

  const handleCreate = async () => {
    if (!url.trim()) return;
    if (!url.startsWith('https://')) {
      setError('Webhook URL must use HTTPS');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), events: selectedEvents }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to create webhook');
        return;
      }
      setNewSecret(json.webhook.secret);
      setUrl('');
      setSelectedEvents(['all']);
      setShowAddForm(false);
      await fetchWebhooks();
    } catch {
      setError('Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Failed to delete webhook');
        return;
      }
      await fetchWebhooks();
    } catch {
      setError('Failed to delete webhook');
    }
  };

  const handleTest = async (id) => {
    if (isDemoMode()) {
      setTestResults({ ...testResults, [id]: 'testing' });
      await new Promise((r) => setTimeout(r, 1000));
      setTestResults({ ...testResults, [id]: { success: true, status: 200 } });
      return;
    }
    setTestResults({ ...testResults, [id]: 'testing' });
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setTestResults({ ...testResults, [id]: { success: false, status: json.response_status || 0 } });
        return;
      }
      setTestResults({ ...testResults, [id]: { success: json.success, status: json.response_status } });
    } catch {
      setTestResults({ ...testResults, [id]: { success: false, status: 0 } });
    }
  };

  const toggleDeliveries = async (webhookId) => {
    if (expandedWebhook === webhookId) {
      setExpandedWebhook(null);
      return;
    }

    setExpandedWebhook(webhookId);
    if (deliveries[webhookId]) return;

    setLoadingDeliveries(true);
    try {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 400));
        setDeliveries({ ...deliveries, [webhookId]: demoWebhookDeliveries[webhookId] || [] });
        return;
      }
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      const json = await res.json();
      if (res.ok) {
        setDeliveries({ ...deliveries, [webhookId]: json.deliveries || [] });
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleCopySecret = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stats = {
    total: webhooks.length,
    active: webhooks.filter((w) => w.active).length,
    failed: webhooks.filter((w) => w.failure_count > 0).length,
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const parseEvents = (eventsJson) => {
    try {
      return JSON.parse(eventsJson);
    } catch {
      return [];
    }
  };

  return (
    <PageLayout
      breadcrumbs={['Dashboard', 'Webhooks']}
      title="Webhooks"
      subtitle="Receive real-time notifications when security signals are detected"
      actions={
        canEdit && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setError(null);
              setNewSecret(null);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
          >
            <Plus size={16} />
            Add Webhook
          </button>
        )
      }
    >
      {isDemo && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-zinc-300 text-sm">
          Demo mode: webhooks are read-only.
        </div>
      )}
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="py-4">
            <StatCompact label="Total Webhooks" value={stats.total} />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="py-4">
            <StatCompact label="Active" value={stats.active} color="text-emerald-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="py-4">
            <StatCompact label="Failed" value={stats.failed} color="text-amber-400" />
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-400">{error}</div>
        </div>
      )}

      {/* New secret banner (show once after creation) */}
      {newSecret && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
          <div className="flex items-start gap-3 mb-2">
            <Check size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-emerald-400 font-medium">
              Webhook created successfully. Save your signing secret now — it will not be shown again.
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 p-2 rounded bg-surface-tertiary border border-[rgba(255,255,255,0.06)] font-mono text-xs text-zinc-200 break-all">
              {newSecret}
            </code>
            <button
              onClick={handleCopySecret}
              className="px-3 py-2 rounded bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 hover:text-white transition-colors flex items-center gap-2"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add webhook form */}
      {showAddForm && canEdit && (
        <Card className="mb-6">
          <CardContent className="py-5">
            <div className="space-y-4">
              {/* Template selector */}
              <div>
                <label className="block text-xs text-zinc-500 mb-2">Start from Template</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {WEBHOOK_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setUrl(tpl.urlPlaceholder);
                        setSelectedEvents(tpl.defaultEvents);
                      }}
                      className="text-left p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] hover:border-brand/50 transition-colors group"
                    >
                      <div className="text-xs font-medium text-zinc-200 group-hover:text-white">{tpl.name}</div>
                      <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{tpl.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
                <div className="text-xs text-zinc-500 mt-1">Must use HTTPS</div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-2">Event Types</label>
                <div className="grid grid-cols-2 gap-2">
                  {EVENT_TYPES.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] cursor-pointer hover:border-brand/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={() => handleEventToggle(event.value)}
                        className="w-4 h-4 rounded border-zinc-700 bg-surface-primary text-brand focus:ring-2 focus:ring-brand/50"
                      />
                      <span className="text-sm text-zinc-200">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !url.trim()}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Webhook'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setUrl('');
                    setSelectedEvents(['all']);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-300 text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Webhook list */}
      {loading ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-zinc-500">
            Loading webhooks...
          </CardContent>
        </Card>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={Webhook}
              title="No webhooks configured"
              description={
                isAdmin
                  ? "Add your first webhook to receive real-time notifications when security signals are detected"
                  : "Ask an admin to configure webhooks for this workspace"
              }
              action={
                canEdit && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors"
                  >
                    <Plus size={16} />
                    Add Webhook
                  </button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => {
            const events = parseEvents(webhook.events);
            const testResult = testResults[webhook.id];
            const isExpanded = expandedWebhook === webhook.id;
            const webhookDeliveries = deliveries[webhook.id] || [];

            return (
              <Card key={webhook.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-xs text-zinc-200 truncate block max-w-md">
                          {webhook.url.length > 60 ? webhook.url.slice(0, 60) + '...' : webhook.url}
                        </code>
                        {webhook.active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="error">Disabled</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {events.map((event) => (
                          <Badge key={event} variant="default" size="xs">
                            {EVENT_TYPES.find((e) => e.value === event)?.label || event}
                          </Badge>
                        ))}
                      </div>
                      {webhook.failure_count > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
                          <AlertTriangle size={12} />
                          <span>{webhook.failure_count} recent failures</span>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-zinc-500">
                        Last triggered: {formatTimestamp(webhook.last_triggered_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleTest(webhook.id)}
                            disabled={testResult === 'testing'}
                            className="p-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-300 hover:text-white hover:border-brand/50 transition-colors disabled:opacity-50"
                            title="Test webhook"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(webhook.id)}
                            className="p-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-300 hover:text-red-400 hover:border-red-500/30 transition-colors"
                            title="Delete webhook"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleDeliveries(webhook.id)}
                        className="p-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-300 hover:text-white transition-colors"
                        title="Toggle delivery history"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Test result */}
                  {testResult && testResult !== 'testing' && (
                    <div
                      className={`mt-3 p-2 rounded-lg text-xs flex items-center gap-2 ${
                        testResult.success
                          ? 'bg-green-500/10 border border-green-500/30 text-emerald-400'
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}
                    >
                      {testResult.success ? <Check size={12} /> : <AlertTriangle size={12} />}
                      <span>
                        {testResult.success ? 'Test successful' : 'Test failed'} (HTTP {testResult.status})
                      </span>
                    </div>
                  )}

                  {/* Delivery history */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                      <div className="text-xs text-zinc-400 font-medium mb-3">Delivery History</div>
                      {loadingDeliveries ? (
                        <div className="text-xs text-zinc-500 py-4 text-center">Loading deliveries...</div>
                      ) : webhookDeliveries.length === 0 ? (
                        <div className="text-xs text-zinc-500 py-4 text-center">No deliveries yet</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                                <th className="text-left text-zinc-500 font-medium pb-2">Event Type</th>
                                <th className="text-left text-zinc-500 font-medium pb-2">Status</th>
                                <th className="text-left text-zinc-500 font-medium pb-2">HTTP Status</th>
                                <th className="text-left text-zinc-500 font-medium pb-2">Time</th>
                                <th className="text-left text-zinc-500 font-medium pb-2">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {webhookDeliveries.slice(0, 20).map((delivery) => (
                                <tr key={delivery.id} className="border-b border-[rgba(255,255,255,0.04)]">
                                  <td className="py-2 text-zinc-300">
                                    {EVENT_TYPES.find((e) => e.value === delivery.event_type)?.label ||
                                      delivery.event_type}
                                  </td>
                                  <td className="py-2">
                                    <Badge
                                      variant={
                                        delivery.status === 'success'
                                          ? 'success'
                                          : delivery.status === 'failed'
                                          ? 'error'
                                          : 'default'
                                      }
                                      size="xs"
                                    >
                                      {delivery.status}
                                    </Badge>
                                  </td>
                                  <td className="py-2 font-mono text-zinc-400">{delivery.response_status || '-'}</td>
                                  <td className="py-2 text-zinc-400">{formatTimestamp(delivery.attempted_at)}</td>
                                  <td className="py-2 text-zinc-400">
                                    {delivery.duration_ms ? `${delivery.duration_ms}ms` : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Admin guide */}
      {!isAdmin && webhooks.length > 0 && (
        <Card className="mt-6">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm text-zinc-300 font-medium mb-1">Admin Only</div>
                <div className="text-xs text-zinc-500">
                  Only workspace admins can add, test, or delete webhooks. Contact an admin to manage webhook
                  configurations.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageLayout>
  );
}

