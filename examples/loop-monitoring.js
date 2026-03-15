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

  // 1. Create a loop
  const { loop_id } = await claw.createLoop({
    loop_type: 'background_indexing',
    description: 'Indexing new documentation for RAG',
    priority: 'medium'
  });

  console.log(`Loop created: ${loop_id}`);

  // 2. Update progress
  await new Promise(r => setTimeout(r, 1000));
  await claw.updateLoop(loop_id, {
    status: 'active',
    description: 'Processed 15 files...'
  });

  // 3. Resolve loop
  await new Promise(r => setTimeout(r, 1000));
  await claw.updateLoop(loop_id, {
    status: 'resolved',
    resolution: 'Successfully indexed 42 files.',
    description: 'Indexing complete.'
  });

  console.log('Loop resolved.');
}

main();
