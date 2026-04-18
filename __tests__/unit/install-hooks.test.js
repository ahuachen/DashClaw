import { describe, it, expect } from 'vitest';
import { isManagedHookCommand, MANAGED_HOOK_FILES } from '../../scripts/install-hooks.mjs';

/**
 * Tests for the install-hooks.mjs managed-hook whitelist.
 *
 * Before commit 0986e958, this function used a naive substring check
 * (`cmd.includes('dashclaw_')`) which swept away user-authored hooks with
 * similar names on re-install. The whitelist approach restricts removal to
 * the three exact managed filenames. These tests guard against a regression
 * that would re-introduce the over-broad match.
 */

describe('install-hooks isManagedHookCommand', () => {
  it('recognises the three managed hooks via Unix-style paths', () => {
    expect(isManagedHookCommand('python .claude/hooks/dashclaw_pretool.py')).toBe(true);
    expect(isManagedHookCommand('python .claude/hooks/dashclaw_posttool.py')).toBe(true);
    expect(isManagedHookCommand('python .claude/hooks/dashclaw_stop.py')).toBe(true);
  });

  it('recognises the three managed hooks via Windows-style paths', () => {
    expect(isManagedHookCommand('python .claude\\hooks\\dashclaw_pretool.py')).toBe(true);
    expect(isManagedHookCommand('python .claude\\hooks\\dashclaw_posttool.py')).toBe(true);
    expect(isManagedHookCommand('python .claude\\hooks\\dashclaw_stop.py')).toBe(true);
  });

  it('matches when the filename stands alone (no path)', () => {
    expect(isManagedHookCommand('dashclaw_pretool.py')).toBe(true);
  });

  it('matches when the path is quoted in the settings command', () => {
    // settings.json JSON-escapes its values; rendered commands often look
    // like `python ".claude/hooks/dashclaw_stop.py"`. The path separator
    // before the filename is what the regex locks onto, so quoting is fine.
    expect(isManagedHookCommand('python ".claude/hooks/dashclaw_stop.py"')).toBe(true);
    expect(isManagedHookCommand('python ".claude\\hooks\\dashclaw_pretool.py"')).toBe(true);
  });

  it('does NOT match user-authored wrappers with similar names', () => {
    // These are the canonical regression cases — the pre-fix substring
    // match ('dashclaw_') would have eaten all of them.
    expect(isManagedHookCommand('python .claude/hooks/my_dashclaw_pretool.py')).toBe(false);
    expect(isManagedHookCommand('python .claude/hooks/dashclaw_metrics.py')).toBe(false);
    expect(isManagedHookCommand('python wrappers/run_dashclaw_pretool_with_tracing.py')).toBe(false);
    expect(isManagedHookCommand('dashclaw_custom.py')).toBe(false);
  });

  it('does NOT match partial filename collisions', () => {
    // Someone named their script with a managed filename as a substring —
    // still NOT a managed hook.
    expect(isManagedHookCommand('my_dashclaw_pretool.py.bak')).toBe(false);
    expect(isManagedHookCommand('dashclaw_stop.py.old')).toBe(false);
    expect(isManagedHookCommand('./notdashclaw_stop.py')).toBe(false);
  });

  it('does NOT match empty or irrelevant commands', () => {
    expect(isManagedHookCommand('')).toBe(false);
    expect(isManagedHookCommand('echo hello')).toBe(false);
    expect(isManagedHookCommand('python scripts/other.py')).toBe(false);
  });

  it('exposes the canonical list of managed files', () => {
    expect(MANAGED_HOOK_FILES).toEqual([
      'dashclaw_pretool.py',
      'dashclaw_posttool.py',
      'dashclaw_stop.py',
    ]);
  });
});
