import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { createSqlMock } from '../helpers.js';
import { getAnalytics } from '../../app/lib/repositories/analytics.repository.js';

// Freeze time so the daily gap-fill window is deterministic.
const FIXED_NOW = new Date('2026-04-19T12:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function emptyRows() {
  return [
    [{ total_cost: 0, total_actions: 0, active_agents: 0, avg_latency_ms: 0 }], // heroRows
    [{ total_cost: 0, total_actions: 0, active_agents: 0, avg_latency_ms: 0 }], // prevHeroRows
    [], // dailyRows
    [], // dailyStatusRows
    [], // agentRows
    [], // typeRows
    [{ blocked: 0, require_approval: 0, warn: 0, total: 0 }], // policyRows
    [{ total_in: 0, total_out: 0, total: 0, total_cost: 0 }], // tokenRows
    [], // tokenConsumerRows
  ];
}

describe('analytics.repository getAnalytics', () => {
  it('emits daily queries that return YYYY-MM-DD strings (not Date objects)', async () => {
    const sql = createSqlMock({ queryResponses: emptyRows() });
    await getAnalytics(sql, 'org_test', 7);

    // Queries 3 and 4 (index 2, 3) are the two daily GROUP BY queries.
    const dailyCost = sql.queryCalls[2].text;
    const dailyStatus = sql.queryCalls[3].text;

    expect(dailyCost).toMatch(/TO_CHAR\(/);
    expect(dailyCost).toMatch(/YYYY-MM-DD/);
    expect(dailyCost).not.toMatch(/\bDATE\(timestamp_start\)/);
    expect(dailyStatus).toMatch(/TO_CHAR\(/);
    expect(dailyStatus).toMatch(/YYYY-MM-DD/);
    expect(dailyStatus).not.toMatch(/\bDATE\(timestamp_start\)/);
  });

  it('gap-fills missing days across the requested window', async () => {
    const sql = createSqlMock({ queryResponses: emptyRows() });
    const result = await getAnalytics(sql, 'org_test', 7);

    // 7-day window ending "today" (inclusive) → 8 entries.
    expect(result.daily).toHaveLength(8);
    for (const d of result.daily) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.cost).toBe(0);
      expect(d.actions).toBe(0);
      expect(d.completed).toBe(0);
    }
    expect(result.daily[result.daily.length - 1].date).toBe('2026-04-19');
  });

  it('merges sparse cost + status rows onto the gap-filled axis', async () => {
    const rows = emptyRows();
    // dailyRows: one day has cost
    rows[2] = [{ date: '2026-04-17', cost: 12.5, actions: 3 }];
    // dailyStatusRows: same day has status mix
    rows[3] = [{ date: '2026-04-17', completed: 2, failed: 1, blocked: 0, other: 0 }];

    const sql = createSqlMock({ queryResponses: rows });
    const result = await getAnalytics(sql, 'org_test', 7);

    const hit = result.daily.find(d => d.date === '2026-04-17');
    expect(hit).toMatchObject({
      date: '2026-04-17',
      cost: 12.5,
      actions: 3,
      completed: 2,
      failed: 1,
      blocked: 0,
    });

    // Other days stay zeroed.
    const zero = result.daily.find(d => d.date === '2026-04-15');
    expect(zero.cost).toBe(0);
    expect(zero.actions).toBe(0);
  });
});
