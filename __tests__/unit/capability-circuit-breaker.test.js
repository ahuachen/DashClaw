import { describe, expect, it, vi } from 'vitest';
import { checkCircuitBreaker } from '../../app/lib/capability-health.js';

function makeSqlMock(rows) {
  return vi.fn(() => Promise.resolve(rows));
}

function makeCapability(overrides = {}) {
  return {
    slug: 'test-cap',
    health_status: 'unknown',
    invocation_schema: {
      endpoint: 'https://example.com/api',
      circuit_breaker: { enabled: true, consecutive_failures: 3 },
    },
    ...overrides,
  };
}

describe('checkCircuitBreaker', () => {
  it('returns open:false when circuit_breaker is not configured', async () => {
    const sql = makeSqlMock([]);
    const cap = makeCapability({ invocation_schema: { endpoint: 'https://example.com' } });
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns open:false when circuit_breaker.enabled is false', async () => {
    const sql = makeSqlMock([]);
    const cap = makeCapability({
      invocation_schema: {
        endpoint: 'https://example.com',
        circuit_breaker: { enabled: false, consecutive_failures: 3 },
      },
    });
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns open:false when health_status is healthy (test reset)', async () => {
    const sql = makeSqlMock([]);
    const cap = makeCapability({ health_status: 'healthy' });
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
    expect(sql).not.toHaveBeenCalled();
  });

  it('returns open:false when fewer actions than threshold', async () => {
    const sql = makeSqlMock([{ status: 'failed' }, { status: 'failed' }]);
    const cap = makeCapability();
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
  });

  it('returns open:true when last N actions are all failures', async () => {
    const sql = makeSqlMock([
      { status: 'failed' },
      { status: 'failed' },
      { status: 'failed' },
    ]);
    const cap = makeCapability();
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(true);
    expect(result.consecutive_failures).toBe(3);
  });

  it('returns open:false when recent actions include a success', async () => {
    const sql = makeSqlMock([
      { status: 'failed' },
      { status: 'completed' },
      { status: 'failed' },
    ]);
    const cap = makeCapability();
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
  });

  it('uses default threshold of 5 when consecutive_failures is not set', async () => {
    const sql = makeSqlMock(Array(5).fill({ status: 'failed' }));
    const cap = makeCapability({
      invocation_schema: {
        endpoint: 'https://example.com',
        circuit_breaker: { enabled: true },
      },
    });
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(true);
    expect(result.consecutive_failures).toBe(5);
  });

  it('returns open:false when invocation_schema is missing', async () => {
    const sql = makeSqlMock([]);
    const cap = { slug: 'test', health_status: 'unknown' };
    const result = await checkCircuitBreaker(sql, 'org_1', cap);
    expect(result.open).toBe(false);
  });
});
