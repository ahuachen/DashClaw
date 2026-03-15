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
    # 1. Start a long-running loop
    loop_data = {
        "loop_type": "security_scan",
        "description": "Continuous vulnerability scan of network subnet",
        "priority": "high",
        "owner": "security-bot-1"
    }
    
    # create_loop returns a dict with loop_id
    loop = claw.create_loop(loop_data)
    loop_id = loop.get("loop_id")
    print(f"Loop created: {loop_id}")

    # 2. Simulate progress
    time.sleep(2)
    claw.update_loop(loop_id, {
        "status": "active",
        "description": "Scan 50% complete. No critical issues found."
    })
    print("Loop updated (50%)...")

    # 3. Simulate completion
    time.sleep(2)
    claw.update_loop(loop_id, {
        "status": "resolved",
        "resolution": "Full subnet scan completed. 3 low-severity findings identified.",
        "description": "Scan complete."
    })
    print(f"Loop {loop_id} resolved.")

if __name__ == "__main__":
    main()
