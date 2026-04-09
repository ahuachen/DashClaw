'use client';

import Link from 'next/link';

const SEVERITY_DOT = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

const CATEGORY_PILL = {
  approval: { label: 'Approval', color: 'bg-purple-400/10 text-purple-400 border-purple-400/20' },
  failure: { label: 'Failure', color: 'bg-red-400/10 text-red-400 border-red-400/20' },
  signal: { label: 'Signal', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20' },
  health: { label: 'Health', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
  stale: { label: 'Stale', color: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20' },
};

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffMs = Date.now() - new Date(ts).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}

export default function OperationsFeedItem({ item, onApprove, onDeny, onRetry, onDisable }) {
  const dot = SEVERITY_DOT[item.severity] || SEVERITY_DOT.low;
  const pill = CATEGORY_PILL[item.category] || CATEGORY_PILL.signal;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[rgba(255,255,255,0.06)] px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${pill.color}`}>
            {pill.label}
          </span>
          {item.agent_id && (
            <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">{item.agent_id}</span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto flex-shrink-0">{formatRelativeTime(item.timestamp)}</span>
        </div>

        <Link href={item.action_url || '#'} className="text-sm text-zinc-200 hover:text-white transition-colors">
          {item.title}
        </Link>

        {item.detail && (
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.detail}</p>
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 mt-1">
        {item.category === 'approval' && onApprove && onDeny && (
          <>
            <button
              onClick={() => onApprove(item.source_id)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onDeny(item.source_id)}
              className="px-2 py-1 rounded text-[10px] font-medium bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors"
            >
              Deny
            </button>
          </>
        )}
        {item.suggested_action === 'retry' && onRetry && (
          <button
            onClick={() => onRetry(item.metadata)}
            className="px-2 py-1 rounded text-[10px] font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20 transition-colors"
          >
            Retry
          </button>
        )}
        {item.suggested_action === 'disable' && onDisable && (
          <button
            onClick={() => onDisable(item.metadata)}
            className="px-2 py-1 rounded text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
          >
            Disable
          </button>
        )}
        {item.category !== 'approval' && (
          <Link
            href={item.action_url || '#'}
            className="px-2 py-1 rounded text-[10px] font-medium bg-white/5 text-zinc-400 border border-[rgba(255,255,255,0.08)] hover:bg-white/10 transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
