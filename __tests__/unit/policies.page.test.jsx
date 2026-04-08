import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        role: 'admin',
      },
    },
  }),
}));

vi.mock('@/components/PageLayout', () => ({
  default: ({ title, description, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }) => <div>{children}</div>,
  CardContent: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/Stat', () => ({
  StatCompact: ({ label, value }) => (
    <div>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('@/components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/hooks/useRealtime', () => ({
  useRealtime: () => {},
}));

vi.mock('@/lib/isDemoMode', () => ({
  isDemoMode: () => false,
}));

describe('PoliciesPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (url, options = {}) => {
      if (String(url) === '/api/policies' && !options.method) {
        return {
          ok: true,
          json: async () => ({
            policies: [
              {
                id: 'pol_1',
                name: 'Deploy guard',
                policy_type: 'risk_threshold',
                rules: JSON.stringify({ threshold: 70, action: 'warn' }),
                active: true,
                agent_ids: JSON.stringify(['agent_1']),
              },
            ],
          }),
        };
      }

      if (String(url) === '/api/guard?limit=20') {
        return {
          ok: true,
          json: async () => ({
            decisions: [],
            stats: {},
          }),
        };
      }

      if (String(url) === '/api/agents') {
        return {
          ok: true,
          json: async () => ({
            agents: [
              {
                agent_id: 'agent_1',
                agent_name: 'Primary Agent',
              },
            ],
          }),
        };
      }

      if (String(url) === '/api/policies' && options.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ policy: { id: 'pol_new' } }),
        };
      }

      if (String(url) === '/api/policies' && options.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({ policy: { id: 'pol_1' } }),
        };
      }

      if (String(url) === '/api/policies/simulate') {
        return {
          ok: true,
          json: async () => ({
            summary: { total: 0, block: 0, warn: 0, require_approval: 0 },
            matches: [],
          }),
        };
      }

      if (String(url) === '/api/policies/tests/run') {
        return {
          ok: true,
          json: async () => ({
            totalPolicies: 0,
            totalTests: 0,
            passed: 0,
            failed: 0,
            results: [],
          }),
        };
      }

      if (String(url) === '/api/policies/proof') {
        return {
          ok: true,
          json: async () => ({ report: 'proof' }),
        };
      }

      if (String(url) === '/api/policies/import' || String(url).startsWith('/api/policies/import?')) {
        return {
          ok: true,
          json: async () => ({ imported: 0, skipped: 0, errors: 0 }),
        };
      }

      if (String(url) === '/api/policies/templates') {
        return {
          ok: true,
          json: async () => ({ templates: [] }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows guided summary language in the add form and submits a compiled payload', async () => {
    const { default: PoliciesPage } = await import('@/policies/page.jsx');

    render(<PoliciesPage />);

    expect(await screen.findByText('Deploy guard')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /add policy/i }));

    expect(screen.getByText(/policy summary/i)).toBeTruthy();
    expect(screen.getByText(/block actions when risk is 80 or higher/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/policy name/i), { target: { value: 'Approval gate' } });
    fireEvent.change(screen.getByLabelText(/policy type/i), { target: { value: 'require_approval' } });
    fireEvent.click(screen.getByRole('button', { name: 'deploy' }));

    expect(screen.getByText(/require approval for deploy actions/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Primary Agent' }));
    expect(screen.getByText(/require approval for deploy actions for 1 selected agent/i)).toBeTruthy();

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

    const postCall = global.fetch.mock.calls.find((call) => call[0] === '/api/policies' && call[1]?.method === 'POST');
    const requestBody = JSON.parse(postCall[1].body);

    expect(requestBody).toEqual({
      name: 'Approval gate',
      policy_type: 'require_approval',
      rules: JSON.stringify({
        action_types: ['deploy'],
        action: 'require_approval',
      }),
      agent_ids: JSON.stringify(['agent_1']),
    });
  });

  it('loads edit mode into the shared builder summary and saves a compiled payload', async () => {
    const { default: PoliciesPage } = await import('@/policies/page.jsx');

    render(<PoliciesPage />);

    expect(await screen.findByText(/warn on actions when risk is 70 or higher for 1 selected agent/i)).toBeTruthy();

    fireEvent.click(screen.getByTitle(/edit/i));

    expect(await screen.findByDisplayValue('Deploy guard')).toBeTruthy();
    expect(screen.getByText(/policy summary/i)).toBeTruthy();
    expect(screen.getByText(/warn on actions when risk is 70 or higher for 1 selected agent/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/risk threshold/i), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText(/^action$/i), { target: { value: 'block' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/policies',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const patchCall = global.fetch.mock.calls.find((call) => call[0] === '/api/policies' && call[1]?.method === 'PATCH');
    const requestBody = JSON.parse(patchCall[1].body);

    expect(requestBody).toEqual({
      id: 'pol_1',
      name: 'Deploy guard',
      policy_type: 'risk_threshold',
      rules: JSON.stringify({
        threshold: 90,
        action: 'block',
      }),
      agent_ids: JSON.stringify(['agent_1']),
    });
  });

  it('keeps advanced import out of the default page flow and opens it on demand', async () => {
    const { default: PoliciesPage } = await import('@/policies/page.jsx');

    render(<PoliciesPage />);

    expect(await screen.findByText('Deploy guard')).toBeTruthy();

    expect(screen.getByRole('link', { name: /generate with ai/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /advanced import/i })).toBeTruthy();
    expect(screen.queryByText(/yaml policy definition/i)).toBeNull();
    expect(screen.queryByText(/import policy pack/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /advanced import/i }));

    expect(await screen.findByRole('heading', { name: /advanced import/i })).toBeTruthy();
    expect(screen.getByText(/intended for expert users/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^policy pack$/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^raw yaml$/i }));
    expect(screen.getByPlaceholderText(/paste your policy yaml here/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^policy pack$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));

    expect(await screen.findByText(/0 imported/i)).toBeTruthy();
    expect(screen.getByText(/0 skipped/i)).toBeTruthy();
    expect(screen.getByText(/0 errors/i)).toBeTruthy();
  });
});
