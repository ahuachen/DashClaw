#!/usr/bin/env node
/**
 * Dev-only: creates a synthetic pending_approval action against a local
 * DashClaw instance, then polls until the action is resolved. Operator
 * taps Approve/Reject on their phone; the script prints the round-trip
 * time once status flips.
 *
 * Usage:
 *   npm run telegram:verify -- --base http://localhost:3000 --key oc_live_xxx
 */

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const base = arg('--base', 'http://localhost:3000').replace(/\/$/, '');
const apiKey = arg('--key', process.env.DASHCLAW_API_KEY);
const timeoutMs = Number(arg('--timeout', '600000')); // 10 min default

if (!apiKey) {
  console.error('Set DASHCLAW_API_KEY env or pass --key oc_live_...');
  process.exit(1);
}

const action_id = `act_verify${Date.now().toString(36)}`;

async function cleanup() {
  // Best-effort delete so repeated verify runs don't pollute the DB with
  // synthetic smoke-test rows. Uses the existing DELETE /api/actions
  // handler with ?action_id=... (no separate per-action DELETE exists).
  try {
    const del = await fetch(
      `${base}/api/actions?action_id=${encodeURIComponent(action_id)}`,
      { method: 'DELETE', headers: { 'x-api-key': apiKey } }
    );
    if (!del.ok) {
      console.warn(`[verify-loop] cleanup DELETE returned ${del.status}`);
    }
  } catch (err) {
    console.warn('[verify-loop] cleanup failed:', err.message);
  }
}

const create = await fetch(`${base}/api/actions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
  body: JSON.stringify({
    action_id,
    agent_id: 'telegram-verify',
    action_type: 'deploy',
    declared_goal: 'telegram:verify-loop smoke test',
    risk_score: 80,
    reversible: false,
    status: 'pending_approval',
  }),
});
if (!create.ok) {
  console.error(`Failed to create action: ${create.status} ${await create.text()}`);
  process.exit(1);
}
console.log(`Created ${action_id}. Approve/Reject on Telegram…`);

const start = Date.now();
while (Date.now() - start < timeoutMs) {
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch(`${base}/api/actions/${action_id}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) continue;
  const { action } = await res.json();
  if (action?.status && action.status !== 'pending_approval') {
    const s = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ round-trip succeeded in ${s}s — final status: ${action.status}`);
    await cleanup();
    process.exit(0);
  }
}
console.error('⌛ Timed out waiting for approval');
await cleanup();
process.exit(2);
