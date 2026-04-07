import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteCompletion } = vi.hoisted(() => ({
  mockExecuteCompletion: vi.fn(),
}));

vi.mock('@/lib/providers.js', () => ({
  executeCompletion: mockExecuteCompletion,
}));

vi.mock('@/lib/validate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

import { generatePolicies, buildSystemPrompt, parseGeneratedPolicies } from '@/lib/policy-generator.js';
import { createSqlMock } from '../helpers.js';

describe('policy-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    it('includes all valid policy types', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('risk_threshold');
      expect(prompt).toContain('require_approval');
      expect(prompt).toContain('block_action_type');
      expect(prompt).toContain('rate_limit');
    });

    it('includes valid action types', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('deploy');
      expect(prompt).toContain('migrate');
      expect(prompt).toContain('security');
    });
  });

  describe('parseGeneratedPolicies', () => {
    it('parses valid JSON array of policies', () => {
      const raw = JSON.stringify([
        {
          name: 'Block deploys',
          policy_type: 'block_action_type',
          rules: { action_types: ['deploy'] },
          confidence: 0.9,
        },
      ]);
      const { policies, warnings } = parseGeneratedPolicies(raw);
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Block deploys');
      expect(warnings).toHaveLength(0);
    });

    it('moves invalid policies to warnings', () => {
      const raw = JSON.stringify([
        {
          name: 'Valid',
          policy_type: 'risk_threshold',
          rules: { threshold: 80 },
          confidence: 0.9,
        },
        {
          name: 'Invalid',
          policy_type: 'nonexistent_type',
          rules: {},
          confidence: 0.5,
        },
      ]);
      const { policies, warnings } = parseGeneratedPolicies(raw);
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Valid');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Invalid');
    });

    it('returns empty on unparseable JSON', () => {
      const { policies, warnings } = parseGeneratedPolicies('not json');
      expect(policies).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('parse');
    });

    it('extracts recovery recipes when present', () => {
      const raw = JSON.stringify([
        {
          name: 'Require backup before migrate',
          policy_type: 'require_approval',
          rules: { action_types: ['migrate'] },
          recovery_recipe: {
            signal: 'migration_without_backup',
            suggestion: 'Run backup first',
            auto_action: null,
          },
          confidence: 0.88,
        },
      ]);
      const { policies } = parseGeneratedPolicies(raw);
      expect(policies[0].recovery_recipe).toBeDefined();
      expect(policies[0].recovery_recipe.signal).toBe('migration_without_backup');
    });
  });

  describe('generatePolicies', () => {
    it('calls LLM and returns parsed policies', async () => {
      const generatedPolicies = [
        {
          name: 'Block deploys after hours',
          policy_type: 'block_action_type',
          rules: { action_types: ['deploy'] },
          confidence: 0.92,
        },
      ];
      mockExecuteCompletion.mockResolvedValue({
        content: JSON.stringify(generatedPolicies),
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input_tokens: 500, output_tokens: 200 },
        cost_usd: 0.005,
      });

      const sql = createSqlMock({
        taggedResponses: [
          [{ key: 'OPENAI_API_KEY', value: 'sk-test', encrypted: false }],
        ],
      });

      const result = await generatePolicies(sql, 'org_1', 'No deploys after 5pm');
      expect(result.generated_policies).toHaveLength(1);
      expect(result.generated_policies[0].name).toBe('Block deploys after hours');
      expect(result.warnings).toHaveLength(0);
      expect(mockExecuteCompletion).toHaveBeenCalledOnce();
    });

    it('returns 422-style error when no LLM keys configured', async () => {
      const sql = createSqlMock({
        taggedResponses: [
          [],
        ],
      });

      const result = await generatePolicies(sql, 'org_1', 'Block all deploys');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('provider');
    });
  });
});
