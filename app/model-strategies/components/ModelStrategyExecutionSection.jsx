import {
  getDefaultProviderModel,
  getProviderModelOptions,
  getProviderOptions,
} from '../../lib/providers/providerRegistry.js';

const providerOptions = getProviderOptions();

function FallbackRow({ fallback, index, onChange, onProviderChange, onRemove, canRemove }) {
  const modelOptions = getProviderModelOptions(fallback.provider);

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-3 md:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Fallback provider {index + 1}
        </label>
        <select
          aria-label={`Fallback provider ${index + 1}`}
          value={fallback.provider}
          onChange={(event) => onProviderChange(index, event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        >
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Fallback model {index + 1}
        </label>
        <select
          aria-label={`Fallback model ${index + 1}`}
          value={fallback.model}
          onChange={(event) => onChange(index, 'model', event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
  const primaryModelOptions = getProviderModelOptions(execution.primaryProvider);

  const updateExecution = (nextExecution) => {
    onExecutionChange(nextExecution);
  };

  const updateField = (field, value) => {
    updateExecution({ ...execution, [field]: value });
  };

  const updateFallback = (index, field, value) => {
    const nextFallbacks = execution.fallbacks.map((fallback, fallbackIndex) =>
      fallbackIndex === index ? { ...fallback, [field]: value } : fallback
    );
    updateField('fallbacks', nextFallbacks);
  };

  const updateFallbackProvider = (index, provider) => {
    const nextFallbacks = execution.fallbacks.map((fallback, fallbackIndex) =>
      fallbackIndex === index
        ? {
            ...fallback,
            provider,
            model: getDefaultProviderModel(provider, 'model_strategies') || '',
          }
        : fallback
    );
    updateField('fallbacks', nextFallbacks);
  };

  const addFallback = () => {
    const provider = 'anthropic';
    updateField('fallbacks', [
      ...execution.fallbacks,
      { provider, model: getDefaultProviderModel(provider, 'model_strategies') || '' },
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
            onChange={(event) => {
              const nextProvider = event.target.value;
              updateExecution({
                ...execution,
                primaryProvider: nextProvider,
                primaryModel: getDefaultProviderModel(nextProvider, 'model_strategies') || '',
              });
            }}
            className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          >
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
            Primary model
          </label>
          <select
            aria-label="Primary model"
            value={execution.primaryModel}
            onChange={(event) => updateField('primaryModel', event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          >
            {primaryModelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
              onProviderChange={updateFallbackProvider}
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
