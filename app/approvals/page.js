'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, Check, X, Clock, User, Zap, 
  RefreshCw, MessageCircle, Info, AlertTriangle
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useSession } from 'next-auth/react';
import { isDemoMode } from '../lib/isDemoMode';

export default function ApprovalsPage() {
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState(null);
  const { data: session } = useSession();

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/actions?status=pending_approval&limit=50');
      if (!res.ok) throw new Error('Failed to load pending actions');
      const json = await res.json();
      setPendingActions(json.actions || []);
    } catch (err) {
      setError(err.message);
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
      const res = await fetch(`/api/actions/${actionId}/approve`, {
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

  return (
    <PageLayout
      title="Approval Queue"
      subtitle="Human-in-the-loop intervention for sensitive agent actions"
      breadcrumbs={['Operations', 'Approvals']}
      actions={
        <button onClick={fetchPending} className="p-2 text-zinc-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      }
    >
      <div className="max-w-5xl mx-auto">
        {isDemo && (
          <div className="mb-6 p-4 rounded-xl bg-zinc-500/10 border border-zinc-500/20 flex gap-3 items-start">
            <Info className="text-zinc-300 mt-0.5" size={18} />
            <div>
              <div className="text-sm font-bold text-zinc-200">Demo Mode</div>
              <p className="text-xs text-zinc-400 mt-1">Approvals are read-only in the demo. Self-host to approve/deny actions for real agents.</p>
            </div>
          </div>
        )}
        {!isAdmin && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
            <ShieldAlert className="text-amber-500 mt-0.5" size={18} />
            <div>
              <div className="text-sm font-bold text-amber-200">Read-Only Access</div>
              <p className="text-xs text-amber-400 mt-1">Only administrators can approve or deny actions. You are currently viewing as a member.</p>
            </div>
          </div>
        )}

        {pendingActions.length === 0 ? (
          <div className="py-20">
            <EmptyState 
              icon={Check} 
              title="All clear!" 
              description="No actions currently require human approval." 
            />
          </div>
        ) : (
          <div className="space-y-4">
            {pendingActions.map((action) => (
              <Card key={action.action_id} className="border-l-4 border-l-amber-500">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    
                    {/* Action Content */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="warning">Awaiting Approval</Badge>
                            <span className="text-[10px] text-zinc-500 font-mono">{action.action_id}</span>
                          </div>
                          <h3 className="text-lg font-bold text-white">{action.declared_goal}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Risk Score</div>
                          <div className={`text-2xl font-bold font-mono ${action.risk_score >= 70 ? 'text-red-400' : 'text-amber-400'}`}>
                            {action.risk_score}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <User size={14} />
                            <span>Agent: <span className="text-zinc-200">{action.agent_name || action.agent_id}</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Zap size={14} />
                            <span>Type: <span className="text-zinc-200 uppercase text-xs">{action.action_type}</span></span>
                          </div>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Clock size={14} />
                            <span>Triggered: <span className="text-zinc-200">{new Date(action.timestamp_start).toLocaleString()}</span></span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-tertiary border border-white/5 space-y-2">
                          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                            <Info size={10} /> Systems Touched
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {JSON.parse(action.systems_touched || '[]').map(s => (
                              <Badge key={s} variant="outline" size="xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {action.reasoning && (
                        <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 italic text-zinc-400 text-sm">
                          &ldquo;{action.reasoning}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Actions Panel */}
                    <div className="md:w-48 flex flex-row md:flex-col gap-2 justify-center">
                      <button
                        onClick={() => handleDecision(action.action_id, 'allow')}
                        disabled={!canDecide || processingId === action.action_id}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        <Check size={18} /> Allow
                      </button>
                      <button
                        onClick={() => handleDecision(action.action_id, 'deny')}
                        disabled={!canDecide || processingId === action.action_id}
                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg font-bold text-sm transition-colors disabled:opacity-50"
                      >
                        <X size={18} /> Deny
                      </button>
                    </div>

                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

