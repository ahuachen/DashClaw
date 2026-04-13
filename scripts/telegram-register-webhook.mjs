#!/usr/bin/env node
/**
 * One-shot: registers the DashClaw Telegram webhook with the Bot API.
 *
 * Usage:
 *   npm run telegram:register -- --url https://my-dashclaw.vercel.app
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from env.
 */

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : null;
const force = args.includes('--force');

if (!baseUrl) {
  console.error('Usage: npm run telegram:register -- --url https://your-instance.vercel.app [--force]');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN env var is required');
  process.exit(1);
}
if (!secret) {
  console.error('TELEGRAM_WEBHOOK_SECRET env var is required');
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;

// Check current webhook — prevents preview deploys from silently stealing
// the production webhook registration.
const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const infoData = await infoRes.json();
const existingUrl = infoData?.result?.url || '';

console.log(`Current webhook URL: ${existingUrl || '(none)'}`);
console.log(`Target webhook URL:  ${webhookUrl}`);

if (existingUrl && existingUrl !== webhookUrl && !force) {
  console.error(
    `\nWebhook is currently registered at ${existingUrl}.\n` +
    `To replace with ${webhookUrl}, rerun with --force.`
  );
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
process.exit(data.ok ? 0 : 1);
