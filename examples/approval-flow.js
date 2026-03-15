import { DashClaw, ApprovalDeniedError } from '../sdk/dashclaw.js';
import dotenv from 'dotenv';
dotenv.config();

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'node-approval-agent',
  agentName: 'Node Approval Agent'
});

async function main() {
  console.log('Initiating high-risk action...');

  try {
    // 1. Create action that requires approval
    const { action } = await claw.createAction({
      action_type: 'infrastructure',
      declared_goal: 'Resize production database cluster',
      risk_score: 95,
      systems_touched: ['aws_rds', 'terraform'],
      reversible: true
    });

    const actionId = action.action_id;
    console.log(`Action created: ${actionId}. Waiting for human operator...`);

    // 2. Wait for HITL decision (polls until approved/denied)
    await claw.waitForApproval(actionId);
    console.log('Approval received! Proceeding with execution...');

    // 3. Perform the work
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate work

    // 4. Record success
    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: 'Cluster resized to 4x large successfully.'
    });
    console.log('Task complete.');

  } catch (error) {
    if (error instanceof ApprovalDeniedError) {
      console.error(`Action DENIED by operator: ${error.message}`);
    } else {
      console.error(`Unexpected error: ${error.message}`);
    }
  }
}

main();
