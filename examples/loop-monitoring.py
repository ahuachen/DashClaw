import os
import time
from dashclaw import DashClaw
from dotenv import load_dotenv

load_dotenv()

claw = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="loop-monitor-bot",
)

def main():
    # 1. Create a parent action for the loop to attach to
    action = claw.create_action(
        action_type="security_scan",
        declared_goal="Continuous vulnerability scan of network subnet",
        risk_score=35,
    )
    action_id = action.get("action_id") or action.get("action", {}).get("action_id")
    print(f"Action created: {action_id}")

    # 2. Register an open loop against the action
    loop = claw.register_open_loop(
        action_id=action_id,
        loop_type="security_scan",
        description="Continuous vulnerability scan of network subnet",
        priority="high",
        owner="security-bot-1",
    )
    loop_id = loop.get("loop_id")
    print(f"Loop created: {loop_id}")

    # 3. Simulate progress
    time.sleep(2)
    print("Scan 50% complete. No critical issues found.")

    # 4. Resolve the loop
    time.sleep(2)
    claw.resolve_open_loop(
        loop_id,
        status="resolved",
        resolution="Full subnet scan completed. 3 low-severity findings identified.",
    )
    print(f"Loop {loop_id} resolved.")

    # 5. Close out the parent action
    claw.update_outcome(action_id, status="completed",
                        output_summary="Security scan complete. 3 low-severity findings.")
    print("Action complete.")

if __name__ == "__main__":
    main()
