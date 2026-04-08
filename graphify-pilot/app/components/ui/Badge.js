const variants = {
  default: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  success: 'bg-green-500/10 text-green-400 border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  brand: 'bg-brand-subtle text-brand border-brand/20',
};

const sizes = {
  xs: 'text-[10px] px-1.5 py-0.5 rounded',
  sm: 'text-xs px-2 py-0.5 rounded-md',
};

export function Badge({ children, variant = 'default', size = 'sm', className = '' }) {
  return (
    <span className={`inline-flex items-center font-medium border ${variants[variant] || variants.default} ${sizes[size] || sizes.sm} ${className}`}>
      {children}
    </span>
  );
}
