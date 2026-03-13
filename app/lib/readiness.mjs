/**
 * Canonical readiness check for a DashClaw instance.
 * Used by /setup page to generate the full diagnostic report.
 * Import this module in server components only — it calls network/FS.
 */

import { getSetupStatus } from './setupStatus.mjs';
import { getAuthConfig } from './authConfig.mjs';
import { CORE_TABLES } from './schemaCheck.js';

/**
 * Environment variables required for DashClaw to function.
 * Update this list when new mandatory env vars are introduced.
 */
export const REQUIRED_ENV_VARS = [
  {
    key: 'DATABASE_URL',
    description: 'Postgres connection string',
    help: 'Set to your Neon or local Postgres URL.',
  },
  {
    key: 'NEXTAUTH_SECRET',
    description: 'Session signing secret (min 32 chars)',
    help: 'Generate with: openssl rand -base64 32',
  },
];

/**
 * Environment variables that are strongly recommended but not hard-blocking.
 * Missing these will show a warning, not a failure.
 */
export const ADVISORY_ENV_VARS = [
  {
    key: 'NEXTAUTH_URL',
    description: 'Public URL of this instance',
    help: 'Required in production for OAuth callbacks. E.g. https://dashclaw.example.com',
  },
  {
    key: 'DASHCLAW_API_KEY',
    description: 'Default API key for agent authentication',
    help: 'Required for agents to call /api/* endpoints. Generate one in the API Keys page.',
  },
];

/**
 * Check environment variable configuration.
 * Pure synchronous — no network or filesystem access.
 * @param {NodeJS.ProcessEnv} env
 */
export function checkConfiguration(env = process.env) {
  const required = REQUIRED_ENV_VARS.map(({ key, description, help }) => ({
    key,
    description,
    help,
    present: Boolean(env[key]),
    required: true,
  }));

  const advisory = ADVISORY_ENV_VARS.map(({ key, description, help }) => ({
    key,
    description,
    help,
    present: Boolean(env[key]),
    required: false,
  }));

  const missingRequired = required.filter((v) => !v.present);
  const missingAdvisory = advisory.filter((v) => !v.present);

  return {
    ok: missingRequired.length === 0,
    vars: [...required, ...advisory],
    missingRequired,
    missingAdvisory,
  };
}

/**
 * Full readiness report for the /setup page.
 * Runs all checks in parallel and returns a structured result.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<{
 *   overall: 'healthy'|'needs_attention'|'blocked',
 *   checkedAt: string,
 *   db: object,
 *   config: object,
 *   auth: object,
 * }>}
 */
export async function getReadinessReport(env = process.env) {
  const [dbStatus, authConfig, config] = await Promise.all([
    getSetupStatus(env),
    Promise.resolve(getAuthConfig(env)),
    Promise.resolve(checkConfiguration(env)),
  ]);

  const db = {
    ok: Boolean(dbStatus.configured),
    reason: dbStatus.configured ? 'ready' : (dbStatus.reason || 'unknown'),
    message: dbStatus.message || '',
    missing: Array.isArray(dbStatus.missing) ? dbStatus.missing : [],
    allTables: CORE_TABLES,
  };

  const auth = {
    ok: Boolean(authConfig.hasAnySignInMethod),
    methods: [
      ...(authConfig.oauthProviders || []).map((p) => p.name),
      ...(authConfig.hasLocalPassword ? ['Local password'] : []),
    ],
    config: authConfig,
  };

  let overall;
  if (!db.ok || !config.ok) {
    overall = 'blocked';
  } else if (!auth.ok || config.missingAdvisory.length > 0) {
    overall = 'needs_attention';
  } else {
    overall = 'healthy';
  }

  return {
    overall,
    checkedAt: new Date().toISOString(),
    db,
    config,
    auth,
  };
}
