export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      {Icon && <Icon size={28} className="mb-3 text-zinc-600" strokeWidth={1.5} />}
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      {description && (
        <div className="mt-1.5 max-w-sm text-center text-xs text-zinc-500">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
