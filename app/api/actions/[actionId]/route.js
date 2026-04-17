export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../../lib/db.js';
import { validateActionOutcome } from '../../../lib/validate.js';
import { getOrgId } from '../../../lib/org.js';
import { EVENTS, publishOrgEvent } from '../../../lib/events.js';
import { scanSensitiveData } from '../../../lib/security.js';
import { estimateCost } from '../../../lib/billing.js';
import { getModelPricing } from '../../../lib/repositories/settings.repository.js';
import {
  getActionWithRelations,
  updateActionOutcome,
} from '../../../lib/repositories/actions.repository.js';
import {
  maybeRebuildRecommendations,
  recordLearningRecommendationEvents,
  scoreAndStoreActionEpisode,
} from '../../../lib/learningLoop.service.js';

function isRecommendationApplied(value) {
  return value === true || value === 1 || value === '1';
}

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

export async function GET(request, { params }) {
  try {
    const sql = getDbSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    const result = await getActionWithRelations(sql, orgId, actionId);
    if (!result) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Action detail GET error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching the action' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const sql = getDbSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;
    const body = await request.json();

    // Stop-hook contract — see dashclaw_stop.py. When true, the request's close
    // fields (status/output_summary/timestamp_end) are applied atomically only
    // if the row is still `running`; token fields always apply. This prevents
    // a late Stop hook from clobbering a terminal state PostToolUse just wrote.
    const closeIfRunning = body.close_if_running === true;

    const { valid, data, errors } = validateActionOutcome(body);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // SECURITY: clamp token/cost to reasonable bounds and auto-derive cost
    // when tokens are reported without an explicit cost_estimate. Matches the
    // POST path so hooks reporting tokens after the fact get priced the same.
    const MAX_TOKENS = 10_000_000;
    const MAX_COST_USD = 10_000;
    if (data.tokens_in !== undefined) data.tokens_in = Math.max(0, Math.min(Number(data.tokens_in) || 0, MAX_TOKENS));
    if (data.tokens_out !== undefined) data.tokens_out = Math.max(0, Math.min(Number(data.tokens_out) || 0, MAX_TOKENS));
    if (data.cost_estimate !== undefined) data.cost_estimate = Math.max(0, Math.min(Number(data.cost_estimate) || 0, MAX_COST_USD));
    if ((data.tokens_in || data.tokens_out) && data.cost_estimate === undefined) {
      const customPricing = await getModelPricing(sql, orgId);
      data.cost_estimate = estimateCost(data.tokens_in || 0, data.tokens_out || 0, data.model, customPricing);
    }

    // SECURITY: redact likely secrets before storing the outcome fields.
    const dlpFindings = [];
    for (const k of ['output_summary', 'error_message']) {
      if (data[k] != null) data[k] = redactAny(data[k], dlpFindings);
    }
    if (data.side_effects != null) data.side_effects = redactAny(data.side_effects, dlpFindings);
    if (data.artifacts_created != null) data.artifacts_created = redactAny(data.artifacts_created, dlpFindings);

    let updatedAction;
    if (closeIfRunning) {
      // Split into (close fields) and (everything else). Close fields only
      // apply via a status='running' gate; other fields apply unconditionally
      // so tokens/cost/model land even when PostToolUse already closed the row.
      const CLOSE_FIELDS = new Set(['status', 'output_summary', 'timestamp_end']);
      const closeData = {};
      const otherData = {};
      for (const [k, v] of Object.entries(data)) {
        if (CLOSE_FIELDS.has(k)) closeData[k] = v;
        else otherData[k] = v;
      }

      let closeResult = null;
      if (Object.keys(closeData).length > 0) {
        closeResult = await updateActionOutcome(sql, orgId, actionId, closeData, { gateStatus: 'running' });
      }
      let tokenResult = null;
      if (Object.keys(otherData).length > 0) {
        tokenResult = await updateActionOutcome(sql, orgId, actionId, otherData);
      }

      updatedAction = tokenResult || closeResult;
      if (!updatedAction) {
        // Gate failed AND no token data — re-fetch to return the current row.
        const rel = await getActionWithRelations(sql, orgId, actionId);
        if (!rel) {
          return NextResponse.json({ error: 'Action not found' }, { status: 404 });
        }
        updatedAction = rel.action;
      }
    } else {
      updatedAction = await updateActionOutcome(sql, orgId, actionId, data);
      if (!updatedAction) {
        return NextResponse.json({ error: 'Action not found' }, { status: 404 });
      }
    }

    // Emit real-time event
    void publishOrgEvent(EVENTS.ACTION_UPDATED, {
      orgId,
      action: updatedAction,
    });

    // Best-effort: score this action as a learning episode for recommendation synthesis.
    try {
      const scoredEpisode = await scoreAndStoreActionEpisode(sql, orgId, actionId);
      if (updatedAction.recommendation_id && isRecommendationApplied(updatedAction.recommendation_applied)) {
        await recordLearningRecommendationEvents(sql, orgId, [
          {
            recommendation_id: updatedAction.recommendation_id,
            action_id: actionId,
            agent_id: updatedAction.agent_id || null,
            event_type: 'outcome',
            event_key: `outcome:${actionId}`,
            details: {
              status: updatedAction.status,
              outcome_label: scoredEpisode?.outcome_label || null,
              score: scoredEpisode?.score ?? null,
              duration_ms: updatedAction.duration_ms ?? null,
              cost_estimate: updatedAction.cost_estimate ?? null,
              action_type: updatedAction.action_type || null,
            },
          },
        ]);
      }
      // Auto-rebuild recommendations if enough new episodes have accumulated
      void maybeRebuildRecommendations(sql, orgId).catch(() => {});
    } catch (learningError) {
      console.warn('[LEARNING] Failed to score action episode:', learningError.message);
    }

    return NextResponse.json({
      action: updatedAction,
      security: {
        clean: dlpFindings.length === 0,
        findings_count: dlpFindings.length,
        critical_count: dlpFindings.filter(f => f.severity === 'critical').length,
        categories: [...new Set(dlpFindings.map(f => f.category))],
      },
    });
  } catch (error) {
    console.error('Action detail PATCH error:', error);
    return NextResponse.json({ error: 'An error occurred while updating the action' }, { status: 500 });
  }
}
