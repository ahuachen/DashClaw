// __tests__/unit/doctor-shape.test.js
import { describe, expect, it } from 'vitest';
import {
  META,
  findRoutesByPrefix,
  getAllTables,
  getEnvVar,
  getGovernanceTables,
  getOptionalEnvVars,
  getRequiredEnvVars,
  getRoute,
  getTable,
} from '@/lib/doctor/shape.mjs';

// These tests exercise the committed shape.json. If they break, something
// about the generated artifact changed shape — regenerate and re-run.
describe('doctor/shape', () => {
  it('exposes META from the committed snapshot', () => {
    expect(META.source).toBe('livingcode');
    expect(typeof META.generatedAt).toBe('string');
    expect(META.generatedAt.length).toBeGreaterThan(0);
    expect(META.routeCount).toBeGreaterThan(0);
    expect(META.tableCount).toBeGreaterThan(0);
  });

  it('getAllTables returns the committed table list', () => {
    const tables = getAllTables();
    expect(Array.isArray(tables)).toBe(true);
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.every((t) => typeof t.name === 'string')).toBe(true);
  });

  it('getGovernanceTables returns the curated governance set', () => {
    const names = getGovernanceTables().map((t) => t.name);
    // Every name we curate must exist in the live schema.
    expect(names).toContain('guard_policies');
    expect(names).toContain('action_records');
    expect(names).toContain('api_keys');
  });

  it('getTable returns TableInfo by name or null', () => {
    expect(getTable('guard_policies')?.name).toBe('guard_policies');
    expect(getTable('__definitely_not_a_real_table__')).toBeNull();
  });

  it('getRequiredEnvVars includes the four known critical vars', () => {
    const required = getRequiredEnvVars().map((e) => e.name);
    expect(required).toContain('DATABASE_URL');
    expect(required).toContain('NEXTAUTH_SECRET');
    expect(required).toContain('ENCRYPTION_KEY');
    expect(required).toContain('DASHCLAW_API_KEY');
  });

  it('getOptionalEnvVars returns non-required vars', () => {
    const optional = getOptionalEnvVars();
    expect(optional.length).toBeGreaterThan(0);
    expect(optional.every((e) => !e.required)).toBe(true);
  });

  it('getEnvVar returns info or null', () => {
    expect(getEnvVar('DATABASE_URL')?.required).toBe(true);
    expect(getEnvVar('__NOT_A_REAL_VAR__')).toBeNull();
  });

  it('getRoute resolves a well-known active route', () => {
    const health = getRoute('/api/health');
    expect(health).not.toBeNull();
    expect(health.archived).toBe(false);
  });

  it('findRoutesByPrefix excludes archived routes', () => {
    const guardRoutes = findRoutesByPrefix('/api/guard');
    expect(guardRoutes.length).toBeGreaterThan(0);
    expect(guardRoutes.every((r) => !r.archived)).toBe(true);
  });
});
