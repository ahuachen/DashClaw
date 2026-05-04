import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const readme = readFileSync(path.resolve('README.md'), 'utf8');
const lines = readme.split('\n');

describe('README.md — MON-01 commitment (D-03 location 4)', () => {
  it('contains the exact trigger commitment text', () => {
    expect(readme).toContain('50 verified Claude Code integrations');
  });

  it('trigger first appears AFTER line 50 (Wave-1 parallel safety with Plan 03-01 Task 4)', () => {
    // Plan 03-01 Task 4 edits README lines 8 and 19 for screencast URL backfill.
    // Plan 03-03 Task 3 must insert AFTER line 50 to avoid merge collision.
    let firstMatchLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('50 verified Claude Code integrations')) {
        firstMatchLine = i + 1; // 1-indexed
        break;
      }
    }
    expect(firstMatchLine).toBeGreaterThan(50);
  });

  it('check-readme-lead non-regression: first 50 lines still mention Claude Code + guide link', () => {
    // Replicates scripts/check-readme-lead.mjs inline so this test fails if a
    // future edit accidentally displaces the Claude-Code-forward lead.
    const first50 = lines.slice(0, 50).join('\n');
    expect(first50).toMatch(/claude code/i);
    expect(first50).toMatch(/\/guides\/claude-code/);
  });

  it('points at /pricing for progress (live counter URL)', () => {
    expect(readme).toMatch(/\/pricing/);
  });

  it('contains no paywall/buy-CTA language (D-07: commitment, not purchase)', () => {
    // Only check the *monetization paragraph*, not the whole README — the rest
    // of the README may legitimately mention commercial concepts elsewhere.
    // We locate the trigger line and check its paragraph context (±5 lines).
    const idx = lines.findIndex((l) => l.includes('50 verified Claude Code integrations'));
    expect(idx).toBeGreaterThanOrEqual(0);
    const paragraph = lines.slice(Math.max(0, idx - 3), idx + 5).join('\n');
    expect(paragraph).not.toMatch(/buy now|upgrade now|subscribe|purchase|checkout|pay now/i);
  });
});
