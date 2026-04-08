'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Contact, MessageSquare, Zap, Calendar, Search, ArrowUpRight, ArrowDownLeft, RotateCw, X } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAgentFilter } from '../lib/AgentFilterContext';

export default function RelationshipsDashboard() {
  const { agentId } = useAgentFilter();
  const [contacts, setContacts] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [stats, setStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0, followUpsDue: 0 });
  const [lastUpdated, setLastUpdated] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tempFilter, setTempFilter] = useState('All');
  const [showDueOnly, setShowDueOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', platform: 'GitHub', temperature: 'WARM', context: '', followUpDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params = agentId ? `?agent_id=${agentId}` : '';
      const res = await fetch(`/api/relationships${params}`);
      const data = await res.json();
      if (data.contacts) setContacts(data.contacts);
      if (data.interactions) setInteractions(data.interactions);
      if (data.stats) setStats(data.stats);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch relationships:', error);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getTempVariant = (temp) => {
    switch (temp) {
      case 'HOT': return 'error';
      case 'WARM': return 'warning';
      case 'COLD': return 'info';
      default: return 'default';
    }
  };

  const getTempBorderColor = (temp) => {
    switch (temp) {
      case 'HOT': return 'border-l-red-500';
      case 'WARM': return 'border-l-yellow-500';
      case 'COLD': return 'border-l-blue-500';
      default: return 'border-l-zinc-500';
    }
  };

  const getDirectionIcon = (dir) => dir === 'outbound' ? ArrowUpRight : ArrowDownLeft;

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date('2026-02-04');
    const target = new Date(dateStr);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getDaysColor = (days) => {
    if (days === null) return '';
    if (days <= 0) return 'text-red-400';
    if (days <= 2) return 'text-yellow-400';
    return 'text-green-400';
  };

  const handleAddContact = async () => {
    if (!addForm.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setShowAddModal(false);
        setAddForm({ name: '', platform: 'GitHub', temperature: 'WARM', context: '', followUpDate: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name?.toLowerCase().includes(q) && !c.context?.toLowerCase().includes(q) && !c.platform?.toLowerCase().includes(q)) return false;
    }
    if (tempFilter !== 'All' && c.temperature !== tempFilter) return false;
    if (showDueOnly) {
      const days = getDaysUntil(c.followUpDate);
      if (days === null || days > 0) return false;
    }
    return true;
  });

  return (
    <PageLayout
      title="Contacts"
      subtitle={`Contact Management & Follow-ups${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Contacts']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm text-white bg-brand hover:bg-brand-hover rounded-lg transition-colors duration-150 flex items-center gap-1.5 font-medium"
          >
            <Contact size={14} />
            Add Contact
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
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.total}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Contacts</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.hot}</div>
            <div className="text-xs text-zinc-500 mt-1">Hot Leads</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.warm}</div>
            <div className="text-xs text-zinc-500 mt-1">Warm</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.cold}</div>
            <div className="text-xs text-zinc-500 mt-1">Cold</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.followUpsDue}</div>
            <div className="text-xs text-zinc-500 mt-1">Follow-ups Due</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contacts List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Contacts" icon={Contact} count={filteredContacts.length} />
            <CardContent>
              {/* Search & Filters */}
              <div className="mb-4 space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search by name, context, or platform..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {['All', 'HOT', 'WARM', 'COLD'].map((temp) => (
                    <button
                      key={temp}
                      onClick={() => setTempFilter(temp)}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-colors duration-150 ${
                        tempFilter === temp
                          ? temp === 'HOT' ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                            : temp === 'WARM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                            : temp === 'COLD' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                            : 'bg-white/10 text-white border border-[rgba(255,255,255,0.2)]'
                          : 'bg-surface-tertiary text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[rgba(255,255,255,0.12)]'
                      }`}
                    >
                      {temp === 'All' ? 'All' : temp}
                    </button>
                  ))}
                  <div className="w-px h-5 bg-[rgba(255,255,255,0.08)] mx-1" />
                  <button
                    onClick={() => setShowDueOnly(!showDueOnly)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors duration-150 flex items-center gap-1.5 ${
                      showDueOnly
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-surface-tertiary text-zinc-400 border border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[rgba(255,255,255,0.12)]'
                    }`}
                  >
                    <Calendar size={12} />
                    Overdue Only
                  </button>
                </div>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {filteredContacts.length === 0 && (
                  <div className="text-center text-sm text-zinc-500 py-8">
                    No contacts match the current filters.
                  </div>
                )}
                {filteredContacts.map((contact) => {
                  const daysUntil = getDaysUntil(contact.followUpDate);
                  return (
                    <div key={contact.id} className={`bg-surface-tertiary rounded-lg p-4 border-l-4 ${getTempBorderColor(contact.temperature)}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-sm font-medium text-zinc-300">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">@{contact.name}</div>
                            <div className="text-xs text-zinc-500">{contact.platform}</div>
                          </div>
                        </div>
                        <Badge variant={getTempVariant(contact.temperature)} size="xs">
                          {contact.temperature}
                        </Badge>
                      </div>

                      <div className="text-sm text-zinc-300 mb-3">{contact.context}</div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-zinc-500">
                          Last contact: {contact.lastContact} -- {contact.interactions} interactions
                        </div>
                        {contact.followUpDate && (
                          <div className={`font-medium ${getDaysColor(daysUntil)}`}>
                            Follow-up: {daysUntil <= 0 ? 'OVERDUE' : `${daysUntil} days`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Interactions */}
        <Card>
          <CardHeader title="Recent Activity" icon={MessageSquare} count={interactions.length} />
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {interactions.map((interaction) => {
                const DirectionIcon = getDirectionIcon(interaction.direction);
                return (
                  <div key={interaction.id} className="bg-surface-tertiary rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <DirectionIcon size={14} className="text-zinc-400" />
                        <span className="text-sm font-medium text-white">@{interaction.contactName}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{interaction.date}</span>
                    </div>
                    <div className="text-sm text-zinc-300">{interaction.summary}</div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-zinc-500">{interaction.type}</span>
                      <span className="text-zinc-500">{interaction.platform}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-secondary border border-[rgba(255,255,255,0.1)] rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Contact</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Platform</label>
                <select
                  value={addForm.platform}
                  onChange={(e) => setAddForm(prev => ({ ...prev, platform: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                >
                  <option value="GitHub">GitHub</option>
                  <option value="Twitter">Twitter</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Discord">Discord</option>
                  <option value="Slack">Slack</option>
                  <option value="Email">Email</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Temperature</label>
                <select
                  value={addForm.temperature}
                  onChange={(e) => setAddForm(prev => ({ ...prev, temperature: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                >
                  <option value="HOT">HOT</option>
                  <option value="WARM">WARM</option>
                  <option value="COLD">COLD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Context</label>
                <textarea
                  value={addForm.context}
                  onChange={(e) => setAddForm(prev => ({ ...prev, context: e.target.value }))}
                  placeholder="How do you know this contact?"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-brand resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={addForm.followUpDate}
                  onChange={(e) => setAddForm(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={submitting || !addForm.name.trim()}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

