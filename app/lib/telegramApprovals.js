/**
 * Telegram approval bridge — fires an interactive approval message to a
 * configured Telegram admin chat when an action enters pending_approval.
 * Mirrors actionAlerts.js — always fire-and-forget, never throws.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FETCH_TIMEOUT_MS = 1500;

function isEnabled() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID) return false;
  if (process.env.DASHCLAW_ALERTS_TELEGRAM === 'false') return false;
  return true;
}

/**
 * Fire a Telegram approval message for a pending_approval action.
 * @param {object} action - the action record
 * @param {object} _sql - db handle (reserved for v1.1 per-agent routing)
 * @param {string} _orgId - org id (reserved for v1.1 per-agent routing)
 */
export function fireTelegramApproval(action, _sql, _orgId) {
  if (!isEnabled()) return;
  if (action?.status !== 'pending_approval') return;

  void (async () => {
    try {
      // payload + fetch arrive in Task 2
    } catch (err) {
      console.warn('[TelegramApprovals] Failed to send approval:', err.message);
    }
  })();
}
