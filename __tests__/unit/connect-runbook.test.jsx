import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name) => (name === 'host' ? 'dashclaw.example.com' : null),
  }),
}));

// Stub JSX-in-.js children + the client component. We care about the page-level
// structure (single-page runbook, no wizard markers, HostedProvision preserved,
// three runbook elements present).
vi.mock('@/components/PublicNavbar', () => ({ default: () => null }));
vi.mock('@/components/PublicFooter', () => ({ default: () => null }));

// Force hostedMode TRUE so HostedProvisionSection renders (D-15: inline token UX).
vi.mock('@/lib/hosted/publicConfig.js', () => ({
  publicHostedConfig: () => ({ hostedMode: true, turnstileSiteKey: null }),
}));
vi.mock('@/connect/HostedProvisionClient', () => ({
  default: () => null,
}));

import ConnectPage from '@/connect/page.jsx';

async function renderPage() {
  const element = await ConnectPage();
  return renderToString(element);
}

describe('/connect single-page runbook — DOG-03 D-15', () => {
  it('does NOT contain multi-step wizard markers', async () => {
    const html = await renderPage();
    // "Step 1 of N" / "Step 2 of N" wizard framing
    expect(html).not.toMatch(/step\s*\d+\s*of\s*\d+/i);
    // Explicit "Golden path" header was the wizard's banner — D-15 removes it
    expect(html).not.toMatch(/Golden path/i);
  });

  it('preserves HostedProvisionSection — inline workspace-token UX (D-15)', async () => {
    const html = await renderPage();
    // HostedProvisionSection heading text is stable
    expect(html).toMatch(/Pick your stack|pre-configured workspace/i);
  });

  it('contains all three runbook elements — install, workspace token, Discord', async () => {
    const html = await renderPage();
    // 1. Install command surface
    expect(html).toMatch(/npm install|npm run hooks:install/i);
    // 2. Workspace token / API key surface
    expect(html).toMatch(/DASHCLAW_API_KEY|workspace token|workspace api key/i);
    // 3. Discord approval configuration
    expect(html).toMatch(/discord/i);
  });
});
