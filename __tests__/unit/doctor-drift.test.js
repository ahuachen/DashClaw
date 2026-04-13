// __tests__/unit/doctor-drift.test.js
import { describe, expect, it } from 'vitest';
import { computeDriftChecks } from '@/lib/doctor/checks/drift.mjs';

function makeShape({ timestamp, routes = 1, env_vars = 1, tables = 1 }) {
  return {
    timestamp,
    routes: Array.from({ length: routes }, (_, i) => ({ path: `/api/r${i}` })),
    env_vars: Array.from({ length: env_vars }, (_, i) => ({ name: `E${i}` })),
    tables: Array.from({ length: tables }, (_, i) => ({ name: `t${i}` })),
  };
}

describe('doctor/checks/drift', () => {
  it('passes when shape signature matches baseline', () => {
    const same = makeShape({ timestamp: 'sha1:abc' });
    const checks = computeDriftChecks(same, same);

    expect(checks).toHaveLength(1);
    expect(checks[0].id).toBe('drift_status');
    expect(checks[0].category).toBe('drift');
    expect(checks[0].status).toBe('pass');
    expect(checks[0].fix).toBeNull();
  });

  it('warns when shape signature differs from baseline', () => {
    const shape = makeShape({ timestamp: 'sha1:new', routes: 4 });
    const snapshot = makeShape({ timestamp: 'sha1:old', routes: 2 });

    const checks = computeDriftChecks(shape, snapshot);

    expect(checks[0].status).toBe('warn');
    expect(checks[0].message).toContain('2 routes added');
    expect(checks[0].fix?.action).toBe('regenerate_artifacts');
  });

  it('warns when the baseline snapshot is missing entirely', () => {
    const checks = computeDriftChecks(makeShape({ timestamp: 'sha1:x' }), null);

    expect(checks[0].id).toBe('drift_baseline_missing');
    expect(checks[0].status).toBe('warn');
    expect(checks[0].fix?.action).toBe('regenerate_artifacts');
  });

  it('warns when the current shape snapshot is missing', () => {
    const checks = computeDriftChecks(null, makeShape({ timestamp: 'sha1:x' }));

    expect(checks[0].id).toBe('drift_shape_missing');
    expect(checks[0].status).toBe('warn');
    expect(checks[0].fix?.action).toBe('regenerate_artifacts');
  });

  it('describes removals too', () => {
    const shape = makeShape({ timestamp: 'sha1:new', tables: 5 });
    const snapshot = makeShape({ timestamp: 'sha1:old', tables: 8 });

    const checks = computeDriftChecks(shape, snapshot);

    expect(checks[0].message).toContain('3 tables removed');
  });

  it('reports a field-level message when counts match but signatures differ', () => {
    const shape = makeShape({ timestamp: 'sha1:new', routes: 3, env_vars: 2, tables: 1 });
    const snapshot = makeShape({ timestamp: 'sha1:old', routes: 3, env_vars: 2, tables: 1 });

    const checks = computeDriftChecks(shape, snapshot);

    expect(checks[0].status).toBe('warn');
    expect(checks[0].message).toContain('field-level changes');
  });
});
