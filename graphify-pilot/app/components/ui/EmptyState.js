export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      {Icon && <Icon size={32} className="text-zinc-600 mb-3" />}
      <div className="text-sm font-medium text-zinc-400">{title}</div>
      {description && <div className="text-xs text-zinc-500 mt-1 text-center max-w-xs">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
