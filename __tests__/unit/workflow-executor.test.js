import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeWorkflow } from '../../app/lib/workflow-executor.js';

// Mock step handlers
vi.mock('../../app/lib/step-handlers.js', () => ({
  handleKnowledgeSearch: vi.fn(),
  handleCapabilityInvoke: vi.fn(),
  handlePrompt: vi.fn(),
}));

// Mock action repository
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  createActionRecord: vi.fn().mockResolvedValue({ action_id: 'act_child' }),
}));

import { handleKnowledgeSearch, handleCapabilityInvoke, handlePrompt } from '../../app/lib/step-handlers.js';
import { createActionRecord } from '../../app/lib/repositories/actions.repository.js';

const mockSql = Object.assign(
  vi.fn().mockResolvedValue([]),
  { query: vi.fn().mockResolvedValue([]) },
);

describe('executeWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes steps sequentially and returns final output', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'doc text' }], query: 'test' });
    handlePrompt.mockResolvedValueOnce({ text: 'synthesized answer', tokens_in: 100, tokens_out: 50 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'Answer based on: ${steps.step_1.output.chunks[0].content}' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, { query: 'test' }, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('completed');
    expect(result.result.text).toBe('synthesized answer');
  });

  it('stops on first failed step and reports partial results', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
    handleCapabilityInvoke.mockRejectedValueOnce(new Error('capability_timeout'));

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'capability_invoke', name: 'Research', config: { capability_id: 'cap_1', body: {} } },
      { id: 'step_3', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('failed');
    expect(result.error).toContain('capability_timeout');
    // step_3 should not have been attempted
    expect(handlePrompt).not.toHaveBeenCalled();
  });

  it('creates child action records for each step', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    ];

    await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(createActionRecord).toHaveBeenCalledWith(
      mockSql,
      expect.objectContaining({
        orgId: 'org_1',
        data: expect.objectContaining({
          action_type: 'workflow_step:knowledge_search',
          parent_action_id: 'act_parent',
        }),
      }),
    );
  });

  it('retries a failing step and succeeds on second attempt', async () => {
    handleCapabilityInvoke
      .mockRejectedValueOnce(new Error('capability_timeout'))
      .mockResolvedValueOnce({ data: 'ok' });

    const steps = [
      {
        id: 'step_1',
        type: 'capability_invoke',
        name: 'Call API',
        config: { capability_id: 'cap_1', body: {} },
        retry_policy: { max_retries: 2, backoff: 'none' },
      },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(handleCapabilityInvoke).toHaveBeenCalledTimes(2);
    expect(result.steps[0].retry_metadata).toEqual({ total_attempts: 2, retried: true });
  });

  it('exhausts retries and fails', async () => {
    handleCapabilityInvoke.mockRejectedValue(new Error('always fails'));

    const steps = [
      {
        id: 'step_1',
        type: 'capability_invoke',
        name: 'Call API',
        config: { capability_id: 'cap_1', body: {} },
        retry_policy: { max_retries: 2, backoff: 'none' },
      },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(false);
    expect(handleCapabilityInvoke).toHaveBeenCalledTimes(3);
    expect(result.steps[0].retry_metadata).toEqual({ total_attempts: 3, retried: true });
  });

  it('does not include retry_metadata when no retry configured', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(result.steps[0].retry_metadata).toBeUndefined();
  });

  it('writes step_result records when persistStepResult is provided', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const persistStepResult = vi.fn().mockResolvedValue(undefined);

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

    expect(result.success).toBe(true);
    expect(persistStepResult).toHaveBeenCalledTimes(2);
    expect(persistStepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: 'step_1',
        step_index: 0,
        step_type: 'knowledge_search',
        step_name: 'Search',
        status: 'running',
      }),
    );
    expect(persistStepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: 'step_1',
        status: 'completed',
        output_json: expect.any(Object),
        duration_ms: expect.any(Number),
      }),
    );
  });

  it('writes failed step_result on step failure', async () => {
    handleCapabilityInvoke.mockRejectedValue(new Error('timeout'));

    const persistStepResult = vi.fn().mockResolvedValue(undefined);

    const steps = [
      { id: 'step_1', type: 'capability_invoke', name: 'Call API', config: { capability_id: 'cap_1', body: {} } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

    expect(result.success).toBe(false);
    expect(persistStepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: 'step_1',
        status: 'failed',
        error_message: 'timeout',
      }),
    );
  });

  it('skips step_result writes when persistStepResult is not provided', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });
    expect(result.success).toBe(true);
  });

  it('passes rolling context between steps', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'found data' }], query: 'q' });
    handlePrompt.mockResolvedValueOnce({ text: 'done', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: '${variables.q}' } },
      { id: 'step_2', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'Context: ${steps.step_1.output.chunks[0].content}' } },
    ];

    await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, { q: 'test' }, { strategyConfig: {} });

    // Verify prompt was called with resolved variable
    expect(handlePrompt).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({
        prompt_template: 'Context: found data',
      }),
      expect.any(Object),
    );
  });

  it('skips step when condition resolves to falsy', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const persistStepResult = vi.fn().mockResolvedValue(undefined);

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('skipped');
    expect(handlePrompt).not.toHaveBeenCalled();
  });

  it('runs step when condition resolves to truthy', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'found' }], query: 'test' });
    handlePrompt.mockResolvedValueOnce({ text: 'summary', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('completed');
    expect(handlePrompt).toHaveBeenCalled();
  });

  it('continues to next step when continue_on_failure is true', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
    handleCapabilityInvoke.mockRejectedValueOnce(new Error('capability_timeout'));
    handlePrompt.mockResolvedValueOnce({ text: 'done', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'capability_invoke', name: 'Optional API', config: { capability_id: 'cap_1', body: {} }, continue_on_failure: true },
      { id: 'step_3', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('failed');
    expect(result.steps[2].status).toBe('completed');
    expect(handlePrompt).toHaveBeenCalled();
  });

  it('aborts when continue_on_failure is false (default behavior)', async () => {
    handleCapabilityInvoke.mockRejectedValueOnce(new Error('fatal'));

    const steps = [
      { id: 'step_1', type: 'capability_invoke', name: 'Required API', config: { capability_id: 'cap_1', body: {} } },
      { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(handlePrompt).not.toHaveBeenCalled();
  });

  it('skipped step does not add to context.steps', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
    handlePrompt.mockResolvedValueOnce({ text: 'result', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Conditional', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
      { id: 'step_3', type: 'prompt', name: 'Final', config: { prompt_template: 'Using: ${steps.step_2.output.text}' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(true);
    // step_3 prompt_template should NOT have resolved step_2 output (it was skipped)
    expect(handlePrompt).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({
        prompt_template: expect.stringContaining('${steps.step_2.output.text}'),
      }),
      expect.any(Object),
    );
  });

  it('skips steps before resumeFromIndex and marks them as reused', async () => {
    handlePrompt.mockResolvedValueOnce({ text: 'resumed result', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'Based on: ${steps.step_1.output.chunks[0].content}' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
      strategyConfig: {},
      resumeContext: {
        resumeFromIndex: 1,
        priorSteps: {
          step_1: { output: { chunks: [{ content: 'prior data' }], query: 'test' } },
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('reused');
    expect(result.steps[0].elapsed_ms).toBe(0);
    expect(result.steps[1].status).toBe('completed');
    expect(handleKnowledgeSearch).not.toHaveBeenCalled();
    expect(handlePrompt).toHaveBeenCalled();
  });

  it('reused step outputs are available to resumed steps via context', async () => {
    handlePrompt.mockResolvedValueOnce({ text: 'got it', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Use prior', config: { prompt_template: 'Data: ${steps.step_1.output.answer}' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
      strategyConfig: {},
      resumeContext: {
        resumeFromIndex: 1,
        priorSteps: {
          step_1: { output: { answer: 'forty-two' } },
        },
      },
    });

    expect(result.success).toBe(true);
    // Verify the prompt received the resolved prior output
    expect(handlePrompt).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({
        prompt_template: 'Data: forty-two',
      }),
      expect.any(Object),
    );
  });

  it('writes reused step_result via persistStepResult', async () => {
    handlePrompt.mockResolvedValueOnce({ text: 'ok', tokens_in: 10, tokens_out: 5 });
    const persistStepResult = vi.fn().mockResolvedValue(undefined);

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Go', config: { prompt_template: 'test' } },
    ];

    await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
      strategyConfig: {},
      persistStepResult,
      resumeContext: {
        resumeFromIndex: 1,
        priorSteps: {
          step_1: { output: { data: 'cached' } },
        },
      },
    });

    expect(persistStepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: 'step_1',
        status: 'reused',
        output_json: { data: 'cached' },
      }),
    );
  });

  it('writes skipped step_result via persistStepResult', async () => {
    const persistStepResult = vi.fn().mockResolvedValue(undefined);

    const steps = [
      { id: 'step_1', type: 'prompt', name: 'Conditional', config: { prompt_template: 'test' }, condition: '${variables.run_this}' },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

    expect(result.success).toBe(true);
    expect(persistStepResult).toHaveBeenCalledWith(
      expect.objectContaining({
        step_id: 'step_1',
        status: 'skipped',
      }),
    );
  });
});
