/**
 * AI Policy Generator.
 * Accepts natural language input, calls an LLM to generate guard policies,
 * validates the output, and returns a preview or creates policies.
 */

import { executeCompletion } from './providers.js';
import { validatePolicy, POLICY_TYPES } from './validate.js';
import { createHash } from 'node:crypto';
import { getDefaultProviderModel } from './providers/providerRegistry.js';

const ACTION_TYPES = [
  'build', 'deploy', 'post', 'apply', 'security', 'message', 'api',
  'calendar', 'research', 'review', 'fix', 'refactor', 'test', 'config',
  'monitor', 'alert', 'cleanup', 'sync', 'migrate', 'other',
];

const POLICY_TYPE_SCHEMAS = {
  risk_threshold: '{ "threshold": <number 0-100>, "action": "block"|"warn"|"require_approval" }',
  require_approval: '{ "action_types": ["deploy", "migrate", ...] }',
  block_action_type: '{ "action_types": ["deploy", "migrate", ...] }',
  rate_limit: '{ "max_actions": <number>, "window_minutes": <number>, "action": "warn"|"block" }',
  permission_escalation: '{ "enforce": true }',
  green_contract: '{ "action_types": ["deploy"], "required_level": "targeted"|"package"|"workspace"|"merge_ready", "action": "block"|"require_approval" }',
  branch_freshness: '{ "action_types": ["deploy"], "freshness": ["stale", "diverged"], "max_commits_behind": <number>, "action": "block"|"require_approval" }',
};

const FEW_SHOT_EXAMPLES = [
  {
    input: 'Block all production deploys',
    output: {
      name: 'Block production deploys',
      policy_type: 'block_action_type',
      rules: { action_types: ['deploy'] },
      confidence: 0.95,
    },
  },
  {
    input: 'Require human approval for any action with risk above 70',
    output: {
      name: 'High-risk approval gate',
      policy_type: 'risk_threshold',
      rules: { threshold: 70, action: 'require_approval' },
      confidence: 0.93,
    },
  },
  {
    input: 'Limit agents to 10 actions per hour',
    output: {
      name: 'Hourly rate limit',
      policy_type: 'rate_limit',
      rules: { max_actions: 10, window_minutes: 60, action: 'warn' },
      confidence: 0.90,
    },
  },
];

export function buildSystemPrompt() {
  const typeDescriptions = Object.entries(POLICY_TYPE_SCHEMAS)
    .map(([type, schema]) => `- ${type}: ${schema}`)
    .join('\n');

  const examples = FEW_SHOT_EXAMPLES
    .map((ex) => `Input: "${ex.input}"\nOutput: ${JSON.stringify([ex.output], null, 2)}`)
    .join('\n\n');

  return `You are a DashClaw policy generator. Convert natural language company policies into structured guard policies.

## Valid Policy Types and Rules Schemas
${typeDescriptions}

## Valid Action Types
${ACTION_TYPES.join(', ')}

## Examples
${examples}

## Instructions
- Return a JSON array of policy objects.
- Each object must have: name (string), policy_type (one of the valid types above), rules (object matching the schema for that type), confidence (0.0-1.0).
- Optionally include recovery_recipe: { signal: string, suggestion: string, auto_action: string|null }.
- If the input describes multiple policies, generate one object per policy.
- If the input is unclear or cannot be mapped to a valid policy type, return an empty array.
- Return ONLY the JSON array, no markdown fences, no explanation.`;
}

export function parseGeneratedPolicies(rawContent) {
  const policies = [];
  const warnings = [];

  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { policies: [], warnings: ['Failed to parse LLM response as JSON'] };
  }

  if (!Array.isArray(parsed)) {
    return { policies: [], warnings: ['LLM response is not a JSON array'] };
  }

  for (const item of parsed) {
    const validationInput = {
      name: item.name,
      policy_type: item.policy_type,
      rules: JSON.stringify(item.rules || {}),
    };

    const result = validatePolicy(validationInput);
    if (result.valid) {
      policies.push({
        name: item.name,
        policy_type: item.policy_type,
        rules: item.rules,
        confidence: typeof item.confidence === 'number' ? item.confidence : null,
        recovery_recipe: item.recovery_recipe || null,
      });
    } else {
      warnings.push(`"${item.name || 'unnamed'}": ${result.errors.join(', ')}`);
    }
  }

  return { policies, warnings };
}

const DEFAULT_STRATEGY_CONFIG = {
  primary: {
    provider: 'openai',
    model: getDefaultProviderModel('openai', 'policy_generation') || 'gpt-4.1',
  },
  fallback: [
    {
      provider: 'anthropic',
      model: getDefaultProviderModel('anthropic', 'policy_generation') || 'claude-sonnet-4-6',
    },
  ],
  maxRetries: 1,
  maxBudgetUsd: 0.10,
};

export async function generatePolicies(sql, orgId, inputText) {
  const { getSettings } = await import('./repositories/settings.repository.js');
  const settings = await getSettings(sql, orgId, { category: 'integration' });
  const providerKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY', 'PERPLEXITY_API_KEY'];
  const hasProvider = settings.some((s) => providerKeys.includes(s.key) && s.value);

  if (!hasProvider) {
    return { error: 'No LLM provider configured. Add an API key in Settings or /setup.' };
  }

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: inputText },
  ];

  const completion = await executeCompletion(sql, orgId, DEFAULT_STRATEGY_CONFIG, messages, {
    max_tokens: 2048,
    temperature: 0.3,
  });

  const { policies, warnings } = parseGeneratedPolicies(completion.content);

  const inputHash = createHash('sha256').update(inputText).digest('hex').slice(0, 16);

  return {
    generated_policies: policies,
    warnings,
    input_hash: inputHash,
    llm_metadata: {
      provider: completion.provider,
      model: completion.model,
      cost_usd: completion.cost_usd,
    },
  };
}
