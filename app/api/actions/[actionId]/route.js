export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../../lib/db.js';
import { validateActionOutcome } from '../../../lib/validate.js';
import { getOrgId } from '../../../lib/org.js';
import { EVENTS, publishOrgEvent } from '../../../lib/events.js';
import { scanSensitiveData } from '../../../lib/security.js';
import {
  getActionWithRelations,
  updateActionOutcome,
} from '../../../lib/repositories/actions.repository.js';
import {
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

let _sql;
function getSql() {
  if (_sql) return _sql;
  _sql = getDbSql();
  return _sql;
}

export async function GET(request, { params }) {
  try {
    const sql = getSql();
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
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;
    const body = await request.json();

    const { valid, data, errors } = validateActionOutcome(body);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // SECURITY: redact likely secrets before storing the outcome fields.
    const dlpFindings = [];
    for (const k of ['output_summary', 'error_message']) {
      if (data[k] != null) data[k] = redactAny(data[k], dlpFindings);
    }
    if (data.side_effects != null) data.side_effects = redactAny(data.side_effects, dlpFindings);
    if (data.artifacts_created != null) data.artifacts_created = redactAny(data.artifacts_created, dlpFindings);

    const updatedAction = await updateActionOutcome(sql, orgId, actionId, data);
    if (!updatedAction) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
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
