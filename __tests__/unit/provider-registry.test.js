import { describe, expect, it } from 'vitest';
import {
  getDefaultProviderModel,
  getModelLabel,
  getProviderApiStyle,
  getProviderModelOptions,
  getProviderOptions,
  isSupportedProviderModel,
} from '../../app/lib/providers/providerRegistry.js';

describe('providerRegistry', () => {
  it('returns current provider options', () => {
    const providerIds = getProviderOptions().map((entry) => entry.value);

    expect(providerIds).toContain('openai');
    expect(providerIds).toContain('anthropic');
    expect(providerIds).toContain('groq');
  });

  it('returns model options in declared order', () => {
    expect(getProviderModelOptions('anthropic')[0].value).toBe('claude-sonnet-4-6');
    expect(getProviderModelOptions('perplexity')[0].value).toBe('sonar');
  });

  it('returns provider defaults for specific use cases', () => {
    expect(getDefaultProviderModel('openai', 'workflow_drafting')).toBe('gpt-5.4');
    expect(getDefaultProviderModel('openai', 'model_strategies')).toBe('gpt-4.1');
    expect(getDefaultProviderModel('openai', 'policy_generation')).toBe('gpt-4.1');
    expect(getDefaultProviderModel('openai', 'predictive_risk')).toBe('gpt-4.1-mini');
    expect(getDefaultProviderModel('anthropic', 'predictive_risk')).toBe('claude-3-5-haiku-latest');
  });

  it('validates provider/model membership', () => {
    expect(isSupportedProviderModel('anthropic', 'claude-opus-4-6')).toBe(true);
    expect(isSupportedProviderModel('anthropic', 'gpt-5.4')).toBe(false);
  });

  it('returns labels and api compatibility metadata', () => {
    expect(getModelLabel('anthropic', 'claude-sonnet-4-6')).toBe('Claude Sonnet 4.6');
    expect(getProviderApiStyle('anthropic')).toBe('anthropic_messages');
  });
});
