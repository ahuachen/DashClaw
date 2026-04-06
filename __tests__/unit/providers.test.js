import { describe, it, expect } from 'vitest';
import { resolveProviderChain } from '../../app/lib/providers.js';

describe('providers', () => {
  describe('resolveProviderChain', () => {
    const baseConfig = {
      primary: { provider: 'openai', model: 'gpt-4.1' },
      fallback: [
        { provider: 'anthropic', model: 'claude-sonnet-4' },
        { provider: 'groq', model: 'llama-4-scout' },
      ],
    };

    it('returns primary then fallback chain by default', () => {
      const chain = resolveProviderChain(baseConfig);
      expect(chain).toEqual([
        { provider: 'openai', model: 'gpt-4.1' },
        { provider: 'anthropic', model: 'claude-sonnet-4' },
        { provider: 'groq', model: 'llama-4-scout' },
      ]);
    });

    it('prepends task_mode override when provided', () => {
      const config = {
        ...baseConfig,
        taskModes: {
          reasoning: { provider: 'anthropic', model: 'claude-opus-4-6' },
        },
      };
      const chain = resolveProviderChain(config, 'reasoning');
      expect(chain[0]).toEqual({ provider: 'anthropic', model: 'claude-opus-4-6' });
      expect(chain[1]).toEqual({ provider: 'openai', model: 'gpt-4.1' }); // primary still present
    });

    it('deduplicates when task_mode matches primary', () => {
      const config = {
        ...baseConfig,
        taskModes: {
          default: { provider: 'openai', model: 'gpt-4.1' },
        },
      };
      const chain = resolveProviderChain(config, 'default');
      const openaiEntries = chain.filter((c) => c.provider === 'openai' && c.model === 'gpt-4.1');
      expect(openaiEntries).toHaveLength(1);
    });

    it('filters out disallowed providers', () => {
      const config = {
        ...baseConfig,
        disallowedProviders: ['groq'],
      };
      const chain = resolveProviderChain(config);
      expect(chain).toHaveLength(2);
      expect(chain.find((c) => c.provider === 'groq')).toBeUndefined();
    });

    it('restricts to allowed providers only', () => {
      const config = {
        ...baseConfig,
        allowedProviders: ['openai'],
      };
      const chain = resolveProviderChain(config);
      expect(chain).toHaveLength(1);
      expect(chain[0].provider).toBe('openai');
    });

    it('returns empty chain when all providers are disallowed', () => {
      const config = {
        ...baseConfig,
        disallowedProviders: ['openai', 'anthropic', 'groq'],
      };
      const chain = resolveProviderChain(config);
      expect(chain).toHaveLength(0);
    });

    it('handles missing fallback array gracefully', () => {
      const chain = resolveProviderChain({
        primary: { provider: 'openai', model: 'gpt-4.1' },
      });
      expect(chain).toHaveLength(1);
    });

    it('ignores unknown task_mode (falls through to primary)', () => {
      const chain = resolveProviderChain(baseConfig, 'nonexistent_mode');
      expect(chain[0]).toEqual({ provider: 'openai', model: 'gpt-4.1' });
    });
  });
});
