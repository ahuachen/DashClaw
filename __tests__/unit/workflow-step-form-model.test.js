import { describe, expect, it } from 'vitest';

import {
  buildLegacyWorkflowFallback,
  buildWorkflowStepSummary,
  createDefaultWorkflowStep,
  normalizeWorkflowStepData,
  sanitizeExecutableSteps,
} from '../../app/workflows/lib/workflowStepFormModel.js';

describe('workflowStepFormModel', () => {
  it('creates default knowledge search steps', () => {
    const step = createDefaultWorkflowStep('knowledge_search', 1);

    expect(step).toEqual({
      id: 'step_1',
      type: 'knowledge_search',
      name: 'Knowledge search 1',
      config: {
        collection_id: '',
        query: '',
        top_k: 5,
      },
    });
  });

  it('builds readable summaries for supported step types', () => {
    expect(
      buildWorkflowStepSummary({
        type: 'knowledge_search',
        config: { collection_id: 'kn_faq', query: 'refund eligibility', top_k: 3 },
      })
    ).toContain('Search kn_faq');

    expect(
      buildWorkflowStepSummary({
        type: 'capability_invoke',
        config: { capability_id: 'cap_slack' },
      })
    ).toContain('Invoke cap_slack');

    expect(
      buildWorkflowStepSummary({
        type: 'prompt',
        config: { prompt_template: 'Summarize the prior result' },
      })
    ).toContain('Run prompt');
  });

  it('sanitizes executable runtime steps into the persisted format', () => {
    const steps = sanitizeExecutableSteps([
      {
        id: 'step_1',
        type: 'knowledge_search',
        name: 'Find policy context',
        config: {
          collection_id: 'kn_policy',
          query: 'refund eligibility',
          top_k: 7,
          ignored: 'value',
        },
      },
      {
        id: 'step_2',
        type: 'capability_invoke',
        name: 'Notify Slack',
        config: {
          capability_id: 'cap_slack',
          body: { channel: '#ops', text: 'Escalate' },
        },
      },
      {
        id: 'step_3',
        type: 'prompt',
        name: 'Draft reply',
        config: {
          prompt_template: 'Answer the user',
          system_prompt: 'Be brief',
          max_tokens: 600,
          temperature: 0.4,
        },
      },
    ]);

    expect(steps).toEqual([
      {
        id: 'step_1',
        type: 'knowledge_search',
        name: 'Find policy context',
        config: {
          collection_id: 'kn_policy',
          query: 'refund eligibility',
          top_k: 7,
        },
      },
      {
        id: 'step_2',
        type: 'capability_invoke',
        name: 'Notify Slack',
        config: {
          capability_id: 'cap_slack',
          body: { channel: '#ops', text: 'Escalate' },
        },
      },
      {
        id: 'step_3',
        type: 'prompt',
        name: 'Draft reply',
        config: {
          prompt_template: 'Answer the user',
          system_prompt: 'Be brief',
          max_tokens: 600,
          temperature: 0.4,
        },
      },
    ]);
  });

  it('treats graph-shaped step data as legacy and returns a readable fallback', () => {
    const graphData = {
      nodes: [
        {
          id: 'step_a',
          type: 'step',
          data: { label: 'Approval gate', stepType: 'approval', description: 'Legacy approval node' },
        },
        {
          id: 'step_b',
          type: 'step',
          data: { label: 'Action step', stepType: 'action', description: '' },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'step_a', target: 'step_b' },
      ],
    };

    const normalized = normalizeWorkflowStepData(graphData);

    expect(normalized.mode).toBe('legacy');
    expect(normalized.steps).toEqual([]);
    expect(normalized.legacyFallback).toEqual({
      nodeCount: 2,
      edgeCount: 1,
      nodeTypes: ['approval', 'action'],
      previewSteps: [
        'Approval gate (approval)',
        'Action step (action)',
      ],
    });
  });

  it('normalizes null or empty data into builder mode', () => {
    expect(normalizeWorkflowStepData(null)).toEqual({
      mode: 'builder',
      steps: [],
      legacyFallback: null,
    });

    expect(normalizeWorkflowStepData([])).toEqual({
      mode: 'builder',
      steps: [],
      legacyFallback: null,
    });
  });

  it('builds a legacy fallback preview directly', () => {
    expect(
      buildLegacyWorkflowFallback({
        nodes: [
          { id: 'step_1', data: { label: 'Knowledge fetch', stepType: 'action' } },
        ],
        edges: [],
      })
    ).toEqual({
      nodeCount: 1,
      edgeCount: 0,
      nodeTypes: ['action'],
      previewSteps: ['Knowledge fetch (action)'],
    });
  });
});
