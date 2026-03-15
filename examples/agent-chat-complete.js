import { DashClaw } from '../sdk/dashclaw.js';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Integrated SDK Example
 * Demonstrates: guard -> createAction -> registerAssumption -> updateOutcome
 */

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'integrated-node-agent',
});

async function main() {
  const goal = 'Send status update to customer Slack';
  console.log(`Starting integrated workflow: ${goal}`);

  // 1. Guard check
  const { decision, reasons } = await claw.guard({
    action_type: 'notification',
    risk_score: 55,
    systems_touched: ['slack', 'crm'],
    declared_goal: goal,
    authorization_scope: 'internal_communication'
  });

  console.log(`Guard decision: ${decision}`);
  if (decision === 'block') {
    console.error(`Blocked by policies: ${reasons.join(', ')}`);
    return;
  }

  // 2. Create the action
  const { action } = await claw.createAction({
    action_type: 'notification',
    declared_goal: goal,
    reasoning: 'Critical system event needs immediate visibility.',
    systems_touched: ['slack', 'crm'],
    risk_score: 55,
    confidence: 88
  });

  const actionId = action.action_id;
  console.log(`Action created: ${actionId}`);

  // 3. Register Assumptions
  await claw.registerAssumption({
    action_id: actionId,
    assumption: 'Slack webhook is active.',
    basis: 'Integration test passed 10 minutes ago.'
  });

  await claw.registerAssumption({
    action_id: actionId,
    assumption: 'Recipient channel #incidents exists.',
    basis: 'Workspace settings validated.'
  });

  // 4. Update outcome
  try {
    // Simulate Slack API call
    console.log('Posting message to #incidents...');
    await new Promise(r => setTimeout(r, 500));

    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: 'Message successfully delivered to #incidents via Slack API.'
    });

    console.log('Success.');

  } catch (error) {
    await claw.updateOutcome(actionId, {
      status: 'failed',
      error_message: error.message,
      output_summary: 'Failed to deliver message.'
    });
    console.error(`Action failed: ${error.message}`);
  }
}

main();
