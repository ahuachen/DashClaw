import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function safeJsonParse(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape helpers
// ─────────────────────────────────────────────────────────────────────────────

export function shapeArtifact(row) {
  if (!row) return null;
  return {
    artifact_id: row.artifact_id,
    org_id: row.org_id,
    artifact_type: row.artifact_type,
    name: row.name,
    description: row.description || null,
    content: safeJsonParse(row.content_json),
    content_url: row.content_url || null,
    mime_type: row.mime_type || null,
    size_bytes: row.size_bytes || null,
    source_action_id: row.source_action_id || null,
    source_step_id: row.source_step_id || null,
    source_agent_id: row.source_agent_id || null,
    retention_days: row.retention_days || null,
    tags: safeJsonParse(row.tags_json) || [],
    metadata: safeJsonParse(row.metadata_json) || {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createArtifact(sql, orgId, data) {
  const artifactId = `art_${crypto.randomUUID()}`;
  const rows = await sql`
    INSERT INTO artifacts (
      artifact_id, org_id, artifact_type, name, description,
      content_json, content_url, mime_type, size_bytes,
      source_action_id, source_step_id, source_agent_id,
      retention_days, tags_json, metadata_json
    ) VALUES (
      ${artifactId}, ${orgId}, ${data.artifact_type}, ${data.name}, ${data.description || null},
      ${data.content_json ? (typeof data.content_json === 'string' ? data.content_json : JSON.stringify(data.content_json)) : null},
      ${data.content_url || null}, ${data.mime_type || null}, ${data.size_bytes || null},
      ${data.source_action_id || null}, ${data.source_step_id || null}, ${data.source_agent_id || null},
      ${data.retention_days || null},
      ${JSON.stringify(data.tags || [])},
      ${JSON.stringify(data.metadata || {})}
    )
    RETURNING *
  `;
  return shapeArtifact(rows[0]);
}

export async function listArtifacts(sql, orgId, filters = {}) {
  const { action_id, step_id, agent_id, artifact_type, limit = 50, offset = 0 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  const rows = await sql`
    SELECT * FROM artifacts
    WHERE org_id = ${orgId}
      ${action_id ? sql`AND source_action_id = ${action_id}` : sql``}
      ${step_id ? sql`AND source_step_id = ${step_id}` : sql``}
      ${agent_id ? sql`AND source_agent_id = ${agent_id}` : sql``}
      ${artifact_type ? sql`AND artifact_type = ${artifact_type}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${parsedLimit}
    OFFSET ${parsedOffset}
  `;

  const countRows = await sql`
    SELECT COUNT(*)::int AS total FROM artifacts
    WHERE org_id = ${orgId}
      ${action_id ? sql`AND source_action_id = ${action_id}` : sql``}
      ${step_id ? sql`AND source_step_id = ${step_id}` : sql``}
      ${agent_id ? sql`AND source_agent_id = ${agent_id}` : sql``}
      ${artifact_type ? sql`AND artifact_type = ${artifact_type}` : sql``}
  `;

  return {
    artifacts: rows.map(shapeArtifact),
    total: countRows[0]?.total || 0,
  };
}

export async function getArtifact(sql, orgId, artifactId) {
  const rows = await sql`
    SELECT * FROM artifacts
    WHERE org_id = ${orgId} AND artifact_id = ${artifactId}
    LIMIT 1
  `;
  return shapeArtifact(rows[0] || null);
}

export async function deleteArtifact(sql, orgId, artifactId) {
  const rows = await sql`
    DELETE FROM artifacts
    WHERE org_id = ${orgId} AND artifact_id = ${artifactId}
    RETURNING artifact_id
  `;
  return rows.length > 0 ? { deleted: true } : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence bundle builder
// ─────────────────────────────────────────────────────────────────────────────

export async function buildEvidenceBundle(sql, orgId, actionId) {
  // Load action
  const actionRows = await sql`
    SELECT action_id, status, agent_id, declared_goal, action_type,
           risk_score, reasoning, output_summary, error_message,
           timestamp_start, timestamp_end, duration_ms
    FROM action_records
    WHERE org_id = ${orgId} AND action_id = ${actionId}
    LIMIT 1
  `;
  if (actionRows.length === 0) return null;

  const action = actionRows[0];

  // Load child steps
  const stepRows = await sql`
    SELECT action_id, action_type, status, declared_goal, output_summary, error_message, duration_ms
    FROM action_records
    WHERE org_id = ${orgId} AND parent_action_id = ${actionId}
    ORDER BY timestamp_start ASC
  `;

  // Load linked artifacts
  const artifactRows = await sql`
    SELECT * FROM artifacts
    WHERE org_id = ${orgId} AND source_action_id = ${actionId}
    ORDER BY created_at ASC
  `;

  return {
    artifact_type: 'evidence_bundle',
    action: {
      action_id: action.action_id,
      status: action.status,
      agent_id: action.agent_id,
      declared_goal: action.declared_goal,
      action_type: action.action_type,
      risk_score: action.risk_score,
      output_summary: action.output_summary,
      error_message: action.error_message,
      duration_ms: action.duration_ms,
      started_at: action.timestamp_start,
      finished_at: action.timestamp_end,
    },
    steps: stepRows.map((s) => ({
      action_id: s.action_id,
      action_type: s.action_type,
      status: s.status,
      declared_goal: s.declared_goal,
      output_summary: s.output_summary,
      error_message: s.error_message,
      duration_ms: s.duration_ms,
    })),
    artifacts: artifactRows.map(shapeArtifact),
    generated_at: new Date().toISOString(),
  };
}
