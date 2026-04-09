import { describe, expect, it } from 'vitest';

import {
  buildLegacyWorkflowFallback,
  buildWorkflowStepSummary,
  createDefaultWorkflowStep,
  normalizeWorkflowStepData,
  sanitizeExecutableSteps,
  sanitizeRetryPolicy,
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
      condition: '',
      continue_on_failure: false,
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

  it('sanitizes valid retry_policy', () => {
    expect(sanitizeRetryPolicy({ max_retries: 3, backoff: 'exponential', base_delay_ms: 2000, max_delay_ms: 15000 }))
      .toEqual({ max_retries: 3, backoff: 'exponential', base_delay_ms: 2000, max_delay_ms: 15000 });
  });

  it('returns undefined for retry_policy with max_retries 0', () => {
    expect(sanitizeRetryPolicy({ max_retries: 0 })).toBeUndefined();
  });

  it('returns undefined for null/undefined retry_policy', () => {
    expect(sanitizeRetryPolicy(null)).toBeUndefined();
    expect(sanitizeRetryPolicy(undefined)).toBeUndefined();
  });

  it('clamps retry_policy values to valid ranges', () => {
    const result = sanitizeRetryPolicy({ max_retries: 99, backoff: 'bad', base_delay_ms: -5, max_delay_ms: 999999 });
    expect(result.max_retries).toBe(10);
    expect(result.backoff).toBe('none');
    expect(result.base_delay_ms).toBe(100);
    expect(result.max_delay_ms).toBe(60000);
  });

  it('preserves retry_policy through sanitizeExecutableSteps', () => {
    const steps = sanitizeExecutableSteps([
      {
        id: 'step_1',
        type: 'capability_invoke',
        name: 'Call API',
        config: { capability_id: 'cap_1', body: {} },
        retry_policy: { max_retries: 2, backoff: 'fixed', base_delay_ms: 500 },
      },
    ]);

    expect(steps[0].retry_policy).toEqual({
      max_retries: 2,
      backoff: 'fixed',
      base_delay_ms: 500,
      max_delay_ms: 30000,
    });
  });

  it('omits retry_policy from sanitized steps when max_retries is 0', () => {
    const steps = sanitizeExecutableSteps([
      {
        id: 'step_1',
        type: 'knowledge_search',
        name: 'Search',
        config: { collection_id: 'kc_1', query: 'test' },
        retry_policy: { max_retries: 0 },
      },
    ]);

    expect(steps[0].retry_policy).toBeUndefined();
  });

  it('default step includes condition and continue_on_failure fields', () => {
    const step = createDefaultWorkflowStep('prompt', 1);
    expect(step.condition).toBe('');
    expect(step.continue_on_failure).toBe(false);
  });

  it('sanitizeExecutableSteps preserves condition and continue_on_failure', () => {
    const steps = sanitizeExecutableSteps([
      { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, condition: '${variables.run}', continue_on_failure: true },
    ]);
    expect(steps[0].condition).toBe('${variables.run}');
    expect(steps[0].continue_on_failure).toBe(true);
  });

  it('sanitizeExecutableSteps defaults missing condition and continue_on_failure', () => {
    const steps = sanitizeExecutableSteps([
      { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' } },
    ]);
    expect(steps[0].condition).toBeUndefined();
    expect(steps[0].continue_on_failure).toBeUndefined();
  });

  it('summary includes condition when set', () => {
    const step = { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, condition: '${steps.step_0.output.found}' };
    const summary = buildWorkflowStepSummary(step);
    expect(summary).toContain('Condition');
  });

  it('summary includes continue on failure when true', () => {
    const step = { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, continue_on_failure: true };
    const summary = buildWorkflowStepSummary(step);
    expect(summary).toContain('continue');
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
