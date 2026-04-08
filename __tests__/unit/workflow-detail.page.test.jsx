import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useParams: () => ({ templateId: 'wft_1' }),
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
  CardHeader: ({ title }) => <div>{title}</div>,
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }) => <span>{children}</span>,
}));

describe('WorkflowTemplateDetailPage', () => {
  function createFetchMock(templatePayload) {
    return vi.fn(async (url, options = {}) => {
      if (String(url) === '/api/workflows/templates/wft_1' && (!options.method || options.method === 'GET')) {
        return {
          ok: true,
          json: async () => ({ template: templatePayload }),
        };
      }

      if (String(url) === '/api/knowledge/collections?limit=100') {
        return {
          ok: true,
          json: async () => ({
            collections: [
              { collection_id: 'kn_refunds', name: 'Refund Policies', source_type: 'manual', doc_count: 12 },
            ],
          }),
        };
      }

      if (String(url) === '/api/capabilities?limit=100') {
        return {
          ok: true,
          json: async () => ({
            capabilities: [
              { capability_id: 'cap_slack', name: 'Send Slack Message', source_type: 'http_api', risk_level: 'medium' },
            ],
          }),
        };
      }

      if (String(url) === '/api/prompts/templates') {
        return {
          ok: true,
          json: async () => ({
            templates: [
              { id: 'pt_refund', name: 'Refund Summary', category: 'support' },
            ],
          }),
        };
      }

      if (String(url) === '/api/prompts/templates/pt_refund/versions') {
        return {
          ok: true,
          json: async () => ({
            versions: [
              { id: 'pv_1', version: 1, is_active: true, content: 'Summarize the refund policy.' },
            ],
          }),
        };
      }

      if (String(url) === '/api/workflows/templates/wft_1' && options.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            template: { template_id: 'wft_1' },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({}),
      };
    });
  }

  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders executable steps with the sequential builder instead of the old canvas', async () => {
    global.fetch = createFetchMock({
      template_id: 'wft_1',
      name: 'Refund Workflow',
      slug: 'refund-workflow',
      description: 'Draft refund flow',
      status: 'draft',
      version: 2,
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
      linked_policy_ids: [],
      linked_knowledge_collection_ids: [],
      linked_capability_ids: [],
      linked_prompt_template_ids: [],
      linked_capability_tags: [],
    });

    const { default: WorkflowTemplateDetailPage } = await import('@/workflows/[templateId]/page.jsx');

    render(<WorkflowTemplateDetailPage />);

    await screen.findByRole('heading', { name: /refund workflow/i });

    expect(screen.getByText(/workflows currently run steps in order/i)).toBeTruthy();
    expect(screen.queryByText(/^visual$/i)).toBeNull();
    expect(screen.getByRole('button', { name: /source/i })).toBeTruthy();
    expect(screen.getByDisplayValue('Find refund policy')).toBeTruthy();
    expect(screen.getByText(/reference help/i)).toBeTruthy();
  });

  it('shows an honest legacy notice for graph-shaped step data', async () => {
    global.fetch = createFetchMock({
      template_id: 'wft_1',
      name: 'Legacy Workflow',
      slug: 'legacy-workflow',
      description: '',
      status: 'draft',
      version: 1,
      steps: {
        nodes: [
          { id: 'node_1', type: 'action', data: { label: 'First node', stepType: 'action' } },
        ],
        edges: [],
      },
      linked_policy_ids: [],
      linked_knowledge_collection_ids: [],
      linked_capability_ids: [],
      linked_prompt_template_ids: [],
      linked_capability_tags: [],
    });

    const { default: WorkflowTemplateDetailPage } = await import('@/workflows/[templateId]/page.jsx');

    render(<WorkflowTemplateDetailPage />);

    await screen.findByRole('heading', { name: /legacy workflow/i });

    expect(screen.getByText(/saved with the legacy graph editor/i)).toBeTruthy();
    expect(screen.getByText(/1 node/i)).toBeTruthy();
    expect(screen.getByText(/first node \(action\)/i)).toBeTruthy();
    expect(screen.queryByText(/workflows currently run steps in order/i)).toBeNull();
  });

  it('saves edited executable steps through the template patch route', async () => {
    global.fetch = createFetchMock({
      template_id: 'wft_1',
      name: 'Refund Workflow',
      slug: 'refund-workflow',
      description: '',
      status: 'draft',
      version: 1,
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
      linked_policy_ids: [],
      linked_knowledge_collection_ids: [],
      linked_capability_ids: [],
      linked_prompt_template_ids: [],
      linked_capability_tags: [],
    });

    const { default: WorkflowTemplateDetailPage } = await import('@/workflows/[templateId]/page.jsx');

    render(<WorkflowTemplateDetailPage />);

    await screen.findByRole('heading', { name: /refund workflow/i });

    fireEvent.change(screen.getByLabelText(/step name/i), { target: { value: 'Lookup refund policy' } });
    fireEvent.click(screen.getByRole('button', { name: /save steps/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/workflows/templates/wft_1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        }),
      );
    });

    const patchCall = global.fetch.mock.calls.find(([url, options]) => url === '/api/workflows/templates/wft_1' && options?.method === 'PATCH');
    const requestBody = JSON.parse(patchCall[1].body);

    expect(requestBody).toMatchObject({
      steps: [
        {
          id: 'step_1',
          type: 'knowledge_search',
          name: 'Lookup refund policy',
          config: {
            collection_id: 'kn_refunds',
            query: 'refund eligibility',
            top_k: 3,
          },
        },
      ],
    });
  });
});
