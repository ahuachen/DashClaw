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

vi.mock('@/components/PageLayout', () => ({
  default: ({ title, subtitle, children, actions }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div>{actions}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

describe('NewWorkflowTemplatePage', () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces the canvas with an ordered executable step builder', async () => {
    global.fetch = vi.fn();

    const { default: NewWorkflowTemplatePage } = await import('@/workflows/new/page.jsx');

    render(<NewWorkflowTemplatePage />);

    expect(screen.getByRole('heading', { name: /new workflow template/i })).toBeTruthy();
    expect(screen.getByText(/workflows currently run steps in order/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add first step/i })).toBeTruthy();
    expect(screen.queryByText(/drag nodes, connect edges/i)).toBeNull();
    expect(screen.queryByText(/\+ add step/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /add first step/i }));

    expect(screen.getByRole('button', { name: /knowledge search/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /capability invoke/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /prompt/i })).toBeTruthy();
  });

  it('submits executable steps in the runtime schema', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        template: {
          template_id: 'wft_1',
        },
      }),
    }));

    const { default: NewWorkflowTemplatePage } = await import('@/workflows/new/page.jsx');

    render(<NewWorkflowTemplatePage />);

    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: 'Refund workflow' } });

    fireEvent.click(screen.getByRole('button', { name: /add first step/i }));
    fireEvent.click(screen.getByRole('button', { name: /knowledge search/i }));

    fireEvent.change(screen.getByLabelText(/step name/i), { target: { value: 'Find refund policy' } });
    fireEvent.change(screen.getByLabelText(/knowledge collection/i), { target: { value: 'kn_refunds' } });
    fireEvent.change(screen.getByLabelText(/search query/i), { target: { value: 'refund eligibility' } });
    fireEvent.change(screen.getByLabelText(/top results/i), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /create template/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/workflows/templates',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(requestBody).toMatchObject({
      name: 'Refund workflow',
      status: 'draft',
      steps: [
        {
          id: 'step_1',
          type: 'knowledge_search',
          name: 'Find refund policy',
          config: {
            collection_id: 'kn_refunds',
            query: 'refund eligibility',
            top_k: 3,
          },
        },
      ],
    });

    expect(push).toHaveBeenCalledWith('/workflows/wft_1');
  });
});
