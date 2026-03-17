/**
 * Real-time action alerts — fires Discord (and future adapters) immediately
 * when a high-risk, blocked, or approval-required action is recorded.
 * Always fire-and-forget; never throws.
 */

const RISK_ALERT_THRESHOLD = 75;

const STATUS_EMOJI = {
  blocked: '🚫',
  pending_approval: '⏳',
  high_risk: '⚠️',
};

const STATUS_COLOR = {
  blocked: 0xff3333,
  pending_approval: 0xffaa00,
  high_risk: 0xff6600,
};

function buildEmbed(action, alertType) {
  const emoji = STATUS_EMOJI[alertType];
  const color = STATUS_COLOR[alertType];
  const label =
    alertType === 'blocked' ? 'BLOCKED by policy' :
    alertType === 'pending_approval' ? 'Requires approval' :
    `High risk (score: ${action.risk_score ?? '?'})`;

  return {
    title: `${emoji} DashClaw: ${label}`,
    color,
    fields: [
      { name: 'Agent', value: action.agent_id || 'unknown', inline: true },
      { name: 'Type', value: action.action_type || 'unknown', inline: true },
      { name: 'Risk Score', value: String(action.risk_score ?? 0), inline: true },
      { name: 'Goal', value: (action.declared_goal || '—').slice(0, 200), inline: false },
      ...(action.action_id ? [{ name: 'Action ID', value: action.action_id, inline: false }] : []),
    ],
    timestamp: new Date().toISOString(),
  };
}

async function getDiscordWebhookUrl(sql, orgId) {
  try {
    const { getSettings } = await import('./repositories/settings.repository.js');
    const { decrypt } = await import('./encryption.js');

    // Check alerts are not explicitly disabled
    const toggleRows = await getSettings(sql, orgId, { key: 'DASHCLAW_ALERTS_DISCORD' });
    if (toggleRows?.[0]?.value === 'false') return null;

    const rows = await getSettings(sql, orgId, { key: 'DISCORD_WEBHOOK_URL' });
    const row = rows?.[0];
    if (!row?.value) return null;

    const url = row.encrypted
      ? decrypt(row.value, `${orgId}:DISCORD_WEBHOOK_URL`)
      : row.value;

    if (!url || !url.startsWith('https://discord.com/api/webhooks/')) return null;
    return url;
  } catch {
    return null;
  }
}

async function postToDiscord(webhookUrl, embed) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok && res.status !== 204) {
    console.warn(`[ActionAlerts] Discord returned ${res.status}`);
  }
}

/**
 * Fire a real-time alert for a notable action event.
 * @param {'blocked'|'pending_approval'|'high_risk'} alertType
 * @param {object} action - the action record
 * @param {object} sql - db handle
 * @param {string} orgId
 */
export function fireActionAlert(alertType, action, sql, orgId) {
  // Only alert high_risk if above threshold
  if (alertType === 'high_risk' && (action.risk_score ?? 0) < RISK_ALERT_THRESHOLD) return;

  void (async () => {
    try {
      const webhookUrl = await getDiscordWebhookUrl(sql, orgId);
      if (!webhookUrl) return;
      const embed = buildEmbed(action, alertType);
      await postToDiscord(webhookUrl, embed);
    } catch (err) {
      console.warn('[ActionAlerts] Failed to send alert:', err.message);
    }
  })();
}
