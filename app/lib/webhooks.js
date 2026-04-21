/**
 * Webhook dispatch helpers.
 * HMAC signing, delivery with logging, and org-level dispatch.
 */

import crypto from 'crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { scanSensitiveData } from './security.js';

function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return true;

  const v = net.isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;

    const [a, b] = parts;
    if (a === 0) return true; // "this network"
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    
    // Defend against IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1)
    if (lower.startsWith('::ffff:')) {
      const ipv4Part = lower.substring(7);
      return isPrivateIp(ipv4Part);
    }
    
    return false;
  }

  // Not an IP literal (shouldn't happen here)
  return true;
}

async function assertSafeWebhookUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Webhook URL must use https');
  if (parsed.username || parsed.password) throw new Error('Webhook URL must not include credentials');

  const host = parsed.hostname;
  if (!host) throw new Error('Webhook URL hostname is required');

  const ipKind = net.isIP(host);
  if (ipKind) {
    if (isPrivateIp(host)) throw new Error('Webhook URL cannot target private or loopback IPs');
    return host;
  }

  // Resolve DNS and block any private/loopback/link-local targets.
  const addrs = await dns.lookup(host, { all: true, verbatim: true });
  if (!Array.isArray(addrs) || addrs.length === 0) throw new Error('Webhook hostname did not resolve');
  for (const a of addrs) {
    const addr = a?.address;
    if (isPrivateIp(addr)) throw new Error('Webhook hostname resolves to a private or loopback IP');
  }
  
  return addrs[0].address;
}

/**
 * Sign a payload with HMAC-SHA256.
 */
export function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function redactForStorage(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  return scanSensitiveData(value).redacted;
}

function signGuardWebhookPayload({ timestamp, payload, secret }) {
  const msg = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(msg).digest('hex');
}

/**
 * Deliver a webhook: POST payload to url, log result to webhook_deliveries.
 *
 * @returns {Promise<{success: boolean, status?: number}>}
 */
export async function deliverWebhook({ webhookId, orgId, url, secret, eventType, payload, sql }) {
  const deliveryId = `wd_${crypto.randomUUID()}`;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signature = signPayload(payloadStr, secret);
  const now = new Date().toISOString();
  const start = Date.now();

  let status = 'failed';
  let responseStatus = null;
  let responseBody = null;

  try {
    // Validate URL is safe (no private/loopback IPs) — but fetch the original URL
    // so TLS works correctly with the hostname in the certificate.
    await assertSafeWebhookUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual', // SECURITY: prevent SSRF via redirects
      headers: {
        'Content-Type': 'application/json',
        'X-DashClaw-Signature': signature,
        'X-DashClaw-Event': eventType,
        'X-DashClaw-Delivery': deliveryId,
        'User-Agent': 'DashClaw-Webhooks/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = res.status;

    if (res.status >= 300 && res.status < 400) {
      responseBody = 'Redirect blocked';
      status = 'failed';
    } else {
      responseBody = await res.text().catch(() => '');
      if (responseBody.length > 2000) responseBody = responseBody.substring(0, 2000);
      status = res.ok ? 'success' : 'failed';
    }
  } catch (err) {
    responseBody = err.message || 'Request failed';
    status = 'failed';
  }

  const durationMs = Date.now() - start;

  // Log delivery — await so the audit row is committed before we tell the
  // caller the delivery succeeded. A lost INSERT here would leave an
  // operator investigating a missed webhook alert with no delivery attempt
  // in the UI, unable to distinguish "never tried" from "tried and lost".
  const storedPayload = redactForStorage(payloadStr);
  const storedResponseBody = redactForStorage(responseBody);
  let deliveryLogged = true;
  try {
    await sql`
      INSERT INTO webhook_deliveries (id, webhook_id, org_id, event_type, payload, status, response_status, response_body, attempted_at, duration_ms)
      VALUES (${deliveryId}, ${webhookId}, ${orgId}, ${eventType}, ${storedPayload}, ${status}, ${responseStatus}, ${storedResponseBody}, ${now}, ${durationMs})
    `;
  } catch (err) {
    console.error('[WEBHOOK] Failed to log delivery:', err.message);
    deliveryLogged = false;
  }

  return { success: status === 'success', status: responseStatus, delivery_logged: deliveryLogged };
}

/**
 * Deliver a guard webhook: POST evaluation context to customer URL for custom decision logic.
 * No HMAC signing — guard webhooks are policy-based, not integration-based.
 *
 * @returns {Promise<{success: boolean, response: Object|null, status: number|null}>}
 */
export async function deliverGuardWebhook({ url, policyId, orgId, payload, timeoutMs, sql }) {
  const deliveryId = `wd_${crypto.randomUUID()}`;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const now = new Date().toISOString();
  const start = Date.now();

  let status = 'failed';
  let responseStatus = null;
  let responseBody = null;
  let parsedResponse = null;

  try {
    // Validate URL is safe (no private/loopback IPs) — but fetch the original URL
    // so TLS works correctly with the hostname in the certificate.
    await assertSafeWebhookUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 5000);

    // Optional signing for guard webhooks (global secret).
    const guardSecret = process.env.GUARD_WEBHOOK_SECRET || '';
    const guardTs = String(Date.now());
    const guardSig = guardSecret
      ? signGuardWebhookPayload({ timestamp: guardTs, payload: payloadStr, secret: guardSecret })
      : null;

    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual', // SECURITY: prevent SSRF via redirects
      headers: {
        'Content-Type': 'application/json',
        'X-DashClaw-Event': 'guard.evaluation',
        'X-DashClaw-Delivery': deliveryId,
        ...(guardSig ? { 'X-DashClaw-Timestamp': guardTs, 'X-DashClaw-Signature': `v1=${guardSig}` } : {}),
        'User-Agent': 'DashClaw-Guard/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = res.status;
    if (res.status >= 300 && res.status < 400) {
      responseBody = 'Redirect blocked';
      status = 'failed';
    } else {
      responseBody = await res.text().catch(() => '');
      if (responseBody.length > 2000) responseBody = responseBody.substring(0, 2000);
      status = res.ok ? 'success' : 'failed';

      if (res.ok) {
        try {
          parsedResponse = JSON.parse(responseBody);
        } catch { /* non-JSON response treated as no-op */ }
      }
    }
  } catch (err) {
    responseBody = err.name === 'AbortError' ? 'Request timed out' : (err.message || 'Request failed');
    status = 'failed';
  }

  const durationMs = Date.now() - start;

  // Log delivery (use policyId as webhook_id for guard webhooks). Await so
  // the audit row is committed before the caller acts on the response — a
  // lost INSERT would hide the guard decision from replay and forensics.
  const storedPayload = redactForStorage(payloadStr);
  const storedResponseBody = redactForStorage(responseBody);
  let deliveryLogged = true;
  try {
    await sql`
      INSERT INTO webhook_deliveries (id, webhook_id, org_id, event_type, payload, status, response_status, response_body, attempted_at, duration_ms)
      VALUES (${deliveryId}, ${policyId}, ${orgId}, ${'guard.evaluation'}, ${storedPayload}, ${status}, ${responseStatus}, ${storedResponseBody}, ${now}, ${durationMs})
    `;
  } catch (err) {
    console.error('[GUARD WEBHOOK] Failed to log delivery:', err.message);
    deliveryLogged = false;
  }

  return { success: status === 'success', response: parsedResponse, status: responseStatus, delivery_logged: deliveryLogged };
}

/**
 * Fire webhooks for an org when new signals are detected.
 * Loads active webhooks, filters by event subscription, delivers, manages failure_count.
 */
export async function fireWebhooksForOrg(orgId, signals, sql) {
  if (!signals || signals.length === 0) return [];

  const webhooks = await sql`
    SELECT id, url, secret, events, failure_count
    FROM webhooks
    WHERE org_id = ${orgId} AND active = 1
  `;

  if (webhooks.length === 0) return [];

  const results = [];

  for (const wh of webhooks) {
    let subscribedEvents;
    try {
      subscribedEvents = JSON.parse(wh.events);
    } catch {
      subscribedEvents = ['all'];
    }

    // Filter signals this webhook cares about
    const relevantSignals = subscribedEvents.includes('all')
      ? signals
      : signals.filter(s => subscribedEvents.includes(s.type));

    if (relevantSignals.length === 0) continue;

    const payload = {
      event: 'signals.detected',
      org_id: orgId,
      timestamp: new Date().toISOString(),
      signals: relevantSignals,
    };

    const result = await deliverWebhook({
      webhookId: wh.id,
      orgId,
      url: wh.url,
      secret: wh.secret,
      eventType: 'signals.detected',
      payload,
      sql,
    });

    if (result.success) {
      // Reset failure count on success
      sql`UPDATE webhooks SET failure_count = 0, last_triggered_at = ${new Date().toISOString()} WHERE id = ${wh.id} AND org_id = ${orgId}`.catch((err) => {
        console.warn(`[Webhooks] Failed to reset failure_count for webhook ${wh.id}:`, err.message);
      });
    } else {
      const newCount = (parseInt(wh.failure_count, 10) || 0) + 1;
      if (newCount >= 10) {
        // Disable webhook after 10 consecutive failures
        sql`UPDATE webhooks SET failure_count = ${newCount}, active = 0, last_triggered_at = ${new Date().toISOString()} WHERE id = ${wh.id} AND org_id = ${orgId}`.catch((err) => {
          console.warn(`[Webhooks] Failed to disable webhook ${wh.id} after ${newCount} failures:`, err.message);
        });
      } else {
        sql`UPDATE webhooks SET failure_count = ${newCount}, last_triggered_at = ${new Date().toISOString()} WHERE id = ${wh.id} AND org_id = ${orgId}`.catch((err) => {
          console.warn(`[Webhooks] Failed to update failure_count for webhook ${wh.id}:`, err.message);
        });
      }
    }

    results.push({ webhookId: wh.id, success: result.success, signalCount: relevantSignals.length });
  }

  return results;
}

/**
 * Fire webhooks for approval-related events (pending, granted, denied).
 */
export async function fireWebhooksForApproval(orgId, eventType, action, sql) {
  try {
    const webhooks = await sql`
      SELECT id, url, secret, events FROM webhooks
      WHERE org_id = ${orgId} AND active = 1
    `;

    const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const payload = {
      event: eventType,
      org_id: orgId,
      timestamp: new Date().toISOString(),
      action: {
        action_id: action.action_id,
        agent_id: action.agent_id,
        action_type: action.action_type,
        declared_goal: action.declared_goal,
        risk_score: action.risk_score,
        status: action.status,
        matched_policies: action.matched_policies || [],
        reason: action.reason || '',
      },
      approval_url: `${baseUrl}/api/approvals/${action.action_id}`,
      replay_url: `${baseUrl}/replay/${action.action_id}`,
    };

    for (const wh of webhooks) {
      const events = JSON.parse(wh.events || '["all"]');
      if (!events.includes('all') && !events.includes(eventType)) continue;
      deliverWebhook({
        webhookId: wh.id,
        orgId,
        url: wh.url,
        secret: wh.secret,
        eventType,
        payload,
        sql,
      }).catch(err =>
        console.error(`[WEBHOOK] Delivery failed for ${wh.id}:`, err.message)
      );
    }
  } catch (err) {
    console.error('[WEBHOOK] fireWebhooksForApproval error:', err.message);
  }
}
