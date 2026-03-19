/**
 * Billing & Cost Calculation Library
 */

/**
 * Default model pricing (USD per million tokens).
 * Updated March 2026. Override via Settings > Model Pricing.
 */
export const DEFAULT_PRICING = [
  { pattern: 'opus', input: 15, output: 75 },
  { pattern: 'sonnet', input: 3, output: 15 },
  { pattern: 'haiku', input: 0.80, output: 4 },
  { pattern: 'gpt-4.1', input: 2, output: 8 },
  { pattern: 'gpt-4.1-mini', input: 0.40, output: 1.60 },
  { pattern: 'gpt-4.1-nano', input: 0.10, output: 0.40 },
  { pattern: 'gpt-4o', input: 2.50, output: 10 },
  { pattern: 'gpt-4o-mini', input: 0.15, output: 0.60 },
  { pattern: 'codex', input: 3, output: 15 },
  { pattern: 'o3', input: 2, output: 8 },
  { pattern: 'o4-mini', input: 1.10, output: 4.40 },
  { pattern: 'gemini-2.5-pro', input: 1.25, output: 10 },
  { pattern: 'gemini-2.5-flash', input: 0.15, output: 0.60 },
];

/**
 * Estimate cost based on token usage and model.
 *
 * @param {number} tokensIn - Input tokens
 * @param {number} tokensOut - Output tokens
 * @param {string} model - Model identifier
 * @param {Array<{pattern: string, input: number, output: number}>|null} customPricing - Optional custom pricing table from org settings
 * @returns {number} Estimated cost in USD
 */
export function estimateCost(tokensIn, tokensOut, model = 'opus', customPricing = null) {
  const m = String(model || 'opus').toLowerCase();
  const pricing = customPricing || DEFAULT_PRICING;

  for (const entry of pricing) {
    if (m.includes(entry.pattern)) {
      return (tokensIn * entry.input / 1_000_000) + (tokensOut * entry.output / 1_000_000);
    }
  }

  // Fallback: use the first entry (most expensive) as a conservative estimate
  const fallback = pricing[0] || DEFAULT_PRICING[0];
  return (tokensIn * fallback.input / 1_000_000) + (tokensOut * fallback.output / 1_000_000);
}
