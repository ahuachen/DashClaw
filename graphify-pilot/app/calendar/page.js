'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Clock, RotateCw, Plus, Users, Target, Shield, X } from 'lucide-react';
import PageLayout from '../components/PageLayout';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ListSkeleton } from '../components/ui/Skeleton';

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    summary: '',
    start_time: '',
    end_time: '',
    location: '',
    description: '',
    assigned_agents: [],
    assigned_tasks: [],
    assigned_policies: [],
  });
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [policies, setPolicies] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/calendar');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!showCreateModal) return;
    Promise.all([
      fetch('/api/agents').then(r => r.json()).catch(() => ({ agents: [] })),
      fetch('/api/routing/tasks').then(r => r.json()).catch(() => ({ tasks: [] })),
      fetch('/api/policies').then(r => r.json()).catch(() => ({ policies: [] })),
    ]).then(([agentsData, tasksData, policiesData]) => {
      setAgents(agentsData.agents || []);
      setTasks(tasksData.tasks || []);
      setPolicies(policiesData.policies || []);
    });
  }, [showCreateModal]);

  const handleCreateEvent = async () => {
    if (!formData.summary || !formData.start_time) return;
    setCreating(true);
    try {
      const eventBody = {
        summary: formData.summary,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        location: formData.location || null,
        description: [
          formData.description,
          formData.assigned_agents.length ? `\nAssigned Agents: ${formData.assigned_agents.join(', ')}` : '',
          formData.assigned_tasks.length ? `\nAssigned Tasks: ${formData.assigned_tasks.join(', ')}` : '',
          formData.assigned_policies.length ? `\nAssigned Policies: ${formData.assigned_policies.join(', ')}` : '',
        ].filter(Boolean).join('') || null,
      };
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setFormData({ summary: '', start_time: '', end_time: '', location: '', description: '', assigned_agents: [], assigned_tasks: [], assigned_policies: [] });
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';

    const now = new Date();

    const timeOptions = { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' };
    const dateOptions = { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' };

    const estNow = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const estDate = date.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const estTomorrow = tomorrow.toLocaleDateString('en-US', { timeZone: 'America/New_York' });

    const time = date.toLocaleTimeString('en-US', timeOptions);

    if (estDate === estNow) return `Today ${time}`;
    if (estDate === estTomorrow) return `Tomorrow ${time}`;
    return date.toLocaleDateString('en-US', dateOptions) + ` ${time}`;
  };

  const formatEndTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const timeOptions = { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' };
    return date.toLocaleTimeString('en-US', timeOptions);
  };

  const getTimeUntil = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const event = new Date(timestamp);
    if (isNaN(event.getTime())) return '';

    const diff = event - now;

    if (diff < 0) return 'Past';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(diff / (1000 * 60))}m`;
  };

  const isUrgent = (timestamp) => {
    if (!timestamp) return false;
    const now = new Date();
    const event = new Date(timestamp);
    if (isNaN(event.getTime())) return false;

    const hoursUntil = (event - now) / (1000 * 60 * 60);
    return hoursUntil > 0 && hoursUntil < 24;
  };

  return (
    <PageLayout
      title="Calendar"
      subtitle="Upcoming Events"
      breadcrumbs={['Dashboard', 'Calendar']}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-brand rounded-lg hover:bg-brand/90 transition-colors"
          >
            <Plus size={14} />
            Create Event
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors duration-150 flex items-center gap-1.5"
          >
            <RotateCw size={14} />
            Refresh
          </button>
        </div>
      }
    >
      {showCreateModal && (
        <Card className="mb-6">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <h2 className="text-sm font-medium text-white">Create Event</h2>
            <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-white"><X size={16} /></button>
          </div>
          <CardContent className="py-5">
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Event Title *</label>
                <input
                  type="text"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Team standup, deployment review, etc."
                  className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Zoom, office, etc."
                  className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Event details..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
              </div>

              {/* Assignment dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><Users size={12} /> Assign Agents</label>
                  <select
                    multiple
                    value={formData.assigned_agents}
                    onChange={(e) => setFormData({ ...formData, assigned_agents: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 h-24"
                  >
                    {agents.map(a => <option key={a.id || a.agent_id} value={a.id || a.agent_id}>{a.name || a.agent_id || a.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><Target size={12} /> Assign Tasks</label>
                  <select
                    multiple
                    value={formData.assigned_tasks}
                    onChange={(e) => setFormData({ ...formData, assigned_tasks: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 h-24"
                  >
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title || t.id}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1"><Shield size={12} /> Assign Policies</label>
                  <select
                    multiple
                    value={formData.assigned_policies}
                    onChange={(e) => setFormData({ ...formData, assigned_policies: Array.from(e.target.selectedOptions, o => o.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 h-24"
                  >
                    {policies.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                  </select>
                </div>
              </div>
              <div className="text-[10px] text-zinc-600">Hold Ctrl/Cmd to select multiple items in each list</div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleCreateEvent}
                  disabled={creating || !formData.summary || !formData.start_time}
                  className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] text-zinc-300 text-sm hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Events" icon={Calendar} count={events.length} />
        <CardContent>
          {loading ? (
            <ListSkeleton rows={5} />
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming events"
              description="Calendar events will appear here when scheduled"
            />
          ) : (
            <div className="space-y-3">
              {events.map((event, i) => (
                <div
                  key={event.id || i}
                  className={`p-4 rounded-lg transition-colors duration-150 ${
                    isUrgent(event.start_time)
                      ? 'bg-brand-subtle border border-brand/30'
                      : 'bg-surface-tertiary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white">
                        {event.summary}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                        <Clock size={12} className="shrink-0" />
                        <span>{formatTime(event.start_time)}</span>
                        {event.end_time && (
                          <span className="text-zinc-500"> - {formatEndTime(event.end_time)}</span>
                        )}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1 truncate">
                          <MapPin size={12} className="shrink-0" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {event.description && (
                        <div className="text-xs text-zinc-500 mt-2 line-clamp-2">
                          {event.description}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant={isUrgent(event.start_time) ? 'brand' : 'default'}
                      size="sm"
                    >
                      {getTimeUntil(event.start_time)}
                    </Badge>
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

