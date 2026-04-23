import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// Child components live in .js files containing JSX — vitest's oxc parser
// refuses JSX-in-.js on import, so stub the noisy ones. The hero text we
// care about lives in app/page.js itself and is untouched.
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

// Import AFTER mocks.
import LandingPage from '@/page.jsx';

function renderPage() {
  return renderToString(<LandingPage />);
}

describe('homepage hero — DOG-03 rewrite', () => {
  it('embeds a VideoHero iframe above the fold (Loom or youtube-nocookie)', () => {
    const html = renderPage();
    expect(html).toMatch(/<iframe[^>]*src="[^"]*(loom\.com|youtube-nocookie\.com)\/embed\//);
  });

  it('hero headline mentions Claude Code (terse-technical voice per D-12)', () => {
    const html = renderPage();
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1Match).not.toBeNull();
    const headlineText = h1Match[1].replace(/<[^>]+>/g, '').trim();
    // Accept direct "Claude Code" mention OR a beachhead-adjacent phrase (coding agent)
    expect(headlineText).toMatch(/claude code|coding agent/i);
  });

  it('hero headline is ≤ 60 characters (enforces ≤8-word terse voice)', () => {
    const html = renderPage();
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    expect(h1Match).not.toBeNull();
    const headlineText = h1Match[1].replace(/<[^>]+>/g, '').trim();
    expect(headlineText.length).toBeLessThanOrEqual(60);
  });

  it('CTA order is Watch → Install → Star on GitHub (D-14)', () => {
    const html = renderPage();

    const watchIdx = html.search(/\bWatch\b/);
    const installIdx = html.search(/\bInstall\b/);
    const starIdx = html.search(/\bStar\b/);

    expect(watchIdx).toBeGreaterThan(-1);
    expect(installIdx).toBeGreaterThan(-1);
    expect(starIdx).toBeGreaterThan(-1);

    expect(watchIdx).toBeLessThan(installIdx);
    expect(installIdx).toBeLessThan(starIdx);
  });

  it('Install CTA points at /connect', () => {
    const html = renderPage();
    expect(html).toContain('href="/connect"');
  });

  it('Star CTA points at the DashClaw GitHub repo with rel=noopener', () => {
    const html = renderPage();
    expect(html).toMatch(/href="https:\/\/github\.com\/[^"]*DashClaw"/);
    expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
  });
});
