'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Plug,
  Search, X, Eye, EyeOff, Info, Shield, Cloud, Settings
} from 'lucide-react';
import { INTEGRATION_CONFIGS, CATEGORY_ICONS, CATEGORIES } from '../lib/integrationConfigs';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { isDemoMode } from '../lib/isDemoMode';
import { demoIntegrationsConnections, demoIntegrationsSettings } from '../lib/demoIntegrationsData';

export default function IntegrationsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [settings, setSettings] = useState({});
  const [agentConnections, setAgentConnections] = useState([]);
  const [healthData, setHealthData] = useState({});
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
    switch (status) {
      case 'connected':
        return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
      case 'agent_connected':
        return <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />;
      case 'configured':
        return <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-zinc-500 inline-block" />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'agent_connected': return 'Agent Connected';
      case 'configured': return 'Partial';
      default: return 'Not Set';
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

  if (loading) {
    return (
      <PageLayout
        title="Integrations"
        subtitle="Org-wide service connections — override per agent from Fleet → Agent → Integrations"
        breadcrumbs={['Dashboard', 'Integrations']}
      >
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-zinc-500">Loading integrations...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Integrations"
      subtitle="Org-wide service connections — override per agent from Fleet → Agent → Integrations"
      breadcrumbs={['Dashboard', 'Integrations']}
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Available" value={allIntegrations.length} color="text-white" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Connected" value={connectedCount} color="text-green-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Agent Overrides" value={agentOverrideCount} color="text-blue-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Not Configured" value={notConfiguredCount} color="text-zinc-500" />
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg pl-10 pr-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => {
          const CatIcon = CATEGORY_ICONS[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-brand text-white'
                  : 'bg-surface-tertiary text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[rgba(255,255,255,0.12)]'
              }`}
            >
              <CatIcon size={14} />
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Results count */}
      {(activeCategory !== 'all' || searchQuery) && (
        <p className="text-xs text-zinc-500 mb-4">
          Showing {integrationsList.length} of {allIntegrations.length} integrations
        </p>
      )}

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrationsList.map(([key, config]) => {
          const status = getIntegrationStatus(key);
          return (
            <Card
              key={key}
              className={isAdmin ? 'cursor-pointer group' : 'group'}
              hover={isAdmin}
            >
              <div className="p-5" onClick={() => isAdmin ? openEditor(key) : null}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-surface-tertiary rounded-lg flex items-center justify-center">
                      <Plug size={16} className="text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{config.name}</div>
                      <div className="text-xs text-zinc-500">{config.description}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    {getStatusDot(status)}
                    <span className="text-xs text-zinc-500">{getStatusLabel(status)}</span>
                    {agentCountByProvider[key] > 0 && (
                      <span className="text-[10px] text-zinc-600 ml-1">
                        {agentCountByProvider[key]} agent{agentCountByProvider[key] !== 1 ? 's' : ''}
                      </span>
                    )}
                    {healthData[key]?.status === 'healthy' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400" title={`Verified: ${healthData[key]?.message}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    )}
                    {healthData[key]?.status === 'error' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400" title={healthData[key]?.message}>
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        Error
                      </span>
                    )}
                    {healthData[key]?.status === 'degraded' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400" title={healthData[key]?.message}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Degraded
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <span className="text-xs text-zinc-500 group-hover:text-brand transition-colors">
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-elevated border border-[rgba(255,255,255,0.06)] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-surface-tertiary rounded-lg flex items-center justify-center">
                    <Plug size={16} className="text-zinc-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {INTEGRATION_CONFIGS[editingIntegration].name}
                    </h2>
                    <p className="text-sm text-zinc-400">
                      {INTEGRATION_CONFIGS[editingIntegration].description}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-1">Org-wide default. Agents can override from their profile.</p>
                  </div>
                </div>
                <button
                  onClick={closeEditor}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {INTEGRATION_CONFIGS[editingIntegration].fields.map((field) => (
                  <div key={field.key}>
                    {field.type === 'toggle' ? (
                      <div className="flex items-center justify-between py-1">
                        <label className="text-sm font-medium text-zinc-300">{field.label}</label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, [field.key]: formData[field.key] === 'true' ? 'false' : 'true' })}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            formData[field.key] === 'true' ? 'bg-brand' : 'bg-zinc-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            formData[field.key] === 'true' ? 'translate-x-5' : ''
                          }`} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={showValues[field.key] ? 'text' : field.type}
                            value={formData[field.key] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            className="w-full bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg px-4 py-2.5 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-brand transition-colors"
                          />
                          {field.type === 'password' && (
                            <button
                              type="button"
                              onClick={() => toggleShowValue(field.key)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                            >
                              {showValues[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {field.key}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  testResult.status === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                  testResult.status === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-surface-tertiary text-zinc-300'
                }`}>
                  {testResult.message}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={testConnection}
                  className="flex-1 px-3 py-2.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 font-medium"
                >
                  Test Connection
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-brand hover:bg-brand/90 text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <Card hover={false} className="mt-8">
        <CardHeader title="About Settings" icon={Info} />
        <CardContent>
          <div className="text-sm text-zinc-300 space-y-2">
            <p className="flex items-center gap-2">
              <Shield size={14} className="text-zinc-400 shrink-0" />
              <span><strong className="text-white">Security:</strong> Sensitive values are encrypted and masked in the UI</span>
            </p>
            <p className="flex items-center gap-2">
              <Cloud size={14} className="text-zinc-400 shrink-0" />
              <span><strong className="text-white">Cloud Sync:</strong> Settings are stored in your Neon database</span>
            </p>
            <p className="flex items-center gap-2">
              <Settings size={14} className="text-zinc-400 shrink-0" />
              <span><strong className="text-white">Environment:</strong> For agent gateway settings, update your config file</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

