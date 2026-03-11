/**
 * DashClaw client utilities for agent tool use.
 *
 * Provides validated wrappers around raw SDK methods so callers cannot
 * accidentally omit required fields or pass unrecognised message types.
 */

export const VALID_MESSAGE_TYPES = ['action', 'info', 'lesson', 'question', 'status'];

/**
 * Send a direct (non-broadcast) message with pre-call validation.
 *
 * @param {import('../../sdk/dashclaw.js').DashClaw} sdk - Initialised DashClaw instance
 * @param {Object} params
 * @param {string}  params.to      - Required: target agent ID
 * @param {string}  params.body    - Message body
 * @param {string}  [params.subject] - Subject line
 * @param {string}  [params.type='info'] - Must be one of VALID_MESSAGE_TYPES
 * @returns {Promise<{message: Object, message_id: string}>}
 */
export async function sendDirectMessage(sdk, { to, subject, body, type = 'info' }) {
  if (!to) {
    throw new Error(
      'sendDirectMessage: `to` is required. To send a broadcast use sdk.broadcast() directly.'
    );
  }

  if (!VALID_MESSAGE_TYPES.includes(type)) {
    throw new Error(
      `sendDirectMessage: invalid type "${type}". Must be one of: ${VALID_MESSAGE_TYPES.join(', ')}.`
    );
  }

  return sdk.sendMessage({ to, subject, body, type });
}
