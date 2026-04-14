import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ title, action, count }) => (
    <div data-testid="card-header">
      <span>{title}</span>
      {count !== undefined ? <span data-testid="header-count">{count}</span> : null}
      {action}
    </div>
  ),
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }) => <span data-variant={variant}>{children}</span>,
}));

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }) => (
    <div data-testid="empty-state">
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/Skeleton', () => ({
  CardSkeleton: () => <div data-testid="card-skeleton" />,
}));

const base = (over = {}) => ({
  id: 'm1',
  from_agent_id: 'agent_a',
  to_agent_id: 'agent_b',
  message_type: 'info',
  subject: 'hello',
  body: 'world',
  status: 'sent',
  urgent: false,
  is_read: false,
  created_at: '2026-04-14T12:00:00.000Z',
  ...over,
});

describe('RecentCommsCard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a skeleton when messages is null (loading state)', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(<RecentCommsCard messages={null} />);
    expect(screen.getByTestId('card-skeleton')).toBeTruthy();
  });

  it('renders the empty state when there are no messages', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(<RecentCommsCard messages={[]} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No unread agent messages')).toBeTruthy();
  });

  it('renders the empty state when all messages are already read', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(
      <RecentCommsCard
        messages={[
          base({ id: 'r1', is_read: true }),
          base({ id: 'r2', is_read: true }),
        ]}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });

  it('renders unread messages with urgent sorted first, then newest first', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(
      <RecentCommsCard
        messages={[
          base({ id: 'old_normal', urgent: false, created_at: '2026-04-14T10:00:00.000Z', subject: 'old normal' }),
          base({ id: 'urgent_one', urgent: true, created_at: '2026-04-14T11:00:00.000Z', subject: 'urgent one' }),
          base({ id: 'new_normal', urgent: false, created_at: '2026-04-14T12:00:00.000Z', subject: 'new normal' }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/messages?message_id='));
    expect(rows).toHaveLength(3);
    expect(rows[0].getAttribute('href')).toBe('/messages?message_id=urgent_one');
    expect(rows[1].getAttribute('href')).toBe('/messages?message_id=new_normal');
    expect(rows[2].getAttribute('href')).toBe('/messages?message_id=old_normal');
  });

  it('shows an overflow indicator when unread total exceeds the visible limit', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    const msgs = Array.from({ length: 7 }, (_, i) =>
      base({ id: `m${i}`, created_at: `2026-04-14T12:0${i}:00.000Z` }),
    );
    render(<RecentCommsCard messages={msgs} limit={5} />);

    const rowLinks = screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/messages?message_id='));
    expect(rowLinks).toHaveLength(5);
    expect(screen.getByText(/\+2 more unread/)).toBeTruthy();
  });

  it('surfaces unread count in the card header', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(
      <RecentCommsCard
        messages={[
          base({ id: 'u1' }),
          base({ id: 'u2' }),
          base({ id: 'r1', is_read: true }),
        ]}
      />,
    );
    expect(screen.getByTestId('header-count').textContent).toBe('2');
  });

  it('includes a View all link to the full inbox', async () => {
    const { default: RecentCommsCard } = await import('@/mission-control/components/RecentCommsCard.jsx');
    render(<RecentCommsCard messages={[base({ id: 'u1' })]} />);
    const viewAll = screen.getAllByRole('link').find(a => a.textContent?.includes('View all'));
    expect(viewAll).toBeTruthy();
    expect(viewAll.getAttribute('href')).toBe('/messages');
  });
});
