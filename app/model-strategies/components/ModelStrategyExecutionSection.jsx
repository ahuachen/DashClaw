function FallbackRow({ fallback, index, onChange, onRemove, canRemove }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Fallback provider {index + 1}
        </label>
        <select
          aria-label={`Fallback provider ${index + 1}`}
          value={fallback.provider}
          onChange={(event) => onChange(index, 'provider', event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        >
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
          <option value="google">google</option>
          <option value="xai">xai</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Fallback model {index + 1}
        </label>
        <input
          aria-label={`Fallback model ${index + 1}`}
          type="text"
          value={fallback.model}
          onChange={(event) => onChange(index, 'model', event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          placeholder="claude-sonnet-4"
        />
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={!canRemove}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function ModelStrategyExecutionSection({
  execution,
  onExecutionChange,
}) {
  const updateField = (field, value) => {
    onExecutionChange({ ...execution, [field]: value });
  };

  const updateFallback = (index, field, value) => {
    const nextFallbacks = execution.fallbacks.map((fallback, fallbackIndex) =>
      fallbackIndex === index ? { ...fallback, [field]: value } : fallback
    );
    updateField('fallbacks', nextFallbacks);
  };

  const addFallback = () => {
    updateField('fallbacks', [
      ...execution.fallbacks,
      { provider: 'anthropic', model: '' },
    ]);
  };

  const removeFallback = (index) => {
    updateField(
      'fallbacks',
      execution.fallbacks.filter((_, fallbackIndex) => fallbackIndex !== index)
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Primary provider
          </label>
          <select
            aria-label="Primary provider"
            value={execution.primaryProvider}
            onChange={(event) => updateField('primaryProvider', event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          >
            <option value="openai">openai</option>
            <option value="anthropic">anthropic</option>
            <option value="google">google</option>
            <option value="xai">xai</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Primary model
          </label>
          <input
            aria-label="Primary model"
            type="text"
            value={execution.primaryModel}
            onChange={(event) => updateField('primaryModel', event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
            placeholder="gpt-4.1"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Fallback chain
          </div>
          <button
            type="button"
            onClick={addFallback}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
          >
            Add fallback
          </button>
        </div>

        <div className="space-y-3">
          {execution.fallbacks.map((fallback, index) => (
            <FallbackRow
              key={`${index}-${fallback.provider}-${fallback.model}`}
              fallback={fallback}
              index={index}
              onChange={updateFallback}
              onRemove={removeFallback}
              canRemove={execution.fallbacks.length > 1}
            />
          ))}
        </div>
      </div>

      <div className="max-w-xs">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Max retries
        </label>
        <input
          aria-label="Max retries"
          type="number"
          min="0"
          value={execution.maxRetries}
          onChange={(event) => updateField('maxRetries', Number(event.target.value))}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}
