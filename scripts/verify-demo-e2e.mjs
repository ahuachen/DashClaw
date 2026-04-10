#!/usr/bin/env node

/**
 * Demo E2E Verification Script
 *
 * Single-command end-to-end proof that the Market Intelligence Briefing
 * demo works against a live DashClaw instance. Performs the following
 * phases in order, stopping on the first phase that fails:
 *
 *   1. Prompt for DashClaw admin API key (hidden input).
 *   2. Health check the instance and confirm the key is accepted.
 *   3. Check whether ANTHROPIC_API_KEY is configured. If missing,
 *      prompt the user for one and POST it to /api/settings (encrypted)
 *      so the workflow analyze step can reach Claude.
 *   4. Idempotently patch the two demo capabilities whose seeded
 *      endpoints drifted (Team Notification, Publish Briefing).
 *   5. Run a single capability test against each of the 5 demo
 *      capabilities and report pass/fail per capability.
 *   6. Execute the "Daily Market Briefing" workflow end-to-end via
 *      /api/workflows/templates/{id}/execute and print per-step status.
 *   7. Print a summary line and exit 0 on full pass, 1 on any failure.
 *
 * Usage:
 *   node scripts/verify-demo-e2e.mjs
 *   node scripts/verify-demo-e2e.mjs --url https://my-dashclaw.vercel.app
 *
 * The default base URL is https://my-dashclaw.vercel.app. Override with
 * --url or the DASHCLAW_URL environment variable.
 *
 * Safety notes:
 *   - Only reads and masks settings; never prints the API key back.
 *   - Only patches capability rows whose endpoint matches the known-
 *     broken value, so custom endpoints are left alone.
 *   - The workflow execution uses real LLM tokens on your configured
 *     Anthropic account (roughly 1-5 cents per run at current prices).
 */

import readline from 'node:readline';
import { stdin, stdout } from 'node:process';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// ── CLI + config ────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getArg(flag) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return null;
}

const DEFAULT_URL = 'https://my-dashclaw.vercel.app';
const BASE_URL = (
  getArg('--url') ||
  process.env.DASHCLAW_URL ||
  DEFAULT_URL
).replace(/\/$/, '');

// ── Colors (minimal ANSI, no deps) ──────────────────────────────────────────

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function check(label) { console.log(`  ${C.green('ok')}  ${label}`); }
function fail(label) { console.log(`  ${C.red('xx')}  ${label}`); }
function warn(label) { console.log(`  ${C.yellow('!!')}  ${label}`); }
function info(label) { console.log(`  ${C.dim('..')}  ${C.dim(label)}`); }

function phaseHeader(title) {
  console.log('');
  console.log(C.bold(`── ${title} `.padEnd(60, '─')));
}

// ── Prompt helpers ──────────────────────────────────────────────────────────

function promptHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
      terminal: true,
    });
    // Suppress echo of the user's typed characters. The user knows what
    // they're typing; missing echo is preferable to broken asterisk
    // animation on Windows terminals that don't handle cursor rewrites.
    rl._writeToOutput = () => {};
    rl.question('', (answer) => {
      rl.close();
      stdout.write('\n');
      resolve((answer || '').trim());
    });
  });
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

let API_KEY = '';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };
}

async function apiRequest(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore non-JSON bodies */
  }
  return { ok: res.ok, status: res.status, data };
}

const apiGet = (path) => apiRequest('GET', path);
const apiPost = (path, body) => apiRequest('POST', path, body);
const apiPatch = (path, body) => apiRequest('PATCH', path, body);

// ── Phases ──────────────────────────────────────────────────────────────────

async function checkHealth() {
  phaseHeader('Prerequisites');
  info(`Target: ${BASE_URL}`);
  const res = await apiGet('/api/capabilities');
  if (!res.ok) {
    fail(`Instance unreachable or API key rejected (HTTP ${res.status})`);
    if (res.error) console.log(C.dim(`      ${res.error}`));
    if (res.data?.error) console.log(C.dim(`      ${res.data.error}`));
    process.exit(1);
  }
  const count = res.data?.capabilities?.length || 0;
  check(`Instance reachable, API key accepted (${count} capabilities visible)`);
}

async function ensureAnthropicKey() {
  phaseHeader('LLM Configuration');
  const res = await apiGet('/api/settings?key=ANTHROPIC_API_KEY');
  const setting = res.data?.settings?.find((s) => s.key === 'ANTHROPIC_API_KEY');
  if (setting?.hasValue) {
    check('ANTHROPIC_API_KEY already configured on instance');
    return true;
  }

  warn('ANTHROPIC_API_KEY is not configured on the live instance');
  info('The workflow analyze step uses Claude Sonnet and will fail without it.');
  const key = await promptHidden('      Anthropic API key (sk-ant-..., or Enter to skip): ');
  if (!key) {
    warn('Skipping — the analyze step will fail without an LLM key');
    return false;
  }
  if (!key.startsWith('sk-ant-')) {
    warn('Key does not start with "sk-ant-" — continuing anyway, but it may be invalid');
  }

  const post = await apiPost('/api/settings', {
    key: 'ANTHROPIC_API_KEY',
    value: key,
    category: 'llm',
    encrypted: true,
  });
  if (!post.ok) {
    fail(`Failed to save ANTHROPIC_API_KEY (HTTP ${post.status})`);
    if (post.data?.error) console.log(C.dim(`      ${post.data.error}`));
    process.exit(1);
  }
  check('ANTHROPIC_API_KEY saved (encrypted) on instance');
  return true;
}

const ENDPOINT_PATCHES = [
  {
    name: 'Team Notification',
    old: 'https://httpbin.org/post',
    new: 'https://postman-echo.com/post',
  },
  {
    name: 'Publish Briefing',
    old: 'https://dpaste.org/api/',
    new: 'https://jsonplaceholder.typicode.com/posts',
  },
];

async function syncCapabilityEndpoints() {
  phaseHeader('Sync Capability Endpoints');

  for (const plan of ENDPOINT_PATCHES) {
    const search = await apiGet(
      `/api/capabilities?search=${encodeURIComponent(plan.name)}`,
    );
    const cap = search.data?.capabilities?.find((c) => c.name === plan.name);
    if (!cap) {
      warn(`${plan.name}: not found (skip)`);
      continue;
    }
    const schema = cap.invocation_schema || {};
    if (schema.endpoint === plan.new) {
      check(`${plan.name}: already on ${plan.new}`);
      continue;
    }
    if (schema.endpoint !== plan.old) {
      info(`${plan.name}: custom endpoint ${schema.endpoint} — leaving alone`);
      continue;
    }
    const patchRes = await apiPatch(
      `/api/capabilities/${cap.capability_id || cap.id}`,
      { invocation_schema: { ...schema, endpoint: plan.new } },
    );
    if (!patchRes.ok) {
      fail(`${plan.name}: PATCH failed (HTTP ${patchRes.status})`);
      if (patchRes.data?.error) {
        console.log(C.dim(`      ${patchRes.data.error}`));
      }
      process.exit(1);
    }
    check(`${plan.name}: ${plan.old} → ${plan.new}`);
  }
}

const DEMO_CAPABILITIES = [
  'Hacker News Top Stories',
  'HN Story Detail',
  'IP Geolocation',
  'Team Notification',
  'Publish Briefing',
];

async function testEachCapability() {
  phaseHeader('Individual Capability Tests');
  let passed = 0;
  let failed = 0;

  for (const name of DEMO_CAPABILITIES) {
    const search = await apiGet(
      `/api/capabilities?search=${encodeURIComponent(name)}`,
    );
    const cap = search.data?.capabilities?.find((c) => c.name === name);
    if (!cap) {
      warn(`${name}: not found (skip)`);
      continue;
    }
    const test = await apiPost(
      `/api/capabilities/${cap.capability_id || cap.id}/test`,
      {
        payload: {},
        declared_goal: `E2E verification: ${name}`,
        agent_id: 'demo-e2e-verifier',
      },
    );
    if (test.data?.success) {
      const ms = test.data.elapsed_ms ? ` (${test.data.elapsed_ms}ms)` : '';
      check(`${name}${ms}`);
      passed += 1;
    } else {
      const msg = test.data?.message || test.data?.error || `HTTP ${test.status}`;
      fail(`${name}: ${msg}`);
      failed += 1;
    }
  }

  return { passed, failed };
}

async function executeWorkflow() {
  phaseHeader('Daily Market Briefing Workflow');

  const templates = await apiGet('/api/workflows/templates');
  const tmpl = templates.data?.templates?.find(
    (t) => t.name === 'Daily Market Briefing',
  );
  if (!tmpl) {
    fail(
      'Template "Daily Market Briefing" not found. Run `node scripts/seed-demo-capabilities.mjs` first.',
    );
    return { success: false, steps: [] };
  }
  const templateId = tmpl.template_id || tmpl.id;
  info(`Template: ${tmpl.name} (${templateId})`);
  info('Executing workflow (up to 120s) ...');

  const exec = await apiPost(
    `/api/workflows/templates/${templateId}/execute`,
    {
      agent_id: 'demo-e2e-verifier',
      declared_goal: 'E2E verification of Daily Market Briefing workflow',
      variables: {},
    },
  );

  const steps = exec.data?.steps || [];
  const totalMs = exec.data?.total_elapsed_ms;

  if (exec.data?.success) {
    const tms = totalMs ? ` in ${totalMs}ms` : '';
    check(`Workflow completed${tms}`);
  } else {
    const msg = exec.data?.error || `HTTP ${exec.status}`;
    fail(`Workflow did not complete: ${msg}`);
  }

  // Always print per-step status if we have it
  for (const step of steps) {
    const mark =
      step.status === 'completed'
        ? C.green('ok')
        : step.status === 'failed'
          ? C.red('xx')
          : C.yellow('..');
    const ms = step.elapsed_ms ? ` (${step.elapsed_ms}ms)` : '';
    const label = step.step_name || step.step_id || '<step>';
    const suffix = step.error ? ` — ${C.dim(step.error)}` : '';
    console.log(`      ${mark} ${label}${ms}${suffix}`);
  }

  return { success: !!exec.data?.success, steps };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(C.bold('DashClaw Demo E2E Verification'));
  console.log(C.dim('─'.repeat(60)));

  API_KEY = await promptHidden(
    '  DashClaw admin API key (oc_live_...): ',
  );
  if (!API_KEY) {
    console.error(C.red('No API key provided. Exiting.'));
    process.exit(1);
  }

  await checkHealth();
  await ensureAnthropicKey();
  await syncCapabilityEndpoints();
  const capResults = await testEachCapability();
  const workflow = await executeWorkflow();

  phaseHeader('Summary');
  console.log(
    `  Capability tests: ${
      capResults.failed === 0
        ? C.green(`${capResults.passed}/${capResults.passed}`)
        : C.red(`${capResults.passed}/${capResults.passed + capResults.failed}`)
    }`,
  );
  console.log(
    `  Workflow run:     ${workflow.success ? C.green('passed') : C.red('failed')}`,
  );
  console.log('');

  const allGreen = capResults.failed === 0 && workflow.success;
  if (allGreen) {
    console.log(C.bold(C.green('  DEMO VERIFIED END-TO-END')));
    console.log('');
    process.exit(0);
  } else {
    console.log(C.bold(C.red('  DEMO VERIFICATION FAILED')));
    console.log(
      C.dim(
        '  Review the failing phase above, fix the underlying issue, and re-run.',
      ),
    );
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(C.red('Script failed:'), err?.message || err);
  process.exit(1);
});
