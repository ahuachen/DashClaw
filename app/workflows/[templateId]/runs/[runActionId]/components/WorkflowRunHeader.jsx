'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

const STATUS_BADGE = {
  completed: { label: 'Completed', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  failed: { label: 'Failed', color: 'bg-red-400/10 text-red-400 border-red-400/20' },
  running: { label: 'Running', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
};

export default function WorkflowRunHeader({ run, templateId }) {
  const badge = STATUS_BADGE[run.status] || STATUS_BADGE.running;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href={`/workflows/${templateId}`} className="hover:text-zinc-300 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          {run.template_name || 'Workflow'}
        </Link>
        <span>/</span>
        <span className="text-zinc-400">Run</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{run.template_name || 'Workflow Run'}</h1>
          {run.declared_goal && (
            <p className="text-sm text-zinc-400 mt-1">{run.declared_goal}</p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        {run.agent_id && <span>Agent: <span className="text-zinc-400">{run.agent_id}</span></span>}
        {run.duration_ms != null && <span>Duration: <span className="text-zinc-400">{(run.duration_ms / 1000).toFixed(1)}s</span></span>}
        <span>Steps: <span className="text-zinc-400">{run.steps_completed}/{run.step_count}</span></span>
        {run.started_at && <span>Started: <span className="text-zinc-400">{new Date(run.started_at).toLocaleString()}</span></span>}
        <Link href={`/decisions/${run.run_action_id}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Governance trace <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {run.error_message && (
        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-300 font-mono">
          {run.error_message}
        </div>
      )}
    </div>
  );
}
