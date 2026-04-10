'use client';

import { useState, useEffect } from 'react';
import PageLayout from '../components/PageLayout';
import ShieldsGrid from './components/ShieldsGrid';
import CustomTab from './components/CustomTab';
import ActivityTab from './components/ActivityTab';

const TABS = [
  { id: 'shields', label: 'Shields' },
  { id: 'custom', label: 'Custom' },
  { id: 'activity', label: 'Activity' },
];

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState('shields');
  const [stats, setStats] = useState({ active: 0, blocks: 0, approvals: 0, agents: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [policiesRes, decisionsRes, agentsRes] = await Promise.all([
          fetch('/api/policies'),
          fetch('/api/guard/decisions?limit=1'),
          fetch('/api/agents'),
        ]);
        const policiesData = policiesRes.ok ? await policiesRes.json() : { policies: [] };
        const decisionsData = decisionsRes.ok ? await decisionsRes.json() : { stats: {} };
        const agentsData = agentsRes.ok ? await agentsRes.json() : { agents: [] };
        setStats({
          active: (policiesData.policies || []).filter(p => p.active === 1).length,
          blocks: decisionsData.stats?.blocks || 0,
          approvals: decisionsData.stats?.approvals || 0,
          agents: (agentsData.agents || []).length,
        });
      } catch { /* ignore */ }
    };
    fetchStats();
  }, []);

  return (
    <PageLayout
      title="Policies"
      subtitle="Governance shields and guard rules"
      breadcrumbs={['Governance', 'Policies']}
      maturity="stable"
    >
      {/* Stats bar */}
      <div className="mb-6 flex items-center gap-3 text-xs text-zinc-400">
        <span><span className="text-white font-medium">{stats.active}</span> active shields</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-red-400 font-medium">{stats.blocks}</span> blocks this week</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-amber-400 font-medium">{stats.approvals}</span> approvals this week</span>
        <span className="text-zinc-600">&middot;</span>
        <span><span className="text-white font-medium">{stats.agents}</span> agents governed</span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-[rgba(255,255,255,0.06)]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'shields' && <ShieldsGrid />}
      {activeTab === 'custom' && <CustomTab />}
      {activeTab === 'activity' && <ActivityTab />}
    </PageLayout>
  );
}
