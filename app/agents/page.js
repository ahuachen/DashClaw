'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Activity, ShieldCheck, ShieldAlert, Zap,
  Search, Filter, RotateCw, ChevronRight, Brain,
  Shield, CheckCircle2, XCircle, Clock, Info, Lock
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

export default function AgentsFleetPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.agent_id.toLowerCase().includes(search.toLowerCase()) ||
      (agent.name && agent.name.toLowerCase().includes(search.toLowerCase()));
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'online') return matchesSearch && (agent.status === 'active' || agent.status === 'online');
    if (filterStatus === 'critical') return matchesSearch && (agent.status === 'critical' || agent.status === 'error');
    if (filterStatus === 'offline') return matchesSearch && (agent.status === 'offline');
    
    return matchesSearch;
  });

  const stats = {
    total: agents.length,
    active: agents.filter(a => a.status === 'active' || a.status === 'online').length,
    critical: agents.filter(a => a.status === 'critical' || a.status === 'error').length,
    governed: agents.filter(a => a.governed).length || agents.length, // fallback
  };

  return (
    <PageLayout
      title="Agent Fleet"
      subtitle="Fleet-wide observability and permission governance"
      breadcrumbs={['Command', 'Agents']}
      actions={
        <button
          onClick={() => { setLoading(true); fetchAgents(); }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Agents</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-emerald-400">{stats.active}</div>
            <div className="text-xs text-zinc-500 mt-1">Online</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-red-400">{stats.critical}</div>
            <div className="text-xs text-zinc-500 mt-1">Critical</div>
          </div>
        </Card>
        <Card hover={false}>
          <div className="p-4 text-center">
            <div className="text-2xl font-semibold text-brand">{stats.governed}</div>
            <div className="text-xs text-zinc-500 mt-1">Governed</div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="mb-6 flex items-center gap-3 relative">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search agents by ID, name or capability..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-white/5 rounded-lg text-sm text-white focus:outline-none focus:border-brand/50 transition-colors"
          />
        </div>
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 border rounded-lg text-sm transition-colors flex items-center gap-2 ${
            showFilters || filterStatus !== 'all' 
              ? 'bg-brand/10 border-brand text-brand' 
              : 'bg-surface-secondary border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          <Filter size={14} />
          {filterStatus === 'all' ? 'Filters' : `Status: ${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`}
        </button>

        {showFilters && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-surface-secondary border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
            {[
              { id: 'all', label: 'All Agents', icon: Users, color: 'text-zinc-400' },
              { id: 'online', label: 'Online Only', icon: CheckCircle2, color: 'text-emerald-400' },
              { id: 'critical', label: 'Critical Only', icon: ShieldAlert, color: 'text-red-400' },
              { id: 'offline', label: 'Offline Only', icon: XCircle, color: 'text-zinc-500' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilterStatus(f.id); setShowFilters(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors hover:bg-white/5 ${
                  filterStatus === f.id ? 'text-brand bg-brand/5' : 'text-zinc-400'
                }`}
              >
                <f.icon size={14} className={f.color} />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Agents Table/List */}
      <Card hover={false}>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={Users}
                title="No agents connected"
                description="Connect your first agent using the DashClaw SDK to see it in the fleet overview."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                    <th className="px-6 py-4">Agent</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Governance</th>
                    <th className="px-6 py-4">Last Action</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAgents.map((agent) => (
                    <tr key={agent.agent_id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                            <Brain size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">{agent.name || agent.agent_id}</div>
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{agent.agent_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === 'active' || agent.status === 'online' ? 'bg-emerald-500' :
                            agent.status === 'critical' ? 'bg-red-500' : 'bg-zinc-500'
                          }`} />
                          <span className="text-xs text-zinc-300 capitalize">{agent.status || 'unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          {agent.governed !== false ? (
                            <Badge variant="success" size="xs">
                              <ShieldCheck size={10} className="mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="warning" size="xs">
                              <ShieldAlert size={10} className="mr-1" />
                              Passive
                            </Badge>
                          )}
                          {agent.verified ? (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-tighter" title="Agent identity cryptographically verified">
                              <Lock size={10} /> Verified Identity
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter" title="Agent is using an unsigned session">
                              <Info size={10} /> Unsigned
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-zinc-400">
                          {agent.last_action_at ? (
                            <div className="flex flex-col">
                              <span>{new Date(agent.last_action_at).toLocaleDateString()}</span>
                              <span className="text-[10px] opacity-50">{new Date(agent.last_action_at).toLocaleTimeString()}</span>
                            </div>
                          ) : 'Never'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/agents/${encodeURIComponent(agent.agent_id)}`}
                          className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 transition-colors"
                        >
                          View Control <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
