'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Network, Plus, Trash2, ChevronDown, ChevronRight,
  AlertTriangle, Activity, Clock, CheckCircle, XCircle,
  RefreshCw, Send,
} from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatCompact } from '../components/ui/Stat';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';
import { HelpIcon } from '../components/HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';
import { isDemoMode } from '../lib/isDemoMode';

const URGENCY_BADGE = {
  critical: 'error',
  high: 'warning',
  normal: 'info',
  low: 'default',
};

const STATUS_BADGE = {
  pending: 'default',
  assigned: 'info',
  completed: 'success',
  failed: 'error',
};

const AGENT_STATUS_BADGE = {
  available: 'success',
  busy: 'warning',
  offline: 'error',
};

const STATUS_ICON = {
  pending: Clock,
  assigned: Activity,
  completed: CheckCircle,
  failed: XCircle,
};

const TASK_FILTERS = ['all', 'pending', 'assigned', 'completed', 'failed'];

function parseCapabilities(agent) {
  if (!agent.capabilities) return [];
  if (typeof agent.capabilities === 'string') {
    try { return JSON.parse(agent.capabilities); } catch { return []; }
  }
  return agent.capabilities;
}

export default function TaskRoutingPage() {
  const isDemo = isDemoMode();
  const canEdit = !isDemo;

  // Data
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [taskFilter, setTaskFilter] = useState('all');

  // Task form
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskSkills, setTaskSkills] = useState('');
  const [taskUrgency, setTaskUrgency] = useState('normal');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Agent form
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentCapabilities, setAgentCapabilities] = useState('');
  const [agentMaxConcurrent, setAgentMaxConcurrent] = useState(3);
  const [agentEndpoint, setAgentEndpoint] = useState('');
  const [registeringAgent, setRegisteringAgent] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, statsRes, agentsRes, tasksRes] = await Promise.all([
        fetch('/api/routing/health'),
        fetch('/api/routing/stats'),
        fetch('/api/routing/agents'),
        fetch('/api/routing/tasks'),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.agents || []);
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      setError('Failed to load routing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmitTask = async (e) => {
    e.preventDefault();
    setSubmittingTask(true);
    try {
      const body = {
        title: taskTitle,
        description: taskDesc,
        required_skills: taskSkills.split(',').map(s => s.trim()).filter(Boolean),
        urgency: taskUrgency,
      };
      const res = await fetch('/api/routing/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setTaskTitle(''); setTaskDesc(''); setTaskSkills(''); setTaskUrgency('normal');
        setShowTaskForm(false);
        fetchData();
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to submit task');
      }
    } catch {
      setError('Failed to submit task');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleRegisterAgent = async (e) => {
    e.preventDefault();
    setRegisteringAgent(true);
    try {
      const body = {
        name: agentName,
        capabilities: agentCapabilities.split(',').map(s => s.trim()).filter(Boolean),
        max_concurrent: agentMaxConcurrent,
        endpoint: agentEndpoint || undefined,
      };
      const res = await fetch('/api/routing/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAgentName(''); setAgentCapabilities(''); setAgentMaxConcurrent(3); setAgentEndpoint('');
        setShowAgentForm(false);
        fetchData();
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to register agent');
      }
    } catch {
      setError('Failed to register agent');
    } finally {
      setRegisteringAgent(false);
    }
  };

  const handleAgentStatusChange = async (agentId, newStatus) => {
    try {
      const res = await fetch(`/api/routing/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Remove this agent from the registry?')) return;
    try {
      const res = await fetch(`/api/routing/agents/${agentId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/routing/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.status === taskFilter);

  return (
    <PageLayout
      title="Task Routing"
      subtitle="Route tasks to available agents based on capabilities and load"
      breadcrumbs={['Task Routing']}
      actions={
        <button
          onClick={fetchData}
          className="p-2 rounded-lg text-secondary hover:text-white hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      }
    >
      {isDemo && (
        <div className="mb-4 p-3 rounded-lg bg-zinc-500/10 border border-zinc-500/20 text-secondary text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> Demo mode: write operations are disabled.
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error-subtle border border-error/20 text-error text-sm flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-error hover:text-error">&times;</button>
        </div>
      )}

      {/* Health indicator */}
      {health && (
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border text-sm">
            <span className={`inline-block w-2 h-2 rounded-full ${health.status === 'healthy' ? 'bg-status-success' : 'bg-status-error'}`} />
            <span className="text-secondary">Router: {health.status}</span>
            {health.router_version && (
              <span className="text-disabled text-xs font-mono">v{health.router_version}</span>
            )}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCompact label="Total Agents" value={stats?.total_agents ?? '\u2014'} />
        <StatCompact label="Available" value={stats?.available_agents ?? '\u2014'} color="text-success" />
        <StatCompact label="Busy" value={stats?.busy_agents ?? '\u2014'} color="text-warning" />
        <StatCompact label="Pending Tasks" value={stats?.pending_tasks ?? '\u2014'} />
        <StatCompact label="Completed" value={stats?.completed_tasks ?? '\u2014'} color="text-success" />
        <StatCompact label="Decisions" value={stats?.routing_decisions ?? '\u2014'} />
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Task Queue (3/5) */}
          <div className="lg:col-span-3">
            <Card className="mb-6">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                <h2 className="text-sm font-medium text-white flex items-center">Task Queue<HelpIcon sectionKey="routing" tip={HELP_TIPS['routing']} /></h2>
                {canEdit && (
                  <button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
                  >
                    {showTaskForm ? <ChevronDown size={14} /> : <Plus size={14} />}
                    {showTaskForm ? 'Cancel' : 'Submit Task'}
                  </button>
                )}
              </div>

              {/* Submit task form */}
              {showTaskForm && canEdit && (
                <form onSubmit={handleSubmitTask} className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] space-y-4 bg-[rgba(255,255,255,0.02)]">
                  <div>
                    <label className="block text-xs text-secondary mb-1">Title</label>
                    <input
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Review pull request #42"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">Description</label>
                    <textarea
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Describe the task in detail..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-secondary mb-1">Required Skills (comma-separated)</label>
                      <input
                        type="text"
                        value={taskSkills}
                        onChange={(e) => setTaskSkills(e.target.value)}
                        placeholder="e.g. code-review, javascript, testing"
                        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">Urgency</label>
                      <select
                        value={taskUrgency}
                        onChange={(e) => setTaskUrgency(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingTask || !taskTitle.trim()}
                    className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send size={14} />
                    {submittingTask ? 'Submitting...' : 'Submit Task'}
                  </button>
                </form>
              )}

              {/* Status filter pills */}
              <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-[rgba(255,255,255,0.06)]">
                {TASK_FILTERS.map(filter => (
                  <button
                    key={filter}
                    onClick={() => setTaskFilter(filter)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                      taskFilter === filter
                        ? 'bg-brand text-white'
                        : 'bg-[#1a1a1a] text-secondary border border-[rgba(255,255,255,0.06)] hover:text-white'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    {filter !== 'all' && (
                      <span className="ml-1 text-[10px] opacity-70">
                        ({tasks.filter(t => t.status === filter).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <CardContent>
                {filteredTasks.length === 0 ? (
                  <EmptyState
                    icon={Network}
                    title={taskFilter === 'all' ? 'No tasks in queue' : `No ${taskFilter} tasks`}
                    description={taskFilter === 'all' ? 'Submit a task to route it to an available agent.' : `No tasks with status "${taskFilter}" found.`}
                  />
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                    {filteredTasks.map(task => {
                      const StatusIcon = STATUS_ICON[task.status] || Clock;
                      return (
                        <div key={task.id} className="py-3 flex items-start gap-3">
                          <StatusIcon size={14} className={`mt-0.5 flex-shrink-0 ${
                            task.status === 'completed' ? 'text-success' :
                            task.status === 'failed' ? 'text-error' :
                            task.status === 'assigned' ? 'text-info' :
                            'text-tertiary'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-medium text-white">{task.title}</span>
                              <Badge variant={STATUS_BADGE[task.status] || 'default'} size="xs">
                                {task.status}
                              </Badge>
                              <Badge variant={URGENCY_BADGE[task.urgency] || 'default'} size="xs">
                                {task.urgency}
                              </Badge>
                            </div>
                            {task.description && (
                              <p className="text-xs text-tertiary truncate">{task.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              {task.assigned_agent && (
                                <span className="text-[10px] text-secondary">
                                  Agent: <span className="text-secondary">{task.assigned_agent}</span>
                                </span>
                              )}
                              {task.created_at && (
                                <span className="text-[10px] text-disabled font-mono">
                                  {new Date(task.created_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-disabled hover:text-error transition-colors flex-shrink-0 mt-0.5"
                              title="Delete task"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Agent Registry (2/5) */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
                <h2 className="text-sm font-medium text-white flex items-center">Agent Registry<HelpIcon sectionKey="routing" tip={HELP_TIPS['routing']} /></h2>
                {canEdit && (
                  <button
                    onClick={() => setShowAgentForm(!showAgentForm)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand-hover transition-colors"
                  >
                    {showAgentForm ? <ChevronDown size={14} /> : <Plus size={14} />}
                    {showAgentForm ? 'Cancel' : 'Register Agent'}
                  </button>
                )}
              </div>

              {/* Register agent form */}
              {showAgentForm && canEdit && (
                <form onSubmit={handleRegisterAgent} className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)] space-y-4 bg-[rgba(255,255,255,0.02)]">
                  <div>
                    <label className="block text-xs text-secondary mb-1">Agent Name</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. code-review-agent"
                      required
                      className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-secondary mb-1">Capabilities (comma-separated)</label>
                    <input
                      type="text"
                      value={agentCapabilities}
                      onChange={(e) => setAgentCapabilities(e.target.value)}
                      placeholder="e.g. code-review, testing, deployment"
                      className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-secondary mb-1">Max Concurrent Tasks</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={agentMaxConcurrent}
                        onChange={(e) => setAgentMaxConcurrent(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-secondary mb-1">Endpoint (optional)</label>
                      <input
                        type="text"
                        value={agentEndpoint}
                        onChange={(e) => setAgentEndpoint(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={registeringAgent || !agentName.trim()}
                    className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
                  >
                    {registeringAgent ? 'Registering...' : 'Register Agent'}
                  </button>
                </form>
              )}

              <CardContent>
                {agents.length === 0 ? (
                  <EmptyState
                    icon={Network}
                    title="No agents registered"
                    description="Register an agent to start routing tasks."
                  />
                ) : (
                  <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                    {agents.map(agent => {
                      const caps = parseCapabilities(agent);
                      return (
                        <div key={agent.id} className="py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                              <Badge variant={AGENT_STATUS_BADGE[agent.status] || 'default'} size="xs">
                                {agent.status}
                              </Badge>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <select
                                  value={agent.status}
                                  onChange={(e) => handleAgentStatusChange(agent.id, e.target.value)}
                                  className="px-2 py-1 rounded bg-[#111] border border-[rgba(255,255,255,0.1)] text-[10px] text-secondary focus:outline-none focus:border-brand"
                                >
                                  <option value="available">Available</option>
                                  <option value="busy">Busy</option>
                                  <option value="offline">Offline</option>
                                </select>
                                <button
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="text-tertiary hover:text-error transition-colors"
                                  title="Remove agent"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Capability tags */}
                          {caps.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {caps.map((cap, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-secondary">
                                  {cap}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Load indicator */}
                          <div className="flex items-center gap-2">
                            {agent.current_load !== undefined && agent.max_concurrent !== undefined && (
                              <>
                                <div className="flex-1 h-1.5 rounded-full bg-tertiary overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      agent.current_load / agent.max_concurrent >= 0.8
                                        ? 'bg-status-error'
                                        : agent.current_load / agent.max_concurrent >= 0.5
                                        ? 'bg-status-warning'
                                        : 'bg-status-success'
                                    }`}
                                    style={{ width: `${Math.min(100, (agent.current_load / agent.max_concurrent) * 100)}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-tertiary font-mono flex-shrink-0">
                                  {agent.current_load}/{agent.max_concurrent}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

