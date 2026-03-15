import os
import asyncio
from dashclaw import DashClaw
from dotenv import load_dotenv

load_dotenv()

claw = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="research-coordinator",
    agent_name="Research Coordinator",
)

def main():
    # 1. High-level COORDINATOR action
    parent = claw.create_action(
        action_type="workflow",
        declared_goal="Analyze market trends for AI safety",
        swarm_id="swarm-alpha-9",
        risk_score=40
    )
    parent_id = parent.get("action_id")
    print(f"Parent Action Created: {parent_id}")

    # 2. Sub-action: Data Collection
    child_1 = claw.create_action(
        action_type="research",
        declared_goal="Scrape recent whitepapers",
        parent_action_id=parent_id,
        swarm_id="swarm-alpha-9",
        systems_touched=["arxiv", "google_scholar"]
    )
    print(f"Child Action 1 Created: {child_1.get('action_id')}")

    # 3. Sub-action: Analysis
    child_2 = claw.create_action(
        action_type="analysis",
        declared_goal="Summarize findings",
        parent_action_id=parent_id,
        swarm_id="swarm-alpha-9",
        confidence=92
    )
    print(f"Child Action 2 Created: {child_2.get('action_id')}")

    # 4. Finalize Parent
    claw.update_outcome(parent_id, {
        "status": "completed",
        "output_summary": "Research workflow finished with 2 sub-tasks completed."
    })
    print("Workflow complete.")

if __name__ == "__main__":
    main()
