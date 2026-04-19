import Link from 'next/link';

export function ActionLink({ href, children, secondary = false }) {
  const classes = secondary
    ? 'border-[rgba(255,255,255,0.08)] bg-transparent text-secondary hover:border-[rgba(255,255,255,0.18)] hover:text-white'
    : 'border-brand/40 bg-brand/10 text-brand hover:border-brand/60 hover:bg-brand/15';

  return (
    <a
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm transition-colors ${classes}`}
    >
      {children}
    </a>
  );
}

export function ModeBadge({ isAuthenticated }) {
  const label = isAuthenticated ? 'Operator view' : 'Public-safe view';
  const classes = isAuthenticated
    ? 'border-emerald-900/40 text-success'
    : 'border-[rgba(255,255,255,0.08)] text-secondary';

  return (
    <div className={`rounded-full border px-3 py-1 text-xs ${classes}`}>
      {label}
    </div>
  );
}

export function CodeBlock({ children }) {
  return (
    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#050505] px-4 py-3 text-xs font-mono text-secondary">
      {children}
    </pre>
  );
}
