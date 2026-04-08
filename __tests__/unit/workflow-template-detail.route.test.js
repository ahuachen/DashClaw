import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockGetWorkflowTemplate,
  mockUpdateWorkflowTemplate,
  mockDeleteWorkflowTemplate,
} = vi.hoisted(() => ({
  mockSql: vi.fn(),
  mockGetWorkflowTemplate: vi.fn(),
  mockUpdateWorkflowTemplate: vi.fn(),
  mockDeleteWorkflowTemplate: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/repositories/workflow-templates.repository.js', () => ({
  getWorkflowTemplate: mockGetWorkflowTemplate,
  updateWorkflowTemplate: mockUpdateWorkflowTemplate,
  deleteWorkflowTemplate: mockDeleteWorkflowTemplate,
}));

import { DELETE } from '@/api/workflows/templates/[templateId]/route.js';

describe('/api/workflows/templates/[templateId] DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 for non-admin', async () => {
    const res = await DELETE(
      makeRequest('http://localhost/api/workflows/templates/wft_1', {
        headers: { 'x-org-id': 'org_1', 'x-org-role': 'member' },
      }),
      { params: Promise.resolve({ templateId: 'wft_1' }) }
    );

    expect(res.status).toBe(403);
  });

  it('returns 404 when template not found', async () => {
    mockDeleteWorkflowTemplate.mockResolvedValueOnce(false);

    const res = await DELETE(
      makeRequest('http://localhost/api/workflows/templates/wft_1', {
        headers: { 'x-org-id': 'org_1', 'x-org-role': 'admin' },
      }),
      { params: Promise.resolve({ templateId: 'wft_1' }) }
    );

    expect(res.status).toBe(404);
  });

  it('deletes template and returns success payload', async () => {
    mockDeleteWorkflowTemplate.mockResolvedValueOnce(true);

    const res = await DELETE(
      makeRequest('http://localhost/api/workflows/templates/wft_1', {
        headers: { 'x-org-id': 'org_1', 'x-org-role': 'admin' },
      }),
      { params: Promise.resolve({ templateId: 'wft_1' }) }
    );

    expect(res.status).toBe(200);
    expect(mockDeleteWorkflowTemplate).toHaveBeenCalledWith(mockSql, 'org_1', 'wft_1');

    const data = await res.json();
    expect(data).toEqual({ deleted: true, template_id: 'wft_1' });
  });
});
