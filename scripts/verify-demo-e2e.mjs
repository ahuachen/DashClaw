#!/usr/bin/env node

/**
 * Demo E2E Verification Script
 *
 * Single-command end-to-end proof that the Market Intelligence Briefing
 * demo works against a live DashClaw instance. Performs the following
 * phases in order, stopping on the first phase that fails:
 *
 *   1. Prompt for DashClaw admin API key. Input is visible as you type
 *      (the readline mute trick breaks on legacy Windows PowerShell);
 *      the key is used only for this session and never written to disk.
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

// ── Prompt helper ───────────────────────────────────────────────────────────
//
// Visible input. We deliberately do NOT mute the terminal: the readline
// mute trick breaks the prompt text on legacy Windows PowerShell (conhost),
// leaving the user staring at a blinking cursor with zero context. Keys
// entered here are visible on screen as you type — same as `gh auth login`
// or `stripe login`. Since this is a local dev tool you run in your own
// terminal, that's a fair tradeoff for a prompt that actually shows up.

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
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
  info('Get a key from https://console.anthropic.com/settings/keys');
  console.log('');
  console.log(C.bold('  Paste your Anthropic API key below (or press Enter to skip).'));
  console.log(C.dim('  Format: sk-ant-api03-...'));
  console.log(C.dim('  Note: the key will be visible as you type/paste. It will be'));
  console.log(C.dim('        sent ONLY to your DashClaw instance, stored encrypted'));
  console.log(C.dim('        via POST /api/settings, and never printed back.'));
  console.log('');
  const key = await prompt('  Anthropic API key: ');
  if (!key) {
    console.log('');
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

/**
 * Auto-heal known workflow-template drift on the live DB.
 *
 * The seed script historically wrote `config.prompt` for `type: "prompt"`
 * steps, but the step handler in app/lib/step-handlers.js expects
 * `config.prompt_template` and throws "prompt step requires prompt_template"
 * at execute time. Rename the field in-place on any drifted step.
 *
 * Returns the (possibly new) steps array and a boolean indicating whether
 * anything changed.
 */
function healWorkflowSteps(steps) {
  let changed = false;
  const healed = steps.map((step) => {
    if (step.type !== 'prompt') return step;
    const config = step.config || {};
    if (config.prompt_template) return step; // already migrated
    if (!config.prompt) return step; // nothing to migrate
    changed = true;
    const { prompt, ...rest } = config;
    return { ...step, config: { ...rest, prompt_template: prompt } };
  });
  return { steps: healed, changed };
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

  // Auto-heal known step-config drift before execution. This matches the
  // endpoint-drift auto-heal pattern used for the capability layer.
  const heal = healWorkflowSteps(tmpl.steps || []);
  if (heal.changed) {
    info('Template has prompt/prompt_template drift — auto-healing ...');
    const patchRes = await apiPatch(
      `/api/workflows/templates/${templateId}`,
      { steps: heal.steps },
    );
    if (!patchRes.ok) {
      fail(`Failed to migrate workflow template (HTTP ${patchRes.status})`);
      if (patchRes.data?.error) {
        console.log(C.dim(`      ${patchRes.data.error}`));
      }
      return { success: false, steps: [] };
    }
    check('Template migrated: prompt → prompt_template');
  }

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

  const runActionId = exec.data?.action_id || null;
  return { success: !!exec.data?.success, steps, templateId, runActionId };
}

// ── Step output rendering ───────────────────────────────────────────────────
//
// After the workflow runs, we fetch the full run detail from
// /api/workflows/templates/{id}/runs/{action_id} and print what each step
// actually produced. This is the "proof it worked" section: the LLM
// briefing text, the HN stories, the webhook response, the published
// resource id — the evidence the operator cares about.

function renderStepOutput(step, lines) {
  if (!step.output) {
    lines.push(C.dim('      (no output captured)'));
    return;
  }

  const output = step.output;

  // LLM prompt step — print the briefing text verbatim with token counts.
  if (step.step_type === 'prompt') {
    const toks = [];
    if (output.tokens_in !== undefined) toks.push(`${output.tokens_in} in`);
    if (output.tokens_out !== undefined) toks.push(`${output.tokens_out} out`);
    if (toks.length) lines.push(C.dim(`      tokens: ${toks.join(' → ')}`));
    lines.push(C.dim('      ' + '─'.repeat(50)));
    const text =
      typeof output.text === 'string'
        ? output.text
        : output.content || JSON.stringify(output, null, 2);
    for (const line of text.split('\n')) lines.push(`      ${line}`);
    lines.push(C.dim('      ' + '─'.repeat(50)));
    return;
  }

  // Knowledge search — list the top matches.
  if (step.step_type === 'knowledge_search') {
    const results = output.results || output.documents || output.matches || [];
    if (Array.isArray(results) && results.length > 0) {
      lines.push(C.dim(`      ${results.length} matching document(s):`));
      for (const r of results.slice(0, 5)) {
        const title =
          r.title ||
          r.name ||
          r.document_name ||
          r.id ||
          (typeof r === 'string'
            ? r.slice(0, 100)
            : JSON.stringify(r).slice(0, 100));
        lines.push(`      · ${title}`);
      }
      if (results.length > 5) {
        lines.push(C.dim(`      ... and ${results.length - 5} more`));
      }
      return;
    }
  }

  // Capability invoke — show the whole response. The handler returns the
  // raw array for list-shaped responses (HN top stories) or the full
  // object for object-shaped ones (postman-echo, jsonplaceholder). We no
  // longer peek into output.data first because that was hiding the
  // postman-echo response body (which contains its own `data` field
  // that's the echoed payload, not the whole envelope).
  if (step.step_type === 'capability_invoke') {
    if (Array.isArray(output)) {
      lines.push(C.dim(`      array of ${output.length} items`));
      const preview = JSON.stringify(output.slice(0, 10));
      lines.push(`      ${preview}${output.length > 10 ? ' ...' : ''}`);
      return;
    }
    if (typeof output === 'object' && output !== null) {
      const json = JSON.stringify(output, null, 2);
      const truncated =
        json.length > 1500
          ? json.slice(0, 1500) + '\n      ... [truncated]'
          : json;
      for (const l of truncated.split('\n')) lines.push(C.dim(`      ${l}`));
      return;
    }
    lines.push(`      ${output}`);
    return;
  }

  // Generic JSON fallback for unknown step types.
  const json =
    typeof output === 'string' ? output : JSON.stringify(output, null, 2);
  const truncated =
    json.length > 1000 ? json.slice(0, 1000) + '\n      ... [truncated]' : json;
  for (const l of truncated.split('\n')) lines.push(C.dim(`      ${l}`));
}

async function showWorkflowOutputs(templateId, runActionId) {
  phaseHeader('What Actually Happened');

  const res = await apiGet(
    `/api/workflows/templates/${templateId}/runs/${runActionId}`,
  );
  if (!res.ok) {
    warn(`Could not fetch run detail (HTTP ${res.status}) — outputs unavailable`);
    return;
  }
  const run = res.data;
  if (!run?.steps?.length) {
    warn('Run has no step results to display');
    return;
  }

  for (const step of run.steps) {
    const label = step.step_name || step.step_id;
    const typeInfo = `${step.step_type || '?'}, ${step.duration_ms || 0}ms`;
    console.log('');
    console.log(`  ${C.bold(label)} ${C.dim(`(${typeInfo})`)}`);

    if (step.status !== 'completed') {
      const msg = step.error_message ? `: ${step.error_message}` : '';
      console.log(C.red(`      ${step.status}${msg}`));
      continue;
    }

    const lines = [];
    renderStepOutput(step, lines);
    for (const line of lines) console.log(line);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(C.bold('DashClaw Demo E2E Verification'));
  console.log(C.dim('─'.repeat(60)));
  console.log('');
  console.log(`  Target instance: ${C.cyan(BASE_URL)}`);
  console.log('');
  console.log('  This script will:');
  console.log('    1. Verify your instance is reachable and your API key works');
  console.log('    2. Make sure ANTHROPIC_API_KEY is configured (prompt if missing)');
  console.log('    3. Patch two drifted demo capability endpoints (idempotent)');
  console.log('    4. Test all 5 demo capabilities individually');
  console.log('    5. Execute the Daily Market Briefing workflow end-to-end');
  console.log('    6. Show what each step actually produced (HN stories, LLM');
  console.log('       briefing text, webhook response, published resource)');
  console.log('    7. Print a pass/fail summary');
  console.log('');
  console.log(C.bold('  Paste your DashClaw admin API key below.'));
  console.log(C.dim(`  Get it from: ${BASE_URL}/api-keys`));
  console.log(C.dim('  Format: oc_live_... (or oc_test_... for test keys)'));
  console.log(C.dim('  Note: the key will be visible as you type/paste. It is used'));
  console.log(C.dim('        only for this session and never written to disk.'));
  console.log('');

  API_KEY = await prompt('  DashClaw API key: ');
  if (!API_KEY) {
    console.log('');
    console.error(C.red('  No API key provided. Exiting.'));
    console.log('');
    process.exit(1);
  }
  console.log('');

  await checkHealth();
  await ensureAnthropicKey();
  await syncCapabilityEndpoints();
  const capResults = await testEachCapability();
  const workflow = await executeWorkflow();

  // Show the actual outputs from each step if the run produced any, even
  // when the overall workflow failed — partial outputs still tell the
  // operator what worked and where it broke.
  if (workflow.runActionId) {
    await showWorkflowOutputs(workflow.templateId, workflow.runActionId);
  }

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
