import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);
const SOURCE_TYPES = new Set([
  'internal_sdk',
  'http_api',
  'webhook',
  'human_approval',
  'external_marketplace',
]);

function safeJsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `cap-${Date.now()}`;
}

export function shapeCapability(row) {
  if (!row) return null;
  return {
    capability_id: row.capability_id,
    org_id: row.org_id,
    name: row.name,
    slug: row.slug,
    description: row.description || null,
    category: row.category || null,
    source_type: row.source_type,
    auth_type: row.auth_type || null,
    risk_level: row.risk_level,
    requires_approval: row.requires_approval === 1 || row.requires_approval === true,
    tags: safeJsonParse(row.tags_json, []),
    pricing: safeJsonParse(row.pricing_json, {}),
    health_status: row.health_status,
    docs_url: row.docs_url || null,
    invocation_schema: safeJsonParse(row.invocation_schema_json, {}),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function listCapabilities(sql, orgId, filters = {}) {
  const { category, risk_level, search, limit = 100, offset = 0 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 100, 500);
  const parsedOffset = parseInt(offset, 10) || 0;

  // Branch on which filters are present. This keeps the tagged-template mock
  // path simple (no inline sql`` interpolation fragments).
  let rows;
  if (search && category && risk_level) {
    const term = `%${search}%`;
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId}
        AND category = ${category}
        AND risk_level = ${risk_level}
        AND (name ILIKE ${term} OR description ILIKE ${term} OR tags_json ILIKE ${term})
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (search && category) {
    const term = `%${search}%`;
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId}
        AND category = ${category}
        AND (name ILIKE ${term} OR description ILIKE ${term} OR tags_json ILIKE ${term})
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (search && risk_level) {
    const term = `%${search}%`;
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId}
        AND risk_level = ${risk_level}
        AND (name ILIKE ${term} OR description ILIKE ${term} OR tags_json ILIKE ${term})
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (search) {
    const term = `%${search}%`;
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId}
        AND (name ILIKE ${term} OR description ILIKE ${term} OR tags_json ILIKE ${term})
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (category && risk_level) {
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId} AND category = ${category} AND risk_level = ${risk_level}
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (category) {
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId} AND category = ${category}
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else if (risk_level) {
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId} AND risk_level = ${risk_level}
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  } else {
    rows = await sql`
      SELECT * FROM capabilities
      WHERE org_id = ${orgId}
      ORDER BY updated_at DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset}
    `;
  }

  return rows.map(shapeCapability);
}

export async function getCapability(sql, orgId, capabilityId) {
  const rows = await sql`
    SELECT *
    FROM capabilities
    WHERE org_id = ${orgId} AND capability_id = ${capabilityId}
    LIMIT 1
  `;
  return shapeCapability(rows[0]);
}

export async function getCapabilityBySlug(sql, orgId, slug) {
  const rows = await sql`
    SELECT * FROM capabilities
    WHERE org_id = ${orgId} AND slug = ${slug}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return shapeCapability(rows[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export async function createCapability(sql, orgId, data) {
  if (!data?.name || typeof data.name !== 'string') {
    throw new Error('name is required');
  }
  if (data.risk_level && !RISK_LEVELS.has(data.risk_level)) {
    throw new Error(`risk_level must be one of ${Array.from(RISK_LEVELS).join(', ')}`);
  }
  if (data.source_type && !SOURCE_TYPES.has(data.source_type)) {
    throw new Error(`source_type must be one of ${Array.from(SOURCE_TYPES).join(', ')}`);
  }

  const capability_id = data.capability_id || `cap_${crypto.randomUUID()}`;
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);

  const rows = await sql`
    INSERT INTO capabilities (
      capability_id,
      org_id,
      name,
      slug,
      description,
      category,
      source_type,
      auth_type,
      risk_level,
      requires_approval,
      tags_json,
      pricing_json,
      health_status,
      docs_url,
      invocation_schema_json
    ) VALUES (
      ${capability_id},
      ${orgId},
      ${data.name},
      ${slug},
      ${data.description || null},
      ${data.category || null},
      ${data.source_type || 'internal_sdk'},
      ${data.auth_type || 'none'},
      ${data.risk_level || 'medium'},
      ${data.requires_approval ? 1 : 0},
      ${JSON.stringify(data.tags || [])},
      ${JSON.stringify(data.pricing || {})},
      ${data.health_status || 'unknown'},
      ${data.docs_url || null},
      ${JSON.stringify(data.invocation_schema || {})}
    )
    RETURNING *
  `;

  return shapeCapability(rows[0]);
}

export async function updateCapability(sql, orgId, capabilityId, patch = {}) {
  const existing = await getCapability(sql, orgId, capabilityId);
  if (!existing) return null;

  if (patch.risk_level && !RISK_LEVELS.has(patch.risk_level)) {
    throw new Error(`risk_level must be one of ${Array.from(RISK_LEVELS).join(', ')}`);
  }
  if (patch.source_type && !SOURCE_TYPES.has(patch.source_type)) {
    throw new Error(`source_type must be one of ${Array.from(SOURCE_TYPES).join(', ')}`);
  }

  const rows = await sql`
    UPDATE capabilities SET
      name = ${patch.name ?? existing.name},
      description = ${patch.description ?? existing.description},
      category = ${patch.category ?? existing.category},
      source_type = ${patch.source_type ?? existing.source_type},
      auth_type = ${patch.auth_type ?? existing.auth_type},
      risk_level = ${patch.risk_level ?? existing.risk_level},
      requires_approval = ${
        'requires_approval' in patch
          ? patch.requires_approval
            ? 1
            : 0
          : existing.requires_approval
          ? 1
          : 0
      },
      tags_json = ${JSON.stringify(patch.tags ?? existing.tags)},
      pricing_json = ${JSON.stringify(patch.pricing ?? existing.pricing)},
      health_status = ${patch.health_status ?? existing.health_status},
      docs_url = ${patch.docs_url ?? existing.docs_url},
      invocation_schema_json = ${JSON.stringify(patch.invocation_schema ?? existing.invocation_schema)},
      updated_at = now()
    WHERE org_id = ${orgId} AND capability_id = ${capabilityId}
    RETURNING *
  `;

  return shapeCapability(rows[0]);
}
