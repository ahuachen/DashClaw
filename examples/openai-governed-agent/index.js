import OpenAI from 'openai';
import { DashClaw, GuardBlockedError } from 'dashclaw';
import dotenv from 'dotenv';
dotenv.config();

/**
 * 🚀 DASHCLAW STARTER: OPENAI GOVERNED AGENT
 * 
 * Scenario: A customer support agent wants to send a refund notification email.
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
    agentId: 'refund-support-agent',
  });

  // Initialize OpenAI (Optional but shown for "Real Agent" flow)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'sk-fake-key',
  });

  const customerEmail = 'jane@example.com';
  const orderId = '#1234';
  const goal = `Send refund confirmation email to ${customerEmail} for order ${orderId}`;

  console.log(`\n🤖 Agent Goal: ${goal}`);

  try {
    // 🛡️ 1. GUARD: Ask DashClaw if this action is safe
    console.log("🛡️  Checking policies via DashClaw Guard...");
    const decision = await claw.guard({
      action_type: 'email_customer',
      declared_goal: goal,
      risk_score: 45, // Moderate risk for financial comms
      systems_touched: ['smtp', 'stripe'],
    });

    if (decision.decision === 'block') {
      console.error(`\n❌ ACTION BLOCKED: ${decision.reason}`);
      console.log(`View decision at: ${process.env.DASHCLAW_BASE_URL}/replay/${decision.action_id}\n`);
      return;
    }

    if (decision.decision === 'require_approval') {
      console.log(`\n⏳ APPROVAL REQUIRED. Waiting for human review...`);
      console.log(`Approve here: ${process.env.DASHCLAW_BASE_URL}/approvals\n`);
      await claw.waitForApproval(decision.action_id);
      console.log("✅ Approved! Proceeding...");
    } else {
      console.log("✅ Guard: Allowed.");
    }

    // 📝 2. ACTION: Declare intent to record evidence
    const { action } = await claw.createAction({
      action_type: 'email_customer',
      declared_goal: goal,
      reasoning: 'Refund was processed in Stripe; customer must be notified per SLA.',
      risk_score: 45,
    });
    const actionId = action.action_id;
    console.log(`📝 Action Recorded: ${actionId}`);

    // 💭 3. ASSUMPTION: Record what the agent believes to be true
    await claw.recordAssumption({
      action_id: actionId,
      assumption: 'Stripe refund transaction is successful.',
      basis: 'API call returned status: succeeded'
    });

    // 🚀 4. EXECUTE: The actual "Real World" side effect
    console.log(`\n📧 Sending email to ${customerEmail}...`);
    // Example: const response = await openai.chat.completions.create(...)
    // For this starter, we simulate the synthetic side effect:
    await new Promise(r => setTimeout(r, 1000));
    console.log("✨ Email sent successfully.");

    // ✅ 5. OUTCOME: Report final result to DashClaw
    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: `Refund email for ${orderId} delivered to ${customerEmail}.`
    });

    console.log(`\n🎉 Workflow complete. Trace recorded in DashClaw.`);
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
