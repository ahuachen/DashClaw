'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, ClipboardList, ScrollText, Clock, CheckCircle2, XCircle, Loader2, HelpCircle, Play, Inbox, RotateCw, Plus } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Stat } from '../../components/ui/Stat';
import { StatCompact } from '../../components/ui/Stat';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAgentFilter } from '../../lib/AgentFilterContext';

const WORKFLOW_TEMPLATES = [
  {
    name: 'Daily Agent Digest',
    description: 'Compile and distribute a daily summary of agent activity, decisions, and key metrics',
    steps: [
      { name: 'Collect Agent Metrics', tool: 'api.get', args: { endpoint: '/api/tokens' } },
      { name: 'Gather Recent Decisions', tool: 'api.get', args: { endpoint: '/api/learning/decisions' } },
      { name: 'Compile Digest', tool: 'report.generate', args: { format: 'markdown' } },
      { name: 'Send Digest', tool: 'message.broadcast', args: { type: 'digest' } },
    ],
  },
  {
    name: 'Weekly Compliance Report',
    description: 'Generate weekly compliance status report with gap analysis and evidence collection',
    steps: [
      { name: 'Fetch Compliance Status', tool: 'api.get', args: { endpoint: '/api/compliance' } },
      { name: 'Run Gap Analysis', tool: 'compliance.analyze', args: {} },
      { name: 'Collect Evidence', tool: 'compliance.evidence', args: {} },
      { name: 'Generate Report', tool: 'report.generate', args: { format: 'markdown', type: 'compliance' } },
    ],
  },
  {
    name: 'High-Risk Alert Escalation',
    description: 'Monitor for high-risk actions and escalate through approval chain with notifications',
    steps: [
      { name: 'Monitor Risk Signals', tool: 'api.get', args: { endpoint: '/api/security/signals' } },
      { name: 'Evaluate Threshold', tool: 'guard.check', args: { threshold: 80 } },
      { name: 'Send Alert', tool: 'webhook.fire', args: { event: 'high_risk_alert' } },
      { name: 'Create Approval', tool: 'api.post', args: { endpoint: '/api/approvals' } },
    ],
  },
  {
    name: 'Agent Onboarding Checklist',
    description: 'Automated setup sequence for new agents: register, configure policies, assign initial tasks',
    steps: [
      { name: 'Register Agent', tool: 'api.post', args: { endpoint: '/api/agents' } },
      { name: 'Apply Default Policies', tool: 'api.post', args: { endpoint: '/api/policies/import' } },
      { name: 'Set Token Budget', tool: 'api.post', args: { endpoint: '/api/tokens/budget' } },
      { name: 'Send Welcome Message', tool: 'message.send', args: { type: 'onboarding' } },
    ],
  },
  {
    name: 'Budget Threshold Alert',
    description: 'Check token usage against budget limits and alert when thresholds are exceeded',
    steps: [
      { name: 'Fetch Token Usage', tool: 'api.get', args: { endpoint: '/api/tokens' } },
      { name: 'Fetch Budget Limits', tool: 'api.get', args: { endpoint: '/api/tokens/budget' } },
      { name: 'Compare Thresholds', tool: 'budget.check', args: { warn_at: 80, block_at: 100 } },
      { name: 'Send Alert', tool: 'webhook.fire', args: { event: 'budget_threshold' } },
    ],
  },
];

export default function WorkflowsDashboard() {
  const { agentId } = useAgentFilter();
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [stats, setStats] = useState({ totalWorkflows: 0, enabled: 0, totalRuns: 0, recentExecutions: 0 });
  const [lastUpdated, setLastUpdated] = useState('');
  const [runningWorkflow, setRunningWorkflow] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const params = agentId ? `?agent_id=${agentId}` : '';
      const [workflowsRes, schedulesRes] = await Promise.all([
        fetch(`/api/workflows${params}`),
        fetch('/api/schedules')
      ]);

      const workflowsData = await workflowsRes.json();
      const schedulesData = await schedulesRes.json();

      if (workflowsData.workflows && Array.isArray(workflowsData.workflows)) {
        setWorkflows(workflowsData.workflows);
      }
      if (workflowsData.executions && Array.isArray(workflowsData.executions)) {
        setExecutions(workflowsData.executions);
      }
      if (workflowsData.stats) {
        setStats({
          totalWorkflows: workflowsData.stats.totalWorkflows || 0,
          enabled: workflowsData.stats.enabled || 0,
          totalRuns: workflowsData.stats.totalRuns || 0,
          recentExecutions: workflowsData.stats.recentExecutions || 0
        });
      }
      if (schedulesData.schedules && Array.isArray(schedulesData.schedules)) {
        setSchedules(schedulesData.schedules);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const runWorkflow = async (workflowId) => {
    setRunningWorkflow(workflowId);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchData();
      } else {
        const json = await res.json();
        console.error('Workflow execution failed:', json.error);
      }
    } catch (err) {
      console.error('Failed to run workflow:', err);
    } finally {
      setRunningWorkflow(null);
    }
  };

  const createFromTemplate = async (template) => {
    setCreatingFromTemplate(template.name);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          steps: JSON.stringify(template.steps),
          enabled: 1,
        }),
      });
      if (res.ok) {
        await fetchData();
        setShowTemplateModal(false);
      } else {
        const json = await res.json();
        console.error('Failed to create workflow from template:', json.error);
      }
    } catch (err) {
      console.error('Failed to create workflow from template:', err);
    } finally {
      setCreatingFromTemplate(null);
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'completed': case 'success': return 'success';
      case 'failed': case 'error': return 'error';
      case 'running': return 'warning';
      default: return 'default';
    }
  };

  const StatusIcon = ({ status, size = 14 }) => {
    switch (status) {
      case 'completed': case 'success':
        return <CheckCircle2 size={size} className="text-green-400" />;
      case 'failed': case 'error':
        return <XCircle size={size} className="text-red-400" />;
      case 'running':
        return <Loader2 size={size} className="text-yellow-400 animate-spin" />;
      default:
        return <HelpCircle size={size} className="text-zinc-400" />;
    }
  };

  const parseSteps = (steps) => {
    if (!steps) return [];
    if (Array.isArray(steps)) return steps;
    if (typeof steps === 'string') {
      try {
        return JSON.parse(steps);
      } catch {
        return [];
      }
    }
    return [];
  };

  const actionButtons = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowTemplateModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
      >
        <Plus size={14} />
        New from Template
      </button>
      <button
        onClick={fetchData}
        className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
      >
        <RotateCw size={14} />
        Refresh
      </button>
    </div>
  );

  return (
    <PageLayout
      title="Workflow Orchestrator"
      subtitle={`Automated Tool Chains${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Workflows']}
      actions={actionButtons}
    >
      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)}>
          <Card hover={false} className="w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <CardHeader title="New from Template" icon={Plus} />
            <CardContent className="overflow-y-auto">
              <div className="space-y-3">
                {WORKFLOW_TEMPLATES.map((template) => (
                  <div
                    key={template.name}
                    className="bg-surface-tertiary rounded-lg p-4 border border-[rgba(255,255,255,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{template.name}</div>
                        <div className="text-sm text-zinc-400 mt-1">{template.description}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.steps.map((step, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-white/5 rounded text-xs text-zinc-300">
                              {step.name}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-zinc-500 mt-2">{template.steps.length} steps</div>
                      </div>
                      <button
                        onClick={() => createFromTemplate(template)}
                        disabled={creatingFromTemplate === template.name}
                        className="flex-shrink-0 px-3 py-1.5 text-sm text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {creatingFromTemplate === template.name ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Plus size={14} />
                        )}
                        Create
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Total Workflows" value={stats.totalWorkflows} color="text-brand" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Enabled" value={stats.enabled} color="text-green-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Total Runs" value={stats.totalRuns} color="text-yellow-400" />
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-4 pb-4">
            <StatCompact label="Recent Executions" value={executions.length} color="text-purple-400" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflows */}
        <Card hover={false}>
          <CardHeader title="Available Workflows" icon={ClipboardList} />
          <CardContent>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {workflows.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No workflows defined yet"
                />
              ) : (
                workflows.map((workflow) => {
                  const steps = parseSteps(workflow.steps);
                  return (
                    <div key={workflow.id} className="bg-surface-tertiary rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${workflow.enabled === 1 ? 'bg-green-500' : 'bg-zinc-500'}`}></span>
                            <div className="text-sm font-medium text-white">{workflow.name}</div>
                          </div>
                          {workflow.description && (
                            <div className="text-sm text-zinc-300 mt-1 ml-4">{workflow.description}</div>
                          )}
                        </div>
                        <button
                          onClick={() => runWorkflow(workflow.id)}
                          disabled={runningWorkflow === workflow.id}
                          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {runningWorkflow === workflow.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          Run
                        </button>
                      </div>

                      {steps.length > 0 && (
                        <div className="ml-4 mt-3">
                          <div className="text-xs text-zinc-500 mb-1">Steps ({steps.length}):</div>
                          <div className="flex flex-wrap gap-1">
                            {steps.slice(0, 5).map((step, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/5 rounded text-xs text-zinc-300">
                                {typeof step === 'string' ? step : (step.name || `Step ${idx + 1}`)}
                              </span>
                            ))}
                            {steps.length > 5 && (
                              <span className="px-2 py-1 bg-white/5 rounded text-xs text-zinc-300">
                                +{steps.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 text-xs text-zinc-500 ml-4">
                        <span>Runs: {workflow.run_count || 0}</span>
                        <span>Last: {workflow.last_run ? new Date(workflow.last_run).toLocaleDateString() : 'Never'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Execution History */}
        <Card hover={false}>
          <CardHeader title="Execution History" icon={ScrollText} />
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {executions.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No executions yet"
                />
              ) : (
                executions.map((exec) => (
                  <div key={exec.id} className="bg-surface-tertiary rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <StatusIcon status={exec.status} />
                        <span className="text-sm font-medium text-white">{exec.workflow_name || `Workflow #${exec.workflow_id}`}</span>
                      </div>
                      <Badge variant={getStatusVariant(exec.status)} size="xs">
                        {exec.status || 'unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>Steps: {exec.steps_completed || 0}/{exec.total_steps || '?'}</span>
                      <span>{exec.started_at ? new Date(exec.started_at).toLocaleString() : 'Unknown'}</span>
                    </div>
                    {exec.error && (
                      <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded">
                        {exec.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Jobs */}
      <Card hover={false} className="mt-6">
        <CardHeader title="Scheduled Jobs" icon={Clock} count={schedules.length} />
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center text-sm text-zinc-500 py-4">
              No scheduled jobs yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="bg-surface-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${schedule.enabled === 1 ? 'bg-green-500' : 'bg-zinc-500'}`}></span>
                      <span className="text-sm font-medium text-white">{schedule.workflow_name}</span>
                    </div>
                  </div>
                  <div className="text-sm text-brand mb-2">{schedule.schedule}</div>
                  {schedule.description && (
                    <div className="text-xs text-zinc-500 mb-2">{schedule.description}</div>
                  )}
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>Next: {schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'N/A'}</span>
                    <span>Runs: {schedule.run_count || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
