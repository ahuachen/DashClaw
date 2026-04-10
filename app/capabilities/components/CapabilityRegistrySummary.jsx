const SUMMARY_ITEMS = [
  { key: 'total', label: 'Total', toneFor: () => 'text-white' },
  {
    key: 'attention',
    label: 'Attention',
    toneFor: (value) => (value > 0 ? 'text-red-400' : 'text-emerald-400'),
  },
  {
    key: 'stale',
    label: 'Stale',
    toneFor: (value) => (value > 0 ? 'text-amber-400' : 'text-zinc-400'),
  },
  {
    key: 'uncertified',
    label: 'Uncertified',
    toneFor: (value) => (value > 0 ? 'text-amber-400' : 'text-zinc-400'),
  },
];

export default function CapabilityRegistrySummary({ counts }) {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface-tertiary">
      <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
        {SUMMARY_ITEMS.map((item, i) => {
          const value = counts?.[item.key] ?? 0;
          return (
            <div
              key={item.key}
              className={`px-5 py-4 ${i >= 2 ? 'border-t border-border md:border-t-0' : ''}`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {item.label}
              </div>
              <div className={`mt-1 text-3xl font-semibold tabular-nums ${item.toneFor(value)}`}>{value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
