#!/usr/bin/env node

/**
 * Zero `cost_estimate` on `action_records` rows where `model IS NULL`.
 *
 * Background: before commit 9216bb8e (2026-04-17), `estimateCost` in
 * app/lib/billing.js fell back to the first pricing entry (Opus) when
 * `model` was falsy — retroactively pricing unmapped rows at $15/M
 * input + $75/M output. The fix made estimateCost return 0 for
 * unknown models, preventing new rows from being affected, but
 * historical rows in the narrow window where tokens were captured
 * without a model still carry phantom Opus-priced cost.
 *
 * This script repairs those rows so the dashboard matches the
 * current billing semantic: "no model → no priceable cost".
 *
 * Dry-run by default. Pass `--apply` to write the change.
 *
 * Usage:
 *   npm run backfill:null-model-cost             (dry-run — shows what would change)
 *   npm run backfill:null-model-cost -- --apply  (actually writes)
 *   npm run backfill:null-model-cost -- --org org_xxx   (scope to a single org)
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import './_load-env.mjs';
import { createSqlFromEnv } from './_db.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const orgIdx = args.indexOf('--org');
const targetOrg = orgIdx !== -1 ? args[orgIdx + 1] : null;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required (add to .env.local or export it)');
  process.exit(1);
}

const sql = createSqlFromEnv();

async function run() {
  const orgFilter = targetOrg ? `AND org_id = $1` : '';
  const params = targetOrg ? [targetOrg] : [];

  const preview = await sql.query(
    `SELECT org_id,
            COUNT(*)::int AS affected_rows,
            ROUND(SUM(cost_estimate)::numeric, 2) AS removed_total,
            MIN(timestamp_start) AS first,
            MAX(timestamp_start) AS last
     FROM action_records
     WHERE model IS NULL AND cost_estimate > 0
       ${orgFilter}
     GROUP BY org_id
     ORDER BY affected_rows DESC`,
    params
  );

  if (preview.length === 0) {
    console.log('\nNothing to repair. All rows with cost_estimate > 0 have a non-null model.\n');
    if (typeof sql.end === 'function') await sql.end({ timeout: 5 });
    return;
  }

  console.log(`\n${apply ? 'APPLYING' : 'DRY-RUN'} — would zero cost_estimate on rows where model IS NULL:`);
  console.log('─'.repeat(100));
  for (const row of preview) {
    console.log(
      `  org=${row.org_id}  rows=${row.affected_rows}  removes=$${row.removed_total}` +
      `  window=${row.first} → ${row.last}`
    );
  }
  console.log('─'.repeat(100));

  if (!apply) {
    console.log('\nThis was a dry-run. Rerun with `--apply` to write the change.\n');
    if (typeof sql.end === 'function') await sql.end({ timeout: 5 });
    return;
  }

  const result = await sql.query(
    `UPDATE action_records
     SET cost_estimate = 0, updated_at = CURRENT_TIMESTAMP
     WHERE model IS NULL AND cost_estimate > 0
       ${orgFilter}`,
    params
  );

  // Neon serverless returns an array (0 rows with metadata); postgres returns count
  const affected = typeof result?.count === 'number'
    ? result.count
    : preview.reduce((n, r) => n + r.affected_rows, 0);

  console.log(`\n✅ Updated ~${affected} rows. cost_estimate is now 0 where model was NULL.\n`);

  if (typeof sql.end === 'function') await sql.end({ timeout: 5 });
}

run().catch((err) => {
  console.error('backfill failed:', err.message || err);
  process.exit(1);
});
