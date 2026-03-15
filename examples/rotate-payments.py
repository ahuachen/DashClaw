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
    agent_id="moonshot-prod-deploy-agent",
    agent_name="Moonshot Prod Deploy Agent",
    guard_mode="enforce",
    hitl_mode="wait",
)

def rotate_payments_api_keys() -> dict:
    print("Rotating production API keys for payments-service...")
    return {"ok": True, "service": "payments-service"}

def main():
    user_prompt = "Write a concise internal summary for rotating production API keys for payments-service."

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
    print("\n=== OPERATION SUMMARY ===\n")
    print(summary)
    print("\n=========================\n")

    try:
        action = claw.create_action(
            action_type="message",
            declared_goal="Send external customer status update",
            reasoning="External communication should require approval before execution.",
            systems_touched=["crm", "email_platform"],
            input_summary=user_prompt,
            reversible=False,
            risk_score=55,
            confidence=84,
            authorization_scope="human_approval_required",
        )
    except DashClawError as e:
        print("DashClaw blocked action:", e)
        print("Status:", getattr(e, "status", None))
        print("Details:", getattr(e, "details", None))
        return

    action_id = action.get("action_id") or action.get("id")
    if not action_id:
        raise RuntimeError(f"Missing action_id in response: {action}")

    print("Action created:", action_id)

    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Rotation window is approved and dependent services can reload secrets safely.",
    })

    print("Waiting for approval in DashClaw...")
    claw.wait_for_approval(action_id)
    print("Approval received.\n")

    try:
        result = rotate_payments_api_keys()

        claw.update_outcome(
            action_id,
            status="completed",
            output_summary=f"Production API key rotation completed successfully for {result['service']}.",
        )

        print("Success. Open Replay for action:", action_id)

    except Exception as e:
        claw.update_outcome(
            action_id,
            status="failed",
            output_summary="Production API key rotation failed.",
            error_message=str(e),
        )
        raise

if __name__ == "__main__":
    main()