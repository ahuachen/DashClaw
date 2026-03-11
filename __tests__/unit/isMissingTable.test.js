import { describe, expect, it } from 'vitest';
import { createSqlMock } from '../helpers.js';

/**
 * Tests for the isMissingTable() graceful degradation pattern used across repositories.
 * This pattern returns [] instead of throwing when a table doesn't exist yet (42P01).
 */

// Import a repository that uses isMissingTable
import { getSharedActions } from '@/lib/repositories/swarm.repository.js';

describe('isMissingTable graceful degradation', () => {
  it('returns empty array when table does not exist (42P01 code)', async () => {
    const sql = () => {
      const err = new Error('relation "action_records" does not exist');
      err.code = '42P01';
      return Promise.reject(err);
    };
    sql.query = async () => [];

    const result = await getSharedActions(sql, 'org_1', ['a1'], ['a2']);
    expect(result).toEqual([]);
  });

  it('returns empty array when error message contains "does not exist"', async () => {
    const sql = () => {
      return Promise.reject(new Error('relation "action_records" does not exist'));
    };
    sql.query = async () => [];

    const result = await getSharedActions(sql, 'org_1', ['a1'], ['a2']);
    expect(result).toEqual([]);
  });

  it('re-throws non-table-missing errors', async () => {
    const sql = () => {
      return Promise.reject(new Error('connection refused'));
    };
    sql.query = async () => [];

    await expect(getSharedActions(sql, 'org_1', ['a1'], ['a2'])).rejects.toThrow('connection refused');
  });
});
