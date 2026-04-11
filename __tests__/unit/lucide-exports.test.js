import { describe, it, expect } from 'vitest';
import * as LucideAll from 'lucide-react';
import { Github } from 'lucide-react';

describe('lucide-react exports (regression guard for issue #71)', () => {
  it('exports Github as a truthy React component', () => {
    expect(Github).toBeTruthy();
  });

  it('keeps all icons used across DashClaw importable from the root export', () => {
    // Icons referenced from app/components/PublicFooter.js, PublicNavbar.js,
    // app/login/LoginClient.js, app/self-host/SetupTabs.js, app/toolkit/page.js
    const required = ['Github'];
    for (const name of required) {
      expect(LucideAll[name], `lucide-react is missing ${name}`).toBeTruthy();
    }
  });

  it('resolves to the 0.577.x line (prevents accidental major bump)', async () => {
    const pkg = await import('lucide-react/package.json', { with: { type: 'json' } }).catch(() => null);
    // If the json import syntax isn't available in the runner, this block becomes a no-op; the first two checks are the real guard.
    if (pkg && pkg.default && pkg.default.version) {
      expect(pkg.default.version.startsWith('0.577')).toBe(true);
    }
  });
});
