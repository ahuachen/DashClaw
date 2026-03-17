from dashclaw import DashClaw

claw = DashClaw(
    base_url="https://my-dashclaw.vercel.app",
    api_key="oc_live_607f846b6bfe92edd06c038499ea8c4b",
    agent_id="my-agent2",
)

claw.create_action(
    action_type="test",
    declared_goal="Verify DashClaw connection",
)