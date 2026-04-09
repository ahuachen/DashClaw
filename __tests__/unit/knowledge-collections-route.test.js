import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// --- Mocks ---

const mockSqlInstance = vi.fn();
const mockGetOrgId = vi.fn(() => 'org_test');
const mockListCollections = vi.fn();
const mockCreateCollection = vi.fn();
const mockGetCollection = vi.fn();
const mockUpdateCollection = vi.fn();
const mockDeleteCollection = vi.fn();

vi.mock('../../app/lib/db.js', () => ({ getSql: () => mockSqlInstance }));
vi.mock('../../app/lib/org.js', () => ({ getOrgId: (...a) => mockGetOrgId(...a) }));
vi.mock('../../app/lib/repositories/knowledge.repository.js', () => ({
  listCollections: (...a) => mockListCollections(...a),
  createCollection: (...a) => mockCreateCollection(...a),
  getCollection: (...a) => mockGetCollection(...a),
  updateCollection: (...a) => mockUpdateCollection(...a),
  deleteCollection: (...a) => mockDeleteCollection(...a),
}));

const listRoute = await import('../../app/api/knowledge/collections/route.js');
const detailRoute = await import('../../app/api/knowledge/collections/[collectionId]/route.js');

// --- Helpers ---

function getReq(params = '') {
  return makeRequest(`http://localhost:3000/api/knowledge/collections${params}`, {
    headers: { 'x-api-key': 'oc_live_test' },
  });
}

function postReq(body) {
  return makeRequest('http://localhost:3000/api/knowledge/collections', {
    headers: { 'x-api-key': 'oc_live_test' },
    body,
  });
}

function detailReq(body) {
  return makeRequest('http://localhost:3000/api/knowledge/collections/col_1', {
    headers: { 'x-api-key': 'oc_live_test' },
    body,
  });
}

const params = Promise.resolve({ collectionId: 'col_1' });

// --- GET /api/knowledge/collections ---

describe('GET /api/knowledge/collections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists collections with defaults', async () => {
    mockListCollections.mockResolvedValueOnce([
      { collection_id: 'col_1', name: 'Strategy Docs' },
    ]);

    const res = await listRoute.GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.collections).toHaveLength(1);
    expect(data.collections[0].name).toBe('Strategy Docs');
  });

  it('passes filter params through', async () => {
    mockListCollections.mockResolvedValueOnce([]);

    await listRoute.GET(getReq('?source_type=manual&limit=10&offset=5'));

    expect(mockListCollections).toHaveBeenCalledWith(
      expect.anything(), 'org_test',
      expect.objectContaining({ sourceType: 'manual', limit: '10', offset: '5' })
    );
  });

  it('returns 503 on missing schema', async () => {
    const err = new Error('relation "collections" does not exist');
    err.code = '42P01';
    mockListCollections.mockRejectedValueOnce(err);

    const res = await listRoute.GET(getReq());
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.code).toBe('SCHEMA_NOT_INITIALIZED');
  });
});

// --- POST /api/knowledge/collections ---

describe('POST /api/knowledge/collections', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a collection (201)', async () => {
    const created = { collection_id: 'col_new', name: 'My Collection' };
    mockCreateCollection.mockResolvedValueOnce(created);

    const res = await listRoute.POST(postReq({ name: 'My Collection' }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.collection.name).toBe('My Collection');
  });

  it('returns 400 when name is missing', async () => {
    const res = await listRoute.POST(postReq({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/name/i);
  });

  it('returns 400 on invalid source_type', async () => {
    mockCreateCollection.mockRejectedValueOnce(new Error('source_type must be one of: manual, api'));

    const res = await listRoute.POST(postReq({ name: 'Test', source_type: 'invalid' }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/source_type/);
  });
});

// --- GET /api/knowledge/collections/[collectionId] ---

describe('GET /api/knowledge/collections/[collectionId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a collection by ID', async () => {
    mockGetCollection.mockResolvedValueOnce({ collection_id: 'col_1', name: 'Docs' });

    const res = await detailRoute.GET(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.collection.collection_id).toBe('col_1');
  });

  it('returns 404 when not found', async () => {
    mockGetCollection.mockResolvedValueOnce(null);

    const res = await detailRoute.GET(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });
});

// --- PATCH /api/knowledge/collections/[collectionId] ---

describe('PATCH /api/knowledge/collections/[collectionId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a collection', async () => {
    mockUpdateCollection.mockResolvedValueOnce({ collection_id: 'col_1', name: 'Updated' });

    const res = await detailRoute.PATCH(detailReq({ name: 'Updated' }), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.collection.name).toBe('Updated');
  });

  it('returns 404 when not found', async () => {
    mockUpdateCollection.mockResolvedValueOnce(null);

    const res = await detailRoute.PATCH(detailReq({ name: 'X' }), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid source_type in update', async () => {
    mockUpdateCollection.mockRejectedValueOnce(new Error('source_type must be one of: manual, api'));

    const res = await detailRoute.PATCH(detailReq({ source_type: 'bad' }), { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toMatch(/source_type/);
  });
});

// --- DELETE /api/knowledge/collections/[collectionId] ---

describe('DELETE /api/knowledge/collections/[collectionId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a collection', async () => {
    mockDeleteCollection.mockResolvedValueOnce(true);

    const res = await detailRoute.DELETE(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
    expect(data.collection_id).toBe('col_1');
  });

  it('returns 404 when not found', async () => {
    mockDeleteCollection.mockResolvedValueOnce(null);

    const res = await detailRoute.DELETE(detailReq(), { params });
    const data = await res.json();

    expect(res.status).toBe(404);
  });
});
