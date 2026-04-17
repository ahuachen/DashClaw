/**
 * Billing & Cost Calculation Library
 */

/**
 * Default model pricing (USD per million tokens).
 * Updated March 2026. Override via Settings > Model Pricing.
 */
export const DEFAULT_PRICING = [
  // Anthropic Claude 4.5/4.6 family (March 2026)
  { pattern: 'opus-4-6', label: 'Claude Opus 4.6', input: 15, output: 75 },
  { pattern: 'opus-4-5', label: 'Claude Opus 4.5', input: 15, output: 75 },
  { pattern: 'opus', label: 'Claude Opus (default)', input: 15, output: 75 },
  { pattern: 'sonnet-4-6', label: 'Claude Sonnet 4.6', input: 3, output: 15 },
  { pattern: 'sonnet-4-5', label: 'Claude Sonnet 4.5', input: 3, output: 15 },
  { pattern: 'sonnet', label: 'Claude Sonnet (default)', input: 3, output: 15 },
  { pattern: 'haiku-4-5', label: 'Claude Haiku 4.5', input: 0.80, output: 4 },
  { pattern: 'haiku', label: 'Claude Haiku (default)', input: 0.80, output: 4 },
  // OpenAI (March 2026)
  { pattern: 'codex-5.4', label: 'Codex 5.4', input: 3, output: 15 },
  { pattern: 'codex', label: 'Codex (default)', input: 3, output: 15 },
  { pattern: 'o3-pro', label: 'o3-pro', input: 150, output: 600 },
  { pattern: 'o3-mini', label: 'o3-mini', input: 1.10, output: 4.40 },
  { pattern: 'o3', label: 'o3', input: 10, output: 40 },
  { pattern: 'o4-mini', label: 'o4-mini', input: 1.10, output: 4.40 },
  { pattern: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', input: 0.40, output: 1.60 },
  { pattern: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', input: 0.10, output: 0.40 },
  { pattern: 'gpt-4.1', label: 'GPT-4.1', input: 2, output: 8 },
  { pattern: 'gpt-4o-mini', label: 'GPT-4o Mini', input: 0.15, output: 0.60 },
  { pattern: 'gpt-4o', label: 'GPT-4o', input: 2.50, output: 10 },
  // Google Gemini (March 2026)
  { pattern: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', input: 1.25, output: 10 },
  { pattern: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', input: 0.15, output: 0.60 },
  // Meta Llama (hosted pricing varies by provider — these are typical)
  { pattern: 'llama-4-maverick', label: 'Llama 4 Maverick', input: 0.50, output: 0.77 },
  { pattern: 'llama-4-scout', label: 'Llama 4 Scout', input: 0.17, output: 0.35 },
];

/**
 * Estimate cost based on token usage and model.
 *
 * @param {number} tokensIn - Input tokens
 * @param {number} tokensOut - Output tokens
 * @param {string|null|undefined} model - Model identifier. If falsy (null, undefined, ''),
 *        returns 0 — we refuse to guess a model because a wrong guess pollutes analytics
 *        (the migration that backfills `action_records.model` to NULL would otherwise
 *        retroactively price every historical row as Opus).
 * @param {Array<{pattern: string, input: number, output: number}>|null} customPricing - Optional custom pricing table from org settings
 * @returns {number} Estimated cost in USD
 */
export function estimateCost(tokensIn, tokensOut, model, customPricing = null) {
  if (!model) return 0;
  const m = String(model).toLowerCase();
  const pricing = customPricing || DEFAULT_PRICING;

  for (const entry of pricing) {
    if (m.includes(entry.pattern)) {
      return (tokensIn * entry.input / 1_000_000) + (tokensOut * entry.output / 1_000_000);
    }
  }

  // Model is present but unrecognized — use the first entry (most expensive)
  // as a conservative over-estimate. A known-but-unmapped model is different
  // from "no model": we flag it as probably-premium rather than 0.
  const fallback = pricing[0] || DEFAULT_PRICING[0];
  return (tokensIn * fallback.input / 1_000_000) + (tokensOut * fallback.output / 1_000_000);
}
