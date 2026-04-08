/**
 * Provider execution module for runtime model routing.
 * Resolves BYOK credentials from org settings, calls provider APIs via raw fetch,
 * handles fallback chains, enforces budget caps, and returns normalized responses.
 *
 * Provider metadata (URLs, API styles, credential keys) comes from the canonical
 * provider registry. Add new providers there; this module only owns protocol handlers.
 */

import { getSettings } from './repositories/settings.repository.js';
import { decrypt } from './encryption.js';
import { estimateCost } from './billing.js';
import { getModelPricing } from './repositories/settings.repository.js';
import {
  getProviderApiStyle,
  getProviderBaseUrl,
  getProviderCredentialKey,
  getProviderLabel,
} from './providers/providerRegistry.js';

const PROVIDER_TIMEOUT = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Credential loading (same pattern as integration-health.js)
// ─────────────────────────────────────────────────────────────────────────────

async function loadOrgCredentials(sql, orgId) {
  const settings = await getSettings(sql, orgId, { category: 'integration' });
  const creds = {};
  for (const s of settings) {
    let val = s.value;
    if (s.encrypted && val) {
      const decrypted = decrypt(val, `${orgId}:${s.key}`);
      if (decrypted) val = decrypted;
    }
    creds[s.key] = val;
  }
  return creds;
}

function getProviderKey(creds, provider) {
  const keyName = getProviderCredentialKey(provider);
  if (!keyName) return null;
  return creds[keyName] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider-specific API callers
// ─────────────────────────────────────────────────────────────────────────────

async function providerFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Protocol handlers — keyed by apiStyle from the provider registry.
// Adding a new provider with an existing apiStyle requires zero changes here.
// ─────────────────────────────────────────────────────────────────────────────

async function openaiStyleCall(baseUrl, label, apiKey, model, messages, options) {
  const res = await providerFetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.max_tokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content || '',
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
    raw_model: data.model || model,
  };
}

async function anthropicStyleCall(baseUrl, label, apiKey, model, messages, options) {
  const systemParts = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const systemText = systemParts.map((m) => m.content).join('\n') || undefined;

  const res = await providerFetch(baseUrl, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: nonSystem,
      max_tokens: options.max_tokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      ...(systemText ? { system: systemText } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${label} ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  return {
    content: textBlock?.text || '',
    usage: {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
    },
    raw_model: data.model || model,
  };
}

const API_STYLE_HANDLERS = {
  openai_chat_completions: openaiStyleCall,
  openai_compatible_chat: openaiStyleCall,
  anthropic_messages: anthropicStyleCall,
};

function getProviderHandler(provider) {
  const apiStyle = getProviderApiStyle(provider);
  if (!apiStyle) return null;
  return API_STYLE_HANDLERS[apiStyle] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a strategy config and an optional task_mode, produce an ordered list
 * of { provider, model } entries to try. Primary first, then fallback chain.
 * task_mode overrides primary when the strategy has taskModes configured.
 */
export function resolveProviderChain(config, taskMode = null) {
  const chain = [];

  // Task-mode override goes first if present.
  if (taskMode && config.taskModes?.[taskMode]) {
    chain.push(config.taskModes[taskMode]);
  }

  // Primary
  if (config.primary) {
    // Avoid duplicate if task mode matched primary
    const dup = chain.find(
      (c) => c.provider === config.primary.provider && c.model === config.primary.model
    );
    if (!dup) chain.push(config.primary);
  }

  // Fallback chain
  for (const fb of config.fallback || []) {
    const dup = chain.find((c) => c.provider === fb.provider && c.model === fb.model);
    if (!dup) chain.push(fb);
  }

  // Filter out disallowed providers
  const disallowed = new Set(config.disallowedProviders || []);
  const allowed = config.allowedProviders ? new Set(config.allowedProviders) : null;

  return chain.filter((entry) => {
    if (disallowed.has(entry.provider)) return false;
    if (allowed && !allowed.has(entry.provider)) return false;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main execution entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a chat completion using a model strategy with full fallback,
 * retry, and budget enforcement.
 *
 * @param {object} sql - Database connection
 * @param {string} orgId - Organization id
 * @param {object} strategyConfig - Parsed config from a model_strategies row
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @param {object} [options={}] - max_tokens, temperature, task_mode
 * @returns {Promise<{content, provider, model, usage, cost_usd, fallback_used, attempts}>}
 */
export async function executeCompletion(sql, orgId, strategyConfig, messages, options = {}) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array is required and must not be empty');
  }

  const chain = resolveProviderChain(strategyConfig, options.task_mode);
  if (chain.length === 0) {
    throw new Error('No usable providers in strategy after filtering');
  }

  const creds = await loadOrgCredentials(sql, orgId);
  const maxRetries = strategyConfig.maxRetries ?? 1;
  const maxBudgetUsd = strategyConfig.maxBudgetUsd ?? Infinity;
  const customPricing = await getModelPricing(sql, orgId);

  const errors = [];

  for (let i = 0; i < chain.length; i++) {
    const { provider, model } = chain[i];
    const handler = getProviderHandler(provider);
    if (!handler) {
      errors.push({ provider, model, error: `Unsupported provider: ${provider}` });
      continue;
    }

    const baseUrl = getProviderBaseUrl(provider);
    const label = getProviderLabel(provider);
    const apiKey = getProviderKey(creds, provider);
    if (!apiKey) {
      errors.push({ provider, model, error: `No API key configured for ${provider}` });
      continue;
    }

    // Retry loop for this provider
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await handler(baseUrl, label, apiKey, model, messages, options);

        // Budget enforcement
        const cost = estimateCost(
          result.usage.input_tokens,
          result.usage.output_tokens,
          result.raw_model || model,
          customPricing
        );

        if (cost > maxBudgetUsd) {
          errors.push({
            provider,
            model,
            error: `Estimated cost $${cost.toFixed(4)} exceeds budget cap $${maxBudgetUsd}`,
          });
          break; // Don't retry same provider — budget will exceed again
        }

        return {
          content: result.content,
          provider,
          model: result.raw_model || model,
          usage: result.usage,
          cost_usd: cost,
          fallback_used: i > 0,
          attempts: errors.length + attempt + 1,
        };
      } catch (err) {
        errors.push({
          provider,
          model,
          attempt: attempt + 1,
          error: err.message,
        });
        // Only retry on potentially transient errors (5xx, timeout)
        if (err.message?.includes('abort') || err.message?.match(/5\d\d/)) {
          continue;
        }
        break; // Non-retryable error (4xx, auth, etc.) — move to fallback
      }
    }
  }

  const err = new Error(
    `All providers failed. Tried: ${errors.map((e) => `${e.provider}/${e.model}: ${e.error}`).join('; ')}`
  );
  err.provider_errors = errors;
  throw err;
}
