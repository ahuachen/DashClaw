'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, Briefcase, DollarSign, Building, BookOpen, Pin, RotateCw, CheckCircle2, Circle, Search, Plus, BarChart3 } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAgentFilter } from '../../lib/AgentFilterContext';

export default function GoalsDashboard() {
  const { agentId } = useAgentFilter();
  const [goals, setGoals] = useState([]);
  const [stats, setStats] = useState({ totalGoals: 0, active: 0, completed: 0, avgProgress: 0 });
  const [lastUpdated, setLastUpdated] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = agentId ? `?agent_id=${agentId}` : '';
      const res = await fetch(`/api/goals${params}`);
      const data = await res.json();
      if (data.goals && Array.isArray(data.goals)) {
        setGoals(data.goals);
      }
      if (data.stats) {
        setStats({
          totalGoals: data.stats.totalGoals || 0,
          active: data.stats.active || 0,
          completed: data.stats.completed || 0,
          avgProgress: data.stats.avgProgress || 0
        });
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'work': return Briefcase;
      case 'income': return DollarSign;
      case 'business': return Building;
      case 'learning': return BookOpen;
      case 'personal': return Target;
      default: return Pin;
    }
  };

  const getDaysRemaining = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const target = new Date(dateStr);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  };

  const getProgressColor = (progress) => {
    const p = progress || 0;
    if (p >= 75) return 'success';
    if (p >= 50) return 'warning';
    if (p >= 25) return 'warning';
    return 'error';
  };

  return (
    <PageLayout
      title="Goal Tracker"
      subtitle={`Progress & Milestone Tracking${lastUpdated ? ` -- Updated ${lastUpdated}` : ''}`}
      breadcrumbs={['Dashboard', 'Goals']}
      actions={
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
        >
          <RotateCw size={14} />
          Refresh
        </button>
      }
    >
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.totalGoals}</div>
            <div className="text-xs text-zinc-500 mt-1">Total Goals</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.active}</div>
            <div className="text-xs text-zinc-500 mt-1">Active</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.completed}</div>
            <div className="text-xs text-zinc-500 mt-1">Completed</div>
          </CardContent>
        </Card>
        <Card hover={false}>
          <CardContent className="pt-5 text-center">
            <div className="text-2xl font-semibold tabular-nums text-white">{stats.avgProgress}%</div>
            <div className="text-xs text-zinc-500 mt-1">Avg Progress</div>
          </CardContent>
        </Card>
      </div>

      {/* Goals */}
      <div className="space-y-4">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="pt-5">
              <EmptyState
                icon={Target}
                title="No goals yet"
                description="Add one to get started!"
              />
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const daysRemaining = getDaysRemaining(goal.target_date);
            const milestones = goal.milestones || [];
            const progress = goal.progress || 0;
            const CategoryIcon = getCategoryIcon(goal.category);

            return (
              <Card key={goal.id} className="border-l-4 border-l-brand">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-tertiary flex items-center justify-center">
                        <CategoryIcon size={18} className="text-zinc-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{goal.title}</h3>
                        <div className="text-xs text-zinc-500">
                          {goal.target_date && `Target: ${goal.target_date}`}
                          {daysRemaining !== null && ` -- ${daysRemaining} days remaining`}
                        </div>
                      </div>
                    </div>
                    <Badge variant={getStatusVariant(goal.status)}>
                      {goal.status || 'active'}
                    </Badge>
                  </div>

                  {/* Description */}
                  {goal.description && (
                    <p className="text-sm text-zinc-300 mb-4">{goal.description}</p>
                  )}

                  {/* Main Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-zinc-500">Overall Progress</span>
                      <span className="text-white font-medium tabular-nums">{progress}%</span>
                    </div>
                    <ProgressBar value={progress} color={getProgressColor(progress)} className="h-2" />
                  </div>

                  {/* Milestones */}
                  {milestones.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Milestones</h4>
                      <div className="space-y-2">
                        {milestones.map((milestone) => (
                          <div key={milestone.id} className="bg-surface-tertiary rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {milestone.status === 'completed' ? (
                                <CheckCircle2 size={16} className="text-green-400" />
                              ) : (
                                <Circle size={16} className="text-zinc-600" />
                              )}
                              <span className={`text-sm ${milestone.status === 'completed' ? 'text-zinc-500 line-through' : 'text-white'}`}>
                                {milestone.title}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader title="Quick Actions" icon={Target} />
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText('cd tools/goal-tracker && python goals.py check');
                alert('Command copied! Paste in terminal.');
              }}
              className="bg-surface-tertiary rounded-lg p-4 text-left hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
            >
              <div className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                <Search size={14} />
                Health Check
              </div>
              <div className="text-xs text-zinc-500 mt-1">Review all goal status</div>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText('cd tools/goal-tracker && python goals.py add "New Goal" --category work --target 2026-04-01');
                alert('Command copied! Edit and paste in terminal.');
              }}
              className="bg-surface-tertiary rounded-lg p-4 text-left hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
            >
              <div className="text-sm font-medium text-blue-400 flex items-center gap-1.5">
                <Plus size={14} />
                Add Goal
              </div>
              <div className="text-xs text-zinc-500 mt-1">Create a new goal</div>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText('cd tools/goal-tracker && python goals.py progress 1 30');
                alert('Command copied! Adjust goal ID and percentage, then paste.');
              }}
              className="bg-surface-tertiary rounded-lg p-4 text-left hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150"
            >
              <div className="text-sm font-medium text-yellow-400 flex items-center gap-1.5">
                <BarChart3 size={14} />
                Update Progress
              </div>
              <div className="text-xs text-zinc-500 mt-1">Log goal progress</div>
            </button>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
