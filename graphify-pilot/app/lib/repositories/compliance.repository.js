/**
 * Compliance Snapshots repository
 */

export async function createSnapshot(sql, orgId, data) {
  const result = await sql`
    INSERT INTO compliance_snapshots (id, org_id, framework, total_controls, covered, partial, gaps, coverage_percentage, risk_level, full_report, created_at)
    VALUES (${data.id}, ${orgId}, ${data.framework}, ${data.total_controls}, ${data.covered}, ${data.partial}, ${data.gaps}, ${data.coverage_percentage}, ${data.risk_level}, ${data.full_report}, ${new Date().toISOString()})
    RETURNING *
  `;
  return result[0];
}

export async function listSnapshots(sql, orgId, framework, limit = 20) {
  if (framework) {
    return sql`
      SELECT * FROM compliance_snapshots
      WHERE org_id = ${orgId} AND framework = ${framework}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }
  return sql`
    SELECT * FROM compliance_snapshots
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getGuardDecisionEvidence(sql, orgId, windowDays = 30) {
  return sql`
    SELECT
      action_type,
      decision,
      COUNT(*) as count
    FROM guard_decisions
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= NOW() - ${windowDays + ' days'}::interval
    GROUP BY action_type, decision
    ORDER BY count DESC
  `;
}

export async function getActionRecordEvidence(sql, orgId, windowDays = 30) {
  return sql`
    SELECT
      action_type,
      COUNT(*) as count
    FROM action_records
    WHERE org_id = ${orgId}
      AND created_at::timestamptz >= NOW() - ${windowDays + ' days'}::interval
    GROUP BY action_type
    ORDER BY count DESC
  `;
}
