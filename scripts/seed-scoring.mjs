#!/usr/bin/env node

/**
 * Seed: Scoring Profiles + Risk Templates
 *
 * Creates starter scoring profiles and risk templates so the /scoring page
 * has real data to display. Also scores sample actions to populate Score Explorer.
 *
 * Safe to re-run -- checks for existing data before inserting.
 *
 * Usage:
 *   node scripts/seed-scoring.mjs
 *   node scripts/seed-scoring.mjs --org-id org_default
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import './_load-env.mjs';
import { createSqlFromEnv } from './_db.mjs';
import { seedDefaultData } from '../app/lib/scoringProfiles.js';

// --- Config -----------------------------------------------

const args = process.argv.slice(2);
const orgIdIdx = args.indexOf('--org-id');
const ORG_ID = orgIdIdx !== -1 ? args[orgIdIdx + 1] : 'org_default';

// --- Main -------------------------------------------------

async function main() {
  console.log('\n[seed-scoring] Seeding scoring profiles and risk templates...');
  console.log(`  org: ${ORG_ID}\n`);

  const sql = createSqlFromEnv();
  await seedDefaultData(sql, ORG_ID);

  console.log('  ✓ Done\n');
  console.log('  Next steps:');
  console.log('  1. Visit /scoring to see your profiles and risk templates');
  console.log('  2. Go to Score Explorer to see sample scores');
  console.log('  3. Once you have 10+ real actions, run Calibrate to tune thresholds');
  console.log('  4. Use dc.scoreWithProfile(profileId, action) in your agent code\n');

  await sql.end?.();
}

main();
