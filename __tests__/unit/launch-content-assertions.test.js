import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Single source of truth for secret regex patterns — MUST stay in lockstep
// with scripts/check-launch-content.mjs. Duplicated intentionally so the
// test file and the runnable guardrail each self-contain their assertions.
const SECRET_PATTERNS = [
  [/DASHCLAW_API_KEY\s*=\s*\S{20,}/, 'DASHCLAW_API_KEY assignment'],
  [/DISCORD_BOT_TOKEN\s*=\s*\S{40,}/, 'DISCORD_BOT_TOKEN assignment'],
  [/DATABASE_URL\s*=\s*(postgres|postgresql):\/\/\S+/, 'DATABASE_URL'],
  [/sk-ant-[A-Za-z0-9]{48,}/, 'Anthropic API key'],
  [/\bsk-[A-Za-z0-9]{40,}/, 'OpenAI API key'],
  [/\bgh[oprsu]_[A-Za-z0-9]{36,}/, 'GitHub token'],
  [/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_\-]{60,}/, 'Discord webhook URL'],
];

const TRIGGER_PHRASE = '50 verified Claude Code integrations';
const COMMITMENT_CLAUSE =
  /(pro|paid|monetization).*(?:launches|unlocks|fires|kicks in|when)/i;
const REJECTED_VOICE = /revolutionize|game-chang|next generation|cutting-edge/i;

const HN_PATH = resolve(process.cwd(), 'docs/launch/hn-post.md');
const TWEET_PATH = resolve(process.cwd(), 'docs/launch/tweet-thread.md');
const BLOG_PATH = resolve(process.cwd(), 'docs/launch/blog-post.md');

const read = (p) => readFileSync(p, 'utf8');

function wordCount(text) {
  // Strip markdown headings / fences / code backticks / html entities
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#>*_~`-]+/g, ' ');
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

describe('launch content: hn-post.md', () => {
  const text = read(HN_PATH);

  it('exists and has non-empty body', () => {
    expect(text.length).toBeGreaterThan(100);
  });

  it('contains a title line in "Show HN: DashClaw – …" format, ≤80 chars', () => {
    const titleMatch = text.match(/^(?:Title:\s*)?(Show HN:\s*DashClaw.*)$/m);
    expect(titleMatch, 'expected a Show HN: DashClaw title line').toBeTruthy();
    const title = titleMatch[1].trim();
    expect(title.length).toBeLessThanOrEqual(80);
    // Target 60-75 for UI buffer (Pitfall 10) — informational, not hard
    expect(title.length).toBeGreaterThanOrEqual(30);
  });

  it('body word count in [150, 300]', () => {
    const wc = wordCount(text);
    expect(wc).toBeGreaterThanOrEqual(150);
    expect(wc).toBeLessThanOrEqual(300);
  });

  it('contains the 50-integration trigger phrase', () => {
    expect(text).toContain(TRIGGER_PHRASE);
  });

  it('contains the commitment clause (pro/paid/monetization + launches/unlocks/fires/kicks in/when)', () => {
    expect(text).toMatch(COMMITMENT_CLAUSE);
  });

  it('links to dashclaw.io', () => {
    expect(text).toMatch(/dashclaw\.io/);
  });

  it('links to the blog post at /blog/claude-code-beachhead', () => {
    expect(text).toMatch(/\/blog\/claude-code-beachhead/);
  });

  it('contains no secret patterns', () => {
    for (const [re, label] of SECRET_PATTERNS) {
      expect(text, `hn-post.md leaked ${label}`).not.toMatch(re);
    }
  });

  it('does not use marketing-voice adjectives', () => {
    expect(text).not.toMatch(REJECTED_VOICE);
  });
});

describe('launch content: tweet-thread.md', () => {
  const text = read(TWEET_PATH);

  // Parse tweets: lines starting with "Tweet N:" or "N)" or "N." followed by body
  function extractTweets(raw) {
    // Split on tweet markers: Tweet 1:, Tweet 2:, etc.
    const parts = raw.split(/\n(?=Tweet\s+\d+:)/);
    const tweets = [];
    for (const part of parts) {
      const m = part.match(/^Tweet\s+\d+:\s*([\s\S]*?)(?:\n\n|\n*$)/);
      if (m) {
        // Body is everything from the Tweet N: line until a blank line or the next
        // section. Strip trailing char-count annotations like "(272 chars)".
        let body = m[1]
          .replace(/\(\s*\d+\s*chars?\s*\)/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim();
        tweets.push(body);
      }
    }
    return tweets;
  }

  const tweets = extractTweets(text);

  it('has 6-10 tweets', () => {
    expect(tweets.length).toBeGreaterThanOrEqual(6);
    expect(tweets.length).toBeLessThanOrEqual(10);
  });

  it('tweet 1 opens with a concrete problem, not a company intro (Pitfall 11)', () => {
    expect(tweets[0]).toBeDefined();
    expect(tweets[0]).not.toMatch(/^(Hi[, ]|I'm building|Introducing|Announcing|Say hello)/i);
  });

  it('each tweet ≤ 280 chars', () => {
    tweets.forEach((t, i) => {
      expect(t.length, `tweet ${i + 1} too long: ${t.length} chars`).toBeLessThanOrEqual(280);
    });
  });

  it('thread contains trigger phrase', () => {
    expect(text).toContain(TRIGGER_PHRASE);
  });

  it('thread contains commitment clause', () => {
    expect(text).toMatch(COMMITMENT_CLAUSE);
  });

  it('thread contains at least one concrete command example', () => {
    expect(text).toMatch(/rm\s*-rf|git push --force|npm install|force-push/);
  });

  it('thread contains a dashclaw.io link', () => {
    expect(text).toMatch(/dashclaw\.io/);
  });

  it('contains no secret patterns', () => {
    for (const [re, label] of SECRET_PATTERNS) {
      expect(text, `tweet-thread.md leaked ${label}`).not.toMatch(re);
    }
  });
});

describe('launch content: blog-post.md', () => {
  const text = read(BLOG_PATH);

  it('has an H1 title', () => {
    expect(text).toMatch(/^#\s+.+$/m);
  });

  it('has at least 5 H2 sections', () => {
    const h2s = text.match(/^##\s+.+$/gm) || [];
    expect(h2s.length).toBeGreaterThanOrEqual(5);
  });

  it('word count in [600, 1200]', () => {
    const wc = wordCount(text);
    expect(wc, `blog word count was ${wc}`).toBeGreaterThanOrEqual(600);
    expect(wc).toBeLessThanOrEqual(1200);
  });

  it('contains trigger phrase', () => {
    expect(text).toContain(TRIGGER_PHRASE);
  });

  it('contains commitment clause', () => {
    expect(text).toMatch(COMMITMENT_CLAUSE);
  });

  it('uses founder-voice first person (I / my / I\'m) at least 3 times', () => {
    const matches = text.match(/\b(I|my|I'm)\b/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it('references the flagship video (placeholder or descriptive)', () => {
    expect(text).toMatch(/(video|walkthrough|loom|youtube|screencast|SCREENCAST_URL)/i);
  });

  it('does not use marketing-voice adjectives', () => {
    expect(text).not.toMatch(REJECTED_VOICE);
  });

  it('contains no secret patterns', () => {
    for (const [re, label] of SECRET_PATTERNS) {
      expect(text, `blog-post.md leaked ${label}`).not.toMatch(re);
    }
  });
});
