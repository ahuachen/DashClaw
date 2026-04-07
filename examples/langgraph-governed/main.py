"""
LangGraph + DashClaw Governance Example

Demonstrates conditional graph routing based on governance decisions:
- allow → research → outcome
- require_approval → approval → research → outcome
- block → abort

Shows assumptions, HITL approval, and outcome recording.
No OPENAI_API_KEY required.
"""

import os
from dotenv import load_dotenv
from dashclaw import DashClaw
from langgraph.graph import StateGraph, END
from typing import TypedDict

load_dotenv()

class AgentState(TypedDict):
    topic: str
    research_result: str
    governance_decision: str
    action_id: str


claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="langgraph-research-agent",
)


def governance_node(state: AgentState) -> AgentState:
    """Check DashClaw guard and record the action."""
    result = claw.guard({
        "action_type": "research",
        "declared_goal": f"Research topic: {state['topic']}",
        "risk_score": 45,
        "systems_touched": ["web_search", "knowledge_base"],
    })
    decision = result.get("decision", "allow")
    print(f"[governance] Guard decision: {decision}")

    if decision == "block":
        print(f"[governance] BLOCKED: {result.get('reasons', [])}")
        return {**state, "governance_decision": "blocked"}

    # Record the action
    action = claw.create_action(
        "research",
        f"Research topic: {state['topic']}",
        risk_score=45,
        systems_touched=["web_search", "knowledge_base"],
    )
    action_id = action["action_id"]
    print(f"[governance] Action recorded: {action_id}")
    return {**state, "governance_decision": decision, "action_id": action_id}


def approval_node(state: AgentState) -> AgentState:
    """Wait for human approval before proceeding."""
    action_id = state.get("action_id")
    if not action_id:
        return {**state, "governance_decision": "blocked"}

    print(f"[approval] Waiting for human approval of {action_id}...")
    try:
        claw.wait_for_approval(action_id, timeout=120, interval=5)
        print("[approval] Approved!")
        return {**state, "governance_decision": "allow"}
    except Exception as e:
        print(f"[approval] Denied: {e}")
        claw.update_outcome(action_id, status="cancelled", error_message=str(e))
        return {**state, "governance_decision": "blocked"}


def research_node(state: AgentState) -> AgentState:
    """Simulate research and record assumptions."""
    action_id = state.get("action_id")

    # Record assumption
    if action_id:
        claw.record_assumption({
            "action_id": action_id,
            "assumption": "Web search results are from reputable sources",
            "basis": "Using curated knowledge base with source verification",
        })

    # Simulated research
    result = f"Research complete for '{state['topic']}': Found 3 relevant papers on governance frameworks."
    print(f"[research] {result}")
    return {**state, "research_result": result}


def outcome_node(state: AgentState) -> AgentState:
    """Report the outcome to DashClaw."""
    action_id = state.get("action_id")
    if action_id:
        claw.update_outcome(
            action_id,
            status="completed",
            output_summary=state.get("research_result", "No result"),
        )
        print(f"[outcome] Reported success for {action_id}")
    return state


def abort_node(state: AgentState) -> AgentState:
    """Handle blocked actions."""
    action_id = state.get("action_id")
    if action_id:
        claw.update_outcome(
            action_id,
            status="cancelled",
            error_message="Blocked by governance policy",
        )
    print("[abort] Action blocked by governance policy.")
    return {**state, "research_result": "Blocked by governance policy"}


def route_after_governance(state: AgentState) -> str:
    """Route based on guard decision."""
    decision = state.get("governance_decision", "allow")
    if decision == "blocked":
        return "abort"
    if decision == "require_approval":
        return "approval"
    return "research"


def route_after_approval(state: AgentState) -> str:
    """Route after approval — proceed or abort."""
    if state.get("governance_decision") == "blocked":
        return "abort"
    return "research"


# Build the graph
graph = StateGraph(AgentState)
graph.add_node("governance", governance_node)
graph.add_node("approval", approval_node)
graph.add_node("research", research_node)
graph.add_node("outcome", outcome_node)
graph.add_node("abort", abort_node)

graph.set_entry_point("governance")
graph.add_conditional_edges("governance", route_after_governance, {
    "research": "research",
    "approval": "approval",
    "abort": "abort",
})
graph.add_conditional_edges("approval", route_after_approval, {
    "research": "research",
    "abort": "abort",
})
graph.add_edge("research", "outcome")
graph.add_edge("outcome", END)
graph.add_edge("abort", END)

app = graph.compile()


if __name__ == "__main__":
    print("=== LangGraph + DashClaw Governance Example ===\n")
    result = app.invoke({
        "topic": "AI safety best practices",
        "research_result": "",
        "governance_decision": "",
        "action_id": "",
    })
    print(f"\nFinal: {result['governance_decision']} — {result['research_result']}")
    if result.get("action_id"):
        base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
        print(f"View decision: {base}/decisions/{result['action_id']}")
