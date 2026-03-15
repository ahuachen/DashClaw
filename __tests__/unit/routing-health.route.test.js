import { describe, expect, it } from 'vitest';
import { GET } from '@/api/_archive/routing/health/route.js';

describe('/api/routing/health GET', () => {
  it('returns ok status', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('dashclaw-routing');
  });

  it('includes timestamp', async () => {
    const res = await GET();
    const data = await res.json();
    expect(data.timestamp).toBeDefined();
  });
});
