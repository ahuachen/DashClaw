import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// --- Mocks ---

const mockSqlInstance = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockListModelStrategies = vi.fn();
const mockCreateModelStrategy = vi.fn();
const mockGetModelStrategy = vi.fn();
const mockUpdateModelStrategy = vi.fn();
const mockDeleteModelStrategy = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/repositories/model-strategies.repository.js', () => ({
  listModelStrategies: (...a) => mockListModelStrategies(...a),
  createModelStrategy: (...a) => mockCreateModelStrategy(...a),
  getModelStrategy: (...a) => mockGetModelStrategy(...a),
  updateModelStrategy: (...a) => mockUpdateModelStrategy(...a),
  deleteModelStrategy: (...a) => mockDeleteModelStrategy(...a),
}));

const listRoute = await import('../../app/api/model-strategies/route.js');
const detailRoute = await import('../../app/api/model-strategies/[strategyId]/route.js');

// --- Helpers ---

function getReq() {
  return makeRequest('http://localhost:3000/api/model-strategies', {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

function postReq(body) {
  return makeRequest('http://localhost:3000/api/model-strategies', {
    headers: { 'x-api-key': 'oc_live_test' },
    body,
  });
}

function detailReq(body) {
  return makeRequest('http://localhost:3000/api/model-strategies/strat_1', {
    headers: { 'x-api-key': 'oc_live_test' },
    body,
  });
}

const params = Promise.resolve({ strategyId: 'strat_1' });

// --- GET /api/model-strategies ---

describe('GET /api/model-strategies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists strategies', async () => {
    mockListModelStrategies.mockResolvedValueOnce([
      { strategy_id: 'strat_1', name: 'Cost Optimized' },
    ]);

    const res = await listRoute.GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.strategies).toHaveLength(1);
    expect(data.strategies[0].name).toBe('Cost Optimized');
  });

  it('returns 500 on unexpected error', async () => {
    mockListModelStrategies.mockRejectedValueOnce(new Error('boom'));

    const res = await listRoute.GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

// --- POST /api/model-strategies ---

describe('POST /api/model-strategies', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a strategy (201)', async () => {
    const created = { strategy_id: 'strat_new', name: 'Balanced', config: { default_model: 'claude-sonnet-4-6' } };
    mockCreateModelStrategy.mockResolvedValueOnce(created);

    const res = await listRoute.POST(postReq({ name: 'Balanced', config: { default_model: 'claude-sonnet-4-6' } }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.strategy.name).toBe('Balanced');
  });

  it('returns 400 when name is missing', async () => {
    const res = await listRoute.POST(postReq({ config: {} }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/name/i);
  });

  it('returns 400 when config is missing', async () => {
    const res = await listRoute.POST(postReq({ name: 'Test' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/config/i);
  });

  it('returns 400 on invalid config', async () => {
    mockCreateModelStrategy.mockRejectedValueOnce(new Error('config.default_model is required'));

    const res = await listRoute.POST(postReq({ name: 'Test', config: {} }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/config/);
  });
});

// --- GET /api/model-strategies/[strategyId] ---

describe('GET /api/model-strategies/[strategyId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a strategy by ID', async () => {
    mockGetModelStrategy.mockResolvedValueOnce({ strategy_id: 'strat_1', name: 'Cost Optimized' });

    const res = await detailRoute.GET(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.strategy.strategy_id).toBe('strat_1');
  });

  it('returns 404 when not found', async () => {
    mockGetModelStrategy.mockResolvedValueOnce(null);

    const res = await detailRoute.GET(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });
});

// --- PATCH /api/model-strategies/[strategyId] ---

describe('PATCH /api/model-strategies/[strategyId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a strategy', async () => {
    mockUpdateModelStrategy.mockResolvedValueOnce({ strategy_id: 'strat_1', name: 'Updated' });

    const res = await detailRoute.PATCH(detailReq({ name: 'Updated' }), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.strategy.name).toBe('Updated');
  });

  it('returns 404 when not found', async () => {
    mockUpdateModelStrategy.mockResolvedValueOnce(null);

    const res = await detailRoute.PATCH(detailReq({ name: 'X' }), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid config update', async () => {
    mockUpdateModelStrategy.mockRejectedValueOnce(new Error('config.default_model is required'));

    const res = await detailRoute.PATCH(detailReq({ config: {} }), { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/config/);
  });
});

// --- DELETE /api/model-strategies/[strategyId] ---

describe('DELETE /api/model-strategies/[strategyId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a strategy', async () => {
    mockDeleteModelStrategy.mockResolvedValueOnce(true);

    const res = await detailRoute.DELETE(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });

  it('returns 404 when not found', async () => {
    mockDeleteModelStrategy.mockResolvedValueOnce(null);

    const res = await detailRoute.DELETE(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
  });
});
