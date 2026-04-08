import { listLearningRecommendations } from './repositories/learningLoop.repository.js';

/**
 * Consolidate lessons for an agent — what DashClaw has learned from scored outcomes.
 */
export async function consolidateLessons(sql, orgId, { agentId, actionType, limit = 10 }) {
  const lessons = [];

  // 1. Top recommendations by confidence
  const recs = await listLearningRecommendations(sql, orgId, {
    agentId,
    actionType,
    limit,
  });

  for (const rec of recs || []) {
    const hints = typeof rec.hints === 'string' ? JSON.parse(rec.hints) : rec.hints || {};
    const guidance = typeof rec.guidance === 'string' ? JSON.parse(rec.guidance) : rec.guidance || {};

    lessons.push({
      action_type: rec.action_type,
      confidence: rec.confidence,
      success_rate: rec.success_rate,
      hints: {
        risk_cap: hints.risk_cap,
        prefer_reversible: hints.prefer_reversible,
        confidence_floor: hints.confidence_floor,
        expected_duration: hints.expected_duration,
        expected_cost: hints.expected_cost,
      },
      guidance: guidance.text || guidance.summary || null,
      sample_size: rec.sample_size,
    });
  }

  // 2. Recent drift warnings
  const driftAlerts = await sql`
    SELECT metric, severity, z_score, direction, agent_id, action_type
    FROM drift_alerts
    WHERE org_id = ${orgId}
      AND (${agentId ? sql`agent_id = ${agentId}` : sql`TRUE`})
      AND acknowledged = false
      AND severity IN ('warning', 'critical')
    ORDER BY created_at DESC LIMIT 5
  `;

  const drift_warnings = driftAlerts.map(a => ({
    metric: a.metric,
    severity: a.severity,
    z_score: Number(a.z_score).toFixed(1),
    direction: a.direction,
  }));

  return { lessons, drift_warnings, agent_id: agentId };
}
