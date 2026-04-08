function TaskModeOverrideRow({ override, index, onChange, onRemove }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Task mode
        </label>
        <input
          aria-label={`Task mode ${index + 1}`}
          type="text"
          value={override.taskMode}
          onChange={(event) => onChange(index, 'taskMode', event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          placeholder="research"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Provider
        </label>
        <select
          aria-label={`Task mode provider ${index + 1}`}
          value={override.provider}
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
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
          Model
        </label>
        <input
          aria-label={`Task mode model ${index + 1}`}
          type="text"
          value={override.model}
          onChange={(event) => onChange(index, 'model', event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          placeholder="gpt-4.1-mini"
        />
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function ModelStrategyAdvancedSection({
  open,
  onToggle,
  warning = null,
  taskModes = [],
  onTaskModesChange,
  rawConfigText = '',
  showRawConfig = false,
  onToggleRawConfig,
  onRawConfigTextChange,
  children,
}) {
  const handleTaskModeChange = (index, field, value) => {
    if (!onTaskModesChange) return;
    const nextTaskModes = taskModes.map((taskMode, taskModeIndex) =>
      taskModeIndex === index ? { ...taskMode, [field]: value } : taskMode
    );
    onTaskModesChange(nextTaskModes);
  };

  const handleTaskModeRemove = (index) => {
    if (!onTaskModesChange) return;
    onTaskModesChange(taskModes.filter((_, taskModeIndex) => taskModeIndex !== index));
  };

  const handleTaskModeAdd = () => {
    if (!onTaskModesChange) return;
    onTaskModesChange([
      ...taskModes,
      { taskMode: '', provider: 'openai', model: '' },
    ]);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            Advanced task-mode overrides
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Optional per-task overrides and raw fallback live here. Most strategies do not need this.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
        >
          {open ? 'Hide advanced' : 'Show advanced'}
        </button>
      </div>
      {warning ? (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {warning}
        </div>
      ) : null}
      {open ? (
        <div className="mt-4 space-y-4">
          {onTaskModesChange ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Task-mode overrides
                </div>
                <button
                  type="button"
                  onClick={handleTaskModeAdd}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
                >
                  Add task mode
                </button>
              </div>
              {taskModes.length > 0 ? (
                taskModes.map((override, index) => (
                  <TaskModeOverrideRow
                    key={`${index}-${override.taskMode}-${override.provider}-${override.model}`}
                    override={override}
                    index={index}
                    onChange={handleTaskModeChange}
                    onRemove={handleTaskModeRemove}
                  />
                ))
              ) : (
                <div className="text-sm text-zinc-500">
                  No task-mode overrides configured.
                </div>
              )}
            </div>
          ) : null}

          {onToggleRawConfig ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={onToggleRawConfig}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/5"
              >
                {showRawConfig ? 'Hide raw JSON' : 'Show raw JSON'}
              </button>
              {showRawConfig ? (
                <textarea
                  aria-label="Raw config JSON"
                  value={rawConfigText}
                  onChange={(event) => onRawConfigTextChange?.(event.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-200 focus:border-brand focus:outline-none"
                />
              ) : null}
            </div>
          ) : null}

          {children}
        </div>
      ) : null}
    </div>
  );
}
