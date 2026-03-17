#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { DashClaw } from 'dashclaw';
import {
  bold, dim, inverse, colorByRisk, clearScreen,
  moveCursor, hideCursor, showCursor,
  green, red,
} from '../lib/render.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// -- Config -------------------------------------------------------------------

const baseUrl = process.env.DASHCLAW_BASE_URL;
const apiKey = process.env.DASHCLAW_API_KEY;
const agentId = process.env.DASHCLAW_AGENT_ID || 'cli-operator';

function requireEnv() {
  const missing = [];
  if (!baseUrl) missing.push('DASHCLAW_BASE_URL');
  if (!apiKey) missing.push('DASHCLAW_API_KEY');
  if (missing.length) {
    console.error(`Error: Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('Set them in your shell or a .env file.');
    process.exit(1);
  }
}

function createClient() {
  requireEnv();
  return new DashClaw({ baseUrl, apiKey, agentId });
}

// -- Argv Parsing -------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0] || 'help';

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

// -- Commands -----------------------------------------------------------------

async function cmdHelp() {
  console.log(`
${bold('DashClaw CLI')} — terminal approval client

${bold('Usage:')}
  dashclaw approvals                     Interactive approval inbox
  dashclaw approve <actionId> [--reason]  Approve an action
  dashclaw deny <actionId> [--reason]     Deny an action
  dashclaw help                          Show this help

${bold('Environment:')}
  DASHCLAW_BASE_URL   (required) DashClaw instance URL
  DASHCLAW_API_KEY    (required) API key for authentication
  DASHCLAW_AGENT_ID   (optional) Operator identity (default: cli-operator)
`);
}

async function cmdApprove() {
  const actionId = args[1];
  if (!actionId) {
    console.error('Error: Missing action ID. Usage: dashclaw approve <actionId>');
    process.exit(1);
  }
  const reason = getFlag('--reason');
  const claw = createClient();

  try {
    await claw.approveAction(actionId, 'allow', reason);
    console.log(`\n  ${green('Approved:')} ${actionId}`);
    console.log(`  Replay:   ${baseUrl}/replay/${actionId}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdDeny() {
  const actionId = args[1];
  if (!actionId) {
    console.error('Error: Missing action ID. Usage: dashclaw deny <actionId>');
    process.exit(1);
  }
  const reason = getFlag('--reason');
  const claw = createClient();

  try {
    await claw.approveAction(actionId, 'deny', reason);
    console.log(`\n  ${red('Denied:')}  ${actionId}`);
    console.log(`  Replay:  ${baseUrl}/replay/${actionId}\n`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdApprovals() {
  const claw = createClient();

  let items = [];
  let selected = 0;

  async function fetchPending() {
    try {
      const result = await claw.getPendingApprovals(50);
      items = result.actions || [];
    } catch (err) {
      console.error(`Error fetching approvals: ${err.message}`);
      process.exit(1);
    }
  }

  function render() {
    clearScreen();
    moveCursor(1, 1);
    process.stdout.write(bold('DashClaw Approval Inbox') + '\n\n');

    if (items.length === 0) {
      process.stdout.write(dim('  No pending approvals.\n'));
      process.stdout.write(dim('  Press R to refresh, Q to quit.\n'));
    } else {
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const id = a.action_id || a.id || '?';
        const type = a.action_type || '-';
        const agent = a.agent_id || '-';
        const goal = (a.declared_goal || '-').slice(0, 60);
        const risk = a.risk_score != null ? colorByRisk(a.risk_score) : dim('-');

        const line = `  [${i + 1}] ${type} | ${agent} | ${goal} | risk: ${risk}`;
        process.stdout.write((i === selected ? inverse(line) : line) + '\n');
      }
    }

    process.stdout.write('\n' + dim('  [A] Approve  [D] Deny  [R] Refresh  [O] Open Replay  [Q] Quit') + '\n');
  }

  function openReplay(actionId) {
    const url = `${baseUrl}/replay/${actionId}`;
    if (!/^https?:\/\/[^\s]+$/.test(url)) {
      process.stdout.write(`\n  Invalid URL, cannot open browser.\n`);
      return;
    }
    try {
      const platform = process.platform;
      if (platform === 'darwin') execFileSync('open', [url]);
      else if (platform === 'win32') execFileSync('cmd', ['/c', 'start', '', url]);
      else execFileSync('xdg-open', [url]);
    } catch (_) {
      process.stdout.write(`\n  Could not open browser. URL: ${url}\n`);
    }
  }

  await fetchPending();

  // Open SSE stream for live push of new approval requests
  let stream = null;
  try {
    stream = claw.events()
      .on('guard.decision.created', (data) => {
        if (data.decision !== 'require_approval') return;
        const exists = items.some((it) => (it.action_id || it.id) === data.action_id);
        if (exists) return;
        items.push(data);
        render();
      })
      .on('error', () => {
        moveCursor(items.length + 6, 1);
        process.stdout.write(dim('  SSE stream error — live push unavailable, use R to refresh') + '\n');
      });
  } catch (_) {
    // SSE unavailable — inbox still works via manual refresh
  }

  // Set up raw mode for interactive input
  if (!process.stdin.isTTY) {
    console.error('Error: Interactive mode requires a TTY. Use dashclaw approve/deny for non-interactive use.');
    process.exit(1);
  }

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  hideCursor();

  // Ensure cleanup on exit
  function cleanup() {
    if (stream) stream.close();
    showCursor();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\n');
  }
  process.on('exit', cleanup);
  process.on('SIGINT', () => process.exit(0));

  render();

  let busy = false;

  process.stdin.on('data', async (key) => {
    if (busy) return;

    // Ctrl+C
    if (key === '\x03') {
      process.exit(0);
    }

    // Arrow keys: escape sequences
    if (key === '\x1b[A') {
      // Up
      if (selected > 0) selected--;
      render();
      return;
    }
    if (key === '\x1b[B') {
      // Down
      if (selected < items.length - 1) selected++;
      render();
      return;
    }

    const ch = key.toLowerCase();

    if (ch === 'q') {
      process.exit(0);
    }

    if (ch === 'r') {
      busy = true;
      await fetchPending();
      selected = Math.min(selected, Math.max(0, items.length - 1));
      render();
      busy = false;
      return;
    }

    if (items.length === 0) return;
    const current = items[selected];
    const actionId = current.action_id || current.id;

    if (ch === 'a') {
      busy = true;
      try {
        await claw.approveAction(actionId, 'allow');
        items.splice(selected, 1);
        selected = Math.min(selected, Math.max(0, items.length - 1));
      } catch (err) {
        moveCursor(items.length + 5, 1);
        process.stdout.write(red(`  Error: ${err.message}`) + '\n');
      }
      render();
      busy = false;
      return;
    }

    if (ch === 'd') {
      busy = true;
      try {
        await claw.approveAction(actionId, 'deny');
        items.splice(selected, 1);
        selected = Math.min(selected, Math.max(0, items.length - 1));
      } catch (err) {
        moveCursor(items.length + 5, 1);
        process.stdout.write(red(`  Error: ${err.message}`) + '\n');
      }
      render();
      busy = false;
      return;
    }

    if (ch === 'o') {
      openReplay(actionId);
      return;
    }
  });
}

// -- Router -------------------------------------------------------------------

switch (command) {
  case 'approvals':
    cmdApprovals();
    break;
  case 'approve':
    cmdApprove();
    break;
  case 'deny':
    cmdDeny();
    break;
  case 'help':
  case '--help':
  case '-h':
    cmdHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    cmdHelp();
    process.exit(1);
}
