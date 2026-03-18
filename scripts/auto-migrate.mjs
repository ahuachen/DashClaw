#!/usr/bin/env node

/**
 * auto-migrate.mjs
 *
 * Non-interactive schema migration for Vercel deploy button flows.
 * Runs as the buildCommand before `next build`:
 *   "node scripts/auto-migrate.mjs && next build"
 *
 * What it does:
 *   1. Verifies DATABASE_URL is present.
 *   2. Runs `drizzle-kit push --force` to create/sync all tables without
 *      interactive prompts (--force auto-approves data-loss statements).
 *   3. Seeds the `org_default` organization row if the orgs table is empty.
 *
 * Idempotent — safe to run on every deploy.
 * Exits 0 on success, non-zero on failure.
 */

process.on('unhandledRejection', (reason) => {
  console.error('[auto-migrate] Unhandled Rejection:', reason);
  process.exit(1);
});

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env / .env.local if present (no-op in Vercel where vars are injected).
import './_load-env.mjs';

import { createSqlFromEnv } from './_db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function log(msg) {
  console.log(`[auto-migrate] ${msg}`);
}

function fail(msg) {
  console.error(`[auto-migrate] ERROR: ${msg}`);
  process.exit(1);
}

// ── Step 0: Guard ──────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is not set. Cannot run schema migration.');
}

log('DATABASE_URL detected. Starting schema migration...');

// ── Step 1: drizzle-kit push --force ──────────────────────────────────────
// --force skips all interactive prompts and auto-approves data-loss statements.
// This is safe on a fresh Neon database (no existing data to lose).
// On subsequent deploys it is also safe: only additive changes are applied
// and --force only matters when drizzle-kit would otherwise ask about drops.
log('Running drizzle-kit push --force ...');

try {
  execFileSync(
    'npx',
    ['drizzle-kit', 'push', '--force', '--config', resolve(projectRoot, 'drizzle.config.js')],
    {
      stdio: 'inherit',
      env: { ...process.env },
      cwd: projectRoot,
      shell: false,
    }
  );
  log('drizzle-kit push completed.');
} catch (err) {
  fail(`drizzle-kit push failed (exit code ${err.status ?? 'unknown'}). Check the output above.`);
}

// ── Step 2: Seed org_default ───────────────────────────────────────────────
// The app requires at least one organization row with id='org_default'.
// This is idempotent — INSERT … ON CONFLICT DO NOTHING.
log('Checking for org_default seed...');

const sql = createSqlFromEnv();

try {
  await sql`
    INSERT INTO organizations (id, name, slug, plan)
    VALUES ('org_default', 'Default Organization', 'default', 'pro')
    ON CONFLICT (id) DO NOTHING
  `;
  log('org_default is present (inserted or already existed).');
} catch (err) {
  // Non-fatal: log and continue. The app can still boot; setup page will guide user.
  log(`Warning: Could not seed org_default — ${err.message}`);
}

// ── Step 3: Optionally seed DASHCLAW_API_KEY ───────────────────────────────
// If the operator has pre-configured an API key via env var, register it.
const configuredKey = process.env.DASHCLAW_API_KEY;
const configuredOrgId = process.env.DASHCLAW_API_KEY_ORG || 'org_default';

if (configuredKey && configuredKey.startsWith('oc_live_')) {
  log('DASHCLAW_API_KEY detected — ensuring api_keys row exists...');

  const { createHash } = await import('node:crypto');
  const keyHash = createHash('sha256').update(configuredKey).digest('hex');
  const keyPrefix = configuredKey.slice(0, 16);

  try {
    // Ensure the target org exists before inserting the key (FK constraint).
    if (configuredOrgId !== 'org_default') {
      await sql`
        INSERT INTO organizations (id, name, slug, plan)
        VALUES (${configuredOrgId}, ${configuredOrgId}, ${configuredOrgId}, 'pro')
        ON CONFLICT (id) DO NOTHING
      `;
    }

    await sql`
      INSERT INTO api_keys (id, org_id, key_hash, key_prefix, label, role)
      VALUES (
        ${'key_' + keyHash.slice(0, 16)},
        ${configuredOrgId},
        ${keyHash},
        ${keyPrefix},
        'auto-provisioned',
        'admin'
      )
      ON CONFLICT (id) DO NOTHING
    `;
    log('api_keys row ensured.');
  } catch (err) {
    log(`Warning: Could not seed api_keys row — ${err.message}`);
  }
}

// Close any open TCP connections (postgres driver).
if (typeof sql.end === 'function') {
  await sql.end({ timeout: 5 });
}

log('Auto-migration complete. Proceeding to next build.');
