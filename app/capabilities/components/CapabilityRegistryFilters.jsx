const HEALTH_FILTERS = [
  { value: 'all', label: 'All Health' },
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
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {HEALTH_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onHealthFilterChange(filter.value)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              healthFilter === filter.value
                ? 'bg-brand text-white'
                : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={staleOnly}
          onChange={(event) => onStaleOnlyChange(event.target.checked)}
          aria-label="Stale only"
        />
        <span>Stale only</span>
      </label>

      <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={uncertifiedOnly}
          onChange={(event) => onUncertifiedOnlyChange(event.target.checked)}
          aria-label="Uncertified only"
        />
        <span>Uncertified only</span>
      </label>
    </div>
  );
}
