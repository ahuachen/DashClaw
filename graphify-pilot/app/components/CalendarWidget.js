'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, MapPin, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmptyState } from './ui/EmptyState';

export default function CalendarWidget() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar')
      .then(res => res.json())
      .then(data => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader title="Calendar" icon={Calendar} />
        <CardContent>
          <div className="text-sm text-zinc-500">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const viewAllLink = (
    <Link href="/calendar" className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1">
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card className="h-full">
      <CardHeader title="Calendar" icon={Calendar} action={viewAllLink}>
        <Badge variant="info" size="sm">{events.length} upcoming</Badge>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No upcoming events"
          />
        ) : (
          <div className="space-y-2">
            {events.slice(0, 5).map((event, i) => (
              <div
                key={event.id || i}
                className={`p-3 rounded-lg transition-colors duration-150 ${
                  isUrgent(event.start_time)
                    ? 'bg-brand-subtle border border-brand/30'
                    : 'bg-surface-tertiary'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {event.summary}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {formatTime(event.start_time)}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1 truncate">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  <Badge
                    variant={isUrgent(event.start_time) ? 'brand' : 'default'}
                    size="xs"
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
  );
}
