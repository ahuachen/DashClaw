export function Card({ children, className = '', hover = true }) {
  return (
    <div
      className={`group/card flex flex-col overflow-hidden bg-surface-secondary border border-border rounded-xl outline-none ${hover ? 'transition-colors duration-150 hover:border-border-hover' : ''} ${className}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, action, count, children }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-zinc-400" />}
        <span className="text-sm font-medium text-zinc-200 uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-subtle text-brand">
            {count}
          </span>
        )}
        {action}
        {children}
      </div>
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`flex-1 min-h-0 overflow-hidden group-focus-within/card:overflow-y-auto px-5 pb-5 ${className}`}>
      {children}
    </div>
  );
}
