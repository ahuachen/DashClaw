import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';

// Stub navbar/footer per the oxc-parser workaround pattern used in
// pricing-page.test.jsx (JSX-in-.js files break vitest's transform on import).
vi.mock('@/components/PublicNavbar', () => ({ default: () => null }));
vi.mock('@/components/PublicFooter', () => ({ default: () => null }));

import BlogPost from '@/blog/claude-code-beachhead/page.jsx';

const BLOG_FILE = resolve(
  process.cwd(),
  'app/blog/claude-code-beachhead/page.jsx',
);

function render() {
  const element = BlogPost();
  return renderToString(element);
}

function wordCount(html) {
  const text = html.replace(/<[^>]+>/g, ' ');
  const decoded = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ');
  return decoded.trim().split(/\s+/).filter(Boolean).length;
}

describe('/blog/claude-code-beachhead page (DOG-04)', () => {
  it('renders without throwing', () => {
    const html = render();
    expect(html.length).toBeGreaterThan(200);
  });

  it('contains the 50-integration trigger commitment (D-03 location 2 echo)', () => {
    const html = render();
    expect(html).toContain('50 verified Claude Code integrations');
  });

  it('embeds a VideoHero iframe from Loom or youtube-nocookie', () => {
    const html = render();
    expect(html).toMatch(/<iframe[^>]+src="[^"]*(loom\.com|youtube-nocookie\.com)/);
  });

  it('has at least 5 H2 section headings', () => {
    const html = render();
    const h2s = html.match(/<h2\b[^>]*>/g) || [];
    expect(h2s.length).toBeGreaterThanOrEqual(5);
  });

  it('word count in main content is within [600, 1200] (D-20 length lock)', () => {
    const html = render();
    const wc = wordCount(html);
    expect(wc, `blog post word count was ${wc}`).toBeGreaterThanOrEqual(600);
    expect(wc).toBeLessThanOrEqual(1200);
  });

  it('uses founder-voice first person at least 3 times', () => {
    const html = render();
    const matches = html.match(/\b(I|my|I&#x27;m|I'm)\b/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('does not use rejected marketing adjectives', () => {
    const html = render();
    expect(html).not.toMatch(/revolutionize|game-chang|next generation|cutting-edge/i);
  });

  it('contains no hardcoded hex in source file', () => {
    const source = readFileSync(BLOG_FILE, 'utf8');
    // Ignore the VideoHero src URL which may be a placeholder; only check for
    // 6-digit hex colors in Tailwind-style bracket classes or inline styles.
    const hexMatches = source.match(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g) || [];
    expect(hexMatches).toEqual([]);
  });

  it('links to /pricing and /guides/claude-code', () => {
    const html = render();
    expect(html).toMatch(/href="[^"]*\/pricing/);
    expect(html).toMatch(/href="[^"]*\/guides\/claude-code/);
  });
});
