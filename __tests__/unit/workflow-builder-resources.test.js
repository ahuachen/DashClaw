import { describe, expect, it, vi } from 'vitest';

import {
  buildMissingResourceOption,
  buildWorkflowResourceLookups,
  loadWorkflowBuilderResources,
  normalizeCapabilityOptions,
  normalizeCollectionOptions,
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
      knowledgeCollections: [{ value: 'kn_faq', label: 'Customer FAQ' }],
      capabilities: [{ value: 'cap_slack', label: 'Send Slack Message' }],
      promptTemplates: [{ value: 'pt_refund', label: 'Refund Summary', content: 'Summarize refunds' }],
    });

    expect(lookups).toEqual({
      knowledgeCollections: { kn_faq: 'Customer FAQ' },
      capabilities: { cap_slack: 'Send Slack Message' },
      promptTemplates: { pt_refund: { label: 'Refund Summary', content: 'Summarize refunds' } },
    });
  });

  it('loads workflow builder resources and active prompt template content best-effort', async () => {
    const fetchMock = vi.fn(async (url) => {
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
