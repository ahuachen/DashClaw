import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../../app/lib/workflow-condition.js';

describe('evaluateCondition', () => {
  const context = {
    variables: { query: 'test', include_research: 'true', empty_var: '' },
    steps: {
      step_1: { output: { chunks: [{ content: 'doc' }], found: true, count: 3 } },
      step_2: { output: { risk_level: 'high', score: 0 } },
    },
  };

  it('returns shouldRun: true when no condition is provided', () => {
    expect(evaluateCondition(null, context)).toEqual({ shouldRun: true, resolvedValue: null });
    expect(evaluateCondition(undefined, context)).toEqual({ shouldRun: true, resolvedValue: null });
    expect(evaluateCondition('', context)).toEqual({ shouldRun: true, resolvedValue: null });
  });

  it('runs when condition resolves to truthy number', () => {
    const result = evaluateCondition('${steps.step_1.output.count}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe(3);
  });

  it('skips when condition resolves to 0', () => {
    const result = evaluateCondition('${steps.step_2.output.score}', context);
    expect(result.shouldRun).toBe(false);
    expect(result.resolvedValue).toBe(0);
  });

  it('runs when condition resolves to non-empty string', () => {
    const result = evaluateCondition('${steps.step_2.output.risk_level}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe('high');
  });

  it('skips when condition resolves to empty string', () => {
    const result = evaluateCondition('${variables.empty_var}', context);
    expect(result.shouldRun).toBe(false);
    expect(result.resolvedValue).toBe('');
  });

  it('runs when condition resolves to boolean true', () => {
    const result = evaluateCondition('${steps.step_1.output.found}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe(true);
  });

  it('skips when condition resolves to string "false"', () => {
    const result = evaluateCondition('false', {});
    expect(result.shouldRun).toBe(false);
  });

  it('skips when condition resolves to string "0"', () => {
    const result = evaluateCondition('0', {});
    expect(result.shouldRun).toBe(false);
  });

  it('runs when condition resolves to array with items', () => {
    const result = evaluateCondition('${steps.step_1.output.chunks}', context);
    expect(result.shouldRun).toBe(true);
  });

  it('skips when variable path does not exist (unresolved template)', () => {
    const result = evaluateCondition('${steps.nonexistent.output}', context);
    // resolveVars returns the raw template string when path doesn't resolve
    // The raw template string is truthy, but we treat unresolved templates as falsy
    expect(result.shouldRun).toBe(false);
  });
});
