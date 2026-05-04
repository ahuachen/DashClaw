import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import VideoHero from '@/components/VideoHero';

describe('VideoHero component — DOG-02 iframe allowlist', () => {
  it('renders iframe with Loom embed src', () => {
    const html = renderToString(<VideoHero src="https://www.loom.com/embed/abc123" title="demo" />);
    expect(html).toContain('<iframe');
    expect(html).toContain('https://www.loom.com/embed/abc123');
  });

  it('renders iframe with youtube-nocookie embed src', () => {
    const html = renderToString(
      <VideoHero src="https://www.youtube-nocookie.com/embed/abc123" title="demo" />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('https://www.youtube-nocookie.com/embed/abc123');
  });

  it('includes allowFullScreen + title attributes for a11y', () => {
    const html = renderToString(
      <VideoHero src="https://www.loom.com/embed/abc123" title="DashClaw walkthrough" />,
    );
    expect(html).toMatch(/allowfullscreen/i);
    expect(html).toContain('title="DashClaw walkthrough"');
  });

  it('throws on non-allowed host (SSRF mitigation T-03-01-04)', () => {
    expect(() =>
      renderToString(<VideoHero src="https://evil.example.com/embed/abc123" title="demo" />),
    ).toThrow(/Loom or YouTube/);
  });

  it('throws on youtube.com (enforces nocookie variant only)', () => {
    expect(() =>
      renderToString(<VideoHero src="https://www.youtube.com/embed/abc123" title="demo" />),
    ).toThrow(/Loom or YouTube/);
  });

  it('throws on invalid URL', () => {
    expect(() => renderToString(<VideoHero src="not-a-url" title="demo" />)).toThrow();
  });

  it('uses CSS token classes, no hardcoded hex', () => {
    const html = renderToString(<VideoHero src="https://www.loom.com/embed/abc123" title="demo" />);
    expect(html).toContain('border-border-hover');
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
