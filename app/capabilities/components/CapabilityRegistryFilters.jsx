const HEALTH_FILTERS = [
  { value: 'all', label: 'All health' },
  { value: 'healthy', label: 'Healthy' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'unhealthy', label: 'Unhealthy' },
  { value: 'unknown', label: 'Unknown' },
];

export default function CapabilityRegistryFilters({
  healthFilter,
  onHealthFilterChange,
  staleOnly,
  onStaleOnlyChange,
  uncertifiedOnly,
  onUncertifiedOnlyChange,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {HEALTH_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onHealthFilterChange(filter.value)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              healthFilter === filter.value
                ? 'border-brand/30 bg-brand/10 text-brand hover:border-brand/40'
                : 'border-transparent text-zinc-500 hover:border-border hover:text-zinc-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(event) => onStaleOnlyChange(event.target.checked)}
            aria-label="Stale only"
            className="h-3.5 w-3.5 accent-brand"
          />
          <span>Stale only</span>
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-300">
          <input
            type="checkbox"
            checked={uncertifiedOnly}
            onChange={(event) => onUncertifiedOnlyChange(event.target.checked)}
            aria-label="Uncertified only"
            className="h-3.5 w-3.5 accent-brand"
          />
          <span>Uncertified only</span>
        </label>
      </div>
    </div>
  );
}
