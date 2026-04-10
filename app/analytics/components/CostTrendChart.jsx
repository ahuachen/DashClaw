'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] px-3 py-2 text-xs shadow-xl">
      <div className="text-zinc-400">{d.date}</div>
      <div className="text-white font-medium">${d.cost?.toFixed(2)}</div>
      <div className="text-zinc-500">{d.actions} actions</div>
    </div>
  );
}

export default function CostTrendChart({ daily }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">Cost Trend</div>
      {daily.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-zinc-500">No cost data in this period.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cost" stroke="#f97316" fill="url(#costGradient)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
