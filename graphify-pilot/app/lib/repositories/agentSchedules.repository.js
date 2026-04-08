export async function listSchedules(sql, orgId, agentId) {
  if (agentId) {
    return sql`
      SELECT * FROM agent_schedules
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
      ORDER BY created_at DESC
    `;
  }
  return sql`
    SELECT * FROM agent_schedules
    WHERE org_id = ${orgId}
    ORDER BY agent_id, created_at DESC
  `;
}

export async function createSchedule(sql, orgId, data) {
  const { agent_id, name, description, cron_expression, enabled, next_run } = data;
  const rows = await sql`
    INSERT INTO agent_schedules (org_id, agent_id, name, description, cron_expression, enabled, next_run)
    VALUES (
      ${orgId},
      ${agent_id},
      ${name},
      ${description || null},
      ${cron_expression},
      ${enabled !== false},
      ${next_run || null}
    )
    RETURNING *
  `;
  return rows[0];
}
