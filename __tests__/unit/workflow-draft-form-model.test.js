import { describe, expect, it } from 'vitest';

import {
  compileWorkflowDraftPayload,
  createDefaultWorkflowDraft,
  decompileWorkflowTemplateToDraft,
} from '../../app/workflows/lib/workflowDraftFormModel.js';

describe('workflowDraftFormModel', () => {
  it('creates a default workflow draft state', () => {
    expect(createDefaultWorkflowDraft()).toEqual({
      name: '',
      slug: '',
      description: '',
      objective: '',
      status: 'draft',
      model_strategy_id: '',
      linked_policy_ids: [],
      linked_knowledge_collection_ids: [],
      linked_capability_ids: [],
      linked_prompt_template_ids: [],
      linked_capability_tags: [],
      steps: [],
    });
  });

  it('compiles basics, linked resources, and steps into the persisted workflow payload', () => {
    const payload = compileWorkflowDraftPayload({
      name: 'Refund workflow',
      slug: 'refund-workflow',
      description: 'Summarize refund policy',
      objective: 'Help support handle refunds',
      status: 'active',
      model_strategy_id: 'mst_support',
      linked_policy_ids: ['gp_approval'],
      linked_knowledge_collection_ids: ['kn_refunds'],
      linked_capability_ids: ['cap_slack'],
      linked_prompt_template_ids: ['pt_refund'],
      linked_capability_tags: ['support'],
      steps: [
        {
          id: 'step_1',
          type: 'knowledge_search',
          name: 'Find refund policy',
          config: {
            collection_id: 'kn_refunds',
            query: 'refund eligibility',
            top_k: 3,
          },
        },
      ],
    });

    expect(payload).toEqual({
      name: 'Refund workflow',
      slug: 'refund-workflow',
      description: 'Summarize refund policy',
      objective: 'Help support handle refunds',
      status: 'active',
      model_strategy_id: 'mst_support',
      linked_policy_ids: ['gp_approval'],
      linked_knowledge_collection_ids: ['kn_refunds'],
      linked_capability_ids: ['cap_slack'],
      linked_prompt_template_ids: ['pt_refund'],
      linked_capability_tags: ['support'],
      steps: [
        {
          id: 'step_1',
          type: 'knowledge_search',
          name: 'Find refund policy',
          config: {
            collection_id: 'kn_refunds',
            query: 'refund eligibility',
            top_k: 3,
          },
        },
      ],
    });
  });

  it('decompiles an existing workflow template into editor state', () => {
    const draft = decompileWorkflowTemplateToDraft({
      name: 'Refund workflow',
      slug: 'refund-workflow',
      description: 'Summarize refund policy',
      objective: 'Help support handle refunds',
      status: 'active',
      model_strategy_id: 'mst_support',
      linked_policy_ids: ['gp_approval'],
      linked_knowledge_collection_ids: ['kn_refunds'],
      linked_capability_ids: ['cap_slack'],
      linked_prompt_template_ids: ['pt_refund'],
      linked_capability_tags: ['support'],
      steps: [
        {
          id: 'step_1',
          type: 'knowledge_search',
          name: 'Find refund policy',
          config: {
            collection_id: 'kn_refunds',
            query: 'refund eligibility',
            top_k: 3,
          },
        },
      ],
    });

    expect(draft.name).toBe('Refund workflow');
    expect(draft.model_strategy_id).toBe('mst_support');
    expect(draft.linked_capability_tags).toEqual(['support']);
    expect(draft.steps).toHaveLength(1);
  });

  it('preserves empty values without inventing invalid IDs', () => {
    const payload = compileWorkflowDraftPayload({
      name: 'Draft workflow',
      steps: [],
    });

    expect(payload.model_strategy_id).toBeUndefined();
    expect(payload.linked_policy_ids).toEqual([]);
    expect(payload.linked_knowledge_collection_ids).toEqual([]);
    expect(payload.linked_capability_ids).toEqual([]);
    expect(payload.linked_prompt_template_ids).toEqual([]);
    expect(payload.linked_capability_tags).toEqual([]);
  });
});
