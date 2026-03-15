import os
from openai import OpenAI
from dashclaw import DashClaw
from dashclaw.client import DashClawError
from dotenv import load_dotenv

load_dotenv()

moonshot = OpenAI(
    api_key=os.environ["MOONSHOT_API_KEY"],
    base_url="https://api.moonshot.ai/v1",
)

claw = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="moonshot-customer-comms-agent",
    agent_name="Moonshot Prod Deploy Agent",
    guard_mode="enforce",
    hitl_mode="wait",
)

def deploy_to_production(version: str) -> dict:
    print(f"Deploying auth service {version} to production...")
    return {"ok": True, "version": version}

def main():
    user_prompt = "Write a concise production deployment summary for auth-service v2.1.1."

    completion = moonshot.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=[
            {
                "role": "system",
                "content": "You write short, crisp internal engineering summaries."
            },
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    summary = completion.choices[0].message.content
    print("\n=== DEPLOY SUMMARY ===\n")
    print(summary)
    print("\n======================\n")

    try:
        action = claw.create_action(
            action_type="deploy",
            declared_goal="Deploy auth-service v2.1.1 to production",
            reasoning="Demo deployment that should be governed by DashClaw before execution.",
            systems_touched=["production_kubernetes", "auth_service", "moonshot_api"],
            input_summary=user_prompt,
            reversible=False,
            risk_score=96,
            confidence=81,
            authorization_scope="human_approval_required",
        )
    except DashClawError as e:
        print(f"DashClaw blocked action: {e}")
        return

    action_id = action.get("action_id") or action.get("id")
    if not action_id:
        raise RuntimeError(f"Missing action_id in response: {action}")

    print("Action created and approved:", action_id)

    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Deployment window is approved and rollback plan exists.",
        "basis": "Demo scenario for a high-risk production change.",
        "validated": False,
    })

    try:
        result = deploy_to_production("v2.1.1")

        claw.update_outcome(
            action_id,
            status="completed",
            output_summary=f"Production deployment completed successfully for {result['version']}.",
        )

        print("Success. Open Replay for action:", action_id)

    except Exception as e:
        claw.update_outcome(
            action_id,
            status="failed",
            output_summary="Production deployment failed.",
            error_message=str(e),
        )
        raise

if __name__ == "__main__":
    main()