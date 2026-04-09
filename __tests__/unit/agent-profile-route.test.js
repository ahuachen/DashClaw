import { describe, expect, it } from 'vitest';
import { createSqlMock } from '../helpers.js';

describe('getAssumptionsSummary', () => {
  it('returns counts by validation state', async () => {
    const sql = createSqlMock({
      queryResponses: [
        [{ total: '23', validated: '14', invalidated: '3', unverified: '6' }],
      ],
    });

    const { getAssumptionsSummary } = await import(
      '../../app/lib/repositories/assumptions.repository.js'
    );
    const result = await getAssumptionsSummary(sql, 'org_test', 'agent_1');

    expect(result).toEqual({ total: 23, validated: 14, invalidated: 3, unverified: 6 });
  });

  it('returns zeros when no assumptions exist', async () => {
    const sql = createSqlMock({
      queryResponses: [[{}]],
    });

    const { getAssumptionsSummary } = await import(
      '../../app/lib/repositories/assumptions.repository.js'
    );
    const result = await getAssumptionsSummary(sql, 'org_test', 'agent_1');

    expect(result).toEqual({ total: 0, validated: 0, invalidated: 0, unverified: 0 });
  });
});
