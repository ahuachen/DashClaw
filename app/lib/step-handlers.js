/**
 * Step type handlers for workflow execution.
 * Each handler takes (sql, orgId, stepConfig, context/workflowContext) and returns an output object.
 */

import { searchCollection } from './knowledge-ingest.js';
import { executeCompletion } from './providers.js';
import { executeCapabilityInvocation, prepareCapabilityInvocation } from './capability-runtime.js';

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

  const prepared = await prepareCapabilityInvocation(sql, orgId, capability_id);
  const result = await executeCapabilityInvocation({
    endpoint: prepared.endpoint,
    authHeaders: prepared.authHeaders,
    schema: prepared.schema,
    body,
  });

  if (!result.success) {
    throw new Error(`Capability invocation failed: ${result.error} — ${result.message || ''}`);
  }

  // Preserve arrays as-is. Spreading an array into an object (the old
  // behavior) corrupts numeric-keyed list responses like HN top stories
  // into { "0": id, "1": id, ..., "elapsed_ms": N }, which then breaks
  // downstream template substitution and LLM prompts that expect the
  // raw list shape. Step duration is already tracked separately on the
  // step result record via duration_ms, so we don't need to smuggle
  // elapsed_ms through the data payload for arrays.
  if (Array.isArray(result.data)) {
    return result.data;
  }

  // For object responses, merge in elapsed_ms so downstream steps can
  // still reference it via ${steps.X.output.elapsed_ms}.
  if (result.data && typeof result.data === 'object') {
    return { ...result.data, elapsed_ms: result.elapsed_ms };
  }

  // Primitive or nullish — wrap so downstream has a stable shape.
  return { data: result.data, elapsed_ms: result.elapsed_ms };
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
