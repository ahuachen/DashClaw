'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import PageLayout from '../components/PageLayout';
import ShieldsGrid from './components/ShieldsGrid';
import CustomTab from './components/CustomTab';
import ActivityTab from './components/ActivityTab';

export default function PoliciesPage() {
  const t = useTranslations('policies');
  const TABS = [
    { id: 'shields', label: t('tabs.shields') },
    { id: 'custom', label: t('tabs.custom') },
    { id: 'activity', label: t('tabs.activity') },
  ];
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
      title={t('title')}
      subtitle={t('subtitle')}
      breadcrumbs={['Governance', 'Policies']}
      maturity="stable"
    >
      {/* Stats bar — prose rail, not another card grid */}
      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
        <span>{t('stats.activeShields', { count: stats.active })}</span>
        <span aria-hidden="true" className="text-zinc-700">&middot;</span>
        <span>{t('stats.blocksThisWeek', { count: stats.blocks })}</span>
        <span aria-hidden="true" className="text-zinc-700">&middot;</span>
        <span>{t('stats.approvalsThisWeek', { count: stats.approvals })}</span>
        <span aria-hidden="true" className="text-zinc-700">&middot;</span>
        <span>{t('stats.agentsGoverned', { count: stats.agents })}</span>
      </div>

      {/* Tabs */}
      <div role="tablist" className="mb-6 flex items-center gap-1 border-b border-border">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'text-white' : 'text-tertiary hover:text-secondary'
              }`}
            >
              {tab.label}
              {isActive && (
                <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'shields' && <ShieldsGrid />}
      {activeTab === 'custom' && <CustomTab />}
      {activeTab === 'activity' && <ActivityTab />}
    </PageLayout>
  );
}
