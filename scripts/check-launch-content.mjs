#!/usr/bin/env node
// check-launch-content.mjs — pre-launch gate for docs/launch/*.md.
//
// Added by plan 03-02 (DOG-04). Run before the same-day 2-hour launch blitz.
// Asserts HN title length, tweet char limits, blog word count, trigger
// commitment presence across all 3 files, and absence of secret-shaped
// strings in any draft.
//
// Exit 0 = ready to launch. Exit 1 = fix the reported issue first.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Secret patterns — MUST stay in lockstep with
// __tests__/unit/launch-content-assertions.test.js.
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

const HN_PATH = resolve(process.cwd(), 'docs/launch/hn-post.md');
const TWEET_PATH = resolve(process.cwd(), 'docs/launch/tweet-thread.md');
const BLOG_PATH = resolve(process.cwd(), 'docs/launch/blog-post.md');

const errors = [];
function fail(msg) {
  errors.push(msg);
}

function wordCount(text) {
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#>*_~`-]+/g, ' ');
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

function scanSecrets(label, text) {
  for (const [re, name] of SECRET_PATTERNS) {
    if (re.test(text)) {
      fail(`[${label}] leaked ${name}`);
    }
  }
}

function checkCommitmentWall(label, text) {
  if (!text.includes(TRIGGER_PHRASE)) {
    fail(`[${label}] missing trigger phrase: "${TRIGGER_PHRASE}"`);
  }
  if (!COMMITMENT_CLAUSE.test(text)) {
    fail(
      `[${label}] missing commitment clause matching ` +
        `/(pro|paid|monetization).*(launches|unlocks|fires|kicks in|when)/i`,
    );
  }
}

// ── HN post ──────────────────────────────────────────────────────────────
{
  let text;
  try {
    text = readFileSync(HN_PATH, 'utf8');
  } catch {
    fail(`[hn-post.md] file missing at ${HN_PATH}`);
    text = '';
  }
  if (text) {
    const titleMatch = text.match(/^(?:Title:\s*)?(Show HN:\s*DashClaw.*)$/m);
    if (!titleMatch) {
      fail('[hn-post.md] no "Show HN: DashClaw …" title line found');
    } else {
      const title = titleMatch[1].trim();
      if (title.length > 80) {
        fail(`[hn-post.md] title ${title.length} chars (>80): ${title}`);
      }
    }
    const wc = wordCount(text);
    if (wc < 150 || wc > 300) {
      fail(`[hn-post.md] body word count ${wc} outside [150, 300]`);
    }
    if (!/dashclaw\.io/.test(text)) {
      fail('[hn-post.md] missing dashclaw.io link');
    }
    if (!/\/blog\/claude-code-beachhead/.test(text)) {
      fail('[hn-post.md] missing /blog/claude-code-beachhead link');
    }
    checkCommitmentWall('hn-post.md', text);
    scanSecrets('hn-post.md', text);
  }
}

// ── Tweet thread ─────────────────────────────────────────────────────────
{
  let text;
  try {
    text = readFileSync(TWEET_PATH, 'utf8');
  } catch {
    fail(`[tweet-thread.md] file missing at ${TWEET_PATH}`);
    text = '';
  }
  if (text) {
    const parts = text.split(/\n(?=Tweet\s+\d+:)/);
    const tweets = [];
    for (const part of parts) {
      const m = part.match(/^Tweet\s+\d+:\s*([\s\S]*?)(?:\n\n|\n*$)/);
      if (m) {
        const body = m[1]
          .replace(/\(\s*\d+\s*chars?\s*\)/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .trim();
        tweets.push(body);
      }
    }
    if (tweets.length < 6 || tweets.length > 10) {
      fail(`[tweet-thread.md] tweet count ${tweets.length} outside [6, 10]`);
    }
    if (tweets[0] && /^(Hi[, ]|I'm building|Introducing|Announcing|Say hello)/i.test(tweets[0])) {
      fail('[tweet-thread.md] tweet 1 looks like a company intro (Pitfall 11)');
    }
    tweets.forEach((t, i) => {
      if (t.length > 280) {
        fail(`[tweet-thread.md] tweet ${i + 1} exceeds 280 chars (${t.length})`);
      }
    });
    if (!/rm\s*-rf|git push --force|npm install|force-push/.test(text)) {
      fail('[tweet-thread.md] no concrete command example found');
    }
    if (!/dashclaw\.io/.test(text)) {
      fail('[tweet-thread.md] missing dashclaw.io link');
    }
    checkCommitmentWall('tweet-thread.md', text);
    scanSecrets('tweet-thread.md', text);
  }
}

// ── Blog post ────────────────────────────────────────────────────────────
{
  let text;
  try {
    text = readFileSync(BLOG_PATH, 'utf8');
  } catch {
    fail(`[blog-post.md] file missing at ${BLOG_PATH}`);
    text = '';
  }
  if (text) {
    if (!/^#\s+.+$/m.test(text)) {
      fail('[blog-post.md] missing H1 title');
    }
    const h2s = text.match(/^##\s+.+$/gm) || [];
    if (h2s.length < 5) {
      fail(`[blog-post.md] only ${h2s.length} H2 sections (<5 required)`);
    }
    const wc = wordCount(text);
    if (wc < 600 || wc > 1200) {
      fail(`[blog-post.md] word count ${wc} outside [600, 1200]`);
    }
    checkCommitmentWall('blog-post.md', text);
    scanSecrets('blog-post.md', text);
  }
}

if (errors.length) {
  console.error('check-launch-content: FAILED');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('check-launch-content: OK — all 3 drafts ready for launch day');
