import { describe, expect, it } from 'vitest';
import { shapeRun, shapeStepResult } from '../../app/lib/repositories/workflow-runs.repository.js';

describe('shapeRun', () => {
  it('shapes a raw action_record row into a run object', () => {
    const row = {
      action_id: 'act_1',
      status: 'completed',
      agent_id: 'agent_1',
      declared_goal: 'Test run',
      trigger: 'workflow:wft_abc',
      duration_ms: 4500,
      timestamp_start: '2026-04-08T12:00:00Z',
      timestamp_end: '2026-04-08T12:00:04Z',
      error_message: null,
      step_count: '3',
      steps_completed: '3',
      steps_failed: '0',
    };

    const run = shapeRun(row);
    expect(run.run_action_id).toBe('act_1');
    expect(run.template_id).toBe('wft_abc');
    expect(run.status).toBe('completed');
    expect(run.step_count).toBe(3);
    expect(run.steps_completed).toBe(3);
    expect(run.steps_failed).toBe(0);
  });

  it('extracts template_id from trigger field', () => {
    const row = {
      action_id: 'act_2',
      trigger: 'workflow:wft_xyz_123',
      status: 'failed',
      step_count: '0',
      steps_completed: '0',
      steps_failed: '0',
    };

    const run = shapeRun(row);
    expect(run.template_id).toBe('wft_xyz_123');
  });

  it('returns null for null input', () => {
    expect(shapeRun(null)).toBeNull();
  });
});

describe('shapeStepResult', () => {
  it('shapes a raw step result row', () => {
    const row = {
      step_result_id: 'sr_1',
      step_id: 'search',
      step_index: 0,
      step_type: 'knowledge_search',
      step_name: 'Find docs',
      status: 'completed',
      input_json: '{"collection_id":"kc_1","query":"test"}',
      output_json: '{"chunks":[]}',
      error_message: null,
      retry_count: 0,
      duration_ms: 312,
      started_at: '2026-04-08T12:00:00Z',
      finished_at: '2026-04-08T12:00:00Z',
    };

    const step = shapeStepResult(row);
    expect(step.step_id).toBe('search');
    expect(step.input).toEqual({ collection_id: 'kc_1', query: 'test' });
    expect(step.output).toEqual({ chunks: [] });
    expect(step.duration_ms).toBe(312);
  });

  it('returns null for unparseable JSON fields', () => {
    const row = {
      step_result_id: 'sr_2',
      step_id: 'broken',
      step_index: 0,
      step_type: 'prompt',
      status: 'failed',
      input_json: 'not-json',
      output_json: null,
      error_message: 'crash',
      retry_count: 0,
    };

    const step = shapeStepResult(row);
    expect(step.input).toBeNull();
    expect(step.output).toBeNull();
    expect(step.error_message).toBe('crash');
  });

  it('returns null for null input', () => {
    expect(shapeStepResult(null)).toBeNull();
  });
});
