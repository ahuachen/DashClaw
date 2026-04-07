/**
 * Step type handlers for workflow execution.
 * Each handler takes (sql, orgId, stepConfig, context/workflowContext) and returns an output object.
 */

import { searchCollection } from './knowledge-ingest.js';
import { executeCompletion } from './providers.js';
import { invokeCapability, resolveAuth } from './capability-invoke.js';
import { resolveEndpointUrl } from './mapping.js';
import { getCapability } from './repositories/capabilities.repository.js';
import { getSettings } from './repositories/settings.repository.js';

/**
 * knowledge_search — search a linked knowledge collection.
 * Config: { collection_id, query, top_k? }
 * Output: { chunks: [...], query }
 */
export async function handleKnowledgeSearch(sql, orgId, config) {
  const { collection_id, query, top_k = 5 } = config;

  if (!collection_id || !query) {
    throw new Error('knowledge_search requires collection_id and query');
  }

  const chunks = await searchCollection(sql, orgId, collection_id, query, {
    limit: top_k,
  });

  return {
    chunks: chunks.map((c) => ({
      content: c.content,
      score: c.score,
      source_uri: c.source_uri,
      title: c.title,
    })),
    query,
  };
}

/**
 * capability_invoke — invoke an HTTP capability.
 * Config: { capability_id, body }
 * Output: whatever the capability returns after response mapping
 */
export async function handleCapabilityInvoke(sql, orgId, config) {
  const { capability_id, body = {} } = config;

  if (!capability_id) {
    throw new Error('capability_invoke requires capability_id');
  }

  const capability = await getCapability(sql, orgId, capability_id);
  if (!capability) {
    throw new Error(`Capability not found: ${capability_id}`);
  }

  if (capability.source_type !== 'http_api') {
    throw new Error(`Capability ${capability_id} is not an http_api type`);
  }

  const schema = capability.invocation_schema || {};

  // Resolve org settings for auth and endpoint.
  // getSettings(sql, orgId) returns all org-level rows; convert to key-value map.
  let orgSettings = {};
  try {
    const rows = await getSettings(sql, orgId);
    for (const row of rows) {
      orgSettings[row.key] = row.value;
    }
  } catch {
    // Settings table may not exist yet
  }

  const authHeaders = resolveAuth(schema.auth, orgSettings);
  const endpoint = resolveEndpointUrl(schema.endpoint, orgSettings);

  const result = await invokeCapability({
    endpoint,
    method: schema.method || 'POST',
    authHeaders,
    body,
    requestMapping: schema.request_mapping,
    responseMapping: schema.response_mapping,
    timeoutMs: schema.timeout_ms || 60000,
  });

  if (!result.success) {
    throw new Error(`Capability invocation failed: ${result.error} — ${result.message || ''}`);
  }

  return { ...result.data, elapsed_ms: result.elapsed_ms };
}

/**
 * prompt — call an LLM via the workflow's linked model strategy.
 * Config: { prompt_template, system_prompt?, max_tokens?, temperature? }
 * workflowContext: { strategyConfig } — resolved model strategy
 * Output: { text, tokens_in, tokens_out }
 */
export async function handlePrompt(sql, orgId, config, workflowContext) {
  const {
    prompt_template,
    system_prompt,
    max_tokens = 1024,
    temperature = 0.3,
  } = config;

  if (!prompt_template) {
    throw new Error('prompt step requires prompt_template');
  }

  if (!workflowContext.strategyConfig) {
    throw new Error('prompt step requires a linked model strategy on the workflow');
  }

  const messages = [];
  if (system_prompt) {
    messages.push({ role: 'system', content: system_prompt });
  }
  messages.push({ role: 'user', content: prompt_template });

  const result = await executeCompletion(
    sql,
    orgId,
    workflowContext.strategyConfig,
    messages,
    { max_tokens, temperature },
  );

  return {
    text: result.content,
    tokens_in: result.usage?.input_tokens || 0,
    tokens_out: result.usage?.output_tokens || 0,
  };
}
