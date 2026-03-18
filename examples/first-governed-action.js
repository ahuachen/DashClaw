import { DashClaw } from "dashclaw";

// 1. Initialize DashClaw
// If running locally, ensures it points to your local instance.
// In "demo" mode, it sends telemetry to the public DashClaw demo.
const claw = new DashClaw({
  apiKey: process.env.DASHCLAW_API_KEY || "demo",
  baseUrl: process.env.DASHCLAW_BASE_URL || "https://your-dashclaw.vercel.app",
  agentId: process.env.DASHCLAW_AGENT_ID || "first-action-agent"
});

async function run() {
  console.log("🚀 Agent attempting high-risk action...");

  // 2. Intercept before you act
  // This sends the intent to DashClaw for policy evaluation.
  const { decision, action_id } = await claw.guard({
    action_type: "deploy",
    risk_score: 92,
    declared_goal: "Deploy build v2.1.0 to production environment",
    reasoning: "The build has passed all CI checks and is ready for release."
  });

  console.log(`⚖️ DashClaw decision: ${decision.toUpperCase()}`);
  
  if (action_id) {
    console.log(`🔗 View decision replay: http://localhost:3000/decisions/${action_id}`);
  }

  // 3. Follow the decision
  if (decision === "allow") {
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
  console.log("Or run with: DASHCLAW_BASE_URL=https://your-dashclaw.vercel.app node first-governed-action.js");
});
