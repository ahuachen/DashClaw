import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/components/PageLayout.js', () => ({
  default: ({ title, subtitle, children, actions }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/Card.js', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
  CardHeader: ({ title }) => <div>{title}</div>,
}));

describe('NewCapabilityPage', () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to registry-only mode and reveals runnable HTTP builder fields when selected', async () => {
    global.fetch = vi.fn();

    const { default: NewCapabilityPage } = await import('@/capabilities/new/page.jsx');

    render(<NewCapabilityPage />);

    expect(screen.getByRole('heading', { name: /register capability/i })).toBeTruthy();
    expect(screen.getByText(/registry entry only/i)).toBeTruthy();
    expect(screen.getByText(/runnable http capability/i)).toBeTruthy();
    expect(screen.getByText(/only HTTP capabilities are runnable in this version/i)).toBeTruthy();
    expect(screen.queryByLabelText(/endpoint url/i)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /runnable http capability/i }));

    expect(await screen.findByLabelText(/endpoint url/i)).toBeTruthy();
    expect(screen.getByLabelText(/http method/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add input field/i })).toBeTruthy();
  });

  it('submits a compiled invocation schema for runnable HTTP capabilities', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        capability: {
          capability_id: 'cap_1',
        },
      }),
    }));

    const { default: NewCapabilityPage } = await import('@/capabilities/new/page.jsx');

    render(<NewCapabilityPage />);

    fireEvent.click(screen.getByRole('radio', { name: /runnable http capability/i }));

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Slack Message Sender' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Send a Slack message by HTTP' } });
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'messaging' } });
    fireEvent.change(screen.getByLabelText(/endpoint url/i), { target: { value: 'https://slack.example.com/api/messages' } });
    fireEvent.change(screen.getByLabelText(/http method/i), { target: { value: 'POST' } });
    fireEvent.change(screen.getByLabelText(/auth mode/i), { target: { value: 'bearer' } });
    fireEvent.change(screen.getByLabelText(/token setting key/i), { target: { value: 'SLACK_BOT_TOKEN' } });

    fireEvent.click(screen.getByRole('button', { name: /add input field/i }));

    fireEvent.change(screen.getByLabelText(/field label/i), { target: { value: 'Channel' } });
    fireEvent.change(screen.getByLabelText(/field key/i), { target: { value: 'channel' } });
    fireEvent.change(screen.getByLabelText(/field type/i), { target: { value: 'string' } });
    fireEvent.click(screen.getByLabelText(/required field/i));

    fireEvent.click(screen.getByRole('button', { name: /register capability/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/capabilities',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(requestBody).toMatchObject({
      name: 'Slack Message Sender',
      description: 'Send a Slack message by HTTP',
      category: 'messaging',
      source_type: 'http_api',
      auth_type: 'bearer',
      invocation_schema: {
        endpoint: 'https://slack.example.com/api/messages',
        method: 'POST',
        auth: {
          type: 'bearer',
          token_setting: 'SLACK_BOT_TOKEN',
        },
        input_schema: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: {
              type: 'string',
              title: 'Channel',
            },
          },
        },
      },
    });

    expect(push).toHaveBeenCalledWith('/capabilities');
  });
});
