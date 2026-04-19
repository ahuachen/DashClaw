'use client';

import { useState, useEffect } from 'react';
import { Gauge, BarChart3, DollarSign, AlertTriangle, Inbox, RotateCw, Settings } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Stat } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';

const DEFAULT_BUDGET = { daily_limit: 18000, weekly_limit: 126000, monthly_limit: 540000 };

export default function TokensDashboard() {
  const [tokenData, setTokenData] = useState({
    dailyUsed: 0,
    dailyLimit: DEFAULT_BUDGET.daily_limit,
    weeklyUsed: 0,
    weeklyLimit: DEFAULT_BUDGET.weekly_limit,
    monthlyUsed: 0,
    monthlyLimit: DEFAULT_BUDGET.monthly_limit,
  });
  const [lastUpdated, setLastUpdated] = useState('');
  const [operations, setOperations] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ ...DEFAULT_BUDGET });
  const [savingBudget, setSavingBudget] = useState(false);

  const costGuide = [
    { operation: 'LinkedIn snapshot', tokens: 50000, cost: '$0.75', risk: 'HIGH' },
    { operation: 'Generic webpage', tokens: 20000, cost: '$0.30', risk: 'MEDIUM' },
    { operation: 'Form filling', tokens: 5000, cost: '$0.08', risk: 'LOW' },
    { operation: 'Simple click', tokens: 100, cost: '$0.001', risk: 'LOW' },
    { operation: 'API call', tokens: 500, cost: '$0.008', risk: 'LOW' },
    { operation: 'Memory read', tokens: 2000, cost: '$0.03', risk: 'LOW' },
    { operation: 'File write', tokens: 1000, cost: '$0.015', risk: 'LOW' }
  ];

  const fetchTokenData = async () => {
    try {
      const [res, budgetRes] = await Promise.all([
        fetch('/api/tokens'),
        fetch('/api/tokens/budget'),
      ]);
      const data = await res.json();
      let budget = DEFAULT_BUDGET;
      try {
        const budgetData = await budgetRes.json();
        if (budgetData.budget) budget = budgetData.budget;
      } catch { /* use defaults */ }

      // Today's totals come from data.today (camelCase)
      const dailyUsed = data?.today?.totalTokens || 0;

      // Weekly = sum of history[] (7-day rolling window)
      const weeklyUsed = Array.isArray(data?.history)
        ? data.history.reduce((sum, day) => sum + (day.totalTokens || 0), 0)
        : 0;

      setTodayStats(data?.today || null);

      setTokenData({
        dailyUsed,
        dailyLimit: budget.daily_limit || DEFAULT_BUDGET.daily_limit,
        weeklyUsed,
        weeklyLimit: budget.weekly_limit || DEFAULT_BUDGET.weekly_limit,
        monthlyUsed: weeklyUsed,
        monthlyLimit: budget.monthly_limit || DEFAULT_BUDGET.monthly_limit,
      });
      setBudgetForm({
        daily_limit: budget.daily_limit || DEFAULT_BUDGET.daily_limit,
        weekly_limit: budget.weekly_limit || DEFAULT_BUDGET.weekly_limit,
        monthly_limit: budget.monthly_limit || DEFAULT_BUDGET.monthly_limit,
      });

      // Operations = timeline snapshots (recent 24h snapshots)
      if (Array.isArray(data?.timeline)) {
        const ops = data.timeline.slice(0, 10).map((s, idx) => ({
          id: idx,
          name: 'Token Snapshot',
          timestamp: s.time ? new Date(s.time).toLocaleString() : '',
          tokensIn: s.tokensIn || 0,
          tokensOut: s.tokensOut || 0,
          total: (s.tokensIn || 0) + (s.tokensOut || 0),
        }));
        setOperations(ops);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch token data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(fetchTokenData, 30000);
    return () => clearInterval(interval);
  }, []);

  const safePct = (used, limit) => {
    if (!limit || limit === 0) return 0;
    return ((used || 0) / limit) * 100;
  };

  const getDailyPct = () => safePct(tokenData.dailyUsed, tokenData.dailyLimit);
  const getWeeklyPct = () => safePct(tokenData.weeklyUsed, tokenData.weeklyLimit);
  const getMonthlyPct = () => safePct(tokenData.monthlyUsed, tokenData.monthlyLimit);

  const getProgressColor = (pct) => {
    if (pct > 100) return 'error';
    if (pct > 75) return 'warning';
    return 'success';
  };

  const getStatusText = (pct) => {
    if (pct > 100) return 'CRITICAL';
    if (pct > 75) return 'WARNING';
    return 'OK';
  };

  const getStatusVariant = (pct) => {
    if (pct > 100) return 'error';
    if (pct > 75) return 'warning';
    return 'success';
  };

  const getRiskVariant = (risk) => {
    switch (risk) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'success';
      default: return 'default';
    }
  };

  const formatNumber = (num) => (num ?? 0).toLocaleString();

  const dailyPct = getDailyPct();

  const statusBadge = (
    <Badge variant={getStatusVariant(dailyPct)}>
      {getStatusText(dailyPct)} - {dailyPct.toFixed(0)}%
    </Badge>
  );

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      await fetch('/api/tokens/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetForm),
      });
      setTokenData(prev => ({
        ...prev,
        dailyLimit: budgetForm.daily_limit,
        weeklyLimit: budgetForm.weekly_limit,
        monthlyLimit: budgetForm.monthly_limit,
      }));
      setShowBudgetModal(false);
    } catch (err) {
      console.error('Failed to save budget:', err);
    } finally {
      setSavingBudget(false);
    }
  };

  const refreshButton = (
    <button
      onClick={fetchTokenData}
      className="px-3 py-1.5 text-sm text-secondary hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
    >
      <RotateCw size={14} />
      Refresh
    </button>
  );

  return (
    <PageLayout
      title="Token Efficiency"
      subtitle={`Real-time Cost Accountability${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Tokens']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBudgetModal(true)}
            className="px-3 py-1.5 text-sm text-secondary hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
          >
            <Settings size={14} />
            Configure Budgets
          </button>
          {refreshButton}
          {statusBadge}
        </div>
      }
    >
      {/* Budget Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Daily Budget', pct: getDailyPct(), used: tokenData.dailyUsed, limit: tokenData.dailyLimit },
          { label: 'Weekly Budget', pct: getWeeklyPct(), used: tokenData.weeklyUsed, limit: tokenData.weeklyLimit },
          { label: 'Monthly Budget', pct: getMonthlyPct(), used: tokenData.monthlyUsed, limit: tokenData.monthlyLimit }
        ].map((budget) => (
          <Card key={budget.label} hover={false}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-secondary">{budget.label}</span>
                <Badge variant={getStatusVariant(budget.pct)} size="xs">
                  {getStatusText(budget.pct)}
                </Badge>
              </div>
              <div className="text-2xl font-semibold tabular-nums text-white mb-3">
                {budget.pct.toFixed(1)}%
              </div>
              <ProgressBar value={budget.pct} color={getProgressColor(budget.pct)} className="mb-3" />
              <div className="flex justify-between text-xs text-tertiary">
                <span>{formatNumber(budget.used)} used</span>
                <span>{formatNumber(budget.limit)} limit</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today Summary */}
      {todayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Stat label="Today In" value={formatNumber(todayStats.tokensIn || 0)} />
          <Stat label="Today Out" value={formatNumber(todayStats.tokensOut || 0)} />
          <Stat label="Est. Cost" value={todayStats.estimatedCost || '$0.00'} />
          <Stat label="Snapshots" value={todayStats.snapshots || 0} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Operations */}
        <Card hover={false}>
          <CardHeader title="Recent Operations" icon={BarChart3} />
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {operations.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No operations logged yet"
                  description="Token usage will appear here once tracked"
                />
              ) : (
                operations.map((op) => (
                  <div key={op.id} className="bg-surface-tertiary rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">{op.name}</div>
                        <div className="text-xs text-tertiary">{op.timestamp}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums text-error">{formatNumber(op.total)}</div>
                        <div className="text-xs text-tertiary">tokens</div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm">
                      <div className="flex space-x-4">
                        <span className="text-success text-xs tabular-nums">In: {formatNumber(op.tokensIn)}</span>
                        <span className="text-info text-xs tabular-nums">Out: {formatNumber(op.tokensOut)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cost Reference Guide */}
        <Card hover={false}>
          <CardHeader title="Cost Reference Guide" icon={DollarSign} />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-tertiary border-b border-[rgba(255,255,255,0.06)]">
                    <th className="pb-3">Operation</th>
                    <th className="pb-3">Tokens</th>
                    <th className="pb-3">Est. Cost</th>
                    <th className="pb-3">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {costGuide.map((item, index) => (
                    <tr key={index} className="border-b border-[rgba(255,255,255,0.03)]">
                      <td className="py-3 text-sm text-white">{item.operation}</td>
                      <td className="py-3 text-sm text-secondary tabular-nums">{formatNumber(item.tokens)}</td>
                      <td className="py-3 text-sm text-secondary">{item.cost}</td>
                      <td className="py-3">
                        <Badge variant={getRiskVariant(item.risk)} size="xs">
                          {item.risk}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Guidelines */}
      <Card hover={false} className="mt-6">
        <CardHeader title="Budget Guidelines" icon={AlertTriangle} />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-tertiary p-4 rounded-lg border-l-4 border-l-red-500">
              <div className="text-sm text-error font-semibold mb-2">When Budget Low (&lt;25%)</div>
              <ul className="text-sm text-secondary space-y-1">
                <li>1. Switch to Sonnet for automation</li>
                <li>2. Avoid browser snapshots</li>
                <li>3. Summarize context to files</li>
                <li>4. Use direct API calls</li>
              </ul>
            </div>
            <div className="bg-surface-tertiary p-4 rounded-lg border-l-4 border-l-yellow-500">
              <div className="text-sm text-warning font-semibold mb-2">Model Selection</div>
              <ul className="text-sm text-secondary space-y-1">
                <li>Complex reasoning: Opus</li>
                <li>Automation/execution: Sonnet</li>
                <li>Simple/status: Haiku</li>
                <li>Context &gt;150k: Summarize first</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Budget Configuration Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-secondary border border-[rgba(255,255,255,0.1)] rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Configure Token Budgets</h3>
            <div className="space-y-4">
              {[
                { key: 'daily_limit', label: 'Daily Limit' },
                { key: 'weekly_limit', label: 'Weekly Limit' },
                { key: 'monthly_limit', label: 'Monthly Limit' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-secondary mb-1">{label}</label>
                  <input
                    type="number"
                    min="0"
                    value={budgetForm[key]}
                    onChange={(e) => setBudgetForm(prev => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 text-sm text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {savingBudget ? 'Saving...' : 'Save Budgets'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

