import crypto from 'crypto';

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

export async function listOrganizations(sql, options = {}) {
  const includeDefault = options.includeDefault !== false;
  if (includeDefault) {
    return sql`SELECT id FROM organizations ORDER BY id`;
  }
  return sql`SELECT id FROM organizations WHERE id != 'org_default' ORDER BY id`;
}

export async function listUnscoredActionIds(sql, orgId, filters = {}) {
  const lookbackDays = Math.max(1, Math.min(Number(filters.lookbackDays) || 30, 365));
  const limit = Math.max(1, Math.min(Number(filters.limit) || 1000, 20000));

  return sql.query(
    `
      SELECT ar.action_id
      FROM action_records ar
      LEFT JOIN learning_episodes le
        ON le.org_id = ar.org_id
       AND le.action_id = ar.action_id
      WHERE ar.org_id = $1
        AND ar.timestamp_start::timestamptz > NOW() - INTERVAL '1 day' * $2
        AND le.action_id IS NULL
      ORDER BY ar.timestamp_start DESC
      LIMIT $3
    `,
    [orgId, lookbackDays, limit]
  );
}

export async function getActionEpisodeSource(sql, orgId, actionId) {
  const rows = await sql`
    SELECT
      ar.*,
      (
        SELECT COUNT(*)::int
        FROM assumptions a
        WHERE a.org_id = ${orgId}
          AND a.action_id = ${actionId}
          AND a.invalidated = 1
      ) AS invalidated_assumptions,
      (
        SELECT COUNT(*)::int
        FROM open_loops ol
        WHERE ol.org_id = ${orgId}
          AND ol.action_id = ${actionId}
          AND ol.status = 'open'
      ) AS open_loops
    FROM action_records ar
    WHERE ar.org_id = ${orgId}
      AND ar.action_id = ${actionId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function upsertLearningEpisode(sql, orgId, source, scored) {
  const now = new Date().toISOString();
  const id = `lep_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

  const rows = await sql`
    INSERT INTO learning_episodes (
      id,
      org_id,
      action_id,
      agent_id,
      action_type,
      status,
      outcome_label,
      risk_score,
      reversible,
      confidence,
      duration_ms,
      cost_estimate,
      invalidated_assumptions,
      open_loops,
      recommendation_id,
      recommendation_applied,
      score,
      score_breakdown,
      created_at,
      updated_at
    ) VALUES (
      ${id},
      ${orgId},
      ${source.action_id},
      ${source.agent_id},
      ${source.action_type},
      ${source.status || null},
      ${scored.outcome_label},
      ${source.risk_score ?? 0},
      ${source.reversible ?? 1},
      ${source.confidence ?? 50},
      ${source.duration_ms ?? null},
      ${source.cost_estimate ?? 0},
      ${source.invalidated_assumptions ?? 0},
      ${source.open_loops ?? 0},
      ${source.recommendation_id ?? null},
      ${source.recommendation_applied ?? 0},
      ${scored.score},
      ${JSON.stringify(scored.breakdown)},
      ${source.timestamp_start || now},
      ${now}
    )
    ON CONFLICT (org_id, action_id)
    DO UPDATE SET
      agent_id = EXCLUDED.agent_id,
      action_type = EXCLUDED.action_type,
      status = EXCLUDED.status,
      outcome_label = EXCLUDED.outcome_label,
      risk_score = EXCLUDED.risk_score,
      reversible = EXCLUDED.reversible,
      confidence = EXCLUDED.confidence,
      duration_ms = EXCLUDED.duration_ms,
      cost_estimate = EXCLUDED.cost_estimate,
      invalidated_assumptions = EXCLUDED.invalidated_assumptions,
      open_loops = EXCLUDED.open_loops,
      recommendation_id = EXCLUDED.recommendation_id,
      recommendation_applied = EXCLUDED.recommendation_applied,
      score = EXCLUDED.score,
      score_breakdown = EXCLUDED.score_breakdown,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  const row = rows[0] || null;
  if (!row) return null;
  return {
    ...row,
    recommendation_applied: toBoolean(row.recommendation_applied),
    score_breakdown: parseJson(row.score_breakdown, {}),
  };
}

export async function listLearningEpisodes(sql, orgId, filters = {}) {
  const { agentId, actionType, lookbackDays = 30, limit = 5000 } = filters;
  let idx = 1;
  const conditions = [`org_id = $${idx++}`];
  const params = [orgId];

  const boundedDays = Math.max(1, Math.min(Number(lookbackDays) || 30, 365));
  conditions.push(`updated_at::timestamptz > NOW() - INTERVAL '1 day' * $${idx++}`);
  params.push(boundedDays);

  if (agentId) {
    conditions.push(`agent_id = $${idx++}`);
    params.push(agentId);
  }
  if (actionType) {
    conditions.push(`action_type = $${idx++}`);
    params.push(actionType);
  }

  const boundedLimit = Math.max(1, Math.min(Number(limit) || 5000, 10000));
  const query = `
    SELECT *
    FROM learning_episodes
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
    LIMIT $${idx}
  `;
  params.push(boundedLimit);
  const rows = await sql.query(query, params);
  return rows.map((row) => ({
    ...row,
    recommendation_applied: toBoolean(row.recommendation_applied),
    score_breakdown: parseJson(row.score_breakdown, {}),
  }));
}

export async function clearLearningRecommendations(sql, orgId, filters = {}) {
  const { agentId, actionType } = filters;
  let idx = 1;
  const conditions = [`org_id = $${idx++}`];
  const params = [orgId];

  if (agentId) {
    conditions.push(`agent_id = $${idx++}`);
    params.push(agentId);
  }
  if (actionType) {
    conditions.push(`action_type = $${idx++}`);
    params.push(actionType);
  }

  const rows = await sql.query(
    `DELETE FROM learning_recommendations WHERE ${conditions.join(' AND ')} RETURNING id`,
    params
  );
  return rows.length;
}

export async function upsertLearningRecommendations(sql, orgId, recommendations) {
  const now = new Date().toISOString();
  const saved = [];

  for (const rec of recommendations) {
    const id = `lrec_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const rows = await sql`
      INSERT INTO learning_recommendations (
        id,
        org_id,
        agent_id,
        action_type,
        confidence,
        sample_size,
        top_sample_size,
        success_rate,
        avg_score,
        hints,
        guidance,
        active,
        computed_at,
        updated_at
      ) VALUES (
        ${id},
        ${orgId},
        ${rec.agent_id},
        ${rec.action_type},
        ${rec.confidence},
        ${rec.sample_size},
        ${rec.top_sample_size},
        ${rec.success_rate},
        ${rec.avg_score},
        ${JSON.stringify(rec.hints || {})},
        ${JSON.stringify(rec.guidance || [])},
        ${rec.active === false ? 0 : 1},
        ${now},
        ${now}
      )
      ON CONFLICT (org_id, agent_id, action_type)
      DO UPDATE SET
        confidence = EXCLUDED.confidence,
        sample_size = EXCLUDED.sample_size,
        top_sample_size = EXCLUDED.top_sample_size,
        success_rate = EXCLUDED.success_rate,
        avg_score = EXCLUDED.avg_score,
        hints = EXCLUDED.hints,
        guidance = EXCLUDED.guidance,
        active = learning_recommendations.active,
        computed_at = EXCLUDED.computed_at,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    if (rows[0]) {
      saved.push({
        ...rows[0],
        hints: parseJson(rows[0].hints, {}),
        guidance: parseJson(rows[0].guidance, []),
        active: toBoolean(rows[0].active),
      });
    }
  }

  return saved;
}

export async function listLearningRecommendations(sql, orgId, filters = {}) {
  const { agentId, actionType, limit = 50, includeInactive = false } = filters;
  let idx = 1;
  const conditions = [`org_id = $${idx++}`];
  const params = [orgId];

  if (agentId) {
    conditions.push(`agent_id = $${idx++}`);
    params.push(agentId);
  }
  if (actionType) {
    conditions.push(`action_type = $${idx++}`);
    params.push(actionType);
  }
  if (!includeInactive) {
    conditions.push(`active = 1`);
  }

  const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const rows = await sql.query(
    `SELECT * FROM learning_recommendations WHERE ${conditions.join(' AND ')} ORDER BY confidence DESC, sample_size DESC LIMIT $${idx}`,
    [...params, boundedLimit]
  );

  return rows.map((row) => ({
    ...row,
    hints: parseJson(row.hints, {}),
    guidance: parseJson(row.guidance, []),
    active: toBoolean(row.active),
  }));
}

export async function updateLearningRecommendationActive(sql, orgId, recommendationId, active) {
  const now = new Date().toISOString();
  const rows = await sql`
    UPDATE learning_recommendations
    SET active = ${active ? 1 : 0},
        updated_at = ${now}
    WHERE org_id = ${orgId}
      AND id = ${recommendationId}
    RETURNING *
  `;

  if (!rows[0]) return null;
  return {
    ...rows[0],
    hints: parseJson(rows[0].hints, {}),
    guidance: parseJson(rows[0].guidance, []),
    active: toBoolean(rows[0].active),
  };
}

export async function createLearningRecommendationEvents(sql, orgId, events = []) {
  const created = [];
  for (const event of events) {
    const id = `lrev_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const now = event.created_at || new Date().toISOString();
    const rows = await sql`
      INSERT INTO learning_recommendation_events (
        id,
        org_id,
        recommendation_id,
        agent_id,
        action_id,
        event_type,
        event_key,
        details,
        created_at
      ) VALUES (
        ${id},
        ${orgId},
        ${event.recommendation_id || null},
        ${event.agent_id || null},
        ${event.action_id || null},
        ${event.event_type},
        ${event.event_key || null},
        ${event.details ? JSON.stringify(event.details) : null},
        ${now}
      )
      ON CONFLICT (org_id, event_key)
      DO NOTHING
      RETURNING *
    `;
    if (rows[0]) {
      created.push({
        ...rows[0],
        details: parseJson(rows[0].details, {}),
      });
    }
  }
  return created;
}

export async function listLearningRecommendationEvents(sql, orgId, filters = {}) {
  const {
    agentId,
    recommendationIds,
    actionType,
    lookbackDays = 30,
    limit = 20000,
  } = filters;

  let idx = 1;
  const conditions = [`ev.org_id = $${idx++}`];
  const params = [orgId];

  const boundedDays = Math.max(1, Math.min(Number(lookbackDays) || 30, 365));
  conditions.push(`ev.created_at::timestamptz > NOW() - INTERVAL '1 day' * $${idx++}`);
  params.push(boundedDays);

  if (agentId) {
    conditions.push(`ev.agent_id = $${idx++}`);
    params.push(agentId);
  }

  if (Array.isArray(recommendationIds) && recommendationIds.length > 0) {
    conditions.push(`ev.recommendation_id = ANY($${idx++})`);
    params.push(recommendationIds);
  }

  if (actionType) {
    conditions.push(`rec.action_type = $${idx++}`);
    params.push(actionType);
  }

  const boundedLimit = Math.max(1, Math.min(Number(limit) || 20000, 100000));
  const query = `
    SELECT ev.*, rec.action_type
    FROM learning_recommendation_events ev
    LEFT JOIN learning_recommendations rec
      ON rec.org_id = ev.org_id
     AND rec.id = ev.recommendation_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ev.created_at DESC
    LIMIT $${idx}
  `;

  const rows = await sql.query(query, [...params, boundedLimit]);
  return rows.map((row) => ({
    ...row,
    details: parseJson(row.details, {}),
  }));
}

/**
 * Count episodes created after the most recent recommendation rebuild.
 * Used to decide whether to trigger an automatic rebuild.
 */
export async function countEpisodesSinceLastRebuild(sql, orgId) {
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM learning_episodes le
    WHERE le.org_id = ${orgId}
      AND le.created_at > COALESCE(
        (SELECT MAX(computed_at) FROM learning_recommendations WHERE org_id = ${orgId}),
        '1970-01-01'::timestamptz
      )
  `;
  return rows[0]?.cnt || 0;
}
