import os
from dashclaw import DashClaw

claw = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "https://your-dashclaw.vercel.app"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent2",
)

claw.create_action(
    action_type="test",
    declared_goal="Verify DashClaw connection",
)