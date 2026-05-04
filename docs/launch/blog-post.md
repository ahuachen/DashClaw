# DashClaw: govern Claude Code before it surprises you

*Draft for `app/blog/claude-code-beachhead/page.js`. Task 2 translates
this into JSX. Voice matches the homepage hero — terse, technical, first
person. No marketing adjectives.*

---

# Govern Claude Code before it surprises you

## The problem

Claude Code is fast. Most of the time that's exactly what I want. Some of
the time it isn't. In the past few months it has:

- rm -rf'd a node_modules I actually needed for a different checkout
- force-pushed to main after a rebase I had not finished reviewing
- installed a package I had not vetted because an upstream snippet
  suggested it

None of these are the agent's fault. The agent did what I told it to do,
and sometimes what I told it to do was too broad. The question isn't
"how do I make the agent smarter" — the question is "how do I keep a
small number of specific actions from running without me knowing."

## Demo

Here's the 3-minute walkthrough. Hook install, first destructive call
intercepted, phone tap, terminal unblocks. Real Claude Code session,
real Discord DM, real stopwatch.

[SCREENCAST_URL]

Everything below is the writeup of what you just watched.

## How it works

DashClaw registers a PreToolUse hook on your Claude Code install. Every
Bash, Edit, Write, and MultiEdit call goes through a policy check before
it runs. The flow is:

1. `npm install && npm run hooks:install` — wires the hook into
   `~/.claude/settings.json`.
2. Paste a workspace token from `/connect`. That's the API key my
   deployment uses to recognize this laptop.
3. Configure Discord — pick a server, pick a channel, drop in a bot
   token. I use my own account; you use yours.

That's three commands and one paste. The Claude Code → DashClaw →
Discord → phone loop is the only thing on the critical path.

## What's free

The runtime is free forever for solo devs on the Claude Code path. That
includes:

- The PreToolUse hook and the `claude-code-starter` policy pack
- Discord and Telegram approval bridges
- The `/decisions` ledger with signed approvals and denials
- The semantic guard, using your own OpenAI or Anthropic key — so the
  governance loop costs me about a cent per approval
- The `/activity` and `/my-agent` surfaces, where I check what the agent
  did today without scrolling through a terminal

I self-host on Vercel free tier. Postgres on Neon free tier. Zero SaaS
subscription. Deploy button on the GitHub repo. One click.

## The 50-integration commitment

DashClaw is free while I grow. Pro tier launches when DashClaw hits
**50 verified Claude Code integrations** in the wild — measured by a
public SQL query over `action_records` where `agent_id` starts with
`claude-code`, 90-day recency window, internal orgs excluded. Live
counter at dashclaw.io/pricing.

The free tier above stays free forever. Pro adds multi-user orgs with
SSO, custom policy packs, audit export, and non-Claude-Code integrations
— things a team needs, not things a solo dev on Claude Code needs.

I committed this in four places so I can't quietly change my mind:
`/pricing`, the README, `PROJECT.md`, and this post.

## What breaks and what I fixed

Two things bit me early and both shipped fixes you'll never see:

- **CSP blocked the embed.** The first time I put a Loom iframe on the
  homepage, Chrome refused to render it because my `frame-src` directive
  was `'self'`. Fixed by explicitly allowlisting `loom.com` and
  `youtube-nocookie.com` in `next.config.js`, and by having the embed
  component itself throw if someone tries a third host.
- **The hook silently failed open when the guard was unreachable.** If
  my deployment was down, a destructive action would just… run. Fixed
  with a `block | warn | allow` policy knob that defaults to block, plus
  an orphan-actions journal that backfills every outage call into the
  ledger on recovery.

Both of these are the kinds of things you only find by running DashClaw
on your own laptop every day.

## What's next

I'm building the rest of DashClaw's growth loop under DashClaw-governed
agents. Research, content drafts, monitoring — each one is a Claude Code
session with policies the public can read. If the flywheel works, every
piece of marketing I publish also proves the product. If it breaks, the
audit ledger shows exactly where.

Public status page coming. The first one will be a live board of how
many Claude Code integrations are active this week, which policies fired
most, and which denials I had to override because my own policy was
wrong.

## Try it

```bash
npm install
npm run hooks:install
# then open /connect for the workspace token + Discord setup
```

Three commands. The guide walks you through the rest:
https://dashclaw.io/guides/claude-code

If something breaks, open an issue on GitHub. I read all of them.
