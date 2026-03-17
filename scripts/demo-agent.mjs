#!/usr/bin/env node
/**
 * DashClaw demo agent — no external dependencies.
 * Uses native fetch (Node 18+) to call the local DashClaw API directly.
 */

const BASE_URL = process.env.DASHCLAW_BASE_URL || 'http://localhost:3000';
const API_KEY  = process.env.DASHCLAW_API_KEY  || 'demo-key';
const AGENT_ID = 'demo-deployer';

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
  const goal = 'Deploy auth-service-v2 to production';
  console.log(`\n🤖 Agent Goal: ${goal}`);

  // 1. Guard check
  console.log('🛡️  Checking policies via DashClaw Guard...');
  let guardResult;
  try {
    guardResult = await post('/api/guard', {
      agent_id: AGENT_ID,
      action_type: 'deploy',
      declared_goal: goal,
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api'],
    });
  } catch (err) {
    console.error(`❌ Guard check failed: ${err.message}`);
    process.exit(1);
  }

  const decision  = guardResult.decision;
  const actionId  = guardResult.action_id;

  if (decision === 'block') {
    console.log(`\n❌ ACTION BLOCKED by policy.`);
    console.log(`   Reason: ${guardResult.reason || guardResult.reasons?.join(', ') || 'Policy threshold exceeded'}`);
    console.log(`   Risk score: 85 — exceeds policy threshold`);
    console.log(`\n📋 Decision Replay: ${BASE_URL}/replay/${actionId}`);
    console.log(`REPLAY_URL=${BASE_URL}/replay/${actionId}`);
    return;
  }

  if (decision === 'require_approval') {
    console.log(`\n⏳ APPROVAL REQUIRED — waiting for human review...`);
    console.log(`   Approve here: ${BASE_URL}/approvals`);
    console.log(`REPLAY_URL=${BASE_URL}/approvals`);
    return;
  }

  // 2. Record action
  let actionResult;
  try {
    actionResult = await post('/api/actions', {
      agent_id: AGENT_ID,
      action_type: 'deploy',
      declared_goal: goal,
      reasoning: 'Scheduled release window. QA sign-off received.',
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api'],
    });
  } catch (err) {
    console.error(`❌ Action record failed: ${err.message}`);
    process.exit(1);
  }

  const recordedId = actionResult.action_id || actionResult.action?.action_id || actionId;
  console.log(`📝 Action Recorded: ${recordedId}`);
  console.log(`📋 Decision Replay: ${BASE_URL}/replay/${recordedId}`);
  console.log(`\n🎉 Deployment governed. Trace recorded in DashClaw.`);
  console.log(`REPLAY_URL=${BASE_URL}/replay/${recordedId}`);
}

main().catch(err => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
