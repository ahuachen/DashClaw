/**
 * Guardrails Test Runs repository
 */

export async function createTestRun(sql, orgId, data) {
  const result = await sql`
    INSERT INTO guardrails_test_runs (id, org_id, total_policies, total_tests, passed, failed, success, details, triggered_by, created_at)
    VALUES (${data.id}, ${orgId}, ${data.total_policies}, ${data.total_tests}, ${data.passed}, ${data.failed}, ${data.success ? 1 : 0}, ${JSON.stringify(data.details)}, ${data.triggered_by || 'manual'}, ${new Date().toISOString()})
    RETURNING *
  `;
  return result[0];
}

export async function listTestRuns(sql, orgId, limit = 20) {
  return sql`
    SELECT * FROM guardrails_test_runs
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getActivePolicies(sql, orgId) {
  return sql`
    SELECT * FROM guard_policies
    WHERE org_id = ${orgId} AND active = 1
    ORDER BY created_at DESC
  `;
}

export async function findPolicyByName(sql, orgId, name) {
  return sql`
    SELECT id FROM guard_policies WHERE org_id = ${orgId} AND name = ${name}
  `;
}

export async function deletePoliciesByIds(sql, orgId, idList) {
  return sql`
    DELETE FROM guard_policies
    WHERE id = ANY(${idList}) AND org_id = ${orgId}
    RETURNING id
  `;
}

export async function insertPolicy(sql, orgId, { id, name, policyType, rules, agentIds }) {
  const now = new Date().toISOString();
  const result = await sql`
    INSERT INTO guard_policies (id, org_id, name, policy_type, rules, active, agent_ids, created_at, updated_at)
    VALUES (${id}, ${orgId}, ${name}, ${policyType}, ${rules}, 1, ${agentIds || null}, ${now}, ${now})
    RETURNING *
  `;
  return result[0];
}
