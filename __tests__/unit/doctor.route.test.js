// __tests__/unit/doctor.route.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockRunDoctor, mockApplyFix, mockEmpty } = vi.hoisted(() => ({
  mockRunDoctor: vi.fn(),
  mockApplyFix: vi.fn(),
  mockEmpty: vi.fn(async () => []),
}));

vi.mock('@/lib/doctor/engine.mjs', () => ({
  runDoctor: mockRunDoctor,
  applyFix: mockApplyFix,
}));

// Ensure check-module imports don't fail when engine.mjs is loaded by route handlers
vi.mock('@/lib/doctor/checks/database.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/config.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/auth.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/deployment.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/sdk.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/governance.mjs', () => ({ runChecks: mockEmpty }));

import { GET } from '@/api/doctor/route.js';
import { POST } from '@/api/doctor/fix/route.js';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/doctor', () => {
  it('returns doctor result as JSON', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'healthy',
      summary: { pass: 3, warn: 0, fail: 0 },
      checks: [],
      timestamp: '2026-04-12T00:00:00Z',
    });

    const req = makeRequest('http://localhost/api/doctor', { headers: { 'x-api-key': 'test' } });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  it('returns 503 when status is unhealthy', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'unhealthy', summary: { pass: 0, warn: 0, fail: 1 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor', { headers: { 'x-api-key': 'test' } });
    const res = await GET(req);

    expect(res.status).toBe(503);
  });

  it('passes category filter from query params', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 1, warn: 0, fail: 0 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor?category=database,config', {
      headers: { 'x-api-key': 'test' },
    });
    await GET(req);

    expect(mockRunDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['database', 'config'] }),
    );
  });
});

describe('POST /api/doctor/fix', () => {
  it('applies a fix and returns result with recheck', async () => {
    mockApplyFix.mockResolvedValue({
      applied: true, action: 'migrate', description: 'Ran migrations',
    });
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 1, warn: 0, fail: 0 },
      checks: [{ id: 'db_schema', category: 'database', status: 'pass', title: 'Tables', message: 'OK', fix: null }],
      timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: { action: 'migrate' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied).toBe(true);
    expect(body.recheck).toBeDefined();
  });

  it('returns 400 for missing action', async () => {
    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('passes allowLocal: false to applyFix', async () => {
    mockApplyFix.mockResolvedValue({ applied: false, action: 'generate_secret', description: 'requires local' });
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 0, warn: 0, fail: 0 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: { action: 'generate_secret' },
    });
    await POST(req);

    expect(mockApplyFix).toHaveBeenCalledWith('generate_secret', {}, { allowLocal: false });
  });
});
