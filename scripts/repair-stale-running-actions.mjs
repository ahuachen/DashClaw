#!/usr/bin/env node
/**
 * repair-stale-running-actions.mjs — Close stale action_records stuck in "running" status.
 *
 * These are actions that were created but never closed due to the missing updated_at column
 * bug in updateActionOutcome(). This script sets their status to "completed" (or "failed"
 * if they have an error_message) and populates timestamp_end.
 *
 * Usage:
 *   node scripts/_run-with-env.mjs scripts/repair-stale-running-actions.mjs --dry-run
 *   node scripts/_run-with-env.mjs scripts/repair-stale-running-actions.mjs --older-than-hours 1
 *   node scripts/_run-with-env.mjs scripts/repair-stale-running-actions.mjs --older-than-hours 2 --action-type monitor
 *
 * Options:
 *   --dry-run              Show what would be repaired without modifying data
 *   --older-than-hours N   Only repair actions older than N hours (default: 1)
 *   --action-type TYPE     Only repair actions of this type (e.g., "monitor")
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(projectRoot, '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const l of lines) {
    const idx = l.indexOf('=');
    if (idx > 0 && !l.startsWith('#')) {
      const key = l.slice(0, idx).trim();
      if (!process.env[key]) {
        process.env[key] = l.slice(idx + 1).trim();
      }
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2).replace(/-/g, '_');
      args[key] = argv[++i];
    }
  }
  return args;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv);

  const olderThanHours = parseInt(args.older_than_hours || '1', 10);
  const actionType = args.action_type || null;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL not set. Use _run-with-env.mjs or set in .env.local');
    process.exit(1);
  }

  const { createSqlFromEnv } = await import('./_db.mjs');
  const sql = createSqlFromEnv();

  // Find stale running actions using sql.query() (common interface for both Neon and postgres drivers)
  const params = [olderThanHours];
  let typeClause = '';
  if (actionType) {
    typeClause = `AND action_type = $2`;
    params.push(actionType);
  }

  const matches = await sql.query(
    `SELECT action_id, agent_id, agent_name, action_type, declared_goal, status,
            error_message, timestamp_start, created_at
     FROM action_records
     WHERE status = 'running'
       AND timestamp_start::timestamptz < NOW() - INTERVAL '1 hour' * $1
       ${typeClause}
     ORDER BY timestamp_start ASC`,
    params
  );

  console.log(`Found ${matches.length} stale running action(s) older than ${olderThanHours} hour(s)${actionType ? ` of type "${actionType}"` : ''}`);

  if (matches.length === 0) {
    console.log('Nothing to repair.');
    if (sql.end) await sql.end();
    return;
  }

  for (const r of matches) {
    const label = r.error_message ? 'FAILED' : 'COMPLETED';
    console.log(`  ${r.action_id}  ${r.agent_id}  ${r.action_type}  -> ${label}  (started ${r.timestamp_start})`);
  }

  if (args.dryRun) {
    console.log('\n(dry run - nothing modified)');
    if (sql.end) await sql.end();
    return;
  }

  // Repair: set status based on whether error_message exists
  const now = new Date().toISOString();
  const failedIds = matches.filter(r => r.error_message).map(r => r.action_id);
  const completedIds = matches.filter(r => !r.error_message).map(r => r.action_id);

  let repaired = 0;

  if (completedIds.length > 0) {
    await sql.query(
      `UPDATE action_records
       SET status = 'completed',
           output_summary = COALESCE(output_summary, 'Auto-closed: stale running action repaired'),
           timestamp_end = COALESCE(timestamp_end, $1)
       WHERE action_id = ANY($2)`,
      [now, completedIds]
    );
    repaired += completedIds.length;
    console.log(`Closed ${completedIds.length} action(s) as "completed"`);
  }

  if (failedIds.length > 0) {
    await sql.query(
      `UPDATE action_records
       SET status = 'failed',
           timestamp_end = COALESCE(timestamp_end, $1)
       WHERE action_id = ANY($2)`,
      [now, failedIds]
    );
    repaired += failedIds.length;
    console.log(`Closed ${failedIds.length} action(s) as "failed"`);
  }

  console.log(`Repaired ${repaired} total action(s).`);
  if (sql.end) await sql.end();
}

main();
