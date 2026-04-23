import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const projectMd = readFileSync(path.resolve('.planning/PROJECT.md'), 'utf8');

describe('PROJECT.md — MON-01 commitment (D-03 location 3)', () => {
  it('contains the exact trigger commitment text', () => {
    expect(projectMd).toContain('50 verified Claude Code integrations');
  });

  it('mentions the measurement method (action_records + agent_id)', () => {
    // Anchor the commitment to the actual SQL so the trigger is auditable.
    expect(projectMd).toMatch(/action_records/);
    expect(projectMd).toMatch(/agent_id/);
  });

  it('Key Decisions row for monetization is updated from "Trigger pending" to Locked', () => {
    // The row was: "| Monetization: free first, paid later — but with a trigger | ... | ⚠️ Trigger pending |"
    // It must now be: "✓ Locked" (matching the Phase 3 D-01 decision).
    const monetizationRow = projectMd
      .split('\n')
      .find((line) => line.includes('Monetization: free first, paid later'));

    expect(monetizationRow).toBeDefined();
    expect(monetizationRow).not.toContain('⚠️ Trigger pending');
    expect(monetizationRow).toContain('✓ Locked');
  });
});
