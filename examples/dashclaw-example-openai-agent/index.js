import { DashClaw, GuardBlockedError } from 'dashclaw';

/**
 * 🚀 DASHCLAW EXAMPLE: GOVERN YOUR FIRST ACTION
 * 
 * This script demonstrates the "Aha!" moment of DashClaw:
 * 1. An agent declares an intent (e.g., "deploy to production")
 * 2. DashClaw intercepts the action BEFORE it happens.
 * 3. DashClaw blocks the action because it violates a policy.
 * 
 * Usage:
 * export DASHCLAW_BASE_URL=http://localhost:3000
 * export DASHCLAW_API_KEY=<your-api-key>
 * node index.js
 */

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'openai-deployer-1',
});

async function main() {
  console.log("🚀 Agent attempting: deploy to production...");

  try {
    // 1. INTERCEPT: Ask DashClaw for a policy decision
    // We send a high risk_score (85) to trigger a default block policy
    const decision = await claw.guard({
      action_type: 'deploy',
      declared_goal: 'Deploy latest build to production',
      risk_score: 85 
    });

    if (decision.decision === 'allow') {
      console.log("✅ DashClaw ALLOWED the action. Proceeding with deployment...");
      // executeDeploy();
    } else if (decision.decision === 'require_approval') {
      console.log("⏳ DashClaw REQUIRE_APPROVAL. Waiting for human review...");
      // await claw.waitForApproval(decision.action_id);
    }
  } catch (error) {
    if (error.name === 'GuardBlockedError' || error.status === 403) {
      // 2. THE AHA! MOMENT: DashClaw blocks the risky action
      console.error("\n❌ DASHCLAW BLOCKED THIS ACTION.");
      console.error(`Reason: ${error.message || 'Risk score exceeded organization threshold'}`);
      
      console.log("\nReview the decision record at:");
      console.log(`${process.env.DASHCLAW_BASE_URL}/mission-control\n`);
    } else {
      console.error("Error:", error.message);
    }
  }
}

main();
