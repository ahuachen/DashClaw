#!/usr/bin/env node

/**
 * Patch demo capability endpoints to working URLs.
 *
 * Fixes two seeded capabilities whose original endpoints no longer
 * behave reliably against the DashClaw capability runner:
 *
 *   - Team Notification: httpbin.org/post -> postman-echo.com/post
 *     httpbin was returning 503s and 20s+ latencies that exceeded
 *     the capability's 15s timeout.
 *
 *   - Publish Briefing: dpaste.org/api/ -> jsonplaceholder.typicode.com/posts
 *     dpaste.org now returns 405 Method Not Allowed for POST requests.
 *
 * Idempotent: only patches a capability when its current endpoint
 * matches the old URL. Rows already migrated or with custom endpoints
 * are left alone.
 *
 * Usage:
 *   node scripts/patch-demo-capability-endpoints.mjs
 *
 * Requires DashClaw running at DASHCLAW_URL (default http://localhost:3000)
 * with DASHCLAW_API_KEY set in .env or the environment.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Load .env (same pattern as seed-demo-capabilities.mjs)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  /* no .env file — use env vars */
}

const BASE_URL = (
  process.env.DASHCLAW_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const API_KEY = process.env.DASHCLAW_API_KEY || '';

if (!API_KEY) {
  console.error('[patch] DASHCLAW_API_KEY not set. Add it to .env or export it.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

const PATCHES = [
  {
    name: 'Team Notification',
    old_endpoint: 'https://httpbin.org/post',
    new_endpoint: 'https://postman-echo.com/post',
    reason: 'httpbin.org returns 503s and 20s+ latency',
  },
  {
    name: 'Publish Briefing',
    old_endpoint: 'https://dpaste.org/api/',
    new_endpoint: 'https://jsonplaceholder.typicode.com/posts',
    reason: 'dpaste.org returns 405 Method Not Allowed',
  },
];

async function findCapability(name) {
  const res = await fetch(
    `${BASE_URL}/api/capabilities?search=${encodeURIComponent(name)}`,
    { headers },
  );
  if (!res.ok) {
    throw new Error(`search failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data?.capabilities?.find((c) => c.name === name) || null;
}

async function patchCapability(capabilityId, invocationSchema) {
  const res = await fetch(`${BASE_URL}/api/capabilities/${capabilityId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ invocation_schema: invocationSchema }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`PATCH failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`[patch] Base URL: ${BASE_URL}`);
  console.log(`[patch] Planning ${PATCHES.length} capability updates...\n`);

  let patched = 0;
  let skipped = 0;
  let notFound = 0;

  for (const plan of PATCHES) {
    const cap = await findCapability(plan.name);

    if (!cap) {
      console.log(`  - ${plan.name}: NOT FOUND (skip)`);
      notFound += 1;
      continue;
    }

    const schema = cap.invocation_schema || {};
    const currentEndpoint = schema.endpoint;

    if (currentEndpoint !== plan.old_endpoint) {
      console.log(
        `  - ${plan.name}: current endpoint is ${currentEndpoint}, not ${plan.old_endpoint} -- leaving alone (skip)`,
      );
      skipped += 1;
      continue;
    }

    const newSchema = { ...schema, endpoint: plan.new_endpoint };
    await patchCapability(cap.capability_id || cap.id, newSchema);
    console.log(`  + ${plan.name}`);
    console.log(`      from: ${plan.old_endpoint}`);
    console.log(`      to:   ${plan.new_endpoint}`);
    console.log(`      why:  ${plan.reason}`);
    patched += 1;
  }

  console.log(
    `\n[patch] Done. Patched: ${patched}, skipped: ${skipped}, not found: ${notFound}`,
  );
  if (patched > 0) {
    console.log('[patch] Re-run capability tests to verify (Run Test on each card).');
  }
}

main().catch((err) => {
  console.error('[patch] Failed:', err.message);
  process.exit(1);
});
