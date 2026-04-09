'use client';

import { useState, useEffect } from 'react';
import { Activity, Clock, AlertTriangle, Workflow, Zap } from 'lucide-react';

function MetricRow({ icon: Icon, label, value, sub, color = 'text-white' }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} className="text-zinc-500 flex-shrink-0" />
      <span className="text-[10px] text-zinc-500 flex-1">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-zinc-600">{sub}</span>}
    </div>
  );
}

export default function RuntimeSummaryCard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/operations/summary');
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Runtime</div>
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  const approvalColor = data.approval_backlog.pending_count > 0
    ? (data.approval_backlog.oldest_minutes > 240 ? 'text-red-400' : 'text-amber-400')
    : 'text-emerald-400';

  const workflowFailColor = data.workflows.failed_24h > 0 ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Runtime</div>
      <div className="space-y-2">
        <MetricRow icon={Zap} label="Throughput (1h)" value={data.throughput.last_1h} />
        <MetricRow icon={Clock} label="Latency p95" value={`${(data.latency.p95_ms / 1000).toFixed(1)}s`} />
        <MetricRow
          icon={AlertTriangle}
          label="Approval backlog"
          value={data.approval_backlog.pending_count}
          sub={data.approval_backlog.pending_count > 0 ? `oldest: ${data.approval_backlog.oldest_minutes}m` : ''}
          color={approvalColor}
        />
        <MetricRow
          icon={Workflow}
          label="Workflows (24h)"
          value={`${data.workflows.completed_24h}/${data.workflows.completed_24h + data.workflows.failed_24h}`}
          sub={data.workflows.running > 0 ? `${data.workflows.running} running` : ''}
          color={workflowFailColor}
        />
        <MetricRow
          icon={Activity}
          label="Capabilities"
          value={`${data.capabilities.healthy}/${data.capabilities.healthy + data.capabilities.degraded + data.capabilities.failing}`}
          sub={data.capabilities.failing > 0 ? `${data.capabilities.failing} failing` : ''}
          color={data.capabilities.failing > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
      </div>
    </div>
  );
}
