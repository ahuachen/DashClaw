import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockGetSetupStatus } = vi.hoisted(() => ({
  mockGetSetupStatus: vi.fn(),
}));

vi.mock('@/lib/setupStatus.mjs', () => ({
  getSetupStatus: mockGetSetupStatus,
}));

import { GET } from '@/api/setup/status/route.js';

describe('/api/setup/status GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns shared setup readiness when configured', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: true,
      message: 'Dashboard is configured',
    });

    const res = await GET(makeRequest('http://localhost/api/setup/status'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      configured: true,
      message: 'Dashboard is configured',
    });
  });

  it('returns shared setup readiness when database is unreachable', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'connection_error',
      message: 'Unable to connect to database',
    });

    const res = await GET(makeRequest('http://localhost/api/setup/status'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      configured: false,
      reason: 'connection_error',
      message: 'Unable to connect to database',
    });
  });
});
