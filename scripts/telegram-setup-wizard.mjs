#!/usr/bin/env node
/**
 * Interactive setup wizard for the Telegram approval bridge.
 *
 * Walks the operator through every step of wiring up a bot to their
 * DashClaw deploy:
 *   1. Prompts for the @BotFather token
 *   2. Auto-discovers the admin chat ID via getUpdates
 *   3. Generates the webhook secret
 *   4. Prints the four env vars to paste into Vercel
 *   5. Optionally writes a local .env
 *   6. Registers the webhook with Telegram's Bot API
 *   7. Optionally runs the round-trip smoke test
 *
 * Usage: npm run telegram:setup
 */

import readline from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { writeFile, readFile, access, constants } from 'node:fs/promises';
import { stdin as input, stdout as output } from 'node:process';

const TELEGRAM_API = 'https://api.telegram.org';
const rl = readline.createInterface({ input, output });

function log(s = '') { output.write(s + '\n'); }
function err(s) { process.stderr.write(s + '\n'); }

async function ask(q, def) {
  const prompt = def !== undefined ? `${q} [${def}] ` : `${q} `;
  const raw = await rl.question(prompt);
  const trimmed = raw.trim();
  return trimmed || def || '';
}

async function askYesNo(q, defYes = true) {
  const suffix = defYes ? ' [Y/n] ' : ' [y/N] ';
  const raw = (await rl.question(q + suffix)).trim().toLowerCase();
  if (!raw) return defYes;
  return raw.startsWith('y');
}

async function askSecret(q) {
  // Node's readline doesn't mask input. We do a best-effort by not echoing
  // the bot token back. For a wizard run by the operator on their own
  // machine, visible echo is acceptable; real security comes from the
  // operator's shell history hygiene.
  return (await rl.question(q + ' ')).trim();
}

function redact(s, keep = 4) {
  if (!s || s.length < keep * 2) return '[hidden]';
  return `${s.slice(0, keep)}...${s.slice(-keep)}`;
}

async function tgCall(token, method, body) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

async function validateToken(token) {
  try {
    const me = await tgCall(token, 'getMe');
    return me;
  } catch (e) {
    return null;
  }
}

async function step1_Token() {
  log('\n=== Step 1 of 7: Create the bot ===\n');
  log('  1. Open Telegram (phone or desktop).');
  log('  2. Message @BotFather:  https://t.me/BotFather');
  log('  3. Send  /newbot');
  log('  4. Pick a display name, then a username ending in "bot".');
  log('  5. BotFather will reply with an HTTP API token.');
  log('');

  for (let attempt = 0; attempt < 3; attempt++) {
    const token = await askSecret('Paste your bot token:');
    if (!token) {
      err('  Token is required.');
      continue;
    }
    process.stdout.write('  Validating with Telegram...');
    const me = await validateToken(token);
    if (!me) {
      log(' ✗');
      err('  That token was rejected by Telegram. Try again.');
      continue;
    }
    log(` ✓  (bot: @${me.username})`);
    return { token, bot: me };
  }
  throw new Error('Failed to validate bot token after 3 attempts.');
}

async function ensureGetUpdatesWorks(token) {
  // If a webhook is registered, getUpdates returns an error. Detect and offer
  // to remove the webhook so discovery can proceed. We'll re-register at the
  // end of the wizard.
  const info = await tgCall(token, 'getWebhookInfo');
  if (info?.url) {
    log(`\n  Note: a webhook is currently registered at ${info.url}`);
    log('  I need to remove it temporarily so I can read your chat ID from');
    log('  Telegram. I will re-register a new webhook at the end.');
    const proceed = await askYesNo('  OK to temporarily remove the existing webhook?', true);
    if (!proceed) throw new Error('Cannot discover chat ID while webhook is active.');
    await tgCall(token, 'deleteWebhook', { drop_pending_updates: false });
    log('  ✓ Existing webhook cleared.');
  }
}

async function step2_ChatId(token, bot) {
  log('\n=== Step 2 of 7: Discover your admin chat ID ===\n');
  await ensureGetUpdatesWorks(token);
  log('');
  log(`  Open a chat with @${bot.username} (the bot you just created —`);
  log('  NOT BotFather) and send it any message. "hi" works.');
  log('');

  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt === 0) {
      await rl.question('  Press Enter once you\'ve messaged the bot... ');
    }
    process.stdout.write('  Checking for your message...');
    const updates = await tgCall(token, 'getUpdates');
    const chats = new Map();
    for (const u of updates || []) {
      const m = u.message || u.edited_message;
      if (!m || !m.chat) continue;
      chats.set(m.chat.id, { chat: m.chat, from: m.from });
    }
    log(` found ${chats.size} chat(s).`);

    if (chats.size === 0) {
      err('  No messages from you yet. Send one to the bot and try again.');
      if (attempt < 4) await rl.question('  Press Enter to retry... ');
      continue;
    }

    if (chats.size === 1) {
      const [[id, { chat, from }]] = [...chats];
      log(`  ✓ Found: ${chat.type} chat, id=${id}${from?.username ? ` (@${from.username})` : ''}`);
      if (chat.type !== 'private') {
        err('  WARNING: this is a group/channel. Telegram approval only works in');
        err('  a 1:1 DM with the bot — group chat.id ≠ user.id and the allowlist');
        err('  check will reject every callback. Start a DM with the bot and retry.');
        if (await askYesNo('  Use this chat ID anyway?', false)) return String(id);
        continue;
      }
      return String(id);
    }

    log('  Multiple chats found:');
    const list = [...chats.entries()];
    list.forEach(([id, { chat, from }], i) => {
      log(`    ${i + 1}. id=${id} (${chat.type}${from?.username ? `, @${from.username}` : ''})`);
    });
    const pick = await ask('  Pick one (number):', '1');
    const idx = Math.max(1, Math.min(list.length, parseInt(pick, 10) || 1)) - 1;
    return String(list[idx][0]);
  }
  throw new Error('Could not discover a chat ID.');
}

function step3_Secret() {
  log('\n=== Step 3 of 7: Generate webhook secret ===\n');
  const secret = randomBytes(32).toString('hex');
  log(`  ✓ Generated 64-char secret: ${redact(secret, 6)}`);
  return secret;
}

async function step4_DeployConfig() {
  log('\n=== Step 4 of 7: DashClaw deploy ===\n');
  let baseUrl;
  for (;;) {
    baseUrl = await ask('  Your DashClaw deploy URL (e.g. https://my-dashclaw.vercel.app):');
    if (!baseUrl) { err('  Required.'); continue; }
    if (!/^https:\/\//.test(baseUrl)) {
      err('  Must start with https:// (Telegram won\'t call http URLs).');
      continue;
    }
    baseUrl = baseUrl.replace(/\/$/, '');
    break;
  }
  const orgId = await ask('  Your org ID (for self-hosted single-tenant, use org_default):', 'org_default');
  return { baseUrl, orgId };
}

function printEnvBlock({ token, chatId, secret, orgId }) {
  log('  Copy these into your Vercel Environment Variables (Production scope):\n');
  log('  ─────────────────────────────────────────────────────────────');
  log(`  TELEGRAM_BOT_TOKEN=${token}`);
  log(`  TELEGRAM_ADMIN_CHAT_ID=${chatId}`);
  log(`  TELEGRAM_WEBHOOK_SECRET=${secret}`);
  log(`  TELEGRAM_APPROVER_ORG_ID=${orgId}`);
  log('  ─────────────────────────────────────────────────────────────\n');
  log('  Tip: scope them to Production only — don\'t mirror to Preview,');
  log('  or a preview deploy can steal the webhook from prod.');
  log('');
  log('  After adding, redeploy so the new env vars take effect.');
}

async function maybeWriteLocalEnv(values) {
  if (!(await askYesNo('  Also write these to a local .env for dev?', false))) return;
  const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
  let existing = '';
  try {
    await access(envPath, constants.F_OK);
    existing = await readFile(envPath, 'utf8');
  } catch { /* no existing .env */ }

  const updates = {
    TELEGRAM_BOT_TOKEN: values.token,
    TELEGRAM_ADMIN_CHAT_ID: values.chatId,
    TELEGRAM_WEBHOOK_SECRET: values.secret,
    TELEGRAM_APPROVER_ORG_ID: values.orgId,
  };

  let updated = existing;
  for (const [k, v] of Object.entries(updates)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, 'm');
    if (re.test(updated)) updated = updated.replace(re, line);
    else updated = (updated && !updated.endsWith('\n') ? updated + '\n' : updated) + line + '\n';
  }

  if (!existing) {
    updated = '# DashClaw local dev env — DO NOT COMMIT\n' + updated;
  }
  await writeFile(envPath, updated, 'utf8');
  log(`  ✓ Updated ${envPath}`);
}

async function step5_EnvVars(values) {
  log('\n=== Step 5 of 7: Environment variables ===\n');
  printEnvBlock(values);
  await rl.question('  Press Enter once you\'ve set these on Vercel (or skip for dev-only)... ');
  await maybeWriteLocalEnv(values);
}

async function step6_RegisterWebhook({ token, secret, baseUrl }) {
  log('\n=== Step 6 of 7: Register the webhook with Telegram ===\n');
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  log(`  Target: ${webhookUrl}`);

  const info = await tgCall(token, 'getWebhookInfo');
  if (info?.url && info.url !== webhookUrl) {
    log(`  Existing webhook: ${info.url}`);
    if (!(await askYesNo('  Replace it with the new one?', true))) {
      err('  Skipped. You can register manually later with `npm run telegram:register`.');
      return;
    }
  }

  await tgCall(token, 'setWebhook', { url: webhookUrl, secret_token: secret });
  log('  ✓ Webhook registered.');
}

async function step7_SmokeTest({ baseUrl }) {
  log('\n=== Step 7 of 7: Round-trip smoke test (optional) ===\n');
  log('  I can create a test approval right now. It\'ll hit your phone as a');
  log('  Telegram message with ✅ Approve / ❌ Reject buttons.');
  log('');
  if (!(await askYesNo('  Run the smoke test now?', true))) return;

  let apiKey = process.env.DASHCLAW_API_KEY;
  if (!apiKey) {
    log('');
    log('  I need a DASHCLAW_API_KEY to create the test action. Get one from');
    log(`  ${baseUrl}/settings (API Keys section) if you don't have one.`);
    apiKey = await askSecret('  Paste your DASHCLAW_API_KEY (oc_live_...):');
    if (!apiKey) { err('  Skipped.'); return; }
  }

  const actionId = `act_setup${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
  log(`\n  Creating synthetic action ${actionId}...`);
  const create = await fetch(`${baseUrl}/api/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      action_id: actionId,
      agent_id: 'telegram-setup-wizard',
      action_type: 'deploy',
      declared_goal: 'telegram:setup wizard round-trip test',
      risk_score: 80,
      reversible: false,
      status: 'pending_approval',
    }),
  });
  if (!create.ok) {
    err(`  Failed to create action: ${create.status} ${await create.text()}`);
    err('  Most likely causes: env vars not set on Vercel yet, or redeploy');
    err('  hasn\'t finished. Wait 30s and re-run `npm run telegram:verify`.');
    return;
  }
  log('  ✓ Action created. Check your phone for the Telegram message.');
  log('  Tap Approve or Reject — I\'ll wait up to 5 minutes.');

  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000;
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await fetch(`${baseUrl}/api/actions/${actionId}`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!r.ok) continue;
    const { action } = await r.json();
    if (action?.status && action.status !== 'pending_approval') {
      const s = ((Date.now() - start) / 1000).toFixed(1);
      log(`\n  ✅ Round-trip succeeded in ${s}s — final status: ${action.status}`);
      try {
        await fetch(`${baseUrl}/api/actions?action_id=${actionId}`, {
          method: 'DELETE',
          headers: { 'x-api-key': apiKey },
        });
      } catch { /* best-effort cleanup */ }
      return;
    }
  }
  err('\n  ⌛ Timed out. The webhook may not be live yet — if you just saved env');
  err('  vars on Vercel, wait for the redeploy to finish and re-run `npm run telegram:verify`.');
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════╗');
  log('║   DashClaw Telegram Approval Setup Wizard                    ║');
  log('╚══════════════════════════════════════════════════════════════╝\n');
  log('This wizard takes ~3 minutes. You\'ll need Telegram (phone or desktop)');
  log('and your DashClaw deploy URL. You can Ctrl-C at any time.\n');
  if (!(await askYesNo('Ready to start?', true))) { rl.close(); return; }

  const { token, bot } = await step1_Token();
  const chatId = await step2_ChatId(token, bot);
  const secret = step3_Secret();
  const { baseUrl, orgId } = await step4_DeployConfig();
  await step5_EnvVars({ token, chatId, secret, orgId });
  await step6_RegisterWebhook({ token, secret, baseUrl });
  await step7_SmokeTest({ baseUrl });

  log('\n╔══════════════════════════════════════════════════════════════╗');
  log('║   All set. Every pending_approval will now ping your phone.  ║');
  log('╚══════════════════════════════════════════════════════════════╝\n');
  log('Kill switch: set DASHCLAW_ALERTS_TELEGRAM=false on Vercel to disable');
  log('without removing the token. See docs/telegram-setup.md for details.\n');
  rl.close();
}

main().catch((e) => {
  err(`\n✗ ${e.message}`);
  rl.close();
  process.exit(1);
});
