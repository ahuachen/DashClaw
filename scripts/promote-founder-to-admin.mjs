#!/usr/bin/env node
/**
 * promote-founder-to-admin.mjs
 *
 * Idempotent one-off script to promote an existing DashClaw user to role='admin'.
 *
 * Why this exists: prior to BUG-03's fix (Phase 1.5 Plan 2, 2026-04-11), the
 * NextAuth signIn callback in `app/lib/auth.js` hardcoded new-user role to
 * 'member' with no first-user detection. Every operator who deployed DashClaw
 * via the Vercel 1-click path signed in, was created as 'member', and then
 * could not approve actions in their own /approvals UI.
 *
 * The fix promotes the FIRST user of a fresh instance automatically going
 * forward. This script handles the retroactive case: existing users who were
 * created as 'member' before the fix landed still need to be promoted manually.
 *
 * Usage:
 *   node scripts/promote-founder-to-admin.mjs <email>
 *
 * Examples:
 *   node scripts/promote-founder-to-admin.mjs wes@example.com
 *
 * Behavior:
 *   - If the user is found and already has role='admin', reports "already admin"
 *     and exits 0. Safe to re-run.
 *   - If the user is found and has any other role, updates role to 'admin'
 *     and exits 0.
 *   - If no user is found with the given email, exits 1 with an error.
 *   - If DATABASE_URL is not set, exits 1 with an error.
 *
 * Requirements: DATABASE_URL env var (from .env or shell environment).
 */

import { getSql } from '../app/lib/db.js';

const email = process.argv[2];

if (!email) {
  console.error('Error: email argument is required.');
  console.error('');
  console.error('Usage: node scripts/promote-founder-to-admin.mjs <email>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set.');
  console.error('Set it in .env or your shell environment before running this script.');
  process.exit(1);
}

async function main() {
  const sql = getSql();

  const rows = await sql`
    SELECT id, email, role, org_id, provider
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.error(`No user found with email: ${email}`);
    console.error('');
    console.error('Make sure the email matches exactly (case-sensitive in most DBs).');
    console.error('You can list all users with:');
    console.error('  psql $DATABASE_URL -c "SELECT email, role FROM users;"');
    process.exit(1);
  }

  const user = rows[0];

  if (user.role === 'admin') {
    console.log(`User ${email} is already admin (id=${user.id}, org=${user.org_id}). No change.`);
    process.exit(0);
  }

  console.log(`Promoting ${email}:`);
  console.log(`  id:       ${user.id}`);
  console.log(`  org:      ${user.org_id}`);
  console.log(`  provider: ${user.provider}`);
  console.log(`  role:     ${user.role} → admin`);

  await sql`
    UPDATE users
    SET role = 'admin'
    WHERE id = ${user.id}
  `;

  console.log('');
  console.log(`✓ Promoted ${email} from ${user.role} to admin.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Reload the DashClaw /approvals page in your browser (full refresh)');
  console.log('  2. The "READ-ONLY ACCESS" banner should be gone');
  console.log('  3. You should see Approve / Deny buttons on any pending actions');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
