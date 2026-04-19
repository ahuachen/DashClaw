'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Plug, Search, X, Eye, EyeOff, Info, Shield, Cloud, Settings, RefreshCw,
} from 'lucide-react';
import { INTEGRATION_CONFIGS, CATEGORY_ICONS, CATEGORIES } from '../lib/integrationConfigs';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { isDemoMode } from '../lib/isDemoMode';
import { demoIntegrationsConnections, demoIntegrationsSettings } from '../lib/demoIntegrationsData';

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [settings, setSettings] = useState({});
  const [agentConnections, setAgentConnections] = useState([]);
  const [healthData, setHealthData] = useState({});
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showValues, setShowValues] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConnections = useCallback(async () => {
    try {
      if (isDemoMode()) {
        setAgentConnections([...demoIntegrationsConnections]);
        return;
      }
      const res = await fetch('/api/agents/connections');
      if (!res.ok) {
        setAgentConnections([]);
        return;
      }
      const data = await res.json();
      setAgentConnections(data.connections || []);
    } catch (error) {
      console.error('Failed to fetch agent connections:', error);
      setAgentConnections([]);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      if (isDemoMode()) {
        const settingsMap = {};
        demoIntegrationsSettings.forEach(s => {
          settingsMap[s.key] = s;
        });
        setSettings(settingsMap);
        return;
      }
      const res = await fetch('/api/settings?category=integration');
      const data = await res.json();
      const settingsMap = {};
      (data.settings || []).forEach(s => {
        settingsMap[s.key] = s;
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      if (isDemoMode()) return;
      const res = await fetch('/api/integrations/health');
      if (res.ok) {
        const data = await res.json();
        setHealthData(data.health || {});
      }
    } catch {}
  }, []);

  const handleRefreshHealth = useCallback(async () => {
    if (refreshingHealth) return;
    setRefreshingHealth(true);
    setRefreshError(null);
    try {
      const res = await fetch('/api/integrations/health/refresh', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Refresh failed (${res.status})`);
      }
      const data = await res.json();
      setHealthData(data.health || {});
    } catch (err) {
      setRefreshError(err.message || 'Refresh failed');
    } finally {
      setRefreshingHealth(false);
    }
  }, [refreshingHealth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSettings(), fetchConnections(), fetchHealth()]);
  }, [fetchSettings, fetchConnections, fetchHealth]);

  // Build a map of provider -> connection count for agent usage indicator
  const connectionsByProvider = {};
  const agentCountByProvider = {};
  for (const conn of agentConnections) {
    const key = conn.provider.toLowerCase();
    if (!connectionsByProvider[key]) connectionsByProvider[key] = [];
    connectionsByProvider[key].push(conn);
    agentCountByProvider[key] = (agentCountByProvider[key] || 0) + 1;
  }

  const getIntegrationStatus = (integrationKey) => {
    const config = INTEGRATION_CONFIGS[integrationKey];
    const requiredFields = config.fields.filter(f => f.required);
    const hasAllRequired = requiredFields.every(f => settings[f.key]?.hasValue);

    if (hasAllRequired) return 'connected';
    if (config.fields.some(f => settings[f.key]?.hasValue)) return 'configured';
    if (connectionsByProvider[integrationKey]?.some(c => c.status === 'active')) return 'agent_connected';
    return 'not_configured';
  };

  const openEditor = (integrationKey) => {
    const config = INTEGRATION_CONFIGS[integrationKey];
    const initialData = {};
    config.fields.forEach(f => {
      initialData[f.key] = settings[f.key]?.value || '';
    });
    setFormData(initialData);
    setEditingIntegration(integrationKey);
    setTestResult(null);
  };

  const closeEditor = () => {
    setEditingIntegration(null);
    setFormData({});
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = INTEGRATION_CONFIGS[editingIntegration];

      for (const field of config.fields) {
        if (formData[field.key] !== undefined) {
          const payload = {
            key: field.key,
            value: formData[field.key],
            category: 'integration',
            encrypted: field.type === 'password'
          };
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      await fetchSettings();
      closeEditor();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTestResult({ status: 'testing', message: 'Testing connection...' });

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: editingIntegration,
          credentials: formData
        })
      });
      const data = await res.json();
      setTestResult({
        status: data.success ? 'success' : 'error',
        message: data.success ? data.message : data.message
      });
    } catch (error) {
      setTestResult({ status: 'error', message: `Test failed: ${error.message}` });
    }
  };

  const toggleShowValue = (key) => {
    setShowValues(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusDot = (status) => {
    const color =
      status === 'connected' ? 'bg-emerald-500'
      : status === 'agent_connected' ? 'bg-blue-500'
      : status === 'configured' ? 'bg-amber-500'
      : 'bg-zinc-500';
    return <span aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'agent_connected': return 'Agent connected';
      case 'configured': return 'Partial';
      default: return 'Not set';
    }
  };

  const allIntegrations = Object.entries(INTEGRATION_CONFIGS);

  // Filter by category and search
  const integrationsList = allIntegrations.filter(([key, config]) => {
    const matchesCategory = activeCategory === 'all' || config.category === activeCategory;
    const matchesSearch = !searchQuery ||
      config.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const connectedCount = allIntegrations.filter(([k]) => getIntegrationStatus(k) === 'connected').length;
  const notConfiguredCount = allIntegrations.length - connectedCount;

  // Count integrations that have at least one agent-specific override
  const overrideProviders = new Set();
  for (const conn of agentConnections) {
    overrideProviders.add(conn.provider.toLowerCase());
  }
  const agentOverrideCount = overrideProviders.size;

  // Newest checked_at across all integrations, formatted relative.
  const lastHealthCheck = (() => {
    let latest = 0;
    for (const v of Object.values(healthData)) {
      const t = v?.checked_at ? new Date(v.checked_at).getTime() : 0;
      if (t > latest) latest = t;
    }
    if (!latest) return null;
    const diffSec = Math.max(0, Math.round((Date.now() - latest) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return `${Math.round(diffSec / 86400)}d ago`;
  })();

  if (loading) {
    return (
      <PageLayout
        title="Integrations"
        subtitle="Org-wide service connections — override per agent from Fleet → Agent → Integrations"
        breadcrumbs={['Dashboard', 'Integrations']}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface-secondary sm:grid-cols-4 sm:divide-x sm:divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
                <div className="mt-2 h-7 w-16 animate-pulse rounded bg-white/5" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-surface-secondary" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Integrations"
      subtitle="Org-wide service connections — override per agent from Fleet → Agent → Integrations"
      breadcrumbs={['Dashboard', 'Integrations']}
      maturity="stable"
    >
      {/* Instrument rail */}
      <div className="mb-3 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border bg-surface-secondary sm:grid-cols-4">
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Available</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{allIntegrations.length}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Connected</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-success">{connectedCount}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Agent overrides</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-info">{agentOverrideCount}</div>
        </div>
        <div className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-tertiary">Not configured</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-secondary">{notConfiguredCount}</div>
        </div>
      </div>

      {/* Health refresh — admin only, free-tier compatible alternative to a cron */}
      {isAdmin && !isDemoMode() && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-tertiary px-3 py-2 text-xs text-secondary">
          <span>
            Health checks run on demand.{' '}
            {lastHealthCheck ? (
              <>Last refresh: <span className="tabular-nums text-secondary">{lastHealthCheck}</span>.</>
            ) : (
              <>No checks recorded yet.</>
            )}
            {refreshError && (
              <span className="ml-2 text-error">· {refreshError}</span>
            )}
          </span>
          <button
            type="button"
            onClick={handleRefreshHealth}
            disabled={refreshingHealth}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-secondary px-2.5 py-1 text-xs font-medium text-secondary transition-colors hover:border-border-hover hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={refreshingHealth ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            {refreshingHealth ? 'Refreshing…' : 'Refresh health'}
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative mb-4">
        <label htmlFor="integration-search" className="sr-only">Search integrations</label>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tertiary" aria-hidden="true" />
        <input
          id="integration-search"
          type="text"
          placeholder="Search integrations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-tertiary py-2 pl-10 pr-4 text-sm text-secondary placeholder:text-disabled transition-colors hover:border-border-hover focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Category Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const CatIcon = CATEGORY_ICONS[cat.id];
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'border-brand/30 bg-brand/10 text-brand hover:border-brand/50 hover:bg-brand/15'
                  : 'border-border bg-surface-tertiary text-secondary hover:border-border-hover hover:text-white'
              }`}
            >
              <CatIcon size={14} aria-hidden="true" />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Results count */}
      {(activeCategory !== 'all' || searchQuery) && (
        <p className="mb-4 tabular-nums text-xs text-tertiary">
          Showing {integrationsList.length} of {allIntegrations.length} integrations
        </p>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrationsList.map(([key, config]) => {
          const status = getIntegrationStatus(key);
          return (
            <Card
              key={key}
              className={isAdmin ? 'group cursor-pointer' : 'group'}
              hover={isAdmin}
            >
              <div className="p-5" onClick={() => isAdmin ? openEditor(key) : null}>
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-tertiary">
                      <Plug size={16} className="text-secondary" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{config.name}</div>
                      <div className="text-xs text-tertiary">{config.description}</div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {getStatusDot(status)}
                    <span className="text-xs text-secondary">{getStatusLabel(status)}</span>
                    {agentCountByProvider[key] > 0 && (
                      <span className="ml-1 tabular-nums text-[11px] text-tertiary">
                        {agentCountByProvider[key]} agent{agentCountByProvider[key] !== 1 ? 's' : ''}
                      </span>
                    )}
                    {healthData[key]?.status === 'healthy' && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-success"
                        title={`Verified: ${healthData[key]?.message}`}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    )}
                    {healthData[key]?.status === 'error' && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-error"
                        title={healthData[key]?.message}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Error
                      </span>
                    )}
                    {healthData[key]?.status === 'degraded' && (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-warning"
                        title={healthData[key]?.message}
                      >
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Degraded
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <span className="text-xs text-tertiary transition-colors group-hover:text-brand">
                      Configure
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Edit Modal (admin only) */}
      {editingIntegration && isAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${INTEGRATION_CONFIGS[editingIntegration].name} settings`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-tertiary">
                    <Plug size={16} className="text-secondary" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {INTEGRATION_CONFIGS[editingIntegration].name}
                    </h2>
                    <p className="text-sm text-secondary">
                      {INTEGRATION_CONFIGS[editingIntegration].description}
                    </p>
                    <p className="mt-1 text-[11px] text-tertiary">
                      Org-wide default. Agents can override from their profile.
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeEditor}
                  aria-label="Close"
                  className="rounded p-1 text-secondary transition-colors hover:bg-white/5 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {INTEGRATION_CONFIGS[editingIntegration].fields.map((field) => (
                  <div key={field.key}>
                    {field.type === 'toggle' ? (
                      <div className="flex items-center justify-between py-1">
                        <label className="text-sm font-medium text-secondary">{field.label}</label>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={formData[field.key] === 'true'}
                          aria-label={`Toggle ${field.label}`}
                          onClick={() => setFormData({ ...formData, [field.key]: formData[field.key] === 'true' ? 'false' : 'true' })}
                          className={`relative h-5 w-10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-surface-elevated ${
                            formData[field.key] === 'true' ? 'bg-brand' : 'bg-white/10'
                          }`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                              formData[field.key] === 'true' ? 'translate-x-5' : ''
                            }`}
                          />
                        </button>
                      </div>
                    ) : (
                      <>
                        <label htmlFor={`field-${field.key}`} className="mb-1 block text-sm font-medium text-secondary">
                          {field.label}
                          {field.required && <span aria-label="required" className="ml-1 text-error">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            id={`field-${field.key}`}
                            type={showValues[field.key] ? 'text' : field.type}
                            value={formData[field.key] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            className="w-full rounded-lg border border-border bg-surface-tertiary px-4 py-2.5 text-sm text-secondary placeholder:text-disabled transition-colors hover:border-border-hover focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          />
                          {field.type === 'password' && (
                            <button
                              type="button"
                              onClick={() => toggleShowValue(field.key)}
                              aria-label={showValues[field.key] ? 'Hide value' : 'Show value'}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-white"
                            >
                              {showValues[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-tertiary">
                          {field.key}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Result */}
              {testResult && (
                <div
                  role="status"
                  className={`mt-4 rounded-lg border p-3 text-sm ${
                    testResult.status === 'success'
                      ? 'border-success/30 bg-success-subtle text-success'
                      : testResult.status === 'error'
                      ? 'border-error/30 bg-error-subtle text-error'
                      : 'border-border bg-surface-tertiary text-secondary'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={testConnection}
                  className="flex-1 rounded-lg border border-border bg-surface-tertiary px-3 py-2 text-sm font-medium text-secondary transition-colors hover:border-border-hover hover:text-white"
                >
                  Test connection
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-brand/20 bg-brand/10 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/40 hover:bg-brand/15 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <Card hover={false} className="mt-8">
        <CardHeader title="About settings" icon={Info} />
        <CardContent>
          <div className="space-y-2 text-sm text-secondary">
            <p className="flex items-center gap-2">
              <Shield size={14} className="shrink-0 text-secondary" aria-hidden="true" />
              <span><strong className="text-white">Security:</strong> Sensitive values are encrypted and masked in the UI</span>
            </p>
            <p className="flex items-center gap-2">
              <Cloud size={14} className="shrink-0 text-secondary" aria-hidden="true" />
              <span><strong className="text-white">Cloud sync:</strong> Settings are stored in your Neon database</span>
            </p>
            <p className="flex items-center gap-2">
              <Settings size={14} className="shrink-0 text-secondary" aria-hidden="true" />
              <span><strong className="text-white">Environment:</strong> For agent gateway settings, update your config file</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

