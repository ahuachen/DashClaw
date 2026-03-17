#!/usr/bin/env node
/**
 * DashClaw demo agent — no external dependencies.
 * Uses native fetch (Node 18+) to call the local DashClaw API directly.
 */

const BASE_URL = process.env.DASHCLAW_BASE_URL || 'http://localhost:3000';
const API_KEY  = process.env.DASHCLAW_API_KEY  || 'demo-key';
const AGENT_ID = 'pipeline-agent';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const goal = 'Purge customer records from production database';
  console.log(`\n🤖 Agent Goal: ${goal}`);

  // 1. Simulate guard block locally — demo mode has no live DB policies
  console.log('🛡️  Checking policies via DashClaw Guard...');
  await new Promise(r => setTimeout(r, 600)); // realistic pause
  console.log('\n🚨 POLICY VIOLATION DETECTED');
  console.log('   Policy:     PRODUCTION_DATA_PROTECTION');
  console.log('   Rule:       Irreversible operations on customer data require explicit approval');
  console.log('   Risk Score: 94 — exceeds org threshold of 75');
  console.log('   Decision:   BLOCK\n');

  // 2. Record blocked action
  let actionResult;
  try {
    actionResult = await post('/api/actions', {
      agent_id: AGENT_ID,
      action_type: 'cleanup',
      declared_goal: goal,
      reasoning: 'Automated data retention policy enforcement — purging expired customer records.',
      risk_score: 94,
      reversible: false,
      systems_touched: ['postgres-prod', 'customer-data', 's3-backups'],
      status: 'blocked',
      error_message: 'Blocked by policy: PRODUCTION_DATA_PROTECTION — irreversible operation on customer data',
    });
  } catch (err) {
    console.error(`❌ Action record failed: ${err.message}`);
    process.exit(1);
  }

  const recordedId = actionResult.action_id || actionResult.action?.action_id;
  console.log(`❌ ACTION BLOCKED — pipeline-agent cannot proceed.`);
  console.log(`📋 Decision Replay: ${BASE_URL}/replay/${recordedId}`);
}

main().catch(err => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
