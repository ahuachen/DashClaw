import { formatCost } from '../../lib/formatCost';

export default function BreakdownCard({ title, items, labelKey, countLabel }) {
  const maxPct = Math.max(...items.map(i => i.pct || 0), 1);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-zinc-500">No data in this period.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item[labelKey] || i}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300 truncate">{item[labelKey]}</span>
                <span className="text-zinc-400 shrink-0 ml-2">
                  {countLabel === 'cost' ? formatCost(item.cost) : item[countLabel] || 0}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5">
                <div
                  className="h-1.5 rounded-full bg-brand transition-all"
                  style={{ width: `${Math.max((item.pct / maxPct) * 100, 2)}%` }}
                />
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">{item.pct}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
