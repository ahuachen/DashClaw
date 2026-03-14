import os
import asyncio
from dashclaw import DashClaw

async def run():
    # 1. Initialize DashClaw
    # In "demo" mode, it sends telemetry to the public DashClaw demo.
    claw = DashClaw(
        api_key=os.getenv("DASHCLAW_API_KEY", "demo"),
        base_url=os.getenv("DASHCLAW_BASE_URL", "http://localhost:3000")
    )

    print("🚀 Agent attempting high-risk action...")

    # 2. Intercept before you act
    # This sends the intent to DashClaw for policy evaluation.
    result = await claw.guard(
        action_type="deploy",
        risk_score=92,
        declared_goal="Deploy build v2.1.0 to production environment",
        reasoning="The build has passed all CI checks and is ready for release."
    )

    decision = result.get("decision", "unknown")
    action_id = result.get("actionId")

    print(f"⚖️ DashClaw decision: {decision.upper()}")
    
    if action_id:
        print(f"🔗 View decision replay: http://localhost:3000/decisions/{action_id}")

    # 3. Follow the decision
    if decision == "allowed":
        print("✅ Action permitted. Proceeding with deployment.")
    elif decision == "require_approval":
        print("⏳ Action paused. Awaiting human operator approval in Mission Control.")
    else:
        print("🛑 Action BLOCKED by governance policy.")

if __name__ == "__main__":
    try:
        asyncio.run(run())
    except Exception as e:
        print(f"❌ Error running example: {e}")
        print("\nTip: Make sure DashClaw is running locally at http://localhost:3000")
        print("Or run with: DASHCLAW_BASE_URL=https://www.dashclaw.io python first-governed-action.py")
