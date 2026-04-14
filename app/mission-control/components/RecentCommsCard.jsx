'use client';

import Link from 'next/link';
import { MessageSquare, AlertCircle, Inbox, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { selectUrgentUnread } from '../../lib/messages/selectors.js';

const TYPE_VARIANTS = {
  action: 'warning',
  info: 'info',
  lesson: 'success',
  question: 'secondary',
  status: 'default',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * RecentCommsCard — Mission Control compact view of urgent/unread agent
 * messages. Deep-links to /messages for the full inbox.
 *
 * Props:
 *   messages: Array | null  Raw inbox payload; null = loading
 *   limit: number           Max rows to show (default 5)
 */
export default function RecentCommsCard({ messages, limit = 5 }) {
  if (messages === null) {
    return <CardSkeleton />;
  }

  const visible = selectUrgentUnread(messages, { limit });
  const unreadTotal = Array.isArray(messages)
    ? messages.filter(m => m && m.status === 'sent' && !m.is_read).length
    : 0;
  const overflow = Math.max(0, unreadTotal - visible.length);

  const viewAllLink = (
    <Link
      href="/messages"
      className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1"
    >
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card hover={false}>
      <CardHeader
        title="Recent Agent Comms"
        icon={MessageSquare}
        count={unreadTotal > 0 ? unreadTotal : undefined}
        action={viewAllLink}
      />
      <CardContent>
        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No unread agent messages"
            description="Urgent and unread inter-agent messages will surface here."
          />
        ) : (
          <div className="space-y-1.5">
            {visible.map((msg) => (
              <Link
                key={msg.id}
                href={`/messages?message_id=${encodeURIComponent(msg.id)}`}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-surface-tertiary border border-border transition-colors duration-150 hover:border-zinc-700"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border border-border bg-surface-secondary">
                  <MessageSquare size={12} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                    {msg.urgent && (
                      <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-foreground truncate">
                      {msg.from_agent_id || 'Unknown'}
                      <span className="text-zinc-600 font-normal"> → </span>
                      <span className="text-zinc-300 font-normal">
                        {msg.to_agent_id || 'broadcast'}
                      </span>
                    </span>
                    <Badge variant={TYPE_VARIANTS[msg.message_type] || 'default'} size="xs">
                      {msg.message_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">
                    {msg.subject || msg.body || '(no content)'}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-1">
                  {timeAgo(msg.created_at)}
                </span>
              </Link>
            ))}
            {overflow > 0 && (
              <div className="text-[10px] text-zinc-600 pt-1">
                +{overflow} more unread — <Link href="/messages" className="text-brand hover:text-brand-hover">view inbox</Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
