import { slackAdapter } from './slack.js';
import { discordAdapter } from './discord.js';
import { linearAdapter } from './linear.js';
import { githubAdapter } from './github.js';
import { emailAdapter } from './email.js';

export const ADAPTERS = [
  slackAdapter,
  discordAdapter,
  linearAdapter,
  githubAdapter,
  emailAdapter,
];

/**
 * Deliver signals through all configured and enabled native adapters.
 * @returns {{ provider: string, success: boolean, message: string }[]}
 */
export async function deliverNativeNotifications(orgId, signals, settings, sql) {
  const creds = {};
  for (const s of settings) creds[s.key] = s.value;

  const results = [];
  for (const adapter of ADAPTERS) {
    const hasKey = adapter.requiredKeys.some(k => creds[k]);
    if (!hasKey) continue;

    const enabledKey = `DASHCLAW_ALERTS_${adapter.name.toUpperCase()}`;
    if (creds[enabledKey] === 'false') continue;

    try {
      const result = await adapter.send(signals, creds, orgId);
      results.push({ provider: adapter.name, ...result });
    } catch (err) {
      results.push({ provider: adapter.name, success: false, message: err.message });
    }
  }
  return results;
}
