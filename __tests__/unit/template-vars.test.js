import { describe, expect, it } from 'vitest';
import { resolveVars } from '../../app/lib/template-vars.js';

describe('resolveVars', () => {
  const context = {
    variables: { query: 'What is x402?', budget: 0.25 },
    steps: {
      step_1: { output: { chunks: [{ content: 'chunk text' }], query: 'x402' } },
      step_2: { output: { answer: 'x402 is a protocol', sources: ['a', 'b'] } },
    },
  };

  it('resolves ${variables.x} in strings', () => {
    expect(resolveVars('Search for: ${variables.query}', context)).toBe(
      'Search for: What is x402?',
    );
  });

  it('resolves ${steps.step_id.output.field} in strings', () => {
    expect(resolveVars('Answer: ${steps.step_2.output.answer}', context)).toBe(
      'Answer: x402 is a protocol',
    );
  });

  it('resolves array index access ${steps.step_1.output.chunks[0].content}', () => {
    expect(resolveVars('${steps.step_1.output.chunks[0].content}', context)).toBe('chunk text');
  });

  it('returns original type when entire string is a variable', () => {
    expect(resolveVars('${variables.budget}', context)).toBe(0.25);
    expect(typeof resolveVars('${variables.budget}', context)).toBe('number');
  });

  it('leaves unresolved placeholders as-is', () => {
    expect(resolveVars('${variables.missing}', context)).toBe('${variables.missing}');
  });

  it('handles non-string values (passthrough)', () => {
    expect(resolveVars(42, context)).toBe(42);
    expect(resolveVars(true, context)).toBe(true);
    expect(resolveVars(null, context)).toBe(null);
  });

  it('resolves variables in object values recursively', () => {
    const config = {
      query: '${variables.query}',
      nested: { budget: '${variables.budget}' },
    };
    expect(resolveVars(config, context)).toEqual({
      query: 'What is x402?',
      nested: { budget: 0.25 },
    });
  });

  it('resolves variables in array elements', () => {
    const arr = ['${variables.query}', 'literal'];
    expect(resolveVars(arr, context)).toEqual(['What is x402?', 'literal']);
  });

  it('JSON-stringifies objects in inline string substitution (no [object Object])', () => {
    const result = resolveVars(
      'Context: ${steps.step_1.output}\nEnd.',
      context,
    );
    expect(result).not.toContain('[object Object]');
    expect(result).toContain('"chunks"');
    expect(result).toContain('"chunk text"');
    expect(result).toContain('"query"');
    expect(result).toContain('End.');
  });

  it('JSON-stringifies arrays in inline string substitution', () => {
    const ctx = {
      variables: {},
      steps: { fetch: { output: [42141, 42140, 42139] } },
    };
    const result = resolveVars('IDs: ${steps.fetch.output}', ctx);
    expect(result).toBe('IDs: [\n  42141,\n  42140,\n  42139\n]');
  });

  it('preserves object identity for single-variable templates', () => {
    // Single-var form returns the raw value so downstream code can
    // inspect the object. Only inline substitutions get JSON-stringified.
    const obj = resolveVars('${steps.step_1.output}', context);
    expect(obj).toEqual({
      chunks: [{ content: 'chunk text' }],
      query: 'x402',
    });
  });

  it('stringifies null in inline substitution (not "[object Null]")', () => {
    const ctx = { variables: { x: null }, steps: {} };
    expect(resolveVars('Value: ${variables.x}', ctx)).toBe('Value: null');
  });

  it('stringifies booleans in inline substitution', () => {
    const ctx = { variables: { flag: true }, steps: {} };
    expect(resolveVars('Flag: ${variables.flag}', ctx)).toBe('Flag: true');
  });
});
