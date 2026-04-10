import { TrendingUp, TrendingDown } from 'lucide-react';

export function Stat({ label, value, change, trend }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums text-white">{value}</div>
      {change !== undefined && (
        <div className={`mt-1 flex items-center gap-1 text-xs font-medium tabular-nums ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'}`}>
          {trend === 'up' && <TrendingUp size={12} />}
          {trend === 'down' && <TrendingDown size={12} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}

export function StatCompact({ label, value, color = 'text-white' }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
