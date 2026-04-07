import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listCapabilities,
  getCapability,
  createCapability,
  updateCapability,
  shapeCapability,
} from '../../app/lib/repositories/capabilities.repository.js';

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

function capRow(overrides = {}) {
  return {
    capability_id: 'cap_1',
    org_id: 'org_1',
    name: 'Send Slack message',
    slug: 'send-slack-message',
    description: 'Posts to a Slack channel',
    category: 'messaging',
    source_type: 'http_api',
    auth_type: 'oauth',
    risk_level: 'medium',
    requires_approval: 0,
    tags_json: '["notify","slack"]',
    pricing_json: '{}',
    health_status: 'healthy',
    docs_url: 'https://docs.example.com/slack',
    invocation_schema_json: '{"type":"object"}',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
    ...overrides,
  };
}

describe('capabilities.repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('shapeCapability', () => {
    it('parses tags, pricing, and invocation_schema', () => {
      const shaped = shapeCapability(capRow());
      expect(shaped.tags).toEqual(['notify', 'slack']);
      expect(shaped.pricing).toEqual({});
      expect(shaped.invocation_schema).toEqual({ type: 'object' });
    });

    it('normalizes requires_approval into a boolean', () => {
      expect(shapeCapability(capRow({ requires_approval: 1 })).requires_approval).toBe(true);
      expect(shapeCapability(capRow({ requires_approval: 0 })).requires_approval).toBe(false);
    });
  });

  describe('listCapabilities', () => {
    it('returns all when no filters given', async () => {
      const sql = makeSqlMock([[capRow(), capRow({ capability_id: 'cap_2' })]]);
      const result = await listCapabilities(sql, 'org_1');
      expect(result).toHaveLength(2);
    });

    it('applies category filter', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await listCapabilities(sql, 'org_1', { category: 'messaging' });
      expect(sql.calls[0].values).toContain('messaging');
    });

    it('applies search filter as ILIKE term', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await listCapabilities(sql, 'org_1', { search: 'slack' });
      expect(sql.calls[0].values).toContain('%slack%');
    });

    it('combines search + category + risk_level', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await listCapabilities(sql, 'org_1', {
        search: 'slack',
        category: 'messaging',
        risk_level: 'medium',
      });
      const values = sql.calls[0].values;
      expect(values).toContain('messaging');
      expect(values).toContain('medium');
      expect(values).toContain('%slack%');
    });
  });

  describe('getCapability', () => {
    it('returns null when not found', async () => {
      const sql = makeSqlMock([[]]);
      expect(await getCapability(sql, 'org_1', 'cap_missing')).toBeNull();
    });
  });

  describe('createCapability', () => {
    it('requires name', async () => {
      const sql = makeSqlMock([]);
      await expect(createCapability(sql, 'org_1', {})).rejects.toThrow(/name is required/);
    });

    it('rejects invalid risk_level', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createCapability(sql, 'org_1', { name: 'X', risk_level: 'extreme' })
      ).rejects.toThrow(/risk_level/);
    });

    it('rejects invalid source_type', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createCapability(sql, 'org_1', { name: 'X', source_type: 'ftp' })
      ).rejects.toThrow(/source_type/);
    });

    it('rejects invalid http_api invocation schema on create', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createCapability(sql, 'org_1', {
          name: 'Broken HTTP capability',
          source_type: 'http_api',
          invocation_schema: {
            method: 'POST',
          },
        })
      ).rejects.toThrow(/invocation_schema.endpoint is required/i);
    });

    it('rejects invalid input schema on create', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createCapability(sql, 'org_1', {
          name: 'Broken schema capability',
          source_type: 'http_api',
          invocation_schema: {
            endpoint: '${API_URL}/v1/test',
            auth: { type: 'bearer', token_setting: 'API_TOKEN' },
            input_schema: {
              type: 'nope',
            },
          },
        })
      ).rejects.toThrow(/input_schema.type must be one of/i);
    });

    it('generates cap_ id and slug from name', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await createCapability(sql, 'org_1', { name: 'Send Slack Message' });
      const values = sql.calls[0].values;
      expect(values).toContain('send-slack-message');
    });

    it('normalizes requires_approval boolean to 1/0', async () => {
      const sql = makeSqlMock([[capRow({ requires_approval: 1 })]]);
      await createCapability(sql, 'org_1', {
        name: 'Deploy to prod',
        requires_approval: true,
      });
      const values = sql.calls[0].values;
      expect(values).toContain(1);
    });
  });

  describe('updateCapability', () => {
    it('returns null when capability does not exist', async () => {
      const sql = makeSqlMock([[]]);
      expect(await updateCapability(sql, 'org_1', 'missing', { name: 'X' })).toBeNull();
    });

    it('rejects invalid risk_level on update', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await expect(
        updateCapability(sql, 'org_1', 'cap_1', { risk_level: 'extreme' })
      ).rejects.toThrow(/risk_level/);
    });

    it('rejects invalid invocation schema on update', async () => {
      const sql = makeSqlMock([[capRow()]]);
      await expect(
        updateCapability(sql, 'org_1', 'cap_1', {
          invocation_schema: {
            endpoint: '${API_URL}/v1/test',
            auth: { type: 'unknown' },
          },
        })
      ).rejects.toThrow(/invocation_schema.auth.type must be one of/i);
    });

    it('persists patch fields', async () => {
      const sql = makeSqlMock([
        [capRow()],
        [capRow({ risk_level: 'high' })],
      ]);
      const result = await updateCapability(sql, 'org_1', 'cap_1', { risk_level: 'high' });
      expect(result.risk_level).toBe('high');
    });
  });
});
