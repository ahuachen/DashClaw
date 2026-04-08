'use client';

import { useAgentFilter } from '../lib/AgentFilterContext';
import { getAgentColor } from '../lib/colors';
import { Users } from 'lucide-react';

export default function AgentFilterDropdown() {
  const { agents, agentId, setAgentId, loading } = useAgentFilter();

  if (loading || agents.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <Users size={14} className="text-zinc-500" />
      <select
        value={agentId || ''}
        onChange={(e) => setAgentId(e.target.value || null)}
        className="bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 hover:border-[rgba(255,255,255,0.12)] focus:outline-none focus:border-brand/50 transition-colors duration-150 cursor-pointer appearance-none pr-7"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
      >
        <option value="" className="bg-zinc-900 text-zinc-300">All Agents</option>
        {agents.map((agent) => (
          <option key={agent.agent_id} value={agent.agent_id} className="bg-zinc-900 text-zinc-300">
            {agent.agent_name || agent.agent_id}
          </option>
        ))}
      </select>
    </div>
  );
}
