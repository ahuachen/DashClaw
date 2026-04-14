#!/usr/bin/env node

/**
 * Adds the `model` column to `action_records`.
 *
 * Populated by POST /api/actions and PATCH /api/actions/:id. Used by
 * estimateCost() at PATCH time to derive cost from tokens + model, and kept
 * around so that historical cost can be re-derived if pricing changes.
 *
 * Idempotent: safe to run multiple times.
 */

import './_load-env.mjs';
import { createSqlFromEnv } from './_db.mjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL || DATABASE_URL.includes('<YOUR_NEON_DATABASE_URL>')) {
  console.error('DATABASE_URL is required and must be a valid connection string');
  process.exit(1);
}

const sql = createSqlFromEnv();

async function run() {
  console.log('\n=== action_records.model Migration ===\n');

  try {
    console.log('Adding action_records.model column (idempotent)...');
    await sql`ALTER TABLE action_records ADD COLUMN IF NOT EXISTS model TEXT`;
    console.log('✅ action_records.model ready');

    console.log('\n=== Migration Complete ===\n');
  } catch (err) {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  }
}

run();
