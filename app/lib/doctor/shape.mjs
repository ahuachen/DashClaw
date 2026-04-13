// app/lib/doctor/shape.mjs
// Typed helpers over the committed shape.json snapshot.
//
// The JSON is regenerated pre-commit by `npm run livingcode:refresh`.
// Production (Vercel) reads the committed file — no Python at request time.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHAPE_PATH = resolve(HERE, 'generated', 'shape.json');

const shape = JSON.parse(readFileSync(SHAPE_PATH, 'utf8'));

/**
 * Curated mapping of table name → functional domain.
 * Tables not listed here are treated as `other`. Keep this list small and
 * intentional — only tables that doctor checks reason about need a domain.
 */
const TABLE_DOMAINS = {
  guard_policies: 'governance',
  action_records: 'governance',
  api_keys: 'governance',
};

const GOVERNANCE_DOMAIN = 'governance';

const TABLE_INDEX = new Map(shape.tables.map((t) => [t.name, t]));
const ROUTE_INDEX = new Map(shape.routes.map((r) => [r.path, r]));
const ENV_INDEX = new Map(shape.env_vars.map((e) => [e.name, e]));

/** Return all tables in the schema. */
export function getAllTables() {
  return shape.tables.slice();
}

/**
 * Return governance-domain tables (from the curated domain map).
 * Any governance-related table not present in the shape snapshot is omitted.
 */
export function getGovernanceTables() {
  const names = Object.entries(TABLE_DOMAINS)
    .filter(([, domain]) => domain === GOVERNANCE_DOMAIN)
    .map(([name]) => name);
  return names.filter((n) => TABLE_INDEX.has(n)).map((n) => TABLE_INDEX.get(n));
}

/**
 * Return the `TableInfo` for a table by name, or `null` if absent.
 * Table names returned here come from the committed shape.json — safe to
 * interpolate into SQL template literals (Neon driver doesn't support
 * `sql.identifier()`).
 */
export function getTable(name) {
  return TABLE_INDEX.get(name) || null;
}

/** Return all required env vars. */
export function getRequiredEnvVars() {
  return shape.env_vars.filter((e) => e.required);
}

/** Return all optional env vars. */
export function getOptionalEnvVars() {
  return shape.env_vars.filter((e) => !e.required);
}

/** Return the `EnvVarInfo` for an env var by name, or `null` if no code path references it. */
export function getEnvVar(name) {
  return ENV_INDEX.get(name) || null;
}

/** Return the `RouteInfo` for a route path, or `null`. */
export function getRoute(path) {
  return ROUTE_INDEX.get(path) || null;
}

/** Return all non-archived routes whose path starts with `prefix`. */
export function findRoutesByPrefix(prefix) {
  return shape.routes.filter((r) => !r.archived && r.path.startsWith(prefix));
}

/** Metadata about this shape snapshot. */
export const META = {
  generatedAt: shape.timestamp,
  source: 'livingcode',
  routeCount: shape.routes.length,
  envVarCount: shape.env_vars.length,
  tableCount: shape.tables.length,
};
