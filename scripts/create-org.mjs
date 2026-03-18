#!/usr/bin/env node

/**
 * Create a new organization and admin API key.
 *
 * Usage:
 *   DATABASE_URL=<db_url> node scripts/create-org.mjs --name "Acme Corp" --slug "acme"
 *   DATABASE_URL=<db_url> node scripts/create-org.mjs --name "Acme Corp" --slug "acme" --plan pro
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createSqlFromEnv } from './_db.mjs';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const name = getArg('name');
const slug = getArg('slug');
const plan = getArg('plan') || 'free';

if (!name || !slug) {
  console.error('Usage: node scripts/create-org.mjs --name "Org Name" --slug "org-slug" [--plan free|pro|team|enterprise]');
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(slug)) {
  console.error('slug must be lowercase alphanumeric with hyphens only');
  process.exit(1);
}

const validPlans = ['free', 'pro', 'team', 'enterprise'];
if (!validPlans.includes(plan)) {
  console.error(`plan must be one of: ${validPlans.join(', ')}`);
  process.exit(1);
}

const sql = createSqlFromEnv();

async function run() {
  console.log('\n=== Create Organization ===\n');

  const orgId = `org_${randomUUID()}`;

  // Create the organization
  await sql`
    INSERT INTO organizations (id, name, slug, plan)
    VALUES (${orgId}, ${name.trim()}, ${slug}, ${plan})
  `;
  console.log(`Organization created: ${name} (${orgId})`);
  console.log(`  slug: ${slug}`);
  console.log(`  plan: ${plan}`);

  // Generate admin API key
  const rawKey = `oc_live_${randomBytes(16).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 8);
  const keyId = `key_${randomUUID()}`;

  await sql`
    INSERT INTO api_keys (id, org_id, key_hash, key_prefix, label, role)
    VALUES (${keyId}, ${orgId}, ${keyHash}, ${keyPrefix}, 'Admin Key', 'admin')
  `;

  console.log('\nAdmin API Key (save this — it will not be shown again):');
  console.log(`  ${rawKey}`);
  console.log(`\n  key_id:  ${keyId}`);
  console.log(`  prefix:  ${keyPrefix}...`);
  console.log(`  role:    admin`);

  console.log('\nUsage with SDK:');
  console.log(`  const agent = new DashClaw({ baseUrl: "http://localhost:3000", apiKey: "${rawKey}", agentId: "my-agent" }); // or https://your-app.vercel.app`);
  console.log('\n=== Done ===\n');
}

run().catch(err => {
  if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
    console.error(`\nError: An organization with slug "${slug}" already exists.`);
  } else {
    console.error('\nFailed:', err.message);
  }
  process.exit(1);
});
