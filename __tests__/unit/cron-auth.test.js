/**
 * Security regression tests for CRON_SECRET enforcement in cron routes (SEC-04).
 * Verifies that both /api/cron/signals and /api/cron/integration-health reject
 * unauthenticated requests and accept valid Bearer tokens.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// ── /api/cron/signals ─────────────────────────────────────────────────────────

const {
  mockSqlSignals,
  mockComputeSignals,
  mockTimingSafeCompare,
  mockFireWebhooks,
  mockSendEmail,
  mockLogActivity,
  mockPublishOrgEvent,
} = vi.hoisted(() => ({
  mockSqlSignals: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockComputeSignals: vi.fn(async () => []),
  mockTimingSafeCompare: vi.fn(),
  mockFireWebhooks: vi.fn(async () => []),
  mockSendEmail: vi.fn(async () => false),
  mockLogActivity: vi.fn(),
  mockPublishOrgEvent: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSqlSignals }));
vi.mock('@/lib/signals.js', () => ({ computeSignals: mockComputeSignals }));
vi.mock('@/lib/timing-safe.js', () => ({ timingSafeCompare: mockTimingSafeCompare }));
vi.mock('@/lib/webhooks.js', () => ({ fireWebhooksForOrg: mockFireWebhooks }));
vi.mock('@/lib/notifications.js', () => ({ sendSignalAlertEmail: mockSendEmail }));
vi.mock('@/lib/audit.js', () => ({ logActivity: mockLogActivity }));
vi.mock('@/lib/events.js', () => ({
  EVENTS: { SIGNAL_DETECTED: 'signal.detected' },
  publishOrgEvent: mockPublishOrgEvent,
}));

import { GET as signalsGET } from '@/api/cron/signals/route.js';

describe('GET /api/cron/signals — CRON_SECRET auth regression tests', () => {
  const savedSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
    process.env.CRON_SECRET = 'super-secret-cron-token';
    mockTimingSafeCompare.mockReturnValue(false);
    mockSqlSignals.mockImplementation(async () => []);
    mockSqlSignals.query.mockImplementation(async () => []);
  });

  afterEach(() => {
    if (savedSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = savedSecret;
    }
  });

  it('returns 503 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;
    const res = await signalsGET(makeRequest('http://localhost/api/cron/signals', {
      headers: { authorization: 'Bearer super-secret-cron-token' },
    }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/CRON_SECRET/i);
  });

  it('returns 401 when Authorization header is missing', async () => {
    // No authorization header at all
    const res = await signalsGET(makeRequest('http://localhost/api/cron/signals', {
      headers: {},
    }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has wrong Bearer token', async () => {
    mockTimingSafeCompare.mockReturnValue(false);
    const res = await signalsGET(makeRequest('http://localhost/api/cron/signals', {
      headers: { authorization: 'Bearer wrong-token' },
    }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is malformed (no Bearer prefix)', async () => {
    mockTimingSafeCompare.mockReturnValue(false);
    const res = await signalsGET(makeRequest('http://localhost/api/cron/signals', {
      headers: { authorization: 'super-secret-cron-token' },
    }));
    expect(res.status).toBe(401);
  });

  it('proceeds past auth when CRON_SECRET is set and token matches', async () => {
    mockTimingSafeCompare.mockReturnValue(true);
    // SQL returns empty orgs — route completes successfully
    mockSqlSignals.mockImplementation(async () => []);

    const res = await signalsGET(makeRequest('http://localhost/api/cron/signals', {
      headers: { authorization: 'Bearer super-secret-cron-token' },
    }));
    // Route should not return 401 or 503 — any 2xx is acceptable
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(503);
  });
});

// ── /api/cron/integration-health ─────────────────────────────────────────────

const {
  mockSqlHealth,
  mockCheckAllIntegrations,
  mockUpsertHealth,
  mockGetActiveOrgIds,
} = vi.hoisted(() => ({
  mockSqlHealth: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockCheckAllIntegrations: vi.fn(async () => ({})),
  mockUpsertHealth: vi.fn(async () => {}),
  mockGetActiveOrgIds: vi.fn(async () => []),
}));

vi.mock('@/lib/integration-health.js', () => ({ checkAllIntegrations: mockCheckAllIntegrations }));
vi.mock('@/lib/repositories/integration-health.repository.js', () => ({
  upsertHealth: mockUpsertHealth,
  getActiveOrgIds: mockGetActiveOrgIds,
}));

import { GET as integrationHealthGET } from '@/api/cron/integration-health/route.js';

describe('GET /api/cron/integration-health — CRON_SECRET auth regression tests', () => {
  const savedSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
    process.env.CRON_SECRET = 'super-secret-cron-token';
    mockGetActiveOrgIds.mockResolvedValue([]);
  });

  afterEach(() => {
    if (savedSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = savedSecret;
    }
  });

  it('returns 500 when CRON_SECRET env var is not set', async () => {
    delete process.env.CRON_SECRET;
    const res = await integrationHealthGET(makeRequest('http://localhost/api/cron/integration-health', {
      headers: { authorization: 'Bearer super-secret-cron-token' },
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await integrationHealthGET(makeRequest('http://localhost/api/cron/integration-health', {
      headers: {},
    }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header has wrong Bearer token', async () => {
    const res = await integrationHealthGET(makeRequest('http://localhost/api/cron/integration-health', {
      headers: { authorization: 'Bearer wrong-token' },
    }));
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization header is malformed (no Bearer prefix)', async () => {
    const res = await integrationHealthGET(makeRequest('http://localhost/api/cron/integration-health', {
      headers: { authorization: 'super-secret-cron-token' },
    }));
    expect(res.status).toBe(401);
  });

  it('proceeds past auth and returns 200 when CRON_SECRET matches', async () => {
    mockGetActiveOrgIds.mockResolvedValue([]);

    const res = await integrationHealthGET(makeRequest('http://localhost/api/cron/integration-health', {
      headers: { authorization: 'Bearer super-secret-cron-token' },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
