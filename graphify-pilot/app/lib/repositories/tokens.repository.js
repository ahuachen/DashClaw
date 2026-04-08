// --- Read queries ---

export async function getLatestSnapshot(sql, orgId, agentId) {
  if (agentId) {
    return sql`
      SELECT * FROM token_snapshots
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
  }
  return sql`
    SELECT * FROM token_snapshots
    WHERE org_id = ${orgId} AND agent_id IS NULL
    ORDER BY timestamp DESC
    LIMIT 1
  `;
}

export async function getTodayTotals(sql, orgId, agentId, today) {
  if (agentId) {
    return sql`
      SELECT * FROM daily_totals
      WHERE date = ${today} AND org_id = ${orgId} AND agent_id = ${agentId}
    `;
  }
  return sql`
    SELECT * FROM daily_totals
    WHERE date = ${today} AND org_id = ${orgId} AND agent_id IS NULL
  `;
}

export async function getHistory(sql, orgId, agentId) {
  if (agentId) {
    return sql`
      SELECT * FROM daily_totals
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
      ORDER BY date DESC
      LIMIT 7
    `;
  }
  return sql`
    SELECT * FROM daily_totals
    WHERE org_id = ${orgId} AND agent_id IS NULL
    ORDER BY date DESC
    LIMIT 7
  `;
}

export async function getRecentSnapshots(sql, orgId, agentId, since) {
  if (agentId) {
    return sql`
      SELECT timestamp, tokens_in, tokens_out
      FROM token_snapshots
      WHERE timestamp > ${since} AND org_id = ${orgId} AND agent_id = ${agentId}
      ORDER BY timestamp ASC
    `;
  }
  return sql`
    SELECT timestamp, tokens_in, tokens_out
    FROM token_snapshots
    WHERE timestamp > ${since} AND org_id = ${orgId} AND agent_id IS NULL
    ORDER BY timestamp ASC
  `;
}

export async function getPerAgentLatestSnapshots(sql, orgId) {
  return sql`
    SELECT DISTINCT ON (agent_id) agent_id, context_used, context_max, context_pct, model, timestamp
    FROM token_snapshots
    WHERE org_id = ${orgId} AND agent_id IS NOT NULL
    ORDER BY agent_id, timestamp DESC
  `;
}

// --- Write queries ---

export async function insertSnapshot(sql, orgId, data) {
  const {
    agentId, tokensIn, tokensOut, contextUsed, contextMax, contextPct,
    hourly_pct_left, weekly_pct_left, compactions, model, session_key, now
  } = data;

  return sql`
    INSERT INTO token_snapshots (
      org_id, agent_id, tokens_in, tokens_out, context_used, context_max, context_pct,
      hourly_pct_left, weekly_pct_left, compactions, model, session_key, timestamp
    ) VALUES (
      ${orgId}, ${agentId}, ${tokensIn}, ${tokensOut}, ${contextUsed}, ${contextMax}, ${contextPct},
      ${hourly_pct_left || 100}, ${weekly_pct_left || 100}, ${compactions || 0},
      ${model || 'unknown'}, ${session_key || agentId || 'sdk'}, ${now}
    )
    RETURNING *
  `;
}

export async function insertOrgAggregateSnapshot(sql, orgId, data) {
  const { now } = data;

  // Aggregate latest snapshot per agent to produce a real org-wide summary
  const agg = await sql`
    SELECT
      COALESCE(SUM(sub.tokens_in), 0) AS tokens_in,
      COALESCE(SUM(sub.tokens_out), 0) AS tokens_out,
      COALESCE(SUM(sub.context_used), 0) AS context_used,
      COALESCE(SUM(sub.context_max), 0) AS context_max,
      COALESCE(AVG(sub.context_pct), 0) AS context_pct,
      COALESCE(AVG(sub.hourly_pct_left), 100) AS hourly_pct_left,
      COALESCE(AVG(sub.weekly_pct_left), 100) AS weekly_pct_left,
      COALESCE(SUM(sub.compactions), 0) AS compactions
    FROM (
      SELECT DISTINCT ON (agent_id) tokens_in, tokens_out, context_used, context_max, context_pct,
        hourly_pct_left, weekly_pct_left, compactions
      FROM token_snapshots
      WHERE org_id = ${orgId} AND agent_id IS NOT NULL
      ORDER BY agent_id, timestamp DESC
    ) sub
  `;

  const row = agg[0] || {};
  return sql`
    INSERT INTO token_snapshots (
      org_id, agent_id, tokens_in, tokens_out, context_used, context_max, context_pct,
      hourly_pct_left, weekly_pct_left, compactions, model, session_key, timestamp
    ) VALUES (
      ${orgId}, ${null},
      ${row.tokens_in || 0}, ${row.tokens_out || 0},
      ${row.context_used || 0}, ${row.context_max || 0},
      ${Math.round(row.context_pct || 0)},
      ${Math.round(row.hourly_pct_left || 100)}, ${Math.round(row.weekly_pct_left || 100)},
      ${row.compactions || 0},
      ${'aggregate'}, ${'org-aggregate'}, ${now}
    )
  `;
}

// --- Budget queries ---

export async function getTokenBudget(sql, orgId, agentId = null) {
  try {
    const rows = agentId
      ? await sql`SELECT * FROM token_budgets WHERE org_id = ${orgId} AND agent_id = ${agentId}`
      : await sql`SELECT * FROM token_budgets WHERE org_id = ${orgId} AND agent_id IS NULL`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

export async function upsertTokenBudget(sql, orgId, agentId, limits) {
  const { daily_limit, weekly_limit, monthly_limit } = limits;
  const now = new Date().toISOString();
  const rows = await sql`
    INSERT INTO token_budgets (org_id, agent_id, daily_limit, weekly_limit, monthly_limit, updated_at)
    VALUES (${orgId}, ${agentId || null}, ${daily_limit}, ${weekly_limit}, ${monthly_limit}, ${now})
    ON CONFLICT (org_id, COALESCE(agent_id, ''))
    DO UPDATE SET daily_limit = ${daily_limit}, weekly_limit = ${weekly_limit}, monthly_limit = ${monthly_limit}, updated_at = ${now}
    RETURNING *
  `;
  return rows[0] || null;
}

export async function upsertDailyTotals(sql, orgId, agentId, today, tokensIn, tokensOut, contextPct) {
  await sql.query(
    `INSERT INTO daily_totals (org_id, agent_id, date, total_tokens_in, total_tokens_out, total_tokens, peak_context_pct, snapshots_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
     ON CONFLICT (org_id, COALESCE(agent_id, ''), date)
     DO UPDATE SET
       total_tokens_in = daily_totals.total_tokens_in + $4,
       total_tokens_out = daily_totals.total_tokens_out + $5,
       total_tokens = daily_totals.total_tokens + $6,
       peak_context_pct = GREATEST(daily_totals.peak_context_pct, $7),
       snapshots_count = daily_totals.snapshots_count + 1`,
    [orgId, agentId, today, tokensIn, tokensOut, tokensIn + tokensOut, contextPct]
  );
}
