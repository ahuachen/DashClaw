'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, AlertTriangle, Zap, Eye, RotateCw,
  ChevronRight, CircleAlert, X as XIcon, EyeOff, Undo2,
  ShieldCheck, ShieldX, Info
} from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import SecurityDetailPanel from '../../components/SecurityDetailPanel';
import { HelpIcon } from '../../components/HelpIcon';
import { HELP_TIPS } from '../../lib/demo/fixtures/help-tips.js';
import { useAgentFilter } from '../../lib/AgentFilterContext';
import { getAgentColor } from '../../lib/colors';

export default function SecurityDashboard() {
  const { agentId } = useAgentFilter();
  const [signals, setSignals] = useState([]);
  const [highRiskActions, setHighRiskActions] = useState([]);
  const [invalidatedAssumptions, setInvalidatedAssumptions] = useState([]);
  const [securityStatus, setSecurityStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const securityScore = typeof securityStatus?.score === 'number' ? securityStatus.score : 0;
  const securityChecks = Array.isArray(securityStatus?.checks) ? securityStatus.checks : [];

  // Signal dismissal state
  const [dismissedSignals, setDismissedSignals] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('dashclaw_dismissed_signals');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [showDismissed, setShowDismissed] = useState(false);

  const getSignalHash = (signal) =>
    `${signal.type || signal.signal_type || ''}:${signal.agent_id || ''}:${signal.action_id || ''}:${signal.loop_id || ''}:${signal.assumption_id || ''}`;

  const dismissSignal = (signal) => {
    const hash = getSignalHash(signal);
    setDismissedSignals(prev => {
      const next = new Set(prev);
      next.add(hash);
      localStorage.setItem('dashclaw_dismissed_signals', JSON.stringify([...next]));
      return next;
    });
  };

  const restoreSignal = (signal) => {
    const hash = getSignalHash(signal);
    setDismissedSignals(prev => {
      const next = new Set(prev);
      next.delete(hash);
      localStorage.setItem('dashclaw_dismissed_signals', JSON.stringify([...next]));
      return next;
    });
  };

  const dismissAllVisible = () => {
    const next = new Set(dismissedSignals);
    activeSignals.forEach(s => next.add(getSignalHash(s)));
    localStorage.setItem('dashclaw_dismissed_signals', JSON.stringify([...next]));
    setDismissedSignals(next);
  };

  // Detail panel state
  const [panelItem, setPanelItem] = useState(null);
  const [panelType, setPanelType] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);

  const handleRunScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const res = await fetch('/api/security/status');
      const data = await res.json();
      setScanResults(res.ok ? data : { error: data.error || `Security check failed (${res.status})` });
      if (res.ok) fetchData();
    } catch (err) {
      console.error('Security scan failed:', err);
      setScanResults({ error: 'Network error — could not reach security status endpoint.' });
    } finally {
      setScanning(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = agentId ? `?agent_id=${agentId}` : '';

      const [signalsRes, actionsRes, assumptionsRes, securityRes] = await Promise.all([
        fetch(`/api/actions/signals${params}`),
        fetch(`/api/actions?limit=100${agentId ? `&agent_id=${agentId}` : ''}`),
        fetch(`/api/actions/assumptions?drift=true${agentId ? `&agent_id=${agentId}` : ''}`),
        fetch('/api/security/status'),
      ]);

      const signalsData = await signalsRes.json();
      const actionsData = await actionsRes.json();
      const assumptionsData = await assumptionsRes.json();
      const securityData = await securityRes.json();

      setSignals(signalsData.signals || []);
      setSecurityStatus(securityData);

      // Filter for high-risk actions: risk_score >= 70 OR (no auth scope AND irreversible)
      const actions = actionsData.actions || [];
      const risky = actions.filter(a => {
        const risk = parseInt(a.risk_score, 10) || 0;
        const unscoped = !a.authorization_scope;
        const irreversible = a.reversible === 0;
        return risk >= 70 || (unscoped && irreversible);
      });
      setHighRiskActions(risky);

      // Filter for invalidated assumptions in last 7 days
      const assumptions = assumptionsData.assumptions || [];
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const invalidated = assumptions.filter(a => {
        if (a.invalidated !== 1) return false;
        if (!a.invalidated_at) return false;
        return (now - new Date(a.invalidated_at).getTime()) < sevenDays;
      });
      setInvalidatedAssumptions(invalidated);

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const openPanel = (item, type) => {
    setPanelItem(item);
    setPanelType(type);
  };

  const closePanel = () => {
    setPanelItem(null);
    setPanelType(null);
  };

  // Split signals into active vs dismissed
  const activeSignals = signals.filter(s => !dismissedSignals.has(getSignalHash(s)));
  const dismissedList = signals.filter(s => dismissedSignals.has(getSignalHash(s)));

  // Stats (use active signals only)
  const totalSignals = activeSignals.length;
  const now24h = Date.now() - 24 * 60 * 60 * 1000;
  const highRisk24h = highRiskActions.filter(a => {
    const ts = new Date(a.timestamp_start).getTime();
    return ts > now24h;
  }).length;
  const unscopedCount = highRiskActions.filter(a => !a.authorization_scope).length;
  const invalidatedCount = invalidatedAssumptions.length;

  const getSeverityIcon = (severity) => {
    return severity === 'red' ? CircleAlert : AlertTriangle;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'ok': return ShieldCheck;
      case 'warning': return AlertTriangle;
      case 'critical': return ShieldX;
      default: return Info;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'text-emerald-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  };

  return (
    <PageLayout
      title="Security"
      subtitle={`Decision Integrity & Risk Signals${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Security']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunScan}
            disabled={scanning}
            className="px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand-hover border border-brand rounded-lg transition-colors duration-150 flex items-center gap-1.5 disabled:opacity-50"
          >
            <ShieldAlert size={14} />
            {scanning ? 'Scanning...' : 'Run Security Check'}
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
          >
            <RotateCw size={14} />
            Refresh
          </button>
        </div>
      }
    >
      {/* Scan Results */}
      {scanResults && (
        <Card className="mb-6" hover={false}>
          <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Scan Results</h3>
            <button onClick={() => setScanResults(null)} className="text-zinc-500 hover:text-white"><XIcon size={14} /></button>
          </div>
          <CardContent>
            {scanResults.error ? (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <ShieldX size={14} /> {scanResults.error}
              </p>
            ) : scanResults.score === 100 ? (
              <p className="text-xs text-green-400 flex items-center gap-1.5">
                <ShieldCheck size={14} /> All security checks passed — score 100/100
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 mb-2">Score: {scanResults.score}/100</p>
                {(scanResults.checks || []).map((check) => {
                  const Icon = getStatusIcon(check.status);
                  return (
                    <div key={check.id} className="flex items-start gap-2 text-xs">
                      <Icon size={14} className={`mt-0.5 shrink-0 ${getStatusColor(check.status)}`} />
                      <Badge variant={check.status === 'critical' ? 'error' : check.status === 'warning' ? 'warning' : 'success'} size="xs">
                        {check.status}
                      </Badge>
                      <span className="text-zinc-300">{check.label}{check.detail ? ` — ${check.detail}` : ''}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Health Score Bar */}
      {securityStatus && (
        <Card className="mb-6 border-l-4 border-l-emerald-500 overflow-hidden" hover={false}>
          <div className="flex flex-col md:flex-row items-center gap-6 p-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative">
                <svg className="w-20 h-20">
                  <circle
                    className="text-zinc-800"
                    strokeWidth="6"
                    stroke="currentColor"
                    fill="transparent"
                    r="34"
                    cx="40"
                    cy="40"
                  />
                  <circle
                    className={securityScore >= 90 ? 'text-emerald-500' : securityScore >= 70 ? 'text-yellow-500' : 'text-red-500'}
                    strokeWidth="6"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - securityScore / 100)}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="34"
                    cx="40"
                    cy="40"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xl font-bold">
                  {securityScore}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500 mt-2 font-medium">Security Score</div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {securityChecks.map((check) => {
                  const Icon = getStatusIcon(check.status);
                  return (
                    <div key={check.id} className="flex items-start gap-2.5 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                      <Icon size={16} className={`mt-0.5 shrink-0 ${getStatusColor(check.status)}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">{check.label}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1">{check.detail || 'System check passed.'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className={`text-2xl font-semibold tabular-nums ${totalSignals > 0 ? 'text-red-400' : 'text-white'}`}>
              {totalSignals}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Active Signals</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className={`text-2xl font-semibold tabular-nums ${highRisk24h > 0 ? 'text-yellow-400' : 'text-white'}`}>
              {highRisk24h}
            </div>
            <div className="text-xs text-zinc-500 mt-1">High-Risk (24h)</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className={`text-2xl font-semibold tabular-nums ${unscopedCount > 0 ? 'text-yellow-400' : 'text-white'}`}>
              {unscopedCount}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Unscoped Actions</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className={`text-2xl font-semibold tabular-nums ${invalidatedCount > 0 ? 'text-red-400' : 'text-white'}`}>
              {invalidatedCount}
            </div>
            <div className="text-xs text-zinc-500 mt-1">Invalidated (7d)</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Signal Feed - left */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader title={<span className="flex items-center">Risk Signals<HelpIcon sectionKey="security-signals" tip={HELP_TIPS['security-signals']} /></span>} icon={ShieldAlert} count={activeSignals.length}>
              <div className="flex items-center gap-2">
                {activeSignals.length > 0 && (
                  <button
                    onClick={dismissAllVisible}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                {dismissedList.length > 0 && (
                  <button
                    onClick={() => setShowDismissed(!showDismissed)}
                    className={`flex items-center gap-1 text-[10px] transition-colors ${showDismissed ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <EyeOff size={10} />
                    {dismissedList.length} dismissed
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <ListSkeleton rows={5} />
              ) : activeSignals.length === 0 && !showDismissed ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No active signals"
                  description={dismissedList.length > 0 ? `${dismissedList.length} signal${dismissedList.length !== 1 ? 's' : ''} dismissed.` : 'All clear. No risk signals detected.'}
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {activeSignals.map((signal, idx) => {
                    const SeverityIcon = getSeverityIcon(signal.severity);
                    return (
                      <div
                        key={`active-${idx}`}
                        className="w-full bg-surface-tertiary rounded-lg p-3.5 text-left hover:bg-white/[0.04] transition-colors duration-150 group flex items-start justify-between gap-2"
                      >
                        <button
                          onClick={() => openPanel(signal, 'signal')}
                          className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                        >
                          <SeverityIcon
                            size={16}
                            className={`mt-0.5 shrink-0 ${signal.severity === 'red' ? 'text-red-400' : 'text-yellow-400'}`}
                          />
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">{signal.label}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={signal.severity === 'red' ? 'error' : 'warning'} size="xs">
                                {signal.severity}
                              </Badge>
                              {signal.agent_id && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getAgentColor(signal.agent_id)}`}>
                                  {signal.agent_id}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissSignal(signal); }}
                            className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                            title="Dismiss signal"
                          >
                            <XIcon size={14} />
                          </button>
                          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400" />
                        </div>
                      </div>
                    );
                  })}

                  {/* Dismissed signals section */}
                  {showDismissed && dismissedList.length > 0 && (
                    <>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-wider pt-3 pb-1 px-1">Dismissed</div>
                      {dismissedList.map((signal, idx) => {
                        const SeverityIcon = getSeverityIcon(signal.severity);
                        return (
                          <div
                            key={`dismissed-${idx}`}
                            className="w-full bg-surface-tertiary/50 rounded-lg p-3.5 text-left opacity-60 hover:opacity-80 transition-opacity flex items-start justify-between gap-2"
                          >
                            <button
                              onClick={() => openPanel(signal, 'signal')}
                              className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                            >
                              <SeverityIcon
                                size={16}
                                className={`mt-0.5 shrink-0 ${signal.severity === 'red' ? 'text-red-400' : 'text-yellow-400'}`}
                              />
                              <div className="min-w-0">
                                <div className="text-sm text-zinc-400 truncate">{signal.label}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="default" size="xs">dismissed</Badge>
                                </div>
                              </div>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); restoreSignal(signal); }}
                              className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                              title="Restore signal"
                            >
                              <Undo2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* High-Risk Actions - right */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title={<span className="flex items-center">High-Risk Actions<HelpIcon sectionKey="risk-signals" tip={HELP_TIPS['risk-signals']} /></span>} icon={Zap} count={highRiskActions.length} />
            <CardContent>
              {loading ? (
                <ListSkeleton rows={5} />
              ) : highRiskActions.length === 0 ? (
                <EmptyState
                  icon={Eye}
                  title="No high-risk actions"
                  description="No actions flagged as high-risk."
                />
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {highRiskActions.map((action) => {
                    const riskScore = parseInt(action.risk_score, 10) || 0;
                    return (
                      <button
                        key={action.action_id}
                        onClick={() => openPanel(action, 'action')}
                        className="w-full bg-surface-tertiary rounded-lg p-3.5 text-left hover:bg-white/[0.04] transition-colors duration-150 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm text-white truncate">
                              {action.declared_goal?.substring(0, 60) || 'No goal'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={riskScore >= 90 ? 'error' : riskScore >= 70 ? 'warning' : 'default'} size="xs">
                                Risk: {riskScore}
                              </Badge>
                              <Badge variant={action.status === 'running' ? 'warning' : action.status === 'failed' ? 'error' : 'default'} size="xs">
                                {action.status}
                              </Badge>
                              {action.agent_id && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getAgentColor(action.agent_id)}`}>
                                  {action.agent_id}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-400 mt-0.5 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail Panel */}
      <SecurityDetailPanel item={panelItem} type={panelType} onClose={closePanel} onDismiss={dismissSignal} />
    </PageLayout>
  );
}
