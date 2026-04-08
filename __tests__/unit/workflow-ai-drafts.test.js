import { describe, expect, it } from 'vitest';

import { normalizeGeneratedWorkflowDraft } from '../../app/workflows/lib/workflowAiDrafts.js';

const resourceOptions = {
  modelStrategies: [{ value: 'mst_support', label: 'Support default' }],
  policies: [{ value: 'gp_approval', label: 'Require approval for refunds' }],
  knowledgeCollections: [{ value: 'kn_refunds', label: 'Refund Policies' }],
  capabilities: [{ value: 'cap_slack', label: 'Send Slack Message' }],
  promptTemplates: [{ value: 'pt_refund', label: 'Refund Summary', content: 'Summarize the refund policy for the customer.' }],
};

describe('workflowAiDrafts', () => {
  it('normalizes valid AI output into the canonical workflow editor model', () => {
    const normalized = normalizeGeneratedWorkflowDraft({
      name: 'Refund workflow',
      description: 'Handle refund requests',
      objective: 'Give support a refund-ready answer',
      linked_resources: {
        model_strategy: 'Support default',
        policies: ['Require approval for refunds'],
        knowledge_collections: ['Refund Policies'],
        capabilities: ['Send Slack Message'],
        prompt_templates: ['Refund Summary'],
        capability_tags: ['support'],
      },
      steps: [
        {
          type: 'knowledge_search',
          name: 'Find refund policy',
          collection: 'Refund Policies',
          query: 'refund eligibility',
          top_k: 3,
        },
        {
          type: 'prompt',
          name: 'Summarize answer',
          prompt_template: 'Summarize the refund policy for the customer.',
        },
      ],
    }, resourceOptions);

    expect(normalized.draft.model_strategy_id).toBe('mst_support');
    expect(normalized.draft.linked_policy_ids).toEqual(['gp_approval']);
    expect(normalized.draft.linked_knowledge_collection_ids).toEqual(['kn_refunds']);
    expect(normalized.draft.linked_capability_ids).toEqual(['cap_slack']);
    expect(normalized.draft.linked_prompt_template_ids).toEqual(['pt_refund']);
    expect(normalized.draft.steps).toHaveLength(2);
    expect(normalized.notes).toEqual([]);
  });

  it('drops unsupported step types and records review notes', () => {
    const normalized = normalizeGeneratedWorkflowDraft({
      name: 'Unsupported workflow',
      steps: [
        { type: 'approval', name: 'Ask human' },
      ],
    }, resourceOptions);

    expect(normalized.draft.steps).toEqual([]);
    expect(normalized.notes[0]).toMatch(/unsupported workflow step/i);
  });

  it('keeps unmapped resources out of persisted ids and records review notes', () => {
    const normalized = normalizeGeneratedWorkflowDraft({
      name: 'Draft workflow',
      linked_resources: {
        policies: ['Nonexistent policy'],
        knowledge_collections: ['Unknown collection'],
      },
    }, resourceOptions);

    expect(normalized.draft.linked_policy_ids).toEqual([]);
    expect(normalized.draft.linked_knowledge_collection_ids).toEqual([]);
    expect(normalized.notes.join(' ')).toMatch(/could not be matched/i);
  });
});
