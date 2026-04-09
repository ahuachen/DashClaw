import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

// Lazy import after mock is set up
const { default: OperationsFeed } = await import('../../app/mission-control/components/OperationsFeed.jsx');

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

const mockFeed = {
  items: [
    {
      id: 'approval:act_1',
      category: 'approval',
      severity: 'high',
      title: 'Awaiting approval: Deploy to prod',
      detail: 'agent: deploy-bot, risk: 85',
      source: 'action',
      source_id: 'act_1',
      agent_id: 'deploy-bot',
      timestamp: '2026-04-08T14:00:00Z',
      action_url: '/decisions/act_1',
      suggested_action: 'approve',
    },
    {
      id: 'signal:session_stalled:agent-1',
      category: 'signal',
      severity: 'critical',
      title: 'Session stalled: agent-1',
      detail: 'No activity for 4h',
      source: 'signal',
      source_id: null,
      agent_id: 'agent-1',
      timestamp: '2026-04-08T13:00:00Z',
      action_url: '/agents/agent-1',
      suggested_action: 'investigate',
    },
  ],
  counts: { critical: 1, high: 1, medium: 0, low: 0, total: 2 },
};

describe('OperationsFeed', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders feed items from API', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    expect(await screen.findByText('Awaiting approval: Deploy to prod')).toBeTruthy();
    expect(await screen.findByText('Session stalled: agent-1')).toBeTruthy();
  });

  it('shows severity counts in header', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    // Wait for items to load, then check that severity badges render
    await screen.findByText('Awaiting approval: Deploy to prod');
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThanOrEqual(2); // critical=1 and high=1
  });

  it('renders approval buttons for approval items', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockFeed));

    render(<OperationsFeed />);

    expect(await screen.findByText('Approve')).toBeTruthy();
    expect(await screen.findByText('Deny')).toBeTruthy();
  });

  it('shows empty state when no items', async () => {
    global.fetch.mockResolvedValueOnce(okJson({ items: [], counts: { critical: 0, high: 0, medium: 0, low: 0, total: 0 } }));

    render(<OperationsFeed />);

    expect(await screen.findByText(/all clear/i)).toBeTruthy();
  });
});
