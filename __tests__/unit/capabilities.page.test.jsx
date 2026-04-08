import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('@/components/PageLayout.js', () => ({
  default: ({ title, children, actions }) => (
    <div>
      <div>{title}</div>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/Card.js', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Badge.js', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/EmptyState.js', () => ({
  EmptyState: ({ title, description, action }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div>{action}</div>
    </div>
  ),
}));

function okJson(body) {
  return {
    ok: true,
    json: async () => body,
  };
}

describe('CapabilitiesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders registry health summary, filters by runtime posture, and links cards to detail pages', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).startsWith('/api/capabilities?')) {
        return okJson({
          capabilities: [
            {
              capability_id: 'cap_1',
              name: 'Research Agent',
              slug: 'research-agent',
              risk_level: 'medium',
              source_type: 'http_api',
              health_status: 'healthy',
              invocation_schema: {
                endpoint: 'https://api.example.com/research',
              },
              tags: ['research'],
            },
            {
              capability_id: 'cap_2',
              name: 'Send Slack Message',
              slug: 'send-slack-message',
              risk_level: 'high',
              source_type: 'http_api',
              health_status: 'unhealthy',
              requires_approval: true,
              invocation_schema: {
                endpoint: 'https://slack.example.com/api/messages',
              },
              tags: ['slack'],
            },
            {
              capability_id: 'cap_3',
              name: 'Calendar Registry',
              slug: 'calendar-registry',
              risk_level: 'low',
              source_type: 'internal_sdk',
              health_status: 'unknown',
              tags: ['calendar'],
            },
          ],
        });
      }

      if (String(url).startsWith('/api/capabilities/health')) {
        return okJson({
          capabilities: [
            {
              capability_id: 'cap_1',
              status: 'healthy',
              certification_status: 'certified',
              stale_check: false,
              last_tested_at: '2026-04-07T10:00:00.000Z',
              success_rate_1d: 100,
              recent_failure_count: 0,
            },
            {
              capability_id: 'cap_2',
              status: 'unhealthy',
              certification_status: 'failed',
              stale_check: true,
              last_tested_at: '2026-03-01T10:00:00.000Z',
              recent_failure_count: 3,
              recent_errors: ['Slack 403'],
            },
            {
              capability_id: 'cap_3',
              status: 'unknown',
              certification_status: 'uncertified',
              stale_check: false,
              recent_failure_count: 0,
            },
          ],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { default: CapabilitiesPage } = await import('@/capabilities/page.jsx');

    render(<CapabilitiesPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    expect(await screen.findByRole('link', { name: /research agent/i })).toBeTruthy();

    expect(await screen.findByText('Total capabilities')).toBeTruthy();
    expect(screen.getByText('Attention needed')).toBeTruthy();
    expect(screen.getByText('Stale certifications')).toBeTruthy();
    expect(screen.getByText('Uncertified')).toBeTruthy();

    expect(screen.getByRole('link', { name: /research agent/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /send slack message/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /calendar registry/i })).toBeTruthy();
    expect(screen.getByText('certified')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.getByText('uncertified')).toBeTruthy();
    expect(screen.getByText('Stale')).toBeTruthy();
    expect(screen.getByText(/Slack 403/i)).toBeTruthy();
    expect(screen.getByText(/registry only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /run test calendar registry/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /unhealthy/i }));

    await waitFor(() => {
      expect(screen.queryByText('Research Agent')).toBeNull();
      expect(screen.getByText('Send Slack Message')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /all health/i }));
    fireEvent.click(screen.getByLabelText('Stale only'));

    await waitFor(() => {
      expect(screen.queryByText('Research Agent')).toBeNull();
      expect(screen.getByText('Send Slack Message')).toBeTruthy();
      expect(screen.queryByText('Calendar Registry')).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Stale only'));
    fireEvent.click(screen.getByLabelText('Uncertified only'));

    await waitFor(() => {
      expect(screen.getByText('Calendar Registry')).toBeTruthy();
      expect(screen.queryByText('Send Slack Message')).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Uncertified only'));

    const link = screen.getByRole('link', { name: /research agent/i });
    expect(link.getAttribute('href')).toBe('/capabilities/cap_1');
  });

  it('runs a lightweight test from the registry and refreshes capability health', async () => {
    let healthFetchCount = 0;

    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url).startsWith('/api/capabilities?')) {
        return okJson({
          capabilities: [
            {
              capability_id: 'cap_2',
              name: 'Send Slack Message',
              slug: 'send-slack-message',
              risk_level: 'high',
              source_type: 'http_api',
              health_status: 'unhealthy',
              requires_approval: true,
              invocation_schema: {
                endpoint: 'https://slack.example.com/api/messages',
              },
            },
          ],
        });
      }

      if (String(url).startsWith('/api/capabilities/health')) {
        healthFetchCount += 1;
        return okJson({
          capabilities: [
            healthFetchCount === 1
              ? {
                capability_id: 'cap_2',
                status: 'unhealthy',
                certification_status: 'failed',
                stale_check: true,
                recent_failure_count: 2,
              }
              : {
                capability_id: 'cap_2',
                status: 'healthy',
                certification_status: 'certified',
                stale_check: false,
                recent_failure_count: 0,
              },
          ],
        });
      }

      if (String(url) === '/api/capabilities/cap_2/test') {
        expect(options.method).toBe('POST');
        expect(options.body).toBe('{}');
        return okJson({
          success: true,
          tested: true,
          capability_id: 'cap_2',
          message: 'Capability test passed',
          health_status: 'healthy',
          certification_status: 'certified',
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { default: CapabilitiesPage } = await import('@/capabilities/page.jsx');

    render(<CapabilitiesPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });

    const runTestButton = await screen.findByRole('button', { name: /run test send slack message/i });
    fireEvent.click(runTestButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/capabilities/cap_2/test',
        expect.objectContaining({
          method: 'POST',
          body: '{}',
        }),
      );
    });

    expect(await screen.findByText(/capability test passed/i)).toBeTruthy();
    expect(await screen.findByText('healthy')).toBeTruthy();
    expect(await screen.findByText('certified')).toBeTruthy();
  });
});
