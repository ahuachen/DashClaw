/**
 * Cost alerts — fires when a single action's `cost_estimate` crosses the
 * org-level threshold defined by `DASHCLAW_ACTION_COST_THRESHOLD`. Reuses the
 * existing signal-delivery pipeline (webhook table + native adapters).
 *
 * Called fire-and-forget from the PATCH /api/actions/:id handler so a slow
 * Slack post can never block the API response.
 */

import { EVENTS, publishOrgEvent } from './events.js';
import { fireWebhooksForOrg } from './webhooks.js';
import { deliverNativeNotifications } from './notification-adapters/index.js';
import { getSettings } from './repositories/settings.repository.js';

const THRESHOLD_KEY = 'DASHCLAW_ACTION_COST_THRESHOLD';

/**
 * Parse the threshold from a settings row. Empty / null / non-numeric / ≤0 → null (disabled).
 */
export function parseThreshold(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Build the signal payload for a cost breach. Exposed for tests.
 */
export function buildCostSignal(action, threshold) {
  const cost = Number(action.cost_estimate) || 0;
  const ratio = cost / threshold;
  // amber for small overages, red once we're 2× the cap.
  const severity = ratio >= 2 ? 'red' : 'amber';
  return {
    type: 'cost_exceeded',
    severity,
    label: `Action cost exceeded threshold ($${cost.toFixed(4)} > $${threshold.toFixed(2)})`,
    detail:
      `Action ${action.action_id} (${action.action_type || 'unknown'})` +
      ` cost $${cost.toFixed(4)}, which is ${ratio.toFixed(1)}× the configured cap of $${threshold.toFixed(2)}.`,
    agent_id: action.agent_id || null,
    action_id: action.action_id,
    cost_estimate: cost,
    threshold,
  };
}

/**
 * Check the action's cost against the org threshold and, if exceeded, deliver
 * notifications through webhooks + native adapters and publish an SSE event.
 *
 * Never throws: all delivery is best-effort and errors are swallowed with a
 * console warn. The PATCH route awaits this call only long enough to know
 * whether a signal was built; actual delivery runs in the background.
 *
 * @returns {Promise<{fired: boolean, signal?: object, threshold?: number}>}
 */
export async function maybeFireCostAlert(sql, orgId, action) {
  try {
    if (!action || action.cost_estimate == null) return { fired: false };

    // Threshold lookup is org-scoped (agent overrides not supported yet —
    // keep the config surface small until someone actually needs per-agent
    // caps).
    const settings = await getSettings(sql, orgId, { key: THRESHOLD_KEY });
    const threshold = parseThreshold(settings?.[0]?.value);
    if (!threshold) return { fired: false };

    const cost = Number(action.cost_estimate) || 0;
    if (cost <= threshold) return { fired: false };

    const signal = buildCostSignal(action, threshold);

    // Pull all settings once for the native-adapter delivery (it needs the
    // credential keys). We do this inside the `fired` branch so the common
    // under-threshold path stays at one SELECT.
    const allSettings = await getSettings(sql, orgId, {});

    // Fire-and-forget — the PATCH response should never wait on Slack.
    void fireWebhooksForOrg(orgId, [signal], sql).catch((err) => {
      console.warn('[COST ALERT] webhook delivery failed:', err?.message || err);
    });
    void deliverNativeNotifications(orgId, [signal], allSettings, sql).catch((err) => {
      console.warn('[COST ALERT] native notification delivery failed:', err?.message || err);
    });
    void publishOrgEvent(EVENTS.ACTION_COST_EXCEEDED, {
      orgId,
      action,
      threshold,
      signal,
    });

    return { fired: true, signal, threshold };
  } catch (err) {
    console.warn('[COST ALERT] check failed:', err?.message || err);
    return { fired: false };
  }
}
