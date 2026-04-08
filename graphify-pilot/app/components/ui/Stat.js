import { TrendingUp, TrendingDown } from 'lucide-react';

export function Stat({ label, value, change, trend }) {
  return (
    <div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold tabular-nums text-white mt-0.5">{value}</div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'}`}>
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
    <div className="text-center">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}
