import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  listCollectionItems,
  addCollectionItem,
  shapeCollection,
  shapeItem,
} from '../../app/lib/repositories/knowledge.repository.js';

function makeSqlMock(responses) {
  const queue = [...responses];
  const calls = [];
  const fn = vi.fn((strings, ...values) => {
    calls.push({ strings, values });
    return Promise.resolve(queue.shift() ?? []);
  });
  fn.calls = calls;
  return fn;
}

function collectionRow(overrides = {}) {
  return {
    collection_id: 'kc_1',
    org_id: 'org_1',
    name: 'Runbook Library',
    description: 'Incident runbooks',
    source_type: 'files',
    tags_json: '["ops","oncall"]',
    ingestion_status: 'empty',
    doc_count: 0,
    last_synced_at: null,
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
    ...overrides,
  };
}

function itemRow(overrides = {}) {
  return {
    item_id: 'kci_1',
    collection_id: 'kc_1',
    org_id: 'org_1',
    source_uri: 'https://example.com/runbook.md',
    title: 'Deploy runbook',
    mime_type: 'text/markdown',
    status: 'pending',
    metadata_json: '{"owner":"sre"}',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
    ...overrides,
  };
}

describe('knowledge.repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('shapeCollection', () => {
    it('parses tags_json and copies scalar fields', () => {
      const shaped = shapeCollection(collectionRow());
      expect(shaped.tags).toEqual(['ops', 'oncall']);
      expect(shaped.source_type).toBe('files');
      expect(shaped.doc_count).toBe(0);
    });

    it('returns null on nullish input', () => {
      expect(shapeCollection(null)).toBeNull();
    });
  });

  describe('shapeItem', () => {
    it('parses metadata_json', () => {
      const shaped = shapeItem(itemRow());
      expect(shaped.metadata).toEqual({ owner: 'sre' });
    });
  });

  describe('listCollections', () => {
    it('returns shaped collections without filter', async () => {
      const sql = makeSqlMock([[collectionRow(), collectionRow({ collection_id: 'kc_2' })]]);
      const result = await listCollections(sql, 'org_1');
      expect(result).toHaveLength(2);
      expect(result[0].tags).toEqual(['ops', 'oncall']);
    });

    it('filters by source_type when provided', async () => {
      const sql = makeSqlMock([[collectionRow({ source_type: 'urls' })]]);
      const result = await listCollections(sql, 'org_1', { sourceType: 'urls' });
      expect(result).toHaveLength(1);
      expect(sql.calls[0].values).toContain('urls');
    });
  });

  describe('getCollection', () => {
    it('returns null when not found', async () => {
      const sql = makeSqlMock([[]]);
      expect(await getCollection(sql, 'org_1', 'missing')).toBeNull();
    });
  });

  describe('createCollection', () => {
    it('requires name', async () => {
      const sql = makeSqlMock([]);
      await expect(createCollection(sql, 'org_1', {})).rejects.toThrow(/name is required/);
    });

    it('rejects invalid source_type', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createCollection(sql, 'org_1', { name: 'X', source_type: 'bogus' })
      ).rejects.toThrow(/source_type/);
    });

    it('generates kc_ id, defaults ingestion_status to empty and doc_count to 0', async () => {
      const sql = makeSqlMock([[collectionRow()]]);
      await createCollection(sql, 'org_1', { name: 'Runbook Library', tags: ['ops', 'oncall'] });
      const values = sql.calls[0].values;
      expect(values).toContain('empty');
      expect(values).toContain(0);
      expect(values).toContain(JSON.stringify(['ops', 'oncall']));
    });
  });

  describe('updateCollection', () => {
    it('returns null when collection does not exist', async () => {
      const sql = makeSqlMock([[]]);
      expect(await updateCollection(sql, 'org_1', 'missing', { name: 'X' })).toBeNull();
    });

    it('merges patch fields over existing row', async () => {
      const sql = makeSqlMock([
        [collectionRow()],
        [collectionRow({ name: 'Updated Name' })],
      ]);
      const result = await updateCollection(sql, 'org_1', 'kc_1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('addCollectionItem', () => {
    it('requires source_uri', async () => {
      const sql = makeSqlMock([]);
      await expect(addCollectionItem(sql, 'org_1', 'kc_1', {})).rejects.toThrow(/source_uri/);
    });

    it('returns null when parent collection does not exist', async () => {
      const sql = makeSqlMock([[]]); // getCollection → empty
      const result = await addCollectionItem(sql, 'org_1', 'missing', {
        source_uri: 'x',
      });
      expect(result).toBeNull();
    });

    it('inserts the item and bumps the parent doc_count', async () => {
      const sql = makeSqlMock([
        [collectionRow()],   // getCollection
        [itemRow()],         // INSERT items
        [],                  // UPDATE collections
      ]);
      const item = await addCollectionItem(sql, 'org_1', 'kc_1', {
        source_uri: 'https://example.com/runbook.md',
        title: 'Deploy runbook',
      });
      expect(item.item_id).toBe('kci_1');
      expect(sql.calls).toHaveLength(3);
    });
  });

  describe('listCollectionItems', () => {
    it('returns shaped items', async () => {
      const sql = makeSqlMock([[itemRow(), itemRow({ item_id: 'kci_2' })]]);
      const items = await listCollectionItems(sql, 'org_1', 'kc_1');
      expect(items).toHaveLength(2);
    });
  });
});
