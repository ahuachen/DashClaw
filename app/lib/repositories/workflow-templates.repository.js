import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
    .slice(0, 80) || `wft-${Date.now()}`;
}

/**
 * Shape the raw DB row into the API representation. Parses every *_json column
 * back into arrays/objects so callers don't have to double-decode.
 */
export function shapeTemplate(row) {
  if (!row) return null;
  return {
    template_id: row.template_id,
    org_id: row.org_id,
    name: row.name,
    slug: row.slug,
    description: row.description || null,
    objective: row.objective || null,
    steps: safeJsonParse(row.steps_json, []),
    model_strategy_id: row.model_strategy_id || null,
    model_strategy_snapshot: safeJsonParse(row.model_strategy_snapshot, null),
    linked_prompt_template_ids: safeJsonParse(row.linked_prompt_template_ids_json, []),
    linked_policy_ids: safeJsonParse(row.linked_policy_ids_json, []),
    linked_knowledge_collection_ids: safeJsonParse(row.linked_knowledge_collection_ids_json, []),
    linked_capability_ids: safeJsonParse(row.linked_capability_ids_json, []),
    linked_capability_tags: safeJsonParse(row.linked_capability_tags_json, []),
    version: row.version,
    status: row.status,
    created_by: row.created_by || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function listWorkflowTemplates(sql, orgId, filters = {}) {
  const { status, limit = 50, offset = 0 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
  const parsedOffset = parseInt(offset, 10) || 0;

  const rows = status
    ? await sql`
        SELECT *
        FROM workflow_templates
        WHERE org_id = ${orgId} AND status = ${status}
        ORDER BY updated_at DESC
        LIMIT ${parsedLimit}
        OFFSET ${parsedOffset}
      `
    : await sql`
        SELECT *
        FROM workflow_templates
        WHERE org_id = ${orgId}
        ORDER BY updated_at DESC
        LIMIT ${parsedLimit}
        OFFSET ${parsedOffset}
      `;

  return rows.map(shapeTemplate);
}

export async function getWorkflowTemplate(sql, orgId, templateId) {
  const rows = await sql`
    SELECT *
    FROM workflow_templates
    WHERE org_id = ${orgId} AND template_id = ${templateId}
    LIMIT 1
  `;
  return shapeTemplate(rows[0]);
}

export async function getWorkflowTemplateBySlug(sql, orgId, slug) {
  const rows = await sql`
    SELECT *
    FROM workflow_templates
    WHERE org_id = ${orgId} AND slug = ${slug}
    LIMIT 1
  `;
  return shapeTemplate(rows[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

export async function createWorkflowTemplate(sql, orgId, data) {
  if (!data?.name || typeof data.name !== 'string') {
    throw new Error('name is required');
  }

  const template_id = data.template_id || `wft_${crypto.randomUUID()}`;
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);

  const rows = await sql`
    INSERT INTO workflow_templates (
      template_id,
      org_id,
      name,
      slug,
      description,
      objective,
      steps_json,
      model_strategy_id,
      linked_prompt_template_ids_json,
      linked_policy_ids_json,
      linked_knowledge_collection_ids_json,
      linked_capability_ids_json,
      linked_capability_tags_json,
      version,
      status,
      created_by
    ) VALUES (
      ${template_id},
      ${orgId},
      ${data.name},
      ${slug},
      ${data.description || null},
      ${data.objective || null},
      ${JSON.stringify(data.steps || [])},
      ${data.model_strategy_id || null},
      ${JSON.stringify(data.linked_prompt_template_ids || [])},
      ${JSON.stringify(data.linked_policy_ids || [])},
      ${JSON.stringify(data.linked_knowledge_collection_ids || [])},
      ${JSON.stringify(data.linked_capability_ids || [])},
      ${JSON.stringify(data.linked_capability_tags || [])},
      ${1},
      ${data.status || 'draft'},
      ${data.created_by || null}
    )
    RETURNING *
  `;

  return shapeTemplate(rows[0]);
}

/**
 * Partial update. Bumps version by 1 when `steps` changes. All array/object
 * fields are re-stringified into their *_json columns.
 */
export async function updateWorkflowTemplate(sql, orgId, templateId, patch = {}) {
  const existing = await getWorkflowTemplate(sql, orgId, templateId);
  if (!existing) return null;

  const next = {
    name: patch.name ?? existing.name,
    slug: patch.slug ? slugify(patch.slug) : existing.slug,
    description: patch.description ?? existing.description,
    objective: patch.objective ?? existing.objective,
    steps: patch.steps ?? existing.steps,
    model_strategy_id:
      'model_strategy_id' in patch ? patch.model_strategy_id : existing.model_strategy_id,
    linked_prompt_template_ids:
      patch.linked_prompt_template_ids ?? existing.linked_prompt_template_ids,
    linked_policy_ids: patch.linked_policy_ids ?? existing.linked_policy_ids,
    linked_knowledge_collection_ids:
      patch.linked_knowledge_collection_ids ?? existing.linked_knowledge_collection_ids,
    linked_capability_ids: patch.linked_capability_ids ?? existing.linked_capability_ids,
    linked_capability_tags: patch.linked_capability_tags ?? existing.linked_capability_tags,
    status: patch.status ?? existing.status,
  };

  const stepsChanged = 'steps' in patch && JSON.stringify(patch.steps) !== JSON.stringify(existing.steps);
  const version = stepsChanged ? existing.version + 1 : existing.version;

  const rows = await sql`
    UPDATE workflow_templates SET
      name = ${next.name},
      slug = ${next.slug},
      description = ${next.description},
      objective = ${next.objective},
      steps_json = ${JSON.stringify(next.steps)},
      model_strategy_id = ${next.model_strategy_id},
      linked_prompt_template_ids_json = ${JSON.stringify(next.linked_prompt_template_ids)},
      linked_policy_ids_json = ${JSON.stringify(next.linked_policy_ids)},
      linked_knowledge_collection_ids_json = ${JSON.stringify(next.linked_knowledge_collection_ids)},
      linked_capability_ids_json = ${JSON.stringify(next.linked_capability_ids)},
      linked_capability_tags_json = ${JSON.stringify(next.linked_capability_tags)},
      version = ${version},
      status = ${next.status},
      updated_at = now()
    WHERE org_id = ${orgId} AND template_id = ${templateId}
    RETURNING *
  `;

  return shapeTemplate(rows[0]);
}

export async function duplicateWorkflowTemplate(sql, orgId, templateId, overrides = {}) {
  const existing = await getWorkflowTemplate(sql, orgId, templateId);
  if (!existing) return null;

  const baseName = overrides.name || `${existing.name} (copy)`;
  const baseSlug = overrides.slug || `${existing.slug}-copy-${Date.now().toString(36)}`;

  return createWorkflowTemplate(sql, orgId, {
    name: baseName,
    slug: baseSlug,
    description: existing.description,
    objective: existing.objective,
    steps: existing.steps,
    model_strategy_id: existing.model_strategy_id,
    linked_prompt_template_ids: existing.linked_prompt_template_ids,
    linked_policy_ids: existing.linked_policy_ids,
    linked_knowledge_collection_ids: existing.linked_knowledge_collection_ids,
    linked_capability_ids: existing.linked_capability_ids,
    linked_capability_tags: existing.linked_capability_tags,
    status: 'draft',
    created_by: overrides.created_by || existing.created_by,
  });
}

export async function deleteWorkflowTemplate(sql, orgId, templateId) {
  const existing = await getWorkflowTemplate(sql, orgId, templateId);
  if (!existing) return false;

  await sql`
    DELETE FROM workflow_templates
    WHERE org_id = ${orgId} AND template_id = ${templateId}
  `;

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Launch — creates a traceable action record tied back to the template
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Launching a workflow template in Phase 1 does NOT run an orchestrator.
 * It creates an action_records row with workflow metadata encoded into the
 * trigger + reasoning fields so every downstream governance primitive
 * (decision replay, trace, guard, mission-control) picks it up for free.
 *
 * `resolvedStrategy` is the parsed model_strategies.config_json at launch
 * time — captured as a snapshot so the linked strategy can later change
 * without rewriting history.
 */
export async function launchWorkflowTemplate(sql, orgId, templateId, options = {}) {
  const template = await getWorkflowTemplate(sql, orgId, templateId);
  if (!template) return null;

  const { agent_id = 'workflow_launcher', declared_goal, resolvedStrategy } = options;
  const action_id = `act_${crypto.randomUUID()}`;
  const timestamp_start = new Date().toISOString();

  const launchMeta = {
    template_id: template.template_id,
    template_name: template.name,
    template_slug: template.slug,
    template_version: template.version,
    linked_prompt_template_ids: template.linked_prompt_template_ids,
    linked_policy_ids: template.linked_policy_ids,
    linked_knowledge_collection_ids: template.linked_knowledge_collection_ids,
    linked_capability_ids: template.linked_capability_ids,
    linked_capability_tags: template.linked_capability_tags,
    resolved_strategy: resolvedStrategy || null,
  };

  // Reasoning field carries the structured launch metadata so existing trace /
  // decision replay surfaces show the workflow context without schema changes.
  const reasoning = `WORKFLOW_LAUNCH_META=${JSON.stringify(launchMeta)}`;

  const goal = declared_goal || template.objective || `Launch workflow: ${template.name}`;

  await sql`
    INSERT INTO action_records (
      org_id,
      action_id,
      agent_id,
      action_type,
      declared_goal,
      reasoning,
      trigger,
      systems_touched,
      status,
      reversible,
      risk_score,
      confidence,
      timestamp_start
    ) VALUES (
      ${orgId},
      ${action_id},
      ${agent_id},
      ${'workflow_launch'},
      ${goal},
      ${reasoning},
      ${`workflow:${template.template_id}`},
      ${'[]'},
      ${'running'},
      ${1},
      ${0},
      ${50},
      ${timestamp_start}
    )
  `;

  // Snapshot the resolved strategy onto the template row too so the UI
  // detail page can show the last-launched strategy without re-resolving.
  if (resolvedStrategy) {
    await sql`
      UPDATE workflow_templates
      SET model_strategy_snapshot = ${JSON.stringify(resolvedStrategy)},
          updated_at = now()
      WHERE org_id = ${orgId} AND template_id = ${templateId}
    `;
  }

  return {
    action_id,
    template_id: template.template_id,
    template_version: template.version,
    launched_at: timestamp_start,
    resolved_strategy: resolvedStrategy || null,
  };
}
