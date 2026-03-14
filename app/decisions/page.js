'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { getAgentColor } from '../lib/colors';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useSession } from 'next-auth/react';
import {
  Zap, Hammer, Rocket, FileText, Briefcase, Shield, MessageSquare,
  Link as LinkIcon, Calendar, Search, Eye, Wrench, RefreshCw, FlaskConical,
  Settings, Radio, AlertTriangle, Trash2, Package, Inbox,
  CheckCircle2, XCircle, Clock, Loader2, Ban,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw,
  ShieldCheck, ShieldAlert, ExternalLink, Info,
} from 'lucide-react';

const typeIconMap = {
  build: Hammer, deploy: Rocket, post: FileText, apply: Briefcase, security: Shield,
  message: MessageSquare, api: LinkIcon, calendar: Calendar, research: Search, review: Eye,
  fix: Wrench, refactor: RefreshCw, test: FlaskConical, config: Settings, monitor: Radio,
  alert: AlertTriangle, cleanup: Trash2, sync: RefreshCw, migrate: Package,
};

const statusIconMap = {
  completed: CheckCircle2, failed: XCircle, pending: Clock, running: Loader2, cancelled: Ban,
};

const statusVariantMap = {
  completed: 'success', failed: 'error', running: 'warning', cancelled: 'default', pending: 'info',
};

export default function DecisionsLedger() {
  const { agentId: globalAgentId } = useAgentFilter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [expandedData, setExpandedData] = useState({});
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [filterAgent, setFilterAgent] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRiskMin, setFilterRiskMin] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Sync global agent filter → local filter
  useEffect(() => {
    setFilterAgent(globalAgentId || '');
    setPage(0);
  }, [globalAgentId]);

  const fetchActions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set('agent_id', filterAgent);
      if (filterType) params.set('action_type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      if (filterRiskMin) params.set('risk_min', filterRiskMin);
      params.set('limit', pageSize.toString());
      params.set('offset', (page * pageSize).toString());

      const res = await fetch(`/api/actions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const actionsList = data.actions || [];
      setActions(actionsList);
      setStats(data.stats || {});
      setTotal(data.total || 0);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch actions:', error);
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterType, filterStatus, filterRiskMin, page]);

  useEffect(() => {
    setLoading(true);
    fetchActions();
  }, [fetchActions]);

  const handleClearActions = async () => {
    const agentLabel = filterAgent || 'all agents';
    const statusLabel = filterStatus || 'all statuses';
    const msg = `Delete actions for ${agentLabel} (${statusLabel})? This cannot be undone.`;
    if (!confirm(msg)) return;

    setClearing(true);
    try {
      const params = new URLSearchParams();
      if (filterAgent) params.set('agent_id', filterAgent);
      if (filterStatus) params.set('status', filterStatus);
      // If no filters set, require at least a status to prevent accidental full wipe
      if (!filterAgent && !filterStatus) {
        params.set('status', 'completed');
      }
      const res = await fetch(`/api/actions?${params}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        alert(`Deleted ${data.deleted} action(s).`);
        setPage(0);
        fetchActions();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete actions');
      }
    } catch {
      alert('Failed to delete actions');
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteAction = async (actionId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this action? This cannot be undone.')) return;
    setDeletingId(actionId);
    try {
      const res = await fetch(`/api/actions?action_id=${actionId}`, { method: 'DELETE' });
      if (res.ok) {
        setActions(prev => prev.filter(a => a.action_id !== actionId));
        if (expandedId === actionId) setExpandedId(null);
        setTotal(prev => Math.max(0, prev - 1));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete action');
      }
    } catch {
      alert('Failed to delete action');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = async (actionId) => {
    if (expandedId === actionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(actionId);
    if (!expandedData[actionId]) {
      try {
        const res = await fetch(`/api/actions/${actionId}`);
        if (res.ok) {
          const data = await res.json();
          setExpandedData(prev => ({ ...prev, [actionId]: data }));
        }
      } catch (error) {
        console.error('Failed to fetch action detail:', error);
      }
    }
  };

  const getTypeIcon = (type) => {
    const Icon = typeIconMap[type] || Zap;
    return <Icon size={16} className="text-zinc-400" />;
  };

  const getStatusIcon = (status) => {
    const Icon = statusIconMap[status] || Clock;
    const colors = { completed: 'text-green-400', failed: 'text-red-400', running: 'text-yellow-400', pending: 'text-blue-400', cancelled: 'text-zinc-500' };
    return <Icon size={14} className={colors[status] || 'text-zinc-400'} />;
  };

  const getRiskColor = (score) => {
    const s = parseInt(score, 10);
    if (s >= 70) return 'text-red-400';
    if (s >= 40) return 'text-amber-400';
    return 'text-green-400';
  };

  const formatTime = (ts) => {
    if (!ts) return '--';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch { return ts; }
  };

  const parseJsonArray = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const successRate = parseInt(stats.total, 10) > 0
    ? Math.round((parseInt(stats.completed, 10) / parseInt(stats.total, 10)) * 100)
    : 0;

  const totalPages = Math.ceil(total / pageSize);

  const selectClass = 'px-3 py-2 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg text-white text-sm focus:outline-none focus:border-brand transition-colors duration-150';

  return (
    <PageLayout
      title="Decisions Ledger"
      subtitle={`Global stream of governed agent actions${lastUpdated ? ` \u00B7 Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Governance', 'Decisions']}
      actions={
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={handleClearActions}
              disabled={clearing}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-red-500/30 transition-colors duration-150 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {clearing ? 'Clearing...' : 'Clear Actions'}
            </button>
          )}
          <button
            onClick={() => { setLoading(true); fetchActions(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
          >
            <RotateCw size={14} />
            Refresh
          </button>
        </div>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total || 0, color: 'text-white' },
          { label: 'Success Rate', value: `${successRate}%`, color: 'text-green-400' },
          { label: 'Running', value: stats.running || 0, color: 'text-yellow-400' },
          { label: 'High Risk', value: stats.high_risk || 0, color: parseInt(stats.high_risk, 10) > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Total Cost', value: `$${parseFloat(stats.total_cost || 0).toFixed(2)}`, color: 'text-purple-400' },
        ].map((stat) => (
          <Card key={stat.label} hover={false}>
            <div className="p-4 text-center">
              <div className={`text-2xl font-semibold tabular-nums ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card hover={false} className="mb-6">
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0); }} className={selectClass}>
              <option value="">All Types</option>
              {['build','deploy','post','apply','security','message','api','calendar','research','review','fix','refactor','test','config','monitor','alert','cleanup','sync','migrate','other'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }} className={selectClass}>
              <option value="">All Statuses</option>
              {['running','completed','failed','cancelled','pending'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterRiskMin} onChange={(e) => { setFilterRiskMin(e.target.value); setPage(0); }} className={selectClass}>
              <option value="">Any Risk</option>
              <option value="40">Medium+ (40+)</option>
              <option value="70">High (70+)</option>
              <option value="90">Critical (90+)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Actions List */}
      <Card hover={false}>
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-200 uppercase tracking-wider">
            Decisions <span className="text-xs font-normal text-zinc-500 normal-case ml-2">({total} total)</span>
          </h2>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-white/5 disabled:opacity-30 text-zinc-400 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-zinc-500 tabular-nums">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-white/5 disabled:opacity-30 text-zinc-400 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <EmptyState icon={Inbox} title="No actions found" description="Adjust filters or wait for agent activity" />
          ) : (
            <div className="space-y-2">
              {actions.map((action) => {
                const isExpanded = expandedId === action.action_id;
                const detail = expandedData[action.action_id];
                const systems = parseJsonArray(action.systems_touched);
                const sideEffects = parseJsonArray(action.side_effects);
                const artifacts = parseJsonArray(action.artifacts_created);

                return (
                  <div key={action.action_id} className="bg-surface-tertiary rounded-lg border border-[rgba(255,255,255,0.04)] overflow-hidden">
                    <div
                      onClick={() => toggleExpand(action.action_id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleExpand(action.action_id); }}
                      className="w-full p-4 text-left hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer"
                    >
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* 1. Agent & Intent */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${action.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getAgentColor(action.agent_id)}`}>
                              {action.agent_name || action.agent_id}
                            </span>
                            <span className="text-[10px] text-zinc-600 font-mono">{formatTime(action.timestamp_start)}</span>
                          </div>
                          <div className="font-medium text-sm text-white truncate pl-3.5 border-l border-white/5">
                            {action.declared_goal}
                          </div>
                        </div>

                        {/* Lineage Arrow */}
                        <div className="hidden md:block text-zinc-700">
                          <ChevronRight size={16} />
                        </div>

                        {/* 2. Policy Evaluation (Simplified) */}
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] rounded-lg border border-white/5 min-w-[140px]">
                          <Shield size={14} className={action.risk_score >= 70 ? 'text-red-400' : 'text-emerald-400'} />
                          <div>
                            <div className="text-[9px] text-zinc-500 uppercase font-bold tracking-tighter">Governance</div>
                            <div className={`text-xs font-semibold ${getRiskColor(action.risk_score)}`}>
                              Risk {action.risk_score || 0}
                            </div>
                          </div>
                        </div>

                        {/* Lineage Arrow */}
                        <div className="hidden md:block text-zinc-700">
                          <ChevronRight size={16} />
                        </div>

                        {/* 3. Outcome */}
                        <div className="flex items-center justify-between gap-4 min-w-[200px]">
                          <div className="flex flex-col items-end gap-1.5 mr-2">
                            {action.verified ? (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-tighter bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10" title="Cryptographically signed by agent">
                                <ShieldCheck size={10} /> Verified
                              </div>
                            ) : action.signature ? (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-red-500 uppercase tracking-tighter bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10" title="Signature invalid or tampered">
                                <ShieldAlert size={10} /> Invalid
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded border border-white/5" title="No cryptographic signature provided">
                                <Info size={10} /> Unsigned
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {getStatusIcon(action.status)}
                              <span className={`text-xs font-bold uppercase tracking-wide ${
                                action.status === 'completed' ? 'text-emerald-400' :
                                action.status === 'failed' ? 'text-red-400' : 'text-zinc-400'
                              }`}>
                                {action.status}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <button
                                onClick={(e) => handleDeleteAction(action.action_id, e)}
                                disabled={deletingId === action.action_id}
                                className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                title="Delete action"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            {isExpanded ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[rgba(255,255,255,0.04)] p-4 bg-surface-secondary space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Decision Rationale</div>
                            <div className="text-sm text-zinc-300">{action.reasoning || 'Not specified'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Authorization</div>
                            <div className="text-sm text-zinc-300">{action.authorization_scope || 'Not specified'}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div><span className="text-zinc-500">Confidence: </span><span className="text-white">{action.confidence || 50}%</span></div>
                          <div><span className="text-zinc-500">Reversible: </span><span className={action.reversible ? 'text-green-400' : 'text-red-400'}>{action.reversible ? 'Yes' : 'No'}</span></div>
                          <div><span className="text-zinc-500">Duration: </span><span className="text-white">{action.duration_ms ? `${(action.duration_ms / 1000).toFixed(1)}s` : '--'}</span></div>
                          <div><span className="text-zinc-500">Cost: </span><span className="text-white font-mono">${parseFloat(action.cost_estimate || 0).toFixed(4)}</span></div>
                        </div>

                        {action.output_summary && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Output</div>
                            <div className="text-sm text-zinc-300 bg-black/20 p-2 rounded font-mono">{action.output_summary}</div>
                          </div>
                        )}

                        {action.error_message && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Error</div>
                            <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/10 p-2 rounded font-mono">{action.error_message}</div>
                          </div>
                        )}

                        {sideEffects.length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Side Effects ({sideEffects.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {sideEffects.map((se, i) => <Badge key={i} variant="warning" size="xs">{se}</Badge>)}
                            </div>
                          </div>
                        )}

                        {artifacts.length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Artifacts ({artifacts.length})</div>
                            <div className="flex flex-wrap gap-1">
                              {artifacts.map((a, i) => <Badge key={i} variant="info" size="xs">{a}</Badge>)}
                            </div>
                          </div>
                        )}

                        {detail && (
                          <>
                            {detail.open_loops?.length > 0 && (
                              <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Open Loops ({detail.open_loops.length})</div>
                                <div className="space-y-1">
                                  {detail.open_loops.map(loop => (
                                    <div key={loop.loop_id} className="flex items-center gap-2 text-sm">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${loop.status === 'open' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                      <span className="text-zinc-300">{loop.description}</span>
                                      <span className="text-xs text-zinc-600">({loop.loop_type} / {loop.priority})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {detail.assumptions?.length > 0 && (
                              <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Assumptions ({detail.assumptions.length})</div>
                                <div className="space-y-1">
                                  {detail.assumptions.map(asm => (
                                    <div key={asm.assumption_id} className="flex items-center gap-2 text-sm">
                                      {asm.validated ? <CheckCircle2 size={14} className="text-green-400" /> : asm.invalidated ? <XCircle size={14} className="text-red-400" /> : <Clock size={14} className="text-zinc-500" />}
                                      <span className="text-zinc-300">{asm.assumption}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        <div className="pt-2 flex items-center gap-4">
                          <Link href={`/decisions/${action.action_id}`} className="text-sm text-brand hover:text-brand-hover transition-colors duration-150">
                            View full decision record
                          </Link>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `${window.location.origin}/replay/${action.action_id}`;
                              navigator.clipboard.writeText(url);
                              alert('Replay link copied to clipboard!');
                            }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                          >
                            <ExternalLink size={12} />
                            Share Replay
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}

