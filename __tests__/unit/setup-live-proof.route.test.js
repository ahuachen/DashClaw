import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockCreateLiveVerificationProofToken } = vi.hoisted(() => ({
  mockCreateLiveVerificationProofToken: vi.fn(),
}));

vi.mock('@/lib/liveVerificationProof.mjs', () => ({
  createLiveVerificationProofToken: mockCreateLiveVerificationProofToken,
}));

import { POST } from '@/api/setup/live-proof/route.js';

describe('/api/setup/live-proof POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a signed setup URL for successful validation payloads', async () => {
    mockCreateLiveVerificationProofToken.mockResolvedValue({
      token: 'signed-proof-token',
      proof: {
        tool: 'node',
        mode: 'full',
        summary: { passed: 12, failed: 0, skipped: 0, score: 100 },
      },
    });

    const res = await POST(
      makeRequest('http://localhost/api/setup/live-proof', {
        body: {
          tool: 'node',
          mode: 'full',
          summary: { passed: 12, failed: 0, skipped: 0, score: 100 },
        },
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.setup_url).toContain('/setup?proof=');
    expect(data.proof_download_url).toContain('/api/setup/proof?proof=');
  });

  it('returns 400 when the payload is rejected', async () => {
    mockCreateLiveVerificationProofToken.mockRejectedValue(new Error('Only successful live validation runs can be captured as proof.'));

    const res = await POST(
      makeRequest('http://localhost/api/setup/live-proof', {
        body: {
          tool: 'node',
          mode: 'read_only',
          summary: { passed: 8, failed: 1, skipped: 0, score: 88 },
        },
      })
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'Only successful live validation runs can be captured as proof.',
    });
  });
});
