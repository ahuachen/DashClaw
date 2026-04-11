'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Check, X, Clock, User, Zap,
  RefreshCw, Info,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useSession } from 'next-auth/react';
import { isDemoMode } from '../lib/isDemoMode';

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function Banner({ icon: Icon, tone, title, children }) {
  const tones = {
    neutral: 'border-border bg-white/[0.02] text-zinc-300',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  };
  const iconTone = {
    neutral: 'text-zinc-400',
    warning: 'text-amber-400',
  };
  return (
    <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${tones[tone]}`}>
      <Icon size={16} className={`mt-0.5 shrink-0 ${iconTone[tone]}`} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</div>
        <p className="mt-1 text-xs text-zinc-400">{children}</p>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const { data: session, status: sessionStatus } = useSession();

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/actions?status=pending_approval&limit=50');
      if (!res.ok) throw new Error('Failed to load pending actions');
      const json = await res.json();
      setPendingActions(json.actions || []);
    } catch {
      // Swallow — the list stays as-is and the user can retry with the refresh button
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 10000); // Polling for new approvals
    return () => clearInterval(interval);
  }, [fetchPending]);

  const handleDecision = async (actionId, decision) => {
    try {
      setProcessingId(actionId);
      const res = await fetch(`/api/approvals/${actionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision })
      });

      if (!res.ok) throw new Error('Failed to submit decision');

      // Optimistic update
      setPendingActions(prev => prev.filter(a => a.action_id !== actionId));
    } catch (err) {
      alert(`Decision failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const isAdmin = session?.user?.role === 'admin';
  const isDemo = isDemoMode();
  const canDecide = isAdmin && !isDemo;

  // BUG-03 fix: do not render the READ-ONLY banner while the session is still
  // hydrating. useSession() returns status='loading' on the initial mount until
  // NextAuth resolves the JWT; during that window session.user.role is undefined,
  // which naively evaluates as !isAdmin and causes the orange banner to flash
  // for a real admin user during page refresh. Gate the banner on a settled
  // session state instead.
  const sessionSettled = sessionStatus !== 'loading';

  return (
    <PageLayout
      title="Approval Queue"
      subtitle="Human-in-the-loop intervention for sensitive agent actions"
      breadcrumbs={['Operations', 'Approvals']}
      maturity="stable"
      actions={
        <button
          onClick={fetchPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-tertiary px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:border-border-hover hover:text-white"
          aria-label="Refresh pending approvals"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      }
    >
      <div className="mx-auto max-w-5xl">
        {isDemo && (
          <Banner icon={Info} tone="neutral" title="Demo Mode">
            Approvals are read-only in the demo. Self-host to approve or deny actions for real agents.
          </Banner>
        )}
        {sessionSettled && !isAdmin && (
          <Banner icon={ShieldAlert} tone="warning" title="Read-only access">
            Only administrators can approve or deny actions. You are currently viewing as a member.
          </Banner>
        )}

        {pendingActions.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Check}
              title="All clear"
              description="No actions currently require human approval."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pendingActions.map((action) => {
              const systems = safeJsonArray(action.systems_touched);
              const isProcessing = processingId === action.action_id;
              const riskColor = action.risk_score >= 70 ? 'text-red-400' : 'text-amber-400';
              return (
                <Card key={action.action_id} hover={false}>
                  <CardContent className="pt-5">
                    <div className="flex flex-col gap-6 md:flex-row">
                      {/* Action Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge variant="warning">Awaiting Approval</Badge>
                              <span className="font-mono text-[11px] text-zinc-500">{action.action_id}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{action.declared_goal}</h3>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              Risk
                            </div>
                            <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${riskColor}`}>
                              {action.risk_score || 0}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-zinc-500">
                              <User size={14} />
                              <span>Agent</span>
                              <span className="ml-auto text-zinc-200">{action.agent_name || action.agent_id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <Zap size={14} />
                              <span>Type</span>
                              <span className="ml-auto text-zinc-200">{action.action_type}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <Clock size={14} />
                              <span>Triggered</span>
                              <span className="ml-auto tabular-nums text-zinc-200">
                                {new Date(action.timestamp_start).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2 rounded-lg border border-border bg-surface-tertiary p-3">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              <Info size={10} /> Systems Touched
                            </div>
                            {systems.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {systems.map(s => (
                                  <Badge key={s} variant="default" size="xs">{s}</Badge>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-500">None declared</div>
                            )}
                          </div>
                        </div>

                        {action.reasoning && (
                          <blockquote className="rounded-lg border-l-2 border-border bg-surface-tertiary/50 px-4 py-2.5 text-sm italic text-zinc-400">
                            &ldquo;{action.reasoning}&rdquo;
                          </blockquote>
                        )}
                      </div>

                      {/* Actions Panel */}
                      <div className="flex flex-row justify-center gap-2 md:w-44 md:flex-col">
                        <button
                          onClick={() => handleDecision(action.action_id, 'allow')}
                          disabled={!canDecide || isProcessing}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/20 focus:border-emerald-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Check size={16} /> Allow
                        </button>
                        <button
                          onClick={() => handleDecision(action.action_id, 'deny')}
                          disabled={!canDecide || isProcessing}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:border-red-500/40 hover:bg-red-500/20 focus:border-red-500/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <X size={16} /> Deny
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

