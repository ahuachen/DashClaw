"""
DashClaw: Python research agent with terminal governance.

Simulates a research workflow that fetches sources and writes a report.
Governance fires on the file write step. No AI API key required.
"""

import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

# Inline import guard so the script exits cleanly if dashclaw is missing
try:
    from dashclaw import DashClaw, ApprovalDeniedError
except ImportError:
    print("Missing dashclaw package. Run: pip install -r requirements.txt")
    sys.exit(0)


def main():
    base_url = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
    api_key = os.environ.get("DASHCLAW_API_KEY", "")
    if not api_key or api_key == "your_dashclaw_api_key":
        print("Missing DASHCLAW_API_KEY in .env")
        sys.exit(0)

    topic = os.environ.get("RESEARCH_TOPIC", "AI agent governance patterns")
    slug = topic.lower().replace(" ", "-")

    claw = DashClaw(
        base_url=base_url,
        api_key=api_key,
        agent_id="python-researcher",
    )

    print(f"\n🔬 Python Research Agent")
    print(f"   Topic: {topic}")
    print(f"   Agent: python-researcher\n")

    action_id = None

    try:
        # --- Step 1: Guard check before research ---
        print("[1/3] Guard check: research access...")
        decision = claw.guard({
            "action_type": "research",
            "declared_goal": f"Research topic: {topic}",
            "risk_score": 20,
            "reversible": True,
        })

        if decision.get("decision") == "block":
            reason = (decision.get("reasons") or ["policy violation"])[0]
            print(f"      Blocked: {reason}")
            sys.exit(0)
        print("      Guard: research permitted")

        # --- Step 2: Simulate research ---
        print("\n[2/3] Fetching sources...")
        sources = [
            ("arxiv.org/abs/2309.07864", "AI Agent Safety"),
            ("docs.anthropic.com/claude-code/hooks", None),
            ("nist.gov/ai/rmf", None),
            ("github.com/ucsandman/DashClaw", None),
        ]
        for url, label in sources:
            time.sleep(0.5)
            suffix = f" ({label})" if label else ""
            print(f"      + {url}{suffix}")

        print("      Synthesizing 4 sources...")
        time.sleep(1)
        print("      Report ready (2,847 words)")

        # --- Step 3: Guard check before writing report ---
        print(f"\n[3/3] Guard check: write reports/{slug}.md...")
        guard_result = claw.guard({
            "action_type": "other",
            "declared_goal": f"Write research report to reports/{slug}.md",
            "risk_score": 40,
            "reversible": True,
            "systems_touched": ["filesystem"],
        })
        print(f"      Guard decision: {guard_result.get('decision', 'unknown')}")

        # --- Create action record ---
        result = claw.create_action(
            action_type="other",
            declared_goal=f"Write research report: {topic}",
            reasoning="Research complete. Writing findings to markdown report.",
            risk_score=40,
            reversible=True,
            systems_touched=["filesystem"],
        )
        action_id = result.get("action_id") or result.get("action", {}).get("action_id")
        print(f"      Action recorded: {action_id}")
        print(f"      Replay: {base_url}/replay/{action_id}")

        # --- Handle guard decision ---
        guard_decision = guard_result.get("decision", "allow")

        if guard_decision == "block":
            reason = (guard_result.get("reasons") or ["policy violation"])[0]
            print(f"\n      Blocked by policy: {reason}")
            print(f"      View decision: {base_url}/replay/{action_id}")
            claw.update_outcome(action_id, status="failed", output_summary="Blocked by guard policy")
            sys.exit(0)

        if guard_decision == "require_approval":
            print("")
            print("+== DashClaw Approval Required =====================+")
            print(f"  Action ID:   {action_id}")
            print(f"  Agent:       python-researcher")
            print(f"  File:        reports/{slug}.md")
            print(f"  Risk Score:  40")
            print(f"")
            print(f"  Replay:      {base_url}/replay/{action_id}")
            print(f"")
            print(f"  Approve:     dashclaw approve {action_id}")
            print(f"  Deny:        dashclaw deny {action_id}")
            print(f"")
            print(f"  Waiting... (60s timeout)")
            print("+===================================================+")

            try:
                claw.wait_for_approval(action_id, timeout=60, interval=3)
                print("\n      Approved by operator. Proceeding...")
            except ApprovalDeniedError:
                print("\n      Denied by operator. Report not written.")
                claw.update_outcome(action_id, status="failed", output_summary="Denied by operator")
                sys.exit(0)

        # --- Write report (simulated) ---
        print(f"\n      [Simulated] Would write reports/{slug}.md")
        claw.update_outcome(
            action_id,
            status="completed",
            output_summary=f"Research report written: {topic}",
        )
        print(f"      Full audit trail: {base_url}/replay/{action_id}\n")

    except ApprovalDeniedError:
        print("\n      DENIED BY OPERATOR.")
        if action_id:
            try:
                claw.update_outcome(action_id, status="failed", output_summary="Denied by operator")
            except Exception:
                pass
    except Exception as err:
        print(f"\n      Error: {err}")
        if action_id:
            try:
                claw.update_outcome(action_id, status="failed", output_summary=f"Error: {err}")
            except Exception:
                pass


if __name__ == "__main__":
    main()
