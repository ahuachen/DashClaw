// Shared agent color utility — consistent hash-based color for agent badges
const agentColors = [
  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
];

const agentColorCache = new Map();

export function getAgentColor(agentId) {
  const cached = agentColorCache.get(agentId);
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < (agentId || '').length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  const color = agentColors[Math.abs(hash) % agentColors.length];
  agentColorCache.set(agentId, color);
  return color;
}

// Action type icon mapping (returns Lucide icon name)
export const actionTypeIcons = {
  build: 'Hammer',
  deploy: 'Rocket',
  post: 'FileText',
  apply: 'Briefcase',
  security: 'Shield',
  message: 'MessageSquare',
  api: 'Link',
  calendar: 'Calendar',
  research: 'Search',
  review: 'Eye',
  fix: 'Wrench',
  refactor: 'RefreshCw',
  test: 'FlaskConical',
  config: 'Settings',
  monitor: 'Radio',
  alert: 'AlertTriangle',
  cleanup: 'Trash2',
  sync: 'RefreshCw',
  migrate: 'Package',
  other: 'Zap',
};
