import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const COST_SENSITIVITY = new Set(['low', 'balanced', 'high-quality']);
const LATENCY_SENSITIVITY = new Set(['low', 'medium', 'high']);

function safeJsonParse(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Validate a strategy config payload. Throws with a descriptive error on the
 * first violation. Intentionally lightweight — we only enforce fields that
 * cause downstream surprises, not a full JSON schema.
 */
export function validateStrategyConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('config must be an object');
  }
  if (!config.primary || typeof config.primary !== 'object') {
    throw new Error('config.primary is required');
  }
  if (!config.primary.provider || !config.primary.model) {
    throw new Error('config.primary.provider and config.primary.model are required');
  }
  if (config.costSensitivity && !COST_SENSITIVITY.has(config.costSensitivity)) {
    throw new Error(
      `config.costSensitivity must be one of ${Array.from(COST_SENSITIVITY).join(', ')}`
    );
  }
  if (config.latencySensitivity && !LATENCY_SENSITIVITY.has(config.latencySensitivity)) {
    throw new Error(
      `config.latencySensitivity must be one of ${Array.from(LATENCY_SENSITIVITY).join(', ')}`
    );
  }
  if (config.maxBudgetUsd != null && typeof config.maxBudgetUsd !== 'number') {
    throw new Error('config.maxBudgetUsd must be a number when provided');
  }
  if (config.maxRetries != null && !Number.isInteger(config.maxRetries)) {
    throw new Error('config.maxRetries must be an integer when provided');
  }
  if (config.fallback != null && !Array.isArray(config.fallback)) {
    throw new Error('config.fallback must be an array when provided');
  }
  if (config.allowedProviders != null && !Array.isArray(config.allowedProviders)) {
    throw new Error('config.allowedProviders must be an array when provided');
  }
  if (config.disallowedProviders != null && !Array.isArray(config.disallowedProviders)) {
    throw new Error('config.disallowedProviders must be an array when provided');
  }
  return true;
}

export function shapeStrategy(row) {
  if (!row) return null;
  return {
    strategy_id: row.strategy_id,
    org_id: row.org_id,
    name: row.name,
    description: row.description || null,
    config: safeJsonParse(row.config_json, {}),
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function listModelStrategies(sql, orgId) {
  const rows = await sql`
    SELECT *
    FROM model_strategies
    WHERE org_id = ${orgId}
    ORDER BY updated_at DESC
  `;
  return rows.map(shapeStrategy);
}

export async function getModelStrategy(sql, orgId, strategyId) {
  const rows = await sql`
    SELECT *
    FROM model_strategies
    WHERE org_id = ${orgId} AND strategy_id = ${strategyId}
    LIMIT 1
  `;
  return shapeStrategy(rows[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export async function createModelStrategy(sql, orgId, data) {
  if (!data?.name || typeof data.name !== 'string') {
    throw new Error('name is required');
  }
  validateStrategyConfig(data.config);

  const strategy_id = data.strategy_id || `mst_${crypto.randomUUID()}`;

  const rows = await sql`
    INSERT INTO model_strategies (
      strategy_id,
      org_id,
      name,
      description,
      config_json,
      created_by
    ) VALUES (
      ${strategy_id},
      ${orgId},
      ${data.name},
      ${data.description || null},
      ${JSON.stringify(data.config)},
      ${data.created_by || null}
    )
    RETURNING *
  `;

  return shapeStrategy(rows[0]);
}

export async function updateModelStrategy(sql, orgId, strategyId, patch = {}) {
  const existing = await getModelStrategy(sql, orgId, strategyId);
  if (!existing) return null;

  const nextConfig = 'config' in patch ? { ...existing.config, ...patch.config } : existing.config;
  if ('config' in patch) {
    validateStrategyConfig(nextConfig);
  }

  const rows = await sql`
    UPDATE model_strategies SET
      name = ${patch.name ?? existing.name},
      description = ${patch.description ?? existing.description},
      config_json = ${JSON.stringify(nextConfig)},
      updated_at = now()
    WHERE org_id = ${orgId} AND strategy_id = ${strategyId}
    RETURNING *
  `;
  return shapeStrategy(rows[0]);
}

export async function deleteModelStrategy(sql, orgId, strategyId) {
  const existing = await getModelStrategy(sql, orgId, strategyId);
  if (!existing) return false;

  // Null out the soft reference on any workflow templates that linked to it
  // so we don't leave dangling FKs.
  await sql`
    UPDATE workflow_templates
    SET model_strategy_id = NULL, updated_at = now()
    WHERE org_id = ${orgId} AND model_strategy_id = ${strategyId}
  `;

  await sql`
    DELETE FROM model_strategies
    WHERE org_id = ${orgId} AND strategy_id = ${strategyId}
  `;
  return true;
}
