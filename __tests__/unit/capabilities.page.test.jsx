import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  EmptyState: ({ title }) => <div>{title}</div>,
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

  it('links each capability card to its detail page', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(okJson({
      capabilities: [
        {
          capability_id: 'cap_1',
          name: 'Research Agent',
          slug: 'research-agent',
          risk_level: 'medium',
          source_type: 'http_api',
          health_status: 'healthy',
          tags: ['research'],
        },
      ],
    }));

    const { default: CapabilitiesPage } = await import('@/capabilities/page.jsx');

    render(<CapabilitiesPage />);

    const link = await screen.findByRole('link', { name: /research agent/i });
    expect(link.getAttribute('href')).toBe('/capabilities/cap_1');
  });
});
