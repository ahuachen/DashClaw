'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';

export default function ContentDashboard() {
  const { agentId } = useAgentFilter();
  const [content, setContent] = useState([]);
  const [stats, setStats] = useState({ totalContent: 0, published: 0, draft: 0, byPlatform: {} });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = agentId ? `?agent_id=${agentId}` : '';
      const res = await fetch(`/api/content${params}`);
      const data = await res.json();
      if (data.content) setContent(data.content);
      if (data.stats) setStats(data.stats);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch content data:', error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'published': return 'success';
      case 'draft': return 'warning';
      default: return 'default';
    }
  };

  const getPlatformVariant = (platform) => {
    switch (platform) {
      case 'LinkedIn': return 'info';
      case 'Twitter': return 'default';
      default: return 'default';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const platformCount = Object.keys(stats.byPlatform || {}).length;

  return (
    <PageLayout
      title="Content"
      subtitle={`Content Tracker${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Content']}
      actions={
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm text-secondary hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
        >
          <RotateCw size={14} />
          Refresh
        </button>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.totalContent}</div>
            <div className="text-xs text-tertiary mt-1">Total Content</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.published}</div>
            <div className="text-xs text-tertiary mt-1">Published</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.draft}</div>
            <div className="text-xs text-tertiary mt-1">Draft</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{platformCount}</div>
            <div className="text-xs text-tertiary mt-1">Platforms</div>
          </CardContent>
        </Card>
      </div>

      {/* Content Table */}
      <Card>
        <CardHeader title="Content" icon={FileText} count={content.length} />
        <CardContent>
          {loading ? (
            <ListSkeleton rows={5} />
          ) : content.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No content yet"
              description="Content items will appear here when created"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-tertiary border-b border-[rgba(255,255,255,0.06)]">
                    <th className="pb-3 font-medium">Title</th>
                    <th className="pb-3 font-medium">Platform</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {content.map((item) => (
                    <tr key={item.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-surface-tertiary transition-colors duration-150">
                      <td className="py-3">
                        <div className="text-sm font-medium text-white">{item.title}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant={getPlatformVariant(item.platform)} size="xs">
                          {item.platform || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <Badge variant={getStatusVariant(item.status)} size="xs">
                          {item.status || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-tertiary font-mono">{formatDate(item.created_at)}</span>
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

