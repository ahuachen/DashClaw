'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AgentFilterContext = createContext(null);

export function AgentFilterProvider({ children }) {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState(null); // null = "All Agents"
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return (
    <AgentFilterContext.Provider value={{ agents, agentId, setAgentId, loading }}>
      {children}
    </AgentFilterContext.Provider>
  );
}

export function useAgentFilter() {
  const ctx = useContext(AgentFilterContext);
  if (!ctx) {
    // Return defaults if used outside provider (non-dashboard pages)
    return { agents: [], agentId: null, setAgentId: () => {}, loading: false };
  }
  return ctx;
}
