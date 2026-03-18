import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'home',
});

const { action_id } = await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
});