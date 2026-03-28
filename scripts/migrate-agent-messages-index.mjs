#!/usr/bin/env node

/**
 * Agent Messages Action Index Migration
 *
 * Idempotent — safe to run multiple times.
 * Creates a composite index on agent_messages(org_id, action_id) for faster
 * action-correlated message lookups.
 *
 * Usage:
 *   node scripts/_run-with-env.mjs scripts/migrate-agent-messages-index.mjs
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { createSqlFromEnv } from './_db.mjs';

const sql = createSqlFromEnv();

async function run() {
  console.log('\n=== Agent Messages Action Index Migration ===\n');

  console.log('Creating idx_agent_messages_org_action index...');
  await sql`
    CREATE INDEX IF NOT EXISTS idx_agent_messages_org_action
    ON agent_messages (org_id, action_id)
  `;
  console.log('  ✓ idx_agent_messages_org_action index created');

  console.log('\n✓ Migration complete\n');

  if (sql.end) await sql.end({ timeout: 5 });
}

run().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
