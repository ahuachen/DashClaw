import { DashClaw, GuardBlockedError } from '../sdk/dashclaw.js';
import dotenv from 'dotenv';
dotenv.config();

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'node-guard-agent',
});

async function main() {
  console.log('--- Action Decision Point ---');

  // 1. Guard check (synchronous policy evaluation)
  const { decision } = await claw.guard({
    action_type: 'financial',
    risk_score: 65,
    systems_touched: ['stripe', 'bank_api'],
    declared_goal: 'Authorize payment of $500.00'
  });

  console.log(`Guard decision: ${decision}`);

  if (decision === 'block') {
    console.error('DashClaw BLOCKED the action. Terminating execution.');
    return;
  }

  // 2. Create the record
  const { action } = await claw.createAction({
    action_type: 'financial',
    declared_goal: 'Authorize payment of $500.00',
    reasoning: 'User initiated checkout for order #4002.',
    risk_score: 65
  });

  console.log(`Action record created: ${action.action_id}`);

  // 3. Register assumptions
  await claw.registerAssumption({
    action_id: action.action_id,
    assumption: 'User bank account has sufficient funds.',
    basis: 'Previous balance check passed.'
  });

  // 4. Record success
  await claw.updateOutcome(action.action_id, {
    status: 'completed',
    output_summary: 'Payment authorized and charged.'
  });

  console.log('Action trace finalized.');
}

main();
