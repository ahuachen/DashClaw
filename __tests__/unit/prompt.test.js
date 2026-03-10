import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSql } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/org.js', () => ({ getOrgId: () => 'org_test' }));

import { renderPrompt, getPromptStats, recordPromptRun } from '@/lib/prompt.js';

const request = new Request('http://localhost/api/prompts/stats', {
  headers: { 'x-org-id': 'org_test' },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSql.mockImplementation(async () => []);
  mockSql.query.mockImplementation(async () => []);
});

describe('renderPrompt', () => {
  it('renders simple mustache variables', () => {
    const result = renderPrompt('Hello {{name}}, welcome to {{place}}!', { name: 'Alice', place: 'DashClaw' });
    expect(result).toBe('Hello Alice, welcome to DashClaw!');
  });

  it('preserves unmatched variables as-is', () => {
    const result = renderPrompt('Hello {{name}}, {{unknown}}', { name: 'Bob' });
    expect(result).toBe('Hello Bob, {{unknown}}');
  });

  it('handles empty variables object', () => {
    const result = renderPrompt('No vars {{here}}', {});
    expect(result).toBe('No vars {{here}}');
  });

  it('handles template with no variables', () => {
    const result = renderPrompt('Plain text, no vars.', { key: 'val' });
    expect(result).toBe('Plain text, no vars.');
  });

  it('handles multiple occurrences of same variable', () => {
    const result = renderPrompt('{{x}} and {{x}} again', { x: 'Y' });
    expect(result).toBe('Y and Y again');
  });

  it('handles whitespace in variable names', () => {
    const result = renderPrompt('{{ name }} and {{name}}', { name: 'Test' });
    expect(result).toBe('Test and Test');
  });

  it('handles special regex characters in values', () => {
    const result = renderPrompt('Pattern: {{val}}', { val: 'a.b+c*d' });
    expect(result).toBe('Pattern: a.b+c*d');
  });

  it('handles empty string values', () => {
    const result = renderPrompt('Value: {{val}}', { val: '' });
    expect(result).toBe('Value: ');
  });

  it('handles numeric values', () => {
    const result = renderPrompt('Count: {{n}}', { n: 42 });
    expect(result).toBe('Count: 42');
  });
});

describe('getPromptStats', () => {
  it('returns an unavailable payload when prompt_runs is missing', async () => {
    const missingTable = Object.assign(new Error('relation "prompt_runs" does not exist'), { code: '42P01' });
    mockSql.mockRejectedValueOnce(missingTable);

    const result = await getPromptStats(request);

    expect(result.available).toBe(false);
    expect(result.missing_table).toBe('prompt_runs');
    expect(result.overall.total_runs).toBe(0);
    expect(result.setup_hint).toContain('migrate-prompts');
  });
});

describe('recordPromptRun', () => {
  it('fails soft when prompt_runs is missing', async () => {
    const missingTable = Object.assign(new Error('relation "prompt_runs" does not exist'), { code: '42P01' });
    mockSql.mockRejectedValueOnce(missingTable);

    const result = await recordPromptRun(request, {
      template_id: 'pt_1',
      version_id: 'pv_1',
      rendered: 'hello',
    });

    expect(result.recorded).toBe(false);
    expect(result.missing_table).toBe('prompt_runs');
  });
});
