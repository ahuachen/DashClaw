#!/usr/bin/env node

/**
 * HITL Metadata Migration Script
 *
 * Idempotent — safe to run multiple times.
 * Adds approved_by and approved_at columns to action_records table.
 *
 * Usage:
 *   DATABASE_URL=<db_url> node scripts/migrate-hitl-metadata.mjs
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { createSqlFromEnv } from './_db.mjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = createSqlFromEnv();

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function run() {
  console.log('\n=== HITL Metadata Migration ===\n');

  console.log('Step 1: Adding approved_by and approved_at to action_records...');
  try {
    await sql`ALTER TABLE action_records ADD COLUMN IF NOT EXISTS approved_by TEXT`;
    await sql`ALTER TABLE action_records ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`;
    log('✅', 'action_records: approved_by and approved_at columns ready');
  } catch (err) {
    if (err.message?.includes('does not exist')) {
      log('⚠️', 'action_records table does not exist yet (will be created by other migrations)');
    } else {
      throw err;
    }
  }

  console.log('\n=== Migration Complete ===\n');
}

run().catch(err => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
