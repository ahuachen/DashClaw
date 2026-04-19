'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HardDrive, User, Wrench, Globe, File, Pin, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { ProgressBar } from './ui/ProgressBar';
import { StatCompact } from './ui/Stat';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { CardSkeleton } from './ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { HelpIcon } from './HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';

export default function MemoryHealthCard() {
  const [data, setData] = useState({
    health: null,
    entities: [],
    topics: [],
    loading: true
  });
  const { agentId } = useAgentFilter();

  const fetchData = async () => {
    try {
      const res = await fetch('/api/memory');
      const json = await res.json();
      setData({
        health: json.health,
        entities: json.entities || [],
        topics: json.topics || [],
        entityBreakdown: json.entityBreakdown || [],
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch memory health:', error);
      setData(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-error';
  };

  const getScoreBarColor = (score) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'person': return User;
      case 'tool': return Wrench;
      case 'service': return Globe;
      case 'file': return File;
      default: return Pin;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'person': return 'bg-info-subtle text-info border-blue-500/20';
      case 'tool': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'service': return 'bg-status-success/10 text-success border-green-500/20';
      case 'file': return 'bg-status-warning/10 text-warning border-yellow-500/20';
      default: return 'bg-zinc-500/10 text-secondary border-zinc-500/20';
    }
  };

  if (data.loading) {
    return <CardSkeleton />;
  }

  const health = data.health;

  const viewAllLink = (
    <Link href="/workspace" className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1">
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card className="h-full">
      <CardHeader title={<span className="flex items-center">Memory Health<HelpIcon sectionKey="memory-health" tip={HELP_TIPS['memory-health']} /></span>} icon={HardDrive} action={viewAllLink}>
        {health && (
          <span className={`text-2xl font-semibold tabular-nums ${getScoreColor(health.score)}`}>
            {health.score}
          </span>
        )}
        {agentId && (
          <span className="text-xs text-tertiary border border-zinc-700 rounded px-1.5 py-0.5">Org-wide</span>
        )}
      </CardHeader>
      <CardContent>
        {health ? (
          <div className="space-y-4">
            {/* Health Score Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-tertiary">Health Score</span>
                <span className="text-secondary tabular-nums">{health.score}/100</span>
              </div>
              <ProgressBar value={health.score} color={getScoreBarColor(health.score)} />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 bg-surface-tertiary rounded-lg p-3">
              <StatCompact label="Files" value={health.totalFiles} />
              <StatCompact label="Lines" value={`${(health.totalLines / 1000).toFixed(1)}k`} />
              <StatCompact label="Days" value={health.daysWithNotes} />
            </div>

            {/* Issues */}
            <div className="flex gap-4 text-xs">
              <div className={`flex items-center gap-1 ${health.duplicates > 5 ? 'text-warning' : 'text-success'}`}>
                {health.duplicates > 5
                  ? <AlertTriangle size={14} />
                  : <CheckCircle2 size={14} />
                }
                {health.duplicates} duplicates
              </div>
              <div className={`flex items-center gap-1 ${health.staleCount > 0 ? 'text-warning' : 'text-success'}`}>
                {health.staleCount > 0
                  ? <AlertTriangle size={14} />
                  : <CheckCircle2 size={14} />
                }
                {health.staleCount} stale
              </div>
            </div>

            {/* Top Entities */}
            {data.entities.length > 0 && (
              <div>
                <div className="text-xs text-tertiary mb-2">Top Entities</div>
                <div className="flex flex-wrap gap-1">
                  {data.entities.slice(0, 6).map((entity, i) => {
                    const TypeIcon = getTypeIcon(entity.type);
                    return (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${getTypeColor(entity.type)}`}
                        title={`${entity.type}: ${entity.mentions} mentions`}
                      >
                        <TypeIcon size={10} />
                        {entity.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Topics */}
            {data.topics.length > 0 && (
              <div>
                <div className="text-xs text-tertiary mb-2">Topics</div>
                <div className="flex flex-wrap gap-1">
                  {data.topics.slice(0, 8).map((topic, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-xs bg-brand-subtle text-brand"
                    >
                      #{topic.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last Updated */}
            <div className="text-[10px] text-disabled">
              Updated: {new Date(health.updatedAt).toLocaleString()}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={HardDrive}
            title="No health data yet"
            description="Report memory health via POST /api/memory"
          />
        )}
      </CardContent>
    </Card>
  );
}
