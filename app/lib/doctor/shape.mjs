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

const GOVERNANCE_DOMAIN = 'governance';

const TABLE_INDEX = new Map(shape.tables.map((t) => [t.name, t]));
const ROUTE_INDEX = new Map(shape.routes.map((r) => [r.path, r]));
const ENV_INDEX = new Map(shape.env_vars.map((e) => [e.name, e]));

/** Return all tables in the schema. */
export function getAllTables() {
  return shape.tables.slice();
}

/**
 * Return tables with a matching `domain` field (sourced from
 * `// @domain <name>` annotations directly above `pgTable(...)` calls in
 * schema.js). Returns `[]` when nothing is annotated for that domain.
 */
export function getTablesByDomain(domain) {
  return shape.tables.filter((t) => t.domain === domain);
}

/** Convenience wrapper for the governance domain. */
export function getGovernanceTables() {
  return getTablesByDomain(GOVERNANCE_DOMAIN);
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
