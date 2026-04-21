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
 *   2. Executes the Drizzle DDL SQL directly via postgres.js (no drizzle-kit,
 *      no interactive prompts, no TTY required).
 *   3. Seeds the `org_default` organization row if missing.
 *   4. Optionally seeds an api_keys row from DASHCLAW_API_KEY env var.
 *
 * Idempotent — safe to run on every deploy.
 * Exits 0 on success, non-zero on failure.
 */

process.on('unhandledRejection', (reason) => {
  console.error('[auto-migrate] Unhandled Rejection:', reason);
  process.exit(1);
});

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// Load .env / .env.local if present (no-op in Vercel where vars are injected).
import './_load-env.mjs';

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

// ── Connect via postgres.js (works with Neon, Supabase, any Postgres) ──────
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 30,
  idle_timeout: 5,
});

// ── Step 1: Execute DDL directly (no drizzle-kit, no prompts) ──────────────
// Read the Drizzle-generated DDL SQL and execute each statement individually.
// Skips "already exists" errors so this is safe to re-run on every deploy.
log('Executing schema DDL...');

const ddlPath = resolve(projectRoot, 'drizzle', '0000_clammy_falcon.sql');
let ddl;
try {
  ddl = readFileSync(ddlPath, 'utf8');
} catch (err) {
  fail(`Could not read DDL file at ${ddlPath}: ${err.message}`);
}

const statements = ddl
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

log(`Found ${statements.length} DDL statements.`);

// Postgres error codes we can safely skip (idempotent re-runs):
const SAFE_CODES = new Set([
  '42P07', // duplicate_table
  '42P16', // invalid_table_definition (e.g. column already exists)
  '42701', // duplicate_column
  '42710', // duplicate_object (indexes, constraints)
  '42P10', // invalid_column_reference
  '23505', // unique_violation (for ON CONFLICT seed inserts)
]);

let created = 0;
let skipped = 0;
let pgvectorAvailable = null; // tri-state: null=unknown, true, false

for (const stmt of statements) {
  // Enable pgvector on demand and remember whether it's available on this
  // database. CI Postgres images typically lack the pgvector extension;
  // in that case the vector-dependent statements are skipped deliberately
  // so the rest of the schema still lands.
  const needsVector = stmt.includes('vector(') && !stmt.startsWith('CREATE EXTENSION');
  if (needsVector && pgvectorAvailable === null) {
    try {
      await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
      pgvectorAvailable = true;
    } catch {
      pgvectorAvailable = false;
    }
  }
  if (needsVector && pgvectorAvailable === false) {
    // pgvector not installed — skip this table/index so the remaining
    // schema applies. Not a real DDL failure; the feature that depends
    // on vector columns simply won't be available at runtime.
    skipped++;
    continue;
  }

  try {
    await sql.unsafe(stmt);
    created++;
  } catch (err) {
    if (SAFE_CODES.has(err.code)) {
      skipped++;
      continue;
    }
    // Also handle "already exists" in the message (belt + suspenders)
    if (err.message?.includes('already exists')) {
      skipped++;
      continue;
    }
    // Real DDL failure — missing ref, syntax error, permission denied,
    // etc. Silently continuing produces a partial schema that the app
    // boots against, which is harder to diagnose than a loud failure.
    // Fail the deploy so the operator has to fix the DDL before ship.
    fail(`DDL statement failed (${err.code || 'unknown'}): ${err.message?.slice(0, 200)}`);
  }
}

log(`DDL complete: ${created} applied, ${skipped} skipped (already exist).`);

// ── Step 1b: Ensure columns on existing tables (schema drift fix) ──────────
// When tables already exist from an older deploy, CREATE TABLE is skipped but
// the old table may be missing columns added in later schema versions.
// ALTER TABLE ADD COLUMN IF NOT EXISTS is a no-op for columns that already exist.
log('Ensuring schema columns are up to date...');

let columnsAdded = 0;

for (const stmt of statements) {
  const tableMatch = stmt.match(/^CREATE TABLE\s+"(\w+)"\s*\(/i);
  if (!tableMatch) continue;
  const table = tableMatch[1];

  // Extract column lines: anything that starts with "column_name" type...
  // Stop at CONSTRAINT lines.
  const body = stmt.slice(stmt.indexOf('(') + 1, stmt.lastIndexOf(')'));
  const lines = body.split('\n').map((l) => l.trim().replace(/,\s*$/, ''));

  for (const line of lines) {
    if (!line.startsWith('"')) continue;
    // Parse: "col_name" type [DEFAULT ...] [NOT NULL]
    const colMatch = line.match(/^"(\w+)"\s+(.+)/);
    if (!colMatch) continue;

    const colName = colMatch[1];
    let rest = colMatch[2];
    // Strip trailing constraints that ALTER TABLE ADD COLUMN doesn't accept inline
    // Keep type + DEFAULT + NOT NULL but remove PRIMARY KEY / UNIQUE / CONSTRAINT
    rest = rest.replace(/\s*PRIMARY KEY.*/i, '');
    rest = rest.replace(/,\s*$/, '');

    try {
      await sql.unsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${colName}" ${rest}`);
      columnsAdded++;
    } catch {
      // Column already exists or type mismatch — skip silently
    }
  }
}

log(`Column sync complete: ${columnsAdded} ALTER statements executed (no-op if already present).`);

// ── Step 2: Seed org_default ───────────────────────────────────────────────
// The app requires at least one organization row with id='org_default'.
log('Checking for org_default seed...');

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

// Close the connection pool.
await sql.end({ timeout: 5 });

log('Auto-migration complete. Proceeding to next build.');
