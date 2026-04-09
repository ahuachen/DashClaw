import crypto from 'crypto';

export function shapeAccessRule(row) {
  if (!row) return null;
  return {
    rule_id: row.rule_id,
    org_id: row.org_id,
    capability_id: row.capability_id,
    agent_id: row.agent_id || null,
    access: row.access,
    reason: row.reason || null,
    created_by: row.created_by || null,
    created_at: row.created_at,
  };
}

const VALID_ACCESS_LEVELS = new Set(['allow', 'deny', 'require_approval']);

export async function evaluateAccess(sql, orgId, capabilityId, agentId) {
  // Single query: agent-specific rules first, then org-wide defaults
  const rows = await sql`
    SELECT rule_id, org_id, capability_id, agent_id, access, reason, created_by, created_at
    FROM capability_access_rules
    WHERE org_id = ${orgId}
      AND capability_id = ${capabilityId}
      AND (agent_id = ${agentId} OR agent_id IS NULL)
    ORDER BY agent_id IS NULL ASC
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { access: 'allow', rule: null };
  }

  return { access: rows[0].access, rule: shapeAccessRule(rows[0]) };
}

export async function listAccessRules(sql, orgId, capabilityId) {
  const rows = await sql`
    SELECT * FROM capability_access_rules
    WHERE org_id = ${orgId} AND capability_id = ${capabilityId}
    ORDER BY agent_id IS NULL ASC, created_at DESC
  `;
  return { rules: rows.map(shapeAccessRule) };
}

export async function createAccessRule(sql, orgId, data) {
  if (!VALID_ACCESS_LEVELS.has(data.access)) {
    throw new Error(`Invalid access level: ${data.access}. Must be allow, deny, or require_approval.`);
  }

  // Check for duplicate (same capability + agent)
  const existing = await sql`
    SELECT rule_id FROM capability_access_rules
    WHERE org_id = ${orgId}
      AND capability_id = ${data.capability_id}
      AND ${data.agent_id ? sql`agent_id = ${data.agent_id}` : sql`agent_id IS NULL`}
    LIMIT 1
  `;

  if (existing.length > 0) {
    throw new Error('A rule for this capability and agent already exists. Delete it first.');
  }

  const ruleId = `car_${crypto.randomUUID()}`;
  const rows = await sql`
    INSERT INTO capability_access_rules (
      rule_id, org_id, capability_id, agent_id, access, reason, created_by
    ) VALUES (
      ${ruleId}, ${orgId}, ${data.capability_id},
      ${data.agent_id || null}, ${data.access}, ${data.reason || null}, ${data.created_by || null}
    )
    RETURNING *
  `;
  return shapeAccessRule(rows[0]);
}

export async function deleteAccessRule(sql, orgId, ruleId) {
  const rows = await sql`
    DELETE FROM capability_access_rules
    WHERE org_id = ${orgId} AND rule_id = ${ruleId}
    RETURNING rule_id
  `;
  return rows.length > 0 ? { deleted: true } : null;
}
