import OpenAI from 'openai';
import { DashClaw, GuardBlockedError } from 'dashclaw';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 🚀 DASHCLAW STARTER: OPENAI GOVERNED DEPLOY AGENT
 *
 * Scenario: A deployment agent wants to push auth-service-v2 to production.
 *
 * This example shows the 5-minute path to governance:
 * 1. Guard (Policy Check)
 * 2. Action (Intent Declaration)
 * 3. Assumption (Reasoning/Beliefs)
 * 4. Outcome (Execution Result)
 */

async function main() {
  const apiKey = process.env.DASHCLAW_API_KEY;
  if (!apiKey || apiKey === 'your_dashclaw_api_key') {
    console.error("❌ Missing DASHCLAW_API_KEY in .env");
    return;
  }

  // Initialize DashClaw
  const claw = new DashClaw({
    baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
    apiKey: apiKey,
    agentId: 'openai-deployer-1',
  });

  // Initialize OpenAI (Optional but shown for "Real Agent" flow)
  const openaiKey = process.env.OPENAI_API_KEY;
  const hasOpenAI = openaiKey && openaiKey !== 'sk-fake-key';
  const openai = hasOpenAI ? new OpenAI({ apiKey: openaiKey }) : null;

  const deployTarget = 'production';
  const serviceName = 'auth-service-v2';
  const goal = `Deploy ${serviceName} to ${deployTarget}`;

  console.log(`\n🤖 Agent Goal: ${goal}`);

  try {
    // 🛡️ 1. GUARD: Ask DashClaw if this action is safe
    console.log("🛡️  Checking policies via DashClaw Guard...");
    const decision = await claw.guard({
      action_type: 'deploy',
      declared_goal: goal,
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api'],
    });

    if (decision.decision === 'block') {
      console.error(`\n❌ ACTION BLOCKED: ${decision.reason}`);
      console.log(`View decision at: ${process.env.DASHCLAW_BASE_URL}/decisions\n`);
      return;
    }

    console.log(`✅ Guard: ${decision.decision === 'require_approval' ? 'Approval required.' : 'Allowed.'}`);

    // 📝 2. ACTION: Declare intent to record evidence
    // This creates the action record (with status 'pending_approval' if guard requires it).
    const { action } = await claw.createAction({
      action_type: 'deploy',
      declared_goal: goal,
      reasoning: 'Scheduled release window. QA sign-off received.',
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api'],
    });
    const actionId = action.action_id;
    console.log(`📝 Action Recorded: ${actionId}`);
    console.log(`📋 Decision Replay: ${process.env.DASHCLAW_BASE_URL}/replay/${actionId}`);

    // ⏳ 3. APPROVAL: Wait for human sign-off if required
    if (decision.decision === 'require_approval') {
      console.log(`\n⏳ APPROVAL REQUIRED. Waiting for human review...`);
      console.log(`Approve here: ${process.env.DASHCLAW_BASE_URL}/approvals\n`);
      await claw.waitForApproval(actionId);
      console.log("✅ Approved! Proceeding...");
    }

    // 💭 3. ASSUMPTION: Record what the agent believes to be true
    await claw.recordAssumption({
      action_id: actionId,
      assumption: 'All integration tests passed in staging environment.',
      basis: 'CI pipeline result: 847 tests passed, 0 failed'
    });

    // 🚀 4. EXECUTE: The actual deployment
    if (openai) {
      console.log(`\n🚀 Deploying ${serviceName} to ${deployTarget}...`);
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 100,
        messages: [
          { role: 'system', content: 'You are a deployment agent. Respond with a short deployment status message.' },
          { role: 'user', content: `Simulate deploying ${serviceName} to ${deployTarget}. Respond in one sentence.` },
        ],
      });
      console.log(`🤖 ${response.choices[0].message.content}`);
    } else {
      console.log(`\n🤖 Simulating agent reasoning (no OPENAI_API_KEY set)...`);
      console.log(`🚀 Deploying ${serviceName} to ${deployTarget}...`);
      await new Promise(r => setTimeout(r, 1000));
      console.log(`✨ ${serviceName} deployed to ${deployTarget} successfully.`);
    }

    // ✅ 5. OUTCOME: Report final result to DashClaw
    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: `Deployed ${serviceName} to ${deployTarget}. All health checks passing.`
    });

    console.log(`\n🎉 Deployment complete. Trace recorded in DashClaw.`);
    console.log(`Review Evidence: ${process.env.DASHCLAW_BASE_URL}/replay/${actionId}\n`);

  } catch (error) {
    if (error.name === 'GuardBlockedError') {
      console.error(`\n❌ BLOCKED BY POLICY: ${error.message}`);
    } else if (error.name === 'ApprovalDeniedError') {
      console.error(`\n❌ DENIED BY OPERATOR: ${error.message}`);
    } else {
      console.error(`\n❌ Error: ${error.message}`);
    }
  }
}

main();
