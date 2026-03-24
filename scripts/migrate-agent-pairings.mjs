#!/usr/bin/env node

/**
 * Agent Pairings Migration Script
 *
 * Adds agent_pairings table for the one-click pairing enrollment flow.
 *
 * Usage:
 *   DATABASE_URL=<db_url> node scripts/migrate-agent-pairings.mjs
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
  console.log('\n🔗 Starting Agent Pairings Migration...\n');

  try {
    console.log('Step 1: Creating agent_pairings table...');
    await sql`
      CREATE TABLE IF NOT EXISTS agent_pairings (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        public_key TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'RSASSA-PKCS1-v1_5',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      )
    `;
    log('✅', 'agent_pairings table created');

    console.log('Step 2: Creating indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_pairings_org_status
      ON agent_pairings (org_id, status)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_agent_pairings_org_agent
      ON agent_pairings (org_id, agent_id)
    `;
    log('✅', 'Indexes created');

    console.log('\n🎉 Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
