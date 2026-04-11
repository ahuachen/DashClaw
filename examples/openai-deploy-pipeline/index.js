import { DashClaw, ApprovalDeniedError, GuardBlockedError } from 'dashclaw';
import dotenv from 'dotenv';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const baseUrl = process.env.DASHCLAW_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.DASHCLAW_API_KEY;
  if (!apiKey || apiKey === 'your_dashclaw_api_key') {
    console.error('Missing DASHCLAW_API_KEY in .env');
    process.exit(0);
  }

  // --- Setup ---
  const claw = new DashClaw({
    baseUrl,
    apiKey,
    agentId: 'openai-deployer-1',
  });

  const openaiKey = process.env.OPENAI_API_KEY;
  const simulateAI = !openaiKey || openaiKey === 'your_openai_api_key';
  // Lazy-loaded so the package only resolves when a real key is present.
  let openai = null;
  if (!simulateAI) {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({ apiKey: openaiKey });
  }

  const targetEnv = process.env.TARGET_ENV || 'production';
  const serviceName = process.env.SERVICE_NAME || 'auth-service-v2';

  console.log(`\n🚀 OpenAI Deploy Pipeline`);
  console.log(`   Service: ${serviceName}`);
  console.log(`   Target:  ${targetEnv}\n`);

  let actionId = null;

  try {
    // --- Step 1: Pre-flight checks ---
    console.log('[1/4] Running pre-flight checks...');
    await sleep(500);
    console.log('      + Test suite: 847 passed, 0 failed');
    console.log('      + Coverage: 94.2%');
    console.log('      + Security scan: 0 critical findings');
    console.log('      + Staging canary: healthy (p99 < 120ms)');

    // --- Step 2: AI readiness assessment ---
    let assessment;
    if (simulateAI) {
      assessment =
        'All pre-flight checks passed. Test coverage and performance metrics are within ' +
        'acceptable thresholds. Recommend proceeding with deployment.';
    } else {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content: 'You are a deployment readiness evaluator. Be brief and decisive.',
          },
          {
            role: 'user',
            content:
              `Pre-flight summary: 847 tests passed, 94.2% coverage, 0 critical CVEs, staging healthy. ` +
              `Should we deploy ${serviceName} to ${targetEnv}? Answer in 2 sentences.`,
          },
        ],
      });
      assessment = response.choices[0].message.content;
    }
    console.log(`\n[2/4] AI Readiness Assessment: ${assessment.slice(0, 120)}...`);

    // --- Step 3: Guard check ---
    console.log('\n[3/4] Guard check: deploy permission...');
    const guardResult = await claw.guard({
      action_type: 'deploy',
      declared_goal: `Deploy ${serviceName} to ${targetEnv}`,
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api', 'load-balancer'],
    });
    console.log(`      Guard decision: ${guardResult.decision}`);

    // --- Step 4: Create action + handle approval ---
    const result = await claw.createAction({
      action_type: 'deploy',
      declared_goal: `Deploy ${serviceName} to ${targetEnv}`,
      reasoning: assessment.slice(0, 300),
      risk_score: 85,
      reversible: false,
      systems_touched: ['kubernetes', 'production-api', 'load-balancer'],
    });
    actionId = result.action?.action_id || result.action_id;
    console.log(`      Action recorded: ${actionId}`);
    console.log(`      Replay: ${baseUrl}/replay/${actionId}`);

    const decision = guardResult.decision;

    if (decision === 'block') {
      console.log(`\n      Blocked by policy: ${guardResult.reasons?.[0] || 'policy violation'}`);
      console.log(`      View decision: ${baseUrl}/replay/${actionId}`);
      await claw.updateOutcome(actionId, {
        status: 'failed',
        output_summary: 'Blocked by guard policy',
      });
      process.exit(0);
    }

    if (decision === 'require_approval') {
      console.log('');
      console.log('+== DashClaw Approval Required =====================+');
      console.log(`  Action ID:   ${actionId}`);
      console.log('  Pipeline:    openai-deploy-pipeline');
      console.log(`  Service:     ${serviceName}`);
      console.log(`  Target:      ${targetEnv}`);
      console.log('  Risk Score:  85 (irreversible)');
      console.log('');
      console.log(`  Pre-flight:  PASSED (847 tests, 94.2% coverage)`);
      console.log(`  AI Assess:   ${assessment.slice(0, 80)}`);
      console.log('');
      console.log(`  Replay:      ${baseUrl}/replay/${actionId}`);
      console.log('');
      console.log(`  Approve:     dashclaw approve ${actionId}`);
      console.log(`  Deny:        dashclaw deny ${actionId}`);
      console.log('');
      console.log('  Waiting for approval... (120s timeout)');
      console.log('+===================================================+');

      try {
        await claw.waitForApproval(actionId, { timeout: 120000, interval: 3000 });
        console.log('\n      Approved by operator. Proceeding...');
      } catch (err) {
        if (err.name === 'ApprovalDeniedError') {
          console.log('\n      Denied by operator. Deploy aborted.');
          await claw.updateOutcome(actionId, {
            status: 'failed',
            output_summary: 'Denied by operator',
          });
          process.exit(0);
        }
        throw err;
      }
    }

    // --- Deploy (simulated) ---
    console.log(`\n[4/4] [Simulated] kubectl apply -f k8s/${serviceName}.yaml`);
    console.log('      Deploying to production...');
    const podSteps = [
      'Rolling update: 0/3 pods updated',
      'Rolling update: 1/3 pods updated',
      'Rolling update: 2/3 pods updated',
      'Rolling update: 3/3 pods updated',
      'Health check: passing',
    ];
    for (const step of podSteps) {
      await sleep(2000);
      console.log(`      ${step}`);
    }

    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: `Deployed ${serviceName} to ${targetEnv}. All health checks passing.`,
    });
    console.log(`\n      Deployed successfully. Audit trail: ${baseUrl}/replay/${actionId}\n`);
  } catch (error) {
    if (error.name === 'GuardBlockedError') {
      console.error(`\n      BLOCKED BY POLICY: ${error.message}`);
    } else if (error.name === 'ApprovalDeniedError') {
      console.error(`\n      DENIED BY OPERATOR: ${error.message}`);
    } else {
      console.error(`\n      Error: ${error.message}`);
    }
    if (actionId) {
      try {
        await claw.updateOutcome(actionId, {
          status: 'failed',
          output_summary: `Error: ${error.message}`,
        });
      } catch { /* best effort */ }
    }
  }
}

main();
