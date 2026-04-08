const colorMap = {
  brand: 'bg-brand',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  purple: 'bg-purple-500',
};

export function ProgressBar({ value = 0, color = 'brand', className = '' }) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={`w-full bg-white/5 rounded-full h-1.5 ${className}`}>
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${colorMap[color] || colorMap.brand}`}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
