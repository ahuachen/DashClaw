import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// Stub JSX-in-.js children + data modules; the hero text we assert on is in page.js itself.
vi.mock('@/components/PublicNavbar', () => ({ default: () => null }));
vi.mock('@/components/PublicFooter', () => ({ default: () => null }));
vi.mock('@/components/SetupBanner', () => ({ default: () => null }));
vi.mock('@/components/HeroScreenshot', () => ({ default: () => null }));
vi.mock('@/components/InlineCopyCommand', () => ({ default: () => null }));
vi.mock('@/components/DashClawLogo', () => ({ default: () => null }));
vi.mock('@/screenshotData', () => ({ allScreenshots: [] }));
vi.mock('@/landingData', () => ({
  coreFeatures: [],
  platformFeatures: [],
  corePrimitives: [],
  operationalFeatures: [],
  signals: [],
  platformCoverage: [],
  shippedHighlights: [],
  frameworkQuickstarts: [],
}));

import LandingPage from '@/page.js';

// Rejected framings per D-13. Each substring must NOT appear in the rendered
// hero HTML (case-insensitive). Scope = whole-page render; the plan's intent
// is hero rewrite but lower-fold copy may also carry these phrases — we
// assert on whole-page because that's what a visitor sees.
const REJECTED = [
  'homelab',
  'SOC 2',
  'SOC2',
  'compliance team',
  'control plane for agents',
  'policy-as-code for AI',
  'works with any agent framework',
  'enterprise compliance',
  'policy firewall for AI agents',
];

describe('homepage rejected framings — DOG-03 D-13 negative assertions', () => {
  for (const phrase of REJECTED) {
    it(`does NOT contain "${phrase}" (case-insensitive)`, () => {
      const html = renderToString(<LandingPage />);
      const haystack = html.toLowerCase();
      const needle = phrase.toLowerCase();
      expect(haystack).not.toContain(needle);
    });
  }
});
