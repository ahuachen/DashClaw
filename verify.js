import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: 'oc_live_607f846b6bfe92edd06c038499ea8c4b',
  agentId: 'home',
});

const { action_id } = await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
});