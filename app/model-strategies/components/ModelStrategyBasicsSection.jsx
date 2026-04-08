export default function ModelStrategyBasicsSection({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          aria-label="Name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          placeholder="Balanced default"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-400">
          Description
        </label>
        <textarea
          aria-label="Description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-surface-tertiary px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
          placeholder="GPT-4.1 primary, Claude Sonnet 4 fallback"
        />
      </div>
    </div>
  );
}
