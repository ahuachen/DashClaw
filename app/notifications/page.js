'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, Check, ShieldAlert, AlertCircle } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

const SIGNAL_TYPES = [
  { value: 'all', label: 'All signal types' },
  { value: 'autonomy_spike', label: 'Autonomy spike' },
  { value: 'high_impact_low_oversight', label: 'High impact, low oversight' },
  { value: 'repeated_failures', label: 'Repeated failures' },
  { value: 'stale_loop', label: 'Stale open loop' },
  { value: 'assumption_drift', label: 'Assumption drift' },
  { value: 'stale_assumption', label: 'Stale assumption' },
  { value: 'stale_running_action', label: 'Stale running action' },
];

export default function NotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [signalTypes, setSignalTypes] = useState([]);
  const [originalPrefs, setOriginalPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [resendConfigured, setResendConfigured] = useState(true);

  // Load preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          const emailPref = data.preferences?.find(p => p.channel === 'email');

          if (emailPref) {
            const enabled = emailPref.enabled === 1;
            const types = emailPref.signal_types ? JSON.parse(emailPref.signal_types) : [];
            setEmailEnabled(enabled);
            setSignalTypes(types);
            setOriginalPrefs({ enabled, types });
          } else {
            setOriginalPrefs({ enabled: false, types: [] });
          }
        }

        // Check if RESEND_API_KEY is configured (API includes this info).
        if (res.ok) setResendConfigured(data.resend_configured !== false);
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  // Check if preferences have changed
  const isDirty = originalPrefs !== null && (
    emailEnabled !== originalPrefs.enabled ||
    JSON.stringify(signalTypes.sort()) !== JSON.stringify(originalPrefs.types.sort())
  );

  // Handle signal type toggle
  const toggleSignalType = useCallback((type) => {
    if (type === 'all') {
      // Selecting "all" clears specific selections
      setSignalTypes(['all']);
    } else {
      setSignalTypes(prev => {
        // Remove "all" if selecting a specific type
        const filtered = prev.filter(t => t !== 'all');

        if (prev.includes(type)) {
          // Deselect specific type
          return filtered.filter(t => t !== type);
        } else {
          // Select specific type
          return [...filtered, type];
        }
      });
    }
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          enabled: emailEnabled,
          signal_types: signalTypes,
        }),
      });

      if (res.ok) {
        // Update original prefs to match current state
        setOriginalPrefs({ enabled: emailEnabled, types: signalTypes });

        // Show success banner
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } else {
        console.error('Failed to save preferences');
      }
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  }, [emailEnabled, signalTypes]);

  return (
    <PageLayout
      title="Notifications"
      subtitle="Configure how you receive security alerts"
      breadcrumbs={['System', 'Notifications']}
    >
      {/* Success banner */}
      {showSuccess && (
        <div
          role="status"
          className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400"
        >
          <Check size={20} className="shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">Preferences saved</span>
        </div>
      )}

      <div className="max-w-3xl">
        {/* Email Alerts Card */}
        <Card hover={false}>
          <CardHeader title="Email alerts" icon={Mail} />
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <div className="h-10 animate-pulse rounded bg-white/5" />
                <div className="h-32 animate-pulse rounded bg-white/5" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Email notifications</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Receive alerts when security signals are detected
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailEnabled}
                    aria-label="Toggle email notifications"
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-2 focus:ring-offset-surface-secondary ${
                      emailEnabled ? 'bg-brand' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        emailEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* RESEND_API_KEY not configured warning */}
                {!resendConfigured && (
                  <div
                    role="note"
                    className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
                  >
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <p className="text-xs text-amber-300">
                      Email alerts require the <code className="font-mono text-amber-200">RESEND_API_KEY</code> environment variable to be configured.
                    </p>
                  </div>
                )}

                {/* Signal Types (shown when enabled) */}
                {emailEnabled && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Signal types
                    </div>
                    <div className="space-y-2">
                      {SIGNAL_TYPES.map((signal) => (
                        <label
                          key={signal.value}
                          className="group flex cursor-pointer items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            checked={signalTypes.includes(signal.value)}
                            onChange={() => toggleSignalType(signal.value)}
                            className="h-4 w-4 cursor-pointer accent-brand"
                          />
                          <span className="text-sm text-zinc-300 transition-colors group-hover:text-white">
                            {signal.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    {signalTypes.length === 0 && (
                      <div
                        role="alert"
                        className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
                      >
                        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                        <p className="text-xs text-amber-300">
                          Select at least one signal type to receive email alerts.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
            className="flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/10 px-5 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/40 hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand/20 disabled:hover:bg-brand/10"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                Saving…
              </>
            ) : (
              <>
                <Check size={16} aria-hidden="true" />
                Save preferences
              </>
            )}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

