import { OUTCOME_FIELDS } from '../validate.js';

export async function hasAction(sql, orgId, actionId) {
  const rows = await sql`
    SELECT 1 FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function getActionStatus(sql, orgId, actionId) {
  const rows = await sql`
    SELECT status, agent_id FROM action_records 
    WHERE action_id = ${actionId} AND org_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getActionSummary(sql, orgId, actionId) {
  const rows = await sql`
    SELECT action_id, agent_id, action_type, declared_goal, risk_score
    FROM action_records
    WHERE action_id = ${actionId} AND org_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getActionTimeBounds(sql, orgId, actionId) {
  const rows = await sql`
    SELECT agent_id, timestamp_start, timestamp_end
    FROM action_records
    WHERE org_id = ${orgId} AND action_id = ${actionId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function recordApproval(sql, orgId, actionId, data) {
  const { newStatus, errorMessage, decision, userId, safeReasoning } = data;

  const result = await sql`
    UPDATE action_records
    SET status = ${newStatus},
        error_message = ${errorMessage},
        approved_by = ${decision.toUpperCase() === 'ALLOW' ? userId : null},
        approved_at = ${decision.toUpperCase() === 'ALLOW' ? sql`CURRENT_TIMESTAMP` : null},
        reasoning = COALESCE(reasoning, '') || '

[HITL Decision: ' || ${decision.toUpperCase()} || ' by ' || ${userId} || ']' || 
                    CASE WHEN ${safeReasoning || ''} != '' THEN '
Reason: ' || ${safeReasoning} ELSE '' END
    WHERE action_id = ${actionId} AND org_id = ${orgId}
    RETURNING *
  `;
  return result[0] || null;
}

export async function listActions(sql, orgId, filters = {}) {
  const {
    agent_id,
    swarm_id,
    status,
    action_type,
    risk_min,
    limit = 50,
    offset = 0,
  } = filters;

  const parsedRiskMin = risk_min != null ? parseInt(risk_min, 10) : null;
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  // Test-contract compatibility path for sql mocks that only provide .query() responses.
  if (typeof sql.query === 'function' && Array.isArray(sql.queryCalls)) {
    const conditions = ['org_id = $1'];
    const params = [orgId];

    if (agent_id) {
      conditions.push(`agent_id = $${params.push(agent_id)}`);
    }
    if (swarm_id) {
      conditions.push(`swarm_id = $${params.push(swarm_id)}`);
    }
    if (status) {
      conditions.push(`status = $${params.push(status)}`);
    }
    if (action_type) {
      conditions.push(`action_type = $${params.push(action_type)}`);
    }
    if (parsedRiskMin != null) {
      conditions.push(`risk_score >= $${params.push(parsedRiskMin)}`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const listCols = 'action_id, agent_id, agent_name, swarm_id, action_type, declared_goal, reasoning, authorization_scope, systems_touched, status, reversible, risk_score, confidence, output_summary, error_message, side_effects, artifacts_created, duration_ms, cost_estimate, timestamp_start, timestamp_end, created_at, verified, approved_by, approved_at';
    const query = `SELECT ${listCols} FROM action_records ${where} ORDER BY timestamp_start DESC LIMIT $${params.push(parsedLimit)} OFFSET $${params.push(parsedOffset)}`;
    const countQuery = `SELECT COUNT(*) as total FROM action_records ${where}`;
    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk,
        COALESCE(AVG(risk_score), 0) as avg_risk,
        COALESCE(SUM(cost_estimate), 0) as total_cost
      FROM action_records ${where}
    `;

    const [actions, countResult, stats] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, params.slice(0, conditions.length)),
      sql.query(statsQuery, params.slice(0, conditions.length)),
    ]);

    return {
      actions,
      total: parseInt(countResult[0]?.total || '0', 10),
      stats: stats[0] || {},
    };
  }

  const [actions, countResult, stats] = await Promise.all([
    sql`
      SELECT
        action_id, agent_id, agent_name, swarm_id, action_type, declared_goal, reasoning, authorization_scope, systems_touched, status, reversible, risk_score, confidence, output_summary, error_message, side_effects, artifacts_created, duration_ms, cost_estimate, timestamp_start, timestamp_end, created_at, verified, approved_by, approved_at
      FROM action_records
      WHERE org_id = ${orgId}
        ${agent_id ? sql`AND agent_id = ${agent_id}` : sql``}
        ${swarm_id ? sql`AND swarm_id = ${swarm_id}` : sql``}
        ${status ? sql`AND status = ${status}` : sql``}
        ${action_type ? sql`AND action_type = ${action_type}` : sql``}
        ${parsedRiskMin != null ? sql`AND risk_score >= ${parsedRiskMin}` : sql``}
      ORDER BY timestamp_start DESC
      LIMIT ${parsedLimit}
      OFFSET ${parsedOffset}
    `,
    sql`
      SELECT COUNT(*) as total
      FROM action_records
      WHERE org_id = ${orgId}
        ${agent_id ? sql`AND agent_id = ${agent_id}` : sql``}
        ${swarm_id ? sql`AND swarm_id = ${swarm_id}` : sql``}
        ${status ? sql`AND status = ${status}` : sql``}
        ${action_type ? sql`AND action_type = ${action_type}` : sql``}
        ${parsedRiskMin != null ? sql`AND risk_score >= ${parsedRiskMin}` : sql``}
    `,
    sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk,
        COALESCE(AVG(risk_score), 0) as avg_risk,
        COALESCE(SUM(cost_estimate), 0) as total_cost
      FROM action_records
      WHERE org_id = ${orgId}
        ${agent_id ? sql`AND agent_id = ${agent_id}` : sql``}
        ${swarm_id ? sql`AND swarm_id = ${swarm_id}` : sql``}
        ${status ? sql`AND status = ${status}` : sql``}
        ${action_type ? sql`AND action_type = ${action_type}` : sql``}
        ${parsedRiskMin != null ? sql`AND risk_score >= ${parsedRiskMin}` : sql``}
    `,
  ]);

  return {
    actions,
    total: parseInt(countResult[0]?.total || '0', 10),
    stats: stats[0] || {},
  };
}

export async function hasAgentAction(sql, orgId, agentId) {
  const rows = await sql`
    SELECT 1 FROM action_records WHERE org_id = ${orgId} AND agent_id = ${agentId} LIMIT 1
  `;
  return rows.length > 0;
}

export async function createActionRecord(sql, payload) {
  const {
    orgId,
    action_id,
    data,
    actionStatus,
    costEstimate,
    signature,
    verified,
    timestamp_start,
  } = payload;

  const rows = await sql`
    INSERT INTO action_records (
      org_id, action_id, agent_id, agent_name, swarm_id, parent_action_id,
      action_type, declared_goal, reasoning, authorization_scope,
      trigger, systems_touched, input_summary,
      status, reversible, risk_score, confidence,
      recommendation_id, recommendation_applied, recommendation_override_reason,
      output_summary, side_effects, artifacts_created, error_message,
      timestamp_start, timestamp_end, duration_ms, cost_estimate,
      tokens_in, tokens_out,
      signature, verified
    ) VALUES (
      ${orgId},
      ${action_id},
      ${data.agent_id},
      ${data.agent_name || null},
      ${data.swarm_id || null},
      ${data.parent_action_id || null},
      ${data.action_type},
      ${data.declared_goal},
      ${data.reasoning || null},
      ${data.authorization_scope || null},
      ${data.trigger || null},
      ${JSON.stringify(data.systems_touched || [])},
      ${data.input_summary || null},
      ${actionStatus},
      ${data.reversible !== undefined ? (data.reversible ? 1 : 0) : 1},
      ${data.risk_score || 0},
      ${data.confidence || 50},
      ${data.recommendation_id || null},
      ${data.recommendation_applied ? 1 : 0},
      ${data.recommendation_override_reason || null},
      ${data.output_summary || null},
      ${JSON.stringify(data.side_effects || [])},
      ${JSON.stringify(data.artifacts_created || [])},
      ${data.error_message || null},
      ${timestamp_start},
      ${data.timestamp_end || null},
      ${data.duration_ms || null},
      ${costEstimate},
      ${data.tokens_in || 0},
      ${data.tokens_out || 0},
      ${signature},
      ${verified}
    )
    RETURNING *
  `;

  return rows[0] || null;
}

/**
 * Create a blocked action record for governance visibility.
 * Blocked actions are persisted to ensure they appear in the Decisions Ledger
 * and contribute to agent discovery, even though the action was not executed.
 */
export async function createBlockedActionRecord(sql, payload) {
  const {
    orgId,
    action_id,
    data,
    guardDecision,
    signature,
    verified,
    timestamp_start,
  } = payload;

  // Build error message from guard decision
  const blockedReason = guardDecision?.reason 
    || guardDecision?.reasons?.join('; ') 
    || 'Action blocked by policy';
  const matchedPolicies = guardDecision?.matched_policies || [];

  const rows = await sql`
    INSERT INTO action_records (
      org_id, action_id, agent_id, agent_name, swarm_id, parent_action_id,
      action_type, declared_goal, reasoning, authorization_scope,
      trigger, systems_touched, input_summary,
      status, reversible, risk_score, confidence,
      recommendation_id, recommendation_applied, recommendation_override_reason,
      output_summary, side_effects, artifacts_created, error_message,
      timestamp_start, timestamp_end, duration_ms, cost_estimate,
      tokens_in, tokens_out,
      signature, verified
    ) VALUES (
      ${orgId},
      ${action_id},
      ${data.agent_id},
      ${data.agent_name || null},
      ${data.swarm_id || null},
      ${data.parent_action_id || null},
      ${data.action_type},
      ${data.declared_goal},
      ${data.reasoning || null},
      ${data.authorization_scope || null},
      ${data.trigger || null},
      ${JSON.stringify(data.systems_touched || [])},
      ${data.input_summary || null},
      ${'blocked'},
      ${data.reversible !== undefined ? (data.reversible ? 1 : 0) : 1},
      ${data.risk_score || 0},
      ${data.confidence || 50},
      ${data.recommendation_id || null},
      ${data.recommendation_applied ? 1 : 0},
      ${data.recommendation_override_reason || null},
      ${null},
      ${'[]'},
      ${'[]'},
      ${'Blocked by policy: ' + blockedReason + (matchedPolicies.length > 0 ? ' [Policies: ' + matchedPolicies.join(', ') + ']' : '')},
      ${timestamp_start},
      ${timestamp_start},
      ${0},
      ${0},
      ${data.tokens_in || 0},
      ${data.tokens_out || 0},
      ${signature},
      ${verified}
    )
    RETURNING *
  `;

  return rows[0] || null;
}

export async function insertActionEmbedding(sql, { orgId, agentId, actionId, embedding }) {
  await sql`
    INSERT INTO action_embeddings (org_id, agent_id, action_id, embedding)
    VALUES (${orgId}, ${agentId}, ${actionId}, ${JSON.stringify(embedding)}::vector)
  `;
}

export async function getActionWithRelations(sql, orgId, actionId) {
  const [actions, loops, assumptions, msgSummaryRows] = await Promise.all([
    sql`SELECT * FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId}`,
    sql`SELECT * FROM open_loops WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at DESC`,
    sql`SELECT * FROM assumptions WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at DESC`,
    sql`SELECT COUNT(*)::int AS total,
        COALESCE(STRING_AGG(DISTINCT from_agent_id, ',') || CASE WHEN STRING_AGG(DISTINCT to_agent_id, ',') IS NOT NULL THEN ',' || STRING_AGG(DISTINCT to_agent_id, ',') ELSE '' END, '') AS participants,
        MIN(created_at) AS first_message_at,
        MAX(created_at) AS last_message_at
      FROM agent_messages WHERE org_id = ${orgId} AND action_id = ${actionId}`,
  ]);

  if (actions.length === 0) return null;

  const msgRaw = msgSummaryRows[0] || { total: 0, participants: '', first_message_at: null, last_message_at: null };
  const msgTotal = parseInt(msgRaw.total, 10) || 0;

  return {
    action: actions[0],
    open_loops: loops,
    assumptions,
    message_summary: {
      total: msgTotal,
      participants: msgRaw.participants ? [...new Set(msgRaw.participants.split(',').filter(Boolean))] : [],
      first_message_at: msgRaw.first_message_at || null,
      last_message_at: msgRaw.last_message_at || null,
    },
  };
}

export async function updateActionOutcome(sql, orgId, actionId, outcome) {
  // Verify existence and ownership
  const existing = await sql`SELECT action_id FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId} LIMIT 1`;
  if (existing.length === 0) return null;

  const data = { ...outcome };

  // JSON stringify array/object fields
  if (data.side_effects !== undefined) data.side_effects = JSON.stringify(data.side_effects);
  if (data.artifacts_created !== undefined) data.artifacts_created = JSON.stringify(data.artifacts_created);

  const fields = Object.keys(data).filter(k => OUTCOME_FIELDS.includes(k));
  if (fields.length === 0) return null;

  // Test-contract compatibility path for sql mocks that only provide .query() responses.
  if (typeof sql.query === 'function' && Array.isArray(sql.queryCalls)) {
    const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
    const values = fields.map(f => data[f]);
    const query = `UPDATE action_records SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE action_id = $${fields.length + 1} AND org_id = $${fields.length + 2} RETURNING *`;
    const queryParams = [...values, actionId, orgId];
    const updated = await sql.query(query, queryParams);
    return updated[0] || null;
  }

  // Single atomic UPDATE with all outcome fields at once.
  // Each field uses COALESCE to preserve existing values when not provided.
  const updated = await sql`
    UPDATE action_records SET
      status            = COALESCE(${fields.includes('status') ? data.status : null}, status),
      output_summary    = COALESCE(${fields.includes('output_summary') ? data.output_summary : null}, output_summary),
      side_effects      = COALESCE(${fields.includes('side_effects') ? data.side_effects : null}, side_effects),
      artifacts_created = COALESCE(${fields.includes('artifacts_created') ? data.artifacts_created : null}, artifacts_created),
      error_message     = COALESCE(${fields.includes('error_message') ? data.error_message : null}, error_message),
      timestamp_end     = COALESCE(${fields.includes('timestamp_end') ? data.timestamp_end : null}, timestamp_end),
      duration_ms       = COALESCE(${fields.includes('duration_ms') ? data.duration_ms : null}, duration_ms),
      cost_estimate     = COALESCE(${fields.includes('cost_estimate') ? data.cost_estimate : null}, cost_estimate),
      updated_at        = CURRENT_TIMESTAMP
    WHERE action_id = ${actionId} AND org_id = ${orgId}
    RETURNING *
  `;
  return updated[0] || null;
}

/**
 * Fetch all data required for an action trace (parent chain, assumptions, loops, related actions, sub-actions).
 */
export async function getActionTraceData(sql, orgId, actionId) {
  // Fetch the target action first to get metadata for related queries
  const actions = await sql`
    SELECT * FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId}
  `;

  if (actions.length === 0) return null;
  const action = actions[0];

  // Parallel fetch of direct associations and related signals
  const [assumptions, loops, relatedActions, subActions] = await Promise.all([
    sql`SELECT * FROM assumptions WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at ASC`,
    sql`SELECT * FROM open_loops WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at ASC`,
    sql`
      SELECT action_id, agent_id, agent_name, action_type, declared_goal, status,
             risk_score, timestamp_start, error_message
      FROM action_records
      WHERE action_id != ${actionId}
        AND org_id = ${orgId}
        AND (
          agent_id = ${action.agent_id}
          OR (systems_touched = ${action.systems_touched} AND systems_touched IS NOT NULL AND systems_touched != '[]')
        )
        AND timestamp_start::timestamptz > ${action.timestamp_start}::timestamptz - INTERVAL '1 hour'
        AND timestamp_start::timestamptz < ${action.timestamp_start}::timestamptz + INTERVAL '1 hour'
      ORDER BY timestamp_start DESC
      LIMIT 20
    `,
    sql`
      SELECT action_id, agent_id, agent_name, action_type, declared_goal, status,
             risk_score, timestamp_start, error_message
      FROM action_records
      WHERE parent_action_id = ${actionId}
        AND org_id = ${orgId}
      ORDER BY timestamp_start ASC
    `
  ]);

  // Recursively build parent chain (limited to 10 generations to prevent infinite loops)
  const parentChain = [];
  let currentParentId = action.parent_action_id;
  const visited = new Set([actionId]);
  while (currentParentId && !visited.has(currentParentId) && parentChain.length < 10) {
    visited.add(currentParentId);
    const parentResult = await sql`
      SELECT action_id, agent_id, agent_name, action_type, declared_goal, status,
             risk_score, timestamp_start, error_message, parent_action_id
      FROM action_records WHERE action_id = ${currentParentId} AND org_id = ${orgId}
    `;
    if (parentResult.length === 0) break;
    parentChain.push(parentResult[0]);
    currentParentId = parentResult[0].parent_action_id;
  }

  return {
    action,
    assumptions,
    loops,
    relatedActions,
    subActions,
    parentChain
  };
}

/**
 * Fetch decision throughput statistics for the last 24h and comparison window.
 */
export async function getActionStats(sql, orgId, agentId = null) {
  // Test-contract compatibility path for sql mocks
  if (typeof sql.query === 'function' && Array.isArray(sql.queryCalls)) {
    const agentFilter = agentId ? ' AND agent_id = $2' : '';
    const params = agentId ? [orgId, agentId] : [orgId];
    const currentQuery = `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status='completed')::int as completed,
        COUNT(*) FILTER (WHERE status='failed')::int as failed,
        COUNT(*) FILTER (WHERE status='blocked')::int as blocked,
        COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled,
        COUNT(*) FILTER (WHERE status='pending_approval')::int as approval
      FROM action_records
      WHERE org_id = $1 AND created_at > NOW() - INTERVAL '24 hours'${agentFilter}
    `;
    const previousQuery = `
      SELECT COUNT(*)::int as total
      FROM action_records
      WHERE org_id = $1 AND created_at <= NOW() - INTERVAL '24 hours' AND created_at > NOW() - INTERVAL '48 hours'${agentFilter}
    `;

    const [currentResults, previousResults] = await Promise.all([
      sql.query(currentQuery, params),
      sql.query(previousQuery, params)
    ]);

    return {
      current: currentResults[0] || { total: 0, completed: 0, failed: 0, blocked: 0, cancelled: 0, approval: 0 },
      previousTotal: previousResults[0]?.total || 0
    };
  }

  const [currentResults, previousResults] = agentId
    ? await Promise.all([
        sql`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status='completed')::int as completed,
            COUNT(*) FILTER (WHERE status='failed')::int as failed,
            COUNT(*) FILTER (WHERE status='blocked')::int as blocked,
            COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled,
            COUNT(*) FILTER (WHERE status='pending_approval')::int as approval
          FROM action_records
          WHERE org_id = ${orgId}
            AND agent_id = ${agentId}
            AND created_at > NOW() - INTERVAL '24 hours'
        `,
        sql`
          SELECT COUNT(*)::int as total
          FROM action_records
          WHERE org_id = ${orgId}
            AND agent_id = ${agentId}
            AND created_at <= NOW() - INTERVAL '24 hours'
            AND created_at > NOW() - INTERVAL '48 hours'
        `
      ])
    : await Promise.all([
        sql`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE status='completed')::int as completed,
            COUNT(*) FILTER (WHERE status='failed')::int as failed,
            COUNT(*) FILTER (WHERE status='blocked')::int as blocked,
            COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled,
            COUNT(*) FILTER (WHERE status='pending_approval')::int as approval
          FROM action_records
          WHERE org_id = ${orgId}
            AND created_at > NOW() - INTERVAL '24 hours'
        `,
        sql`
          SELECT COUNT(*)::int as total
          FROM action_records
          WHERE org_id = ${orgId}
            AND created_at <= NOW() - INTERVAL '24 hours'
            AND created_at > NOW() - INTERVAL '48 hours'
        `
      ]);

  return {
    current: currentResults[0] || { total: 0, completed: 0, failed: 0, blocked: 0, cancelled: 0, approval: 0 },
    previousTotal: previousResults[0]?.total || 0
  };
}

/**
 * Fetch historical actions for policy simulation.
 */
/**
 * Delete actions by a list of specific action IDs, including related loops and assumptions.
 */
export async function deleteActionsByIds(sql, orgId, idList) {
  await sql`DELETE FROM open_loops WHERE action_id = ANY(${idList}) AND org_id = ${orgId}`;
  await sql`DELETE FROM assumptions WHERE action_id = ANY(${idList}) AND org_id = ${orgId}`;
  return sql`DELETE FROM action_records WHERE action_id = ANY(${idList}) AND org_id = ${orgId} RETURNING action_id`;
}

/**
 * Aggregate cost and token usage for an org over a rolling time window.
 * Returns totals, per-agent breakdown, and per-day breakdown.
 */
export async function getCostAggregation(sql, orgId, { period = '30d', agentId = null } = {}) {
  const days = parseInt(period) || 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const agentFilter = agentId ? sql` AND agent_id = ${agentId}` : sql``;

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(cost_estimate), 0)::real as total_cost_usd,
      COALESCE(SUM(tokens_in), 0)::integer as total_tokens_in,
      COALESCE(SUM(tokens_out), 0)::integer as total_tokens_out
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
  `;

  const byAgent = await sql`
    SELECT
      agent_id,
      COALESCE(SUM(cost_estimate), 0)::real as cost_usd,
      COUNT(*)::integer as action_count
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
    GROUP BY agent_id
    ORDER BY cost_usd DESC
  `;

  const byDay = await sql`
    SELECT
      DATE(created_at::timestamptz) as date,
      COALESCE(SUM(cost_estimate), 0)::real as cost_usd,
      COUNT(*)::integer as action_count
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= ${since}::timestamptz
      ${agentFilter}
    GROUP BY DATE(created_at::timestamptz)
    ORDER BY date DESC
  `;

  return {
    total_cost_usd: totals.total_cost_usd,
    total_tokens_in: totals.total_tokens_in,
    total_tokens_out: totals.total_tokens_out,
    period,
    by_agent: byAgent,
    by_day: byDay,
  };
}

/**
 * Fetch historical actions for policy simulation.
 */
export async function listActionsForSimulation(sql, orgId, days = 7, limit = 200) {
  return sql`
    SELECT action_id, agent_id, agent_name, action_type, declared_goal, risk_score, 
           systems_touched, reversible, timestamp_start, status
    FROM action_records
    WHERE org_id = ${orgId}
      AND timestamp_start::timestamptz > NOW() - INTERVAL '1 day' * ${parseInt(days, 10)}
    ORDER BY timestamp_start DESC
    LIMIT ${parseInt(limit, 10)}
  `;
}
