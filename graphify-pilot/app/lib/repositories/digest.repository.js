const TABLE_CONFIG = [
  { key: 'actions', table: 'action_records', tsCol: 'timestamp_start', cols: 'action_id, action_type, declared_goal, status, risk_score, timestamp_start' },
  { key: 'decisions', table: 'decisions', tsCol: 'timestamp', cols: 'id, decision, outcome, timestamp' },
  { key: 'lessons', table: 'lessons', tsCol: 'timestamp', cols: 'id, lesson, content, timestamp' },
  { key: 'content', table: 'content', tsCol: 'created_at', cols: 'id, title, platform, status, created_at' },
  { key: 'ideas', table: 'ideas', tsCol: 'captured_at', noAgent: true, cols: 'id, title, score, captured_at' },
  { key: 'interactions', table: 'interactions', tsCol: 'created_at', cols: 'id, summary, direction, created_at' },
  { key: 'goals', table: 'goals', tsCol: 'created_at', cols: 'id, title, progress, status, created_at' },
];

function isMissingTable(err) {
  return String(err?.code || '').includes('42P01') ||
    String(err?.message || '').includes('does not exist');
}

async function safeQuery(promise) {
  try {
    return await promise;
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/**
 * Fetch digest data across all activity tables.
 * If `date` is provided, filters to that single day.
 * Otherwise returns recent activity (most recent first, capped at 50 per category).
 */
export async function fetchDigestData(sql, orgId, { agentId, date } = {}) {
  const queries = TABLE_CONFIG.map(({ table, tsCol, noAgent, cols }) => {
    if (date) {
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;
      if (agentId && !noAgent) {
        return safeQuery(sql.query(
          `SELECT ${cols} FROM ${table} WHERE org_id = $1 AND agent_id = $2 AND ${tsCol} >= $3 AND ${tsCol} <= $4 ORDER BY ${tsCol} DESC`,
          [orgId, agentId, dayStart, dayEnd]
        ));
      }
      return safeQuery(sql.query(
        `SELECT ${cols} FROM ${table} WHERE org_id = $1 AND ${tsCol} >= $2 AND ${tsCol} <= $3 ORDER BY ${tsCol} DESC`,
        [orgId, dayStart, dayEnd]
      ));
    }
    // Recent: no date filter, limit 50
    if (agentId && !noAgent) {
      return safeQuery(sql.query(
        `SELECT ${cols} FROM ${table} WHERE org_id = $1 AND agent_id = $2 ORDER BY ${tsCol} DESC LIMIT 50`,
        [orgId, agentId]
      ));
    }
    return safeQuery(sql.query(
      `SELECT ${cols} FROM ${table} WHERE org_id = $1 ORDER BY ${tsCol} DESC LIMIT 50`,
      [orgId]
    ));
  });

  const results = await Promise.all(queries);

  const data = {};
  TABLE_CONFIG.forEach(({ key }, i) => {
    data[key] = results[i];
  });
  return data;
}
