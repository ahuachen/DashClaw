import { describe, expect, it, vi } from 'vitest';

import {
  buildMissingResourceOption,
  buildWorkflowResourceLookups,
  loadWorkflowBuilderResources,
  normalizeCapabilityOptions,
  normalizeCollectionOptions,
  normalizeModelStrategyOptions,
  normalizePolicyOptions,
  normalizePromptTemplateOptions,
} from '../../app/workflows/lib/workflowBuilderResources.js';

describe('workflowBuilderResources', () => {
  it('normalizes knowledge collections into selectable options', () => {
    const options = normalizeCollectionOptions([
      {
        collection_id: 'kn_faq',
        name: 'Customer FAQ',
        source_type: 'manual',
        doc_count: 12,
      },
    ]);

    expect(options).toEqual([
      {
        value: 'kn_faq',
        label: 'Customer FAQ',
        subtitle: 'manual · 12 items',
        raw: {
          collection_id: 'kn_faq',
          name: 'Customer FAQ',
          source_type: 'manual',
          doc_count: 12,
        },
      },
    ]);
  });

  it('normalizes capabilities into readable options', () => {
    const options = normalizeCapabilityOptions([
      {
        capability_id: 'cap_slack',
        name: 'Send Slack Message',
        source_type: 'http_api',
        risk_level: 'medium',
      },
    ]);

    expect(options).toEqual([
      {
        value: 'cap_slack',
        label: 'Send Slack Message',
        subtitle: 'http_api · medium risk',
        raw: {
          capability_id: 'cap_slack',
          name: 'Send Slack Message',
          source_type: 'http_api',
          risk_level: 'medium',
        },
      },
    ]);
  });

  it('normalizes model strategies into readable options', () => {
    const options = normalizeModelStrategyOptions([
      {
        strategy_id: 'mst_support',
        name: 'Support default',
        config: {
          primary: {
            provider: 'openai',
            model: 'gpt-4o-mini',
          },
        },
      },
    ]);

    expect(options).toEqual([
      {
        value: 'mst_support',
        label: 'Support default',
        subtitle: 'openai · gpt-4o-mini',
        raw: {
          strategy_id: 'mst_support',
          name: 'Support default',
          config: {
            primary: {
              provider: 'openai',
              model: 'gpt-4o-mini',
            },
          },
        },
      },
    ]);
  });

  it('normalizes policies into readable options', () => {
    const options = normalizePolicyOptions([
      {
        id: 'gp_approval',
        name: 'Require approval for refunds',
        policy_type: 'require_approval',
      },
    ]);

    expect(options).toEqual([
      {
        value: 'gp_approval',
        label: 'Require approval for refunds',
        subtitle: 'require_approval',
        raw: {
          id: 'gp_approval',
          name: 'Require approval for refunds',
          policy_type: 'require_approval',
        },
      },
    ]);
  });

  it('normalizes prompt templates with active content for picker usage', () => {
    const options = normalizePromptTemplateOptions([
      {
        id: 'pt_refund',
        name: 'Refund Summary',
        category: 'support',
        activeContent: 'Summarize the refund policy for the customer.',
      },
    ]);

    expect(options).toEqual([
      {
        value: 'pt_refund',
        label: 'Refund Summary',
        subtitle: 'support',
        content: 'Summarize the refund policy for the customer.',
        raw: {
          id: 'pt_refund',
          name: 'Refund Summary',
          category: 'support',
          activeContent: 'Summarize the refund policy for the customer.',
        },
      },
    ]);
  });

  it('builds missing fallback options for saved resource ids', () => {
    expect(buildMissingResourceOption('kn_missing', 'Knowledge collection')).toEqual({
      value: 'kn_missing',
      label: 'kn_missing',
      subtitle: 'Knowledge collection unavailable',
      unavailable: true,
    });
  });

  it('builds resource lookups from option arrays', () => {
    const lookups = buildWorkflowResourceLookups({
      modelStrategies: [{ value: 'mst_support', label: 'Support default' }],
      policies: [{ value: 'gp_approval', label: 'Require approval' }],
      knowledgeCollections: [{ value: 'kn_faq', label: 'Customer FAQ' }],
      capabilities: [{ value: 'cap_slack', label: 'Send Slack Message' }],
      promptTemplates: [{ value: 'pt_refund', label: 'Refund Summary', content: 'Summarize refunds' }],
    });

    expect(lookups).toEqual({
      modelStrategies: { mst_support: 'Support default' },
      policies: { gp_approval: 'Require approval' },
      knowledgeCollections: { kn_faq: 'Customer FAQ' },
      capabilities: { cap_slack: 'Send Slack Message' },
      promptTemplates: { pt_refund: { label: 'Refund Summary', content: 'Summarize refunds' } },
    });
  });

  it('loads workflow builder resources and active prompt template content best-effort', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/model-strategies') {
        return {
          ok: true,
          json: async () => ({
            strategies: [{ strategy_id: 'mst_support', name: 'Support default', config: { primary: { provider: 'openai', model: 'gpt-4o-mini' } } }],
          }),
        };
      }

      if (url === '/api/policies') {
        return {
          ok: true,
          json: async () => ({
            policies: [{ id: 'gp_approval', name: 'Require approval', policy_type: 'require_approval' }],
          }),
        };
      }

      if (url === '/api/knowledge/collections?limit=100') {
        return {
          ok: true,
          json: async () => ({
            collections: [{ collection_id: 'kn_faq', name: 'Customer FAQ', source_type: 'manual', doc_count: 12 }],
          }),
        };
      }

      if (url === '/api/capabilities?limit=100') {
        return {
          ok: true,
          json: async () => ({
            capabilities: [{ capability_id: 'cap_slack', name: 'Send Slack Message', source_type: 'http_api', risk_level: 'medium' }],
          }),
        };
      }

      if (url === '/api/prompts/templates') {
        return {
          ok: true,
          json: async () => ({
            templates: [{ id: 'pt_refund', name: 'Refund Summary', category: 'support' }],
          }),
        };
      }

      if (url === '/api/prompts/templates/pt_refund/versions') {
        return {
          ok: true,
          json: async () => ({
            versions: [
              { id: 'pv_1', version: 1, is_active: false, content: 'Old content' },
              { id: 'pv_2', version: 2, is_active: true, content: 'Summarize the refund policy.' },
            ],
          }),
        };
      }

      throw new Error(`Unexpected url: ${url}`);
    });

    const resources = await loadWorkflowBuilderResources(fetchMock);

    expect(resources.modelStrategies[0]).toMatchObject({
      value: 'mst_support',
      label: 'Support default',
    });
    expect(resources.policies[0]).toMatchObject({
      value: 'gp_approval',
      label: 'Require approval',
    });
    expect(resources.knowledgeCollections[0]).toMatchObject({
      value: 'kn_faq',
      label: 'Customer FAQ',
    });
    expect(resources.capabilities[0]).toMatchObject({
      value: 'cap_slack',
      label: 'Send Slack Message',
    });
    expect(resources.promptTemplates[0]).toMatchObject({
      value: 'pt_refund',
      label: 'Refund Summary',
      content: 'Summarize the refund policy.',
    });
    expect(resources.errors).toEqual([]);
  });
});
