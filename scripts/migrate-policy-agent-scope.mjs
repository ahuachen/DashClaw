#!/usr/bin/env node

/**
 * Policy Agent Scope Migration Script
 *
 * Idempotent — safe to run multiple times.
 * Adds agent_ids column to guard_policies table so policies can be
 * scoped to specific agents (null = applies to all agents).
 *
 * Usage:
 *   DATABASE_URL=<db_url> node scripts/migrate-policy-agent-scope.mjs
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
  console.log('\n=== Policy Agent Scope Migration ===\n');

  console.log('Step 1: Adding agent_ids column to guard_policies...');
  try {
    await sql`ALTER TABLE guard_policies ADD COLUMN IF NOT EXISTS agent_ids TEXT`;
    log('✅', 'guard_policies: agent_ids column ready (null = all agents)');
  } catch (err) {
    if (err.message?.includes('does not exist')) {
      log('⚠️', 'guard_policies table does not exist yet (will be created by other migrations)');
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
