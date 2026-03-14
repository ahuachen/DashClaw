import { DashClaw } from "dashclaw";

// 1. Initialize DashClaw
// If running locally, ensures it points to your local instance.
// In "demo" mode, it sends telemetry to the public DashClaw demo.
const claw = new DashClaw({
  apiKey: process.env.DASHCLAW_API_KEY || "demo",
  baseUrl: process.env.DASHCLAW_BASE_URL || "http://localhost:3000"
});

async function run() {
  console.log("🚀 Agent attempting high-risk action...");

  // 2. Intercept before you act
  // This sends the intent to DashClaw for policy evaluation.
  const { decision, actionId } = await claw.guard({
    actionType: "deploy",
    riskScore: 92,
    declaredGoal: "Deploy build v2.1.0 to production environment",
    reasoning: "The build has passed all CI checks and is ready for release."
  });

  console.log(`⚖️ DashClaw decision: ${decision.toUpperCase()}`);
  
  if (actionId) {
    console.log(`🔗 View decision replay: http://localhost:3000/decisions/${actionId}`);
  }

  // 3. Follow the decision
  if (decision === "allowed") {
    console.log("✅ Action permitted. Proceeding with deployment.");
  } else if (decision === "require_approval") {
    console.log("⏳ Action paused. Awaiting human operator approval in Mission Control.");
  } else {
    console.log("🛑 Action BLOCKED by governance policy.");
  }
}

run().catch(err => {
  console.error("❌ Error running example:", err.message);
  console.log("\nTip: Make sure DashClaw is running locally at http://localhost:3000");
  console.log("Or run with: DASHCLAW_BASE_URL=https://www.dashclaw.io node first-governed-action.js");
});
