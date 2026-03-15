import { DashClaw } from '../sdk/dashclaw.js';
import dotenv from 'dotenv';
dotenv.config();

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'swarm-orchestrator',
});

async function main() {
  const swarmId = 'swarm-node-test-1';
  console.log(`Starting swarm orchestration: ${swarmId}`);

  // 1. Parent Task
  const { action: parent } = await claw.createAction({
    action_type: 'orchestration',
    declared_goal: 'Fulfill customer support request #9921',
    swarm_id: swarmId,
    risk_score: 45
  });

  const parentId = parent.action_id;
  console.log(`Parent Action Created: ${parentId}`);

  // 2. Sub-task: Knowledge lookup
  const { action: sub1 } = await claw.createAction({
    action_type: 'lookup',
    declared_goal: 'Find billing info for User #122',
    parent_action_id: parentId,
    swarm_id: swarmId,
    systems_touched: ['stripe', 'internal_db']
  });

  console.log(`Sub-action 1 (lookup): ${sub1.action_id}`);

  // 3. Sub-task: Response drafting
  const { action: sub2 } = await claw.createAction({
    action_type: 'drafting',
    declared_goal: 'Compose apology and billing update',
    parent_action_id: parentId,
    swarm_id: swarmId
  });

  console.log(`Sub-action 2 (draft): ${sub2.action_id}`);

  // 4. Resolve Parent
  await claw.updateOutcome(parentId, {
    status: 'completed',
    output_summary: 'Knowledge retrieved and draft composed. Task complete.'
  });

  console.log('Orchestration finished.');
}

main();
