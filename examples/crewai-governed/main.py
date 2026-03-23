"""
CrewAI + DashClaw Governance Example

Demonstrates how to govern a CrewAI tool using the @tool decorator pattern.
DashClaw guard runs before each tool execution. If policy blocks the action,
the tool returns early with the reason. Otherwise, it records the action,
executes (simulated here — no LLM provider needed), and reports the outcome.

In a full CrewAI setup, the LLM agent would call this tool automatically.
This example calls the tool directly to show the governance flow without
an LLM provider.
"""

import os
from dotenv import load_dotenv
from dashclaw import DashClaw
from crewai.tools import tool

load_dotenv()

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="crewai-analyst-agent",
)


@tool("Analyze Customer Data")
def analyze_customer_data(query: str) -> str:
    """Analyze customer data based on the query. This tool is governed by DashClaw policies."""

    # 1. GUARD: Check policy before executing
    result = claw.guard({
        "action_type": "data_analysis",
        "declared_goal": f"Analyze customer data: {query}",
        "risk_score": 40,
        "systems_touched": ["customer_database"],
    })

    decision = result.get("decision", "allow")
    print(f"Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"Blocked by governance policy: {', '.join(reasons)}"

    # 2. RECORD: Declare intent
    action = claw.create_action(
        "data_analysis",
        f"Analyze customer data: {query}",
        risk_score=40,
    )
    action_id = action["action_id"]
    print(f"Action recorded: {action_id}")

    # 3. EXECUTE: Simulated analysis (no LLM API key needed)
    analysis_result = (
        f"Analysis of '{query}': Found 42 matching customer segments "
        f"with avg satisfaction 4.2/5."
    )

    # 4. OUTCOME: Report result
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=analysis_result,
    )

    return analysis_result


if __name__ == "__main__":
    print("=== CrewAI + DashClaw Governance Example ===\n")
    print("Running governed tool call...\n")

    # Call the governed tool directly.
    # In a full CrewAI setup, the LLM agent would invoke this tool via its
    # task description — the governance logic inside runs the same way.
    result = analyze_customer_data.run("high-value customers in Q4")

    print(f"\nTool result: {result}")

    base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
    print(f"\nView governed decisions: {base}/decisions")
