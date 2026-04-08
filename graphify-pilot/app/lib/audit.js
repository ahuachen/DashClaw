/**
 * Activity logging helper.
 * Fire-and-forget — never blocks the caller.
 */

import crypto from 'crypto';

/**
 * Log an activity event to the activity_logs table.
 *
 * @param {object} opts
 * @param {string} opts.orgId
 * @param {string} opts.actorId - user ID, 'system', or 'cron'
 * @param {string} [opts.actorType='user'] - user|system|api_key|cron
 * @param {string} opts.action - e.g. 'key.created', 'alert.email_sent'
 * @param {string} [opts.resourceType] - api_key|invite|member|setting|webhook|signal|usage
 * @param {string} [opts.resourceId]
 * @param {object} [opts.details] - arbitrary JSON-serializable details
 * @param {Request} [opts.request] - optional request for IP extraction
 * @param {Function} sql - neon sql tagged template
 */
export function logActivity({ orgId, actorId, actorType = 'user', action, resourceType, resourceId, details, request }, sql) {
  const id = `al_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  // SECURITY: prefer middleware-derived trusted IP; fallback is best-effort only.
  const ip = request?.headers?.get?.('x-client-ip') ||
    request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  const detailsStr = details ? JSON.stringify(details) : null;

  // Fire and forget — never block the caller
  sql`
    INSERT INTO activity_logs (id, org_id, actor_id, actor_type, action, resource_type, resource_id, details, ip_address, created_at)
    VALUES (${id}, ${orgId}, ${actorId}, ${actorType}, ${action}, ${resourceType || null}, ${resourceId || null}, ${detailsStr}, ${ip}, ${now})
  `.catch((err) => {
    console.error('[AUDIT] Failed to log activity:', err.message);
  });
}
