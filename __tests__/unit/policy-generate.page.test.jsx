import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

describe('PolicyGeneratePage', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url) === '/api/policies/generate') {
        return {
          ok: true,
          json: async () => ({
            generated_policies: [
              {
                name: 'Require deploy approval',
                policy_type: 'require_approval',
                rules: {
                  action_types: ['deploy'],
                  action: 'require_approval',
                },
                confidence: 0.92,
              },
              {
                name: 'Warn on risky actions',
                policy_type: 'risk_threshold',
                rules: {
                  threshold: 80,
                  action: 'warn',
                },
                confidence: 0.78,
                recovery_recipe: {
                  signal: 'high_risk_action',
                  suggestion: 'Escalate to a reviewer',
                  auto_action: null,
                },
              },
            ],
            warnings: ['One draft has advanced recovery details'],
          }),
        };
      }

      if (String(url) === '/api/policies') {
        return {
          ok: true,
          json: async () => ({
            policy: {
              id: 'pol_generated',
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads generated candidates into a guided draft editor and saves via the policies API', async () => {
    const { default: PolicyGeneratePage } = await import('@/policies/generate/page.jsx');

    render(<PolicyGeneratePage />);

    fireEvent.change(
      screen.getByPlaceholderText(/paste your company policy, slack message, or compliance requirement/i),
      { target: { value: 'Require approval for deploys and warn on high-risk actions' } }
    );

    fireEvent.click(screen.getByRole('button', { name: /generate drafts|generate preview/i }));

    expect(await screen.findByText('Require deploy approval')).toBeTruthy();
    expect(screen.getAllByText(/require approval for deploy actions/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/policy name/i)).toBeTruthy();
    expect(screen.getByLabelText(/policy type/i)).toBeTruthy();
    expect(screen.getByText(/policy summary/i)).toBeTruthy();
    expect(screen.queryByText(/"action_types"/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /warn on risky actions/i }));

    expect(screen.getByDisplayValue('Warn on risky actions')).toBeTruthy();
    expect(screen.getByLabelText(/policy type/i).value).toBe('risk_threshold');
    expect(screen.getAllByText(/warn on actions when risk is 80 or higher/i).length).toBeGreaterThan(0);

    expect(screen.queryByText(/recovery_recipe/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /advanced details/i }));
    expect(screen.getAllByText(/Escalate to a reviewer/i).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/risk threshold/i), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText(/^action$/i), { target: { value: 'block' } });
    fireEvent.click(screen.getByRole('button', { name: /^create policy$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/policies',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const createCall = global.fetch.mock.calls.find((call) => call[0] === '/api/policies');
    const requestBody = JSON.parse(createCall[1].body);

    expect(requestBody).toEqual({
      name: 'Warn on risky actions',
      policy_type: 'risk_threshold',
      rules: JSON.stringify({
        threshold: 90,
        action: 'block',
      }),
      agent_ids: null,
    });
  });
});
