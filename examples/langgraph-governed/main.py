import os
from dotenv import load_dotenv
from dashclaw import DashClaw
from langgraph.graph import StateGraph, END
from typing import TypedDict

load_dotenv()

# Define the graph state
class AgentState(TypedDict):
    topic: str
    research_result: str
    governance_decision: str
    action_id: str

# Initialize DashClaw
claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="langgraph-research-agent",
)


def governance_node(state: AgentState) -> AgentState:
    """Check DashClaw guard before proceeding."""
    result = claw.guard({
        "action_type": "research",
        "declared_goal": f"Research topic: {state['topic']}",
        "risk_score": 30,
    })
    decision = result.get("decision", "allow")

    if decision == "block":
        print(f"BLOCKED: {result.get('reasons', [])}")
        return {**state, "governance_decision": "blocked"}

    # Record the action
    action = claw.create_action(
        "research",
        f"Research topic: {state['topic']}",
        risk_score=30,
    )
    action_id = action["action_id"]
    print(f"Action recorded: {action_id}")
    return {**state, "governance_decision": decision, "action_id": action_id}


def research_node(state: AgentState) -> AgentState:
    """Simulate research (no LLM API key required)."""
    if state.get("governance_decision") == "blocked":
        return {**state, "research_result": "Blocked by governance policy"}

    # Simulated research output (replace with real LLM call in production)
    result = f"Research complete for '{state['topic']}': Found 3 relevant papers on governance frameworks."

    # Report outcome to DashClaw
    if state.get("action_id"):
        claw.update_outcome(
            state["action_id"],
            status="completed",
            output_summary=result,
        )

    print(f"Research result: {result}")
    return {**state, "research_result": result}


# Build the graph
graph = StateGraph(AgentState)
graph.add_node("governance", governance_node)
graph.add_node("research", research_node)
graph.set_entry_point("governance")
graph.add_edge("governance", "research")
graph.add_edge("research", END)

app = graph.compile()


# Run
if __name__ == "__main__":
    print("=== LangGraph + DashClaw Governance Example ===\n")
    result = app.invoke({
        "topic": "AI safety best practices",
        "research_result": "",
        "governance_decision": "",
        "action_id": "",
    })
    print(f"\nFinal state: {result['governance_decision']}")
    if result.get("action_id"):
        base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
        print(f"View decision: {base}/decisions/{result['action_id']}")
