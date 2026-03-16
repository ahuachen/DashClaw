import { DashClaw } from '../sdk/dashclaw.js';
import dotenv from 'dotenv';
dotenv.config();

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'node-loop-agent',
});

async function main() {
  console.log('Starting background loop...');

  // 1. Create a parent action for the loop to attach to
  const { action } = await claw.createAction({
    action_type: 'indexing',
    declared_goal: 'Index new documentation for RAG',
    risk_score: 15
  });

  const actionId = action.action_id;
  console.log(`Action created: ${actionId}`);

  // 2. Register an open loop against the action
  const { loop_id } = await claw.registerOpenLoop(
    actionId,
    'background_indexing',
    'Indexing new documentation for RAG',
    { priority: 'medium' }
  );

  console.log(`Loop created: ${loop_id}`);

  // 3. Simulate work
  await new Promise(r => setTimeout(r, 1000));
  console.log('Processed 15 files...');

  // 4. Resolve the loop
  await new Promise(r => setTimeout(r, 1000));
  await claw.resolveOpenLoop(loop_id, 'resolved', 'Successfully indexed 42 files.');

  console.log('Loop resolved.');

  // 5. Close out the parent action
  await claw.updateOutcome(actionId, {
    status: 'completed',
    output_summary: 'Indexed 42 files for RAG.'
  });

  console.log('Action complete.');
}

main();
