import { listLearningRecommendations } from './repositories/learningLoop.repository.js';

/**
 * Build learning context for a guard decision.
 * Best-effort — never blocks guard decisions on failure.
 */
export async function getLearningContext(sql, orgId, { agentId, actionType }) {
  if (!agentId) return null;

  const context = {
    recent_score_avg: null,
    baseline_score_avg: null,
    drift_status: null,
    patterns: [],
    feedback_summary: null,
  };

  try {
    // 1. Recent scores for this action type (last 10 episodes)
    const recentEpisodes = await sql`
      SELECT score FROM learning_episodes
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND action_type = ${actionType || 'unknown'}
      ORDER BY created_at DESC LIMIT 10
    `;
    if (recentEpisodes.length > 0) {
      context.recent_score_avg = Math.round(
        recentEpisodes.reduce((s, e) => s + (e.score || 0), 0) / recentEpisodes.length
      );
    }

    // 2. Baseline score (all-time for this action type)
    const baseline = await sql`
      SELECT AVG(score) as avg_score FROM learning_episodes
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND action_type = ${actionType || 'unknown'}
    `;
    if (baseline[0]?.avg_score != null) {
      context.baseline_score_avg = Math.round(baseline[0].avg_score);
    }

    // 3. Active drift alerts for this agent
    const driftAlerts = await sql`
      SELECT severity, metric FROM drift_alerts
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND acknowledged = false
      ORDER BY severity DESC LIMIT 3
    `;
    if (driftAlerts.length > 0) {
      context.drift_status = driftAlerts[0].severity;
    }

    // 4. Recommendations (patterns from successful actions)
    const recs = await listLearningRecommendations(sql, orgId, {
      agentId, actionType, limit: 3,
    });
    if (recs && recs.length > 0) {
      context.patterns = recs.map(r => {
        const guidance = typeof r.guidance === 'string' ? JSON.parse(r.guidance) : r.guidance;
        return guidance?.text || guidance?.summary || '';
      }).filter(Boolean);
    }

    // 5. Recent negative feedback
    const negativeFb = await sql`
      SELECT COUNT(*) as count, AVG(rating) as avg_rating
      FROM feedback
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND sentiment = 'negative'
        AND created_at > NOW() - INTERVAL '7 days'
    `;
    if (negativeFb[0]?.count > 0) {
      context.feedback_summary = `${negativeFb[0].count} negative rating(s) in last 7 days (avg ${Number(negativeFb[0].avg_rating).toFixed(1)})`;
    }
  } catch (err) {
    console.error('[learning-context] Error building context:', err.message);
  }

  const hasData = context.recent_score_avg != null || context.drift_status || context.patterns.length > 0 || context.feedback_summary;
  return hasData ? context : null;
}
