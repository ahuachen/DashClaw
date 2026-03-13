import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockGetReadinessReport, mockProjectReadinessReport, mockGetViewerContext } = vi.hoisted(() => ({
  mockGetReadinessReport: vi.fn(),
  mockProjectReadinessReport: vi.fn(),
  mockGetViewerContext: vi.fn(),
}));

vi.mock('@/lib/readiness.mjs', () => ({
  getReadinessReport: mockGetReadinessReport,
  projectReadinessReport: mockProjectReadinessReport,
}));

vi.mock('@/lib/sessionViewer.mjs', () => ({
  getViewerContextFromCookieHeader: mockGetViewerContext,
}));

import { GET } from '@/api/setup/proof/route.js';

describe('/api/setup/proof GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a public-safe artifact for anonymous viewers', async () => {
    mockGetViewerContext.mockResolvedValue({
      isAuthenticated: false,
      authType: null,
      session: null,
    });
    mockGetReadinessReport.mockResolvedValue({ checkedAt: '2026-03-13T00:00:00.000Z' });
    mockProjectReadinessReport.mockReturnValue({
      proofArtifact: {
        viewer_mode: 'public',
        verification: { overall: 'blocked' },
      },
    });

    const res = await GET(makeRequest('http://localhost/api/setup/proof'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      viewer_mode: 'public',
      verification: { overall: 'blocked' },
    });
    expect(mockProjectReadinessReport).toHaveBeenCalledWith(
      { checkedAt: '2026-03-13T00:00:00.000Z' },
      expect.objectContaining({ isAuthenticated: false, host: 'localhost' })
    );
  });

  it('adds download headers when requested', async () => {
    mockGetViewerContext.mockResolvedValue({
      isAuthenticated: true,
      authType: 'local',
      session: { sub: 'local-admin' },
    });
    mockGetReadinessReport.mockResolvedValue({ checkedAt: '2026-03-13T00:00:00.000Z' });
    mockProjectReadinessReport.mockReturnValue({
      proofArtifact: {
        viewer_mode: 'operator',
        verification: { overall: 'verified' },
      },
    });

    const res = await GET(makeRequest('http://localhost/api/setup/proof?download=1'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment; filename=');
  });
});
