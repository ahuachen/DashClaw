import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listModelStrategies,
  getModelStrategy,
  createModelStrategy,
  updateModelStrategy,
  deleteModelStrategy,
  validateStrategyConfig,
  shapeStrategy,
} from '../../app/lib/repositories/model-strategies.repository.js';

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

function dbRow(overrides = {}) {
  return {
    strategy_id: 'mst_1',
    org_id: 'org_1',
    name: 'Balanced Default',
    description: 'Prod default strategy',
    config_json: JSON.stringify({
      primary: { provider: 'openai', model: 'gpt-4.1' },
      fallback: [{ provider: 'anthropic', model: 'claude-sonnet-4' }],
      costSensitivity: 'balanced',
      maxBudgetUsd: 0.5,
      maxRetries: 2,
    }),
    created_by: 'user_1',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
    ...overrides,
  };
}

describe('model-strategies.repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('validateStrategyConfig', () => {
    it('accepts a minimal valid config', () => {
      expect(() =>
        validateStrategyConfig({ primary: { provider: 'openai', model: 'gpt-4.1' } })
      ).not.toThrow();
    });

    it('rejects missing primary provider', () => {
      expect(() => validateStrategyConfig({ primary: { model: 'gpt-4.1' } })).toThrow(
        /primary.provider/
      );
    });

    it('rejects missing primary model', () => {
      expect(() => validateStrategyConfig({ primary: { provider: 'openai' } })).toThrow(
        /primary.model/
      );
    });

    it('rejects invalid costSensitivity', () => {
      expect(() =>
        validateStrategyConfig({
          primary: { provider: 'openai', model: 'gpt-4.1' },
          costSensitivity: 'very-high',
        })
      ).toThrow(/costSensitivity/);
    });

    it('rejects non-array fallback', () => {
      expect(() =>
        validateStrategyConfig({
          primary: { provider: 'openai', model: 'gpt-4.1' },
          fallback: { provider: 'anthropic' },
        })
      ).toThrow(/fallback/);
    });

    it('rejects non-number maxBudgetUsd', () => {
      expect(() =>
        validateStrategyConfig({
          primary: { provider: 'openai', model: 'gpt-4.1' },
          maxBudgetUsd: '0.50',
        })
      ).toThrow(/maxBudgetUsd/);
    });
  });

  describe('shapeStrategy', () => {
    it('parses config_json into an object', () => {
      const shaped = shapeStrategy(dbRow());
      expect(shaped.config.primary.provider).toBe('openai');
      expect(shaped.config.costSensitivity).toBe('balanced');
    });

    it('returns null for nullish row', () => {
      expect(shapeStrategy(null)).toBeNull();
    });
  });

  describe('listModelStrategies', () => {
    it('returns shaped strategies', async () => {
      const sql = makeSqlMock([[dbRow(), dbRow({ strategy_id: 'mst_2' })]]);
      const result = await listModelStrategies(sql, 'org_1');
      expect(result).toHaveLength(2);
      expect(result[0].config.primary.model).toBe('gpt-4.1');
    });
  });

  describe('getModelStrategy', () => {
    it('returns null when not found', async () => {
      const sql = makeSqlMock([[]]);
      const result = await getModelStrategy(sql, 'org_1', 'mst_missing');
      expect(result).toBeNull();
    });
  });

  describe('createModelStrategy', () => {
    it('throws when name is missing', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createModelStrategy(sql, 'org_1', {
          config: { primary: { provider: 'openai', model: 'gpt-4.1' } },
        })
      ).rejects.toThrow(/name is required/);
    });

    it('throws when config is invalid', async () => {
      const sql = makeSqlMock([]);
      await expect(
        createModelStrategy(sql, 'org_1', { name: 'X', config: { primary: {} } })
      ).rejects.toThrow(/primary.provider/);
    });

    it('generates mst_ id and stringifies config_json', async () => {
      const sql = makeSqlMock([[dbRow()]]);
      await createModelStrategy(sql, 'org_1', {
        name: 'Balanced Default',
        config: { primary: { provider: 'openai', model: 'gpt-4.1' } },
      });
      const values = sql.calls[0].values;
      const configJson = values.find((v) => typeof v === 'string' && v.startsWith('{'));
      expect(configJson).toBeTruthy();
      const parsed = JSON.parse(configJson);
      expect(parsed.primary.provider).toBe('openai');
    });
  });

  describe('updateModelStrategy', () => {
    it('returns null when strategy does not exist', async () => {
      const sql = makeSqlMock([[]]);
      const result = await updateModelStrategy(sql, 'org_1', 'mst_missing', {
        name: 'Renamed',
      });
      expect(result).toBeNull();
    });

    it('merges config patches onto existing config', async () => {
      const sql = makeSqlMock([[dbRow()], [dbRow({ name: 'Renamed' })]]);
      const result = await updateModelStrategy(sql, 'org_1', 'mst_1', {
        config: { maxBudgetUsd: 1.0 },
      });
      expect(result).not.toBeNull();
      // The UPDATE should have received the merged config
      const updateCall = sql.calls[1];
      const configJson = updateCall.values.find(
        (v) => typeof v === 'string' && v.startsWith('{')
      );
      const merged = JSON.parse(configJson);
      expect(merged.primary.provider).toBe('openai'); // preserved
      expect(merged.maxBudgetUsd).toBe(1.0); // merged in
    });
  });

  describe('deleteModelStrategy', () => {
    it('returns false when strategy does not exist', async () => {
      const sql = makeSqlMock([[]]);
      const result = await deleteModelStrategy(sql, 'org_1', 'mst_missing');
      expect(result).toBe(false);
    });

    it('nulls out workflow_templates reference then deletes', async () => {
      const sql = makeSqlMock([
        [dbRow()], // getModelStrategy
        [],        // UPDATE workflow_templates
        [],        // DELETE model_strategies
      ]);
      const result = await deleteModelStrategy(sql, 'org_1', 'mst_1');
      expect(result).toBe(true);
      expect(sql.calls).toHaveLength(3);
    });
  });
});
