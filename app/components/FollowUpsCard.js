'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';
import { ListSkeleton } from './ui/Skeleton';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { useTileSize, fitItems } from '../hooks/useTileSize';
import { HelpIcon } from './HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';

export default function FollowUpsCard() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const { agentId } = useAgentFilter();
  const { ref: sizeRef, height: tileHeight } = useTileSize();

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/relationships${agentId ? `?agent_id=${agentId}` : ''}`);
        const data = await res.json();
        if (data.contacts && Array.isArray(data.contacts)) {
          const withFollowUps = data.contacts
            .filter(c => c.followUpDate)
            .map(c => {
              const dueDate = new Date(c.followUpDate);
              const today = new Date();
              const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
              return {
                id: c.id || 0,
                name: c.name || 'Unknown',
                type: c.context || 'Contact',
                temperature: (c.temperature || 'warm').toUpperCase(),
                dueDate: c.followUpDate,
                daysLeft
              };
            })
            .sort((a, b) => a.daysLeft - b.daysLeft)
            .slice(0, 5);
          setFollowUps(withFollowUps);
        }
      } catch (error) {
        console.error('Failed to fetch follow-ups:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [agentId]);

  const getTempVariant = (temp) => {
    switch (temp) {
      case 'HOT': return 'error';
      case 'WARM': return 'warning';
      case 'COLD': return 'info';
      default: return 'default';
    }
  };

  const getDaysColor = (days) => {
    if (days <= 1) return 'text-error';
    if (days <= 3) return 'text-warning';
    return 'text-success';
  };

  const ITEM_H = 80;
  const maxVisible = tileHeight > 0 ? fitItems(tileHeight, ITEM_H) : 3;
  const visibleFollowUps = followUps.slice(0, maxVisible);
  const followUpOverflow = followUps.length - visibleFollowUps.length;

  const viewAllLink = (
    <Link href="/relationships" className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1">
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card className="h-full">
      <CardHeader title={<span className="flex items-center">Follow-ups<HelpIcon sectionKey="open-loops" tip={HELP_TIPS['open-loops']} /></span>} icon={CheckCircle2} count={followUps.length} action={viewAllLink} />
      <CardContent>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : followUps.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All caught up!"
            description="No pending follow-ups"
          />
        ) : (
          <div ref={sizeRef} className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 space-y-2">
              {visibleFollowUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className="bg-surface-tertiary rounded-lg p-3 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white truncate mr-2">{followUp.name}</span>
                    <Badge variant={getTempVariant(followUp.temperature)} size="xs">
                      {followUp.temperature}
                    </Badge>
                  </div>
                  <div className="text-xs text-secondary mb-1.5">{followUp.type}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-tertiary">Due: {followUp.dueDate}</span>
                    <span className={`font-medium ${getDaysColor(followUp.daysLeft)}`}>
                      {followUp.daysLeft}d left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
