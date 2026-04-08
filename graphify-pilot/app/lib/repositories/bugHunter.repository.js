/**
 * Bug Hunter repository — data-access layer for bug_hunter_scans table.
 * Route-sql guardrail: routes import from here instead of writing SQL directly.
 */

export async function listScans(sql, orgId, limit = 50) {
  try {
    return await sql`
      SELECT scan_id, agent_id, scope, status, findings_count, created_at
      FROM bug_hunter_scans
      WHERE org_id = ${orgId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  } catch {
    // Table may not exist yet
    return [];
  }
}

export async function getScanStats(sql, orgId) {
  try {
    const rows = await sql`
      SELECT
        COUNT(*)::int AS total_scans,
        COALESCE(SUM(findings_count), 0)::int AS issues_found,
        COALESCE(SUM(resolved_count), 0)::int AS resolved,
        COALESCE(SUM(findings_count) - SUM(resolved_count), 0)::int AS open
      FROM bug_hunter_scans
      WHERE org_id = ${orgId}
    `;
    return rows[0] || { total_scans: 0, issues_found: 0, resolved: 0, open: 0 };
  } catch {
    return { total_scans: 0, issues_found: 0, resolved: 0, open: 0 };
  }
}

export async function insertScan(sql, orgId, { scanId, agentId, scope, findingsCount }) {
  try {
    await sql`
      INSERT INTO bug_hunter_scans (scan_id, org_id, agent_id, scope, status, findings_count, resolved_count, created_at)
      VALUES (${scanId}, ${orgId}, ${agentId}, ${scope}, 'completed', ${findingsCount}, 0, NOW())
    `;
    return true;
  } catch {
    // Table may not exist yet
    return false;
  }
}
