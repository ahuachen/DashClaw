import { describe, expect, it } from 'vitest';
import {
  createLiveVerificationProofToken,
  readLiveVerificationProofToken,
} from '@/lib/liveVerificationProof.mjs';

describe('live verification proof tokens', () => {
  it('signs and verifies a sanitized proof payload', async () => {
    const { token, proof } = await createLiveVerificationProofToken(
      {
        validator: 'dashclaw-integration-validator',
        tool: 'node',
        mode: 'full',
        summary: { passed: 12, failed: 0, skipped: 1, score: 100 },
        checks: [
          { name: 'Health endpoint', status: 'pass' },
          { name: 'API key configured', status: 'pass' },
        ],
      },
      {
        env: { NEXTAUTH_SECRET: 'test-secret' },
        host: 'dashclaw.example.com',
      }
    );

    expect(token).toBeTruthy();
    expect(proof.tool).toBe('node');

    const verified = await readLiveVerificationProofToken(token, {
      NEXTAUTH_SECRET: 'test-secret',
    });

    expect(verified.verified).toBe(true);
    expect(verified.summary.failed).toBe(0);
    expect(verified.checks).toHaveLength(2);
  });

  it('rejects failed validation payloads', async () => {
    await expect(
      createLiveVerificationProofToken(
        {
          tool: 'node',
          mode: 'read_only',
          summary: { passed: 8, failed: 1, skipped: 0, score: 88 },
          checks: [{ name: 'API key authentication', status: 'fail' }],
        },
        {
          env: { NEXTAUTH_SECRET: 'test-secret' },
        }
      )
    ).rejects.toThrow('Only successful live validation runs can be captured as proof.');
  });
});
