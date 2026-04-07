"""
CrewAI + DashClaw Governance Example

Demonstrates multi-tool governance with:
- Guard policy checks before each tool execution
- HITL (Human-in-the-Loop) approval for high-risk actions
- Assumption recording for decision evidence
- Outcome tracking for learning loop

No OPENAI_API_KEY required — runs governance flow directly.
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
    """Analyze customer data based on the query. Governed by DashClaw policies."""

    # 1. GUARD: Check policy before executing
    result = claw.guard({
        "action_type": "research",
        "declared_goal": f"Analyze customer data: {query}",
        "risk_score": 40,
        "systems_touched": ["customer_database"],
    })

    decision = result.get("decision", "allow")
    print(f"[analyze] Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"Blocked by governance policy: {', '.join(reasons)}"

    # 2. RECORD: Declare intent
    action = claw.create_action(
        "research",
        f"Analyze customer data: {query}",
        risk_score=40,
        systems_touched=["customer_database"],
    )
    action_id = action["action_id"]
    print(f"[analyze] Action recorded: {action_id}")

    # 3. HITL: Wait for approval if required
    if decision == "require_approval":
        print(f"[analyze] Waiting for human approval of {action_id}...")
        try:
            claw.wait_for_approval(action_id, timeout=120, interval=5)
            print("[analyze] Approved!")
        except Exception as e:
            claw.update_outcome(action_id, status="cancelled", error_message=str(e))
            return f"Denied: {e}"

    # 4. ASSUMPTION: Record reasoning basis
    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Customer database credentials are read-only",
        "basis": "Service account has SELECT-only permissions",
    })

    # 5. EXECUTE: Simulated analysis
    analysis_result = (
        f"Analysis of '{query}': Found 42 matching customer segments "
        f"with avg satisfaction 4.2/5."
    )

    # 6. OUTCOME: Report result
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=analysis_result,
    )

    return analysis_result


@tool("Publish Report")
def publish_report(title: str) -> str:
    """Publish an analysis report externally. Higher risk — may require approval."""

    # 1. GUARD: Higher risk action
    result = claw.guard({
        "action_type": "post",
        "declared_goal": f"Publish report: {title}",
        "risk_score": 65,
        "systems_touched": ["external_api", "customer_portal"],
        "reversible": False,
    })

    decision = result.get("decision", "allow")
    print(f"[publish] Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"Blocked by governance policy: {', '.join(reasons)}"

    # 2. RECORD
    action = claw.create_action(
        "post",
        f"Publish report: {title}",
        risk_score=65,
        systems_touched=["external_api", "customer_portal"],
    )
    action_id = action["action_id"]
    print(f"[publish] Action recorded: {action_id}")

    # 3. HITL
    if decision == "require_approval":
        print(f"[publish] Waiting for human approval of {action_id}...")
        try:
            claw.wait_for_approval(action_id, timeout=120, interval=5)
            print("[publish] Approved!")
        except Exception as e:
            claw.update_outcome(action_id, status="cancelled", error_message=str(e))
            return f"Denied: {e}"

    # 4. ASSUMPTION
    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Report data has been reviewed and is non-sensitive",
        "basis": "Analyst confirmed no PII in output",
    })

    # 5. EXECUTE
    publish_result = f"Report '{title}' published to customer portal."

    # 6. OUTCOME
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=publish_result,
    )

    return publish_result


if __name__ == "__main__":
    print("=== CrewAI + DashClaw Governance Example ===\n")

    print("--- Tool 1: Analyze Customer Data (low risk) ---")
    result1 = analyze_customer_data.run("high-value customers in Q4")
    print(f"Result: {result1}\n")

    print("--- Tool 2: Publish Report (higher risk) ---")
    result2 = publish_report.run("Q4 High-Value Customer Analysis")
    print(f"Result: {result2}\n")

    base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
    print(f"View governed decisions: {base}/decisions")
