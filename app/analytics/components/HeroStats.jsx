import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCost, formatTokens } from '../../lib/formatCost';

function TrendBadge({ current, previous, invert = false }) {
  if (!previous || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  // invert: for cost/latency, lower is better (green); for actions/agents, higher is better (green)
  const isPositive = invert ? pct < 0 : pct > 0;
  const color = isPositive ? 'text-emerald-400' : 'text-red-400';
  const Icon = pct > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={12} /> {pct > 0 ? '+' : ''}{pct}%
    </span>
  );
}

function StatCard({ label, value, trend }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-4">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {trend}
      </div>
    </div>
  );
}

export default function HeroStats({ hero }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Cost"
        value={formatCost(hero.total_cost)}
        trend={<TrendBadge current={hero.total_cost} previous={hero.prev_cost} invert />}
      />
      <StatCard
        label="Actions"
        value={(hero.total_actions || 0).toLocaleString()}
        trend={<TrendBadge current={hero.total_actions} previous={hero.prev_actions} />}
      />
      <StatCard
        label="Active Agents"
        value={hero.active_agents || 0}
        trend={<TrendBadge current={hero.active_agents} previous={hero.prev_agents} />}
      />
      <StatCard
        label="Avg Latency"
        value={hero.avg_latency_ms > 0 ? `${(hero.avg_latency_ms / 1000).toFixed(1)}s` : '—'}
        trend={<TrendBadge current={hero.avg_latency_ms} previous={hero.prev_latency_ms} invert />}
      />
    </div>
  );
}
