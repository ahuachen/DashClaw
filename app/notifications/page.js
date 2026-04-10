'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, Check, ShieldAlert, AlertCircle } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';

const SIGNAL_TYPES = [
  { value: 'all', label: 'All Signal Types' },
  { value: 'autonomy_spike', label: 'Autonomy Spike' },
  { value: 'high_impact_low_oversight', label: 'High Impact / Low Oversight' },
  { value: 'repeated_failures', label: 'Repeated Failures' },
  { value: 'stale_loop', label: 'Stale Open Loop' },
  { value: 'assumption_drift', label: 'Assumption Drift' },
  { value: 'stale_assumption', label: 'Stale Assumption' },
  { value: 'stale_running_action', label: 'Stale Running Action' },
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
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-emerald-400 flex items-center gap-3">
          <Check size={20} className="shrink-0" />
          <span className="text-sm font-medium">Preferences saved</span>
        </div>
      )}

      <div className="max-w-3xl">
        {/* Email Alerts Card */}
        <Card hover={false}>
          <CardHeader title="Email Alerts" icon={Mail} />
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <div className="h-10 bg-zinc-800/50 rounded animate-pulse" />
                <div className="h-32 bg-zinc-800/50 rounded animate-pulse" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Email Notifications</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Receive alerts when security signals are detected
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailEnabled(!emailEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      emailEnabled ? 'bg-brand' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        emailEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* RESEND_API_KEY not configured warning */}
                {!resendConfigured && (
                  <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-start gap-3">
                    <AlertCircle size={16} className="text-zinc-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-400">
                      Email alerts require the RESEND_API_KEY environment variable to be configured.
                    </p>
                  </div>
                )}

                {/* Signal Types (shown when enabled) */}
                {emailEnabled && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-zinc-200">Signal Types</div>
                    <div className="space-y-2 pl-1">
                      {SIGNAL_TYPES.map((signal) => (
                        <label
                          key={signal.value}
                          className="flex items-center gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={signalTypes.includes(signal.value)}
                            onChange={() => toggleSignalType(signal.value)}
                            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-brand focus:ring-brand focus:ring-offset-0 focus:ring-2 cursor-pointer"
                          />
                          <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">
                            {signal.label}
                          </span>
                        </label>
                      ))}
                    </div>

                    {signalTypes.length === 0 && (
                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-3">
                        <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-400">
                          Select at least one signal type to receive email alerts
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
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              !isDirty || saving || loading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-brand hover:bg-brand/90 text-white'
            }`}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

