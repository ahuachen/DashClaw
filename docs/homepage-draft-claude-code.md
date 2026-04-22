# Homepage Draft — Claude Code Beachhead

*Phase 3 handoff artifact. Not published to `app/page.js` in Phase 2. When
Phase 3 lifts this into the homepage hero, the copy and outline below are
the canonical source.*

## Hero

**Headline:** Govern Claude Code in 5 minutes.

**Subhead:** Install a hook. Connect Discord. Approve or deny risky tool
calls from your phone before they run. Built so your coding agent can
never surprise you with a destructive action.

**Hero visual:** Side-by-side split. Left: a terminal showing a real
Claude Code session hitting a destructive command. Right: a phone mockup
with the Discord DashClaw DM, Approve / Deny buttons visible. Motion: on
hover (or auto-play), the phone animates the tap and the terminal
unblocks. Same motion tempo as the existing `demo-gif2.gif` so the two
assets feel like siblings.

**Primary CTA:** "Start with Claude Code" links to `/guides/claude-code`.
**Secondary CTA:** "Deploy to Vercel" keeps the existing Deploy button.

## Three sections below the hero

### Section 1: What it prevents
Three concrete before / after pairs, taken from real blocked actions in
the dogfood ledger. Example: "Claude Code: `rm -rf ./dist` -> DashClaw:
blocked by policy `block_destructive_shell`. Your build cache lived."
Each pair is a single line. No interpretive gloss, no hype.

### Section 2: The 5-minute path
The same 3-step install block from the README, rendered visually.
Numbered. Each step has a tiny code snippet and a copy button. An
anchor link to the full `/guides/claude-code` deep-dive sits at the
end of the section, not at the top. Developers scroll the content
before they click out.

### Section 3: What you get
Three product cards: Mission Control (live decision stream),
`/my-agent` (what did my agent do today), `/activity` (day-grouped
ledger). Screenshots from the real dogfood instance. No mockups.
Evidence over decoration per `.impeccable.md`.

## Body copy (~220 words)

DashClaw is a governance runtime for AI coding agents. It intercepts
every tool call before it executes, enforces policies written in plain
YAML, and records an audit trail of every decision. When a call needs
human judgment, DashClaw routes the approval request to Discord or
Telegram. Approve from your phone in under 10 seconds.

The first-class integration is Claude Code. A single `npm run hooks:install`
registers a `PreToolUse` hook that gates every `Bash`, `Edit`, `Write`,
and `MultiEdit` call through DashClaw. The default policy pack
(`claude-code-starter`) silently allows git commits and test runs, always
blocks `rm -rf` and force-pushes to main, and requires approval for
ambiguous actions like network calls and package installs.

Every blocked action is visible in the ledger. Every approval is signed.
Every denial has a reason attached. The Discord DM is a scannable audit
surface — the full message history is your trail.

Self-host on Vercel free tier. Neon free tier for Postgres. One command
to deploy. No vendor lock-in. No SaaS subscription for the runtime
itself. If you want to publish telemetry or aggregate across fleets,
paid features are additive — the core governance loop is open source
and runs forever on $0 of managed infrastructure.

## Voice notes

- Direct, declarative, technical. No "unleash," no "empower," no
  exclamation marks. No emoji. Reference tone: the first 20 lines of a
  Vercel, Linear, or Resend product page.
- Brand orange (`--color-brand`) ONLY on the primary CTA and the "live
  decision" pulse. Everywhere else the UI is neutral dark. Orange is a
  signal, not ambient wallpaper — this is locked by `.impeccable.md`
  tiebreaker #2.
- Four-anti-references guardrail before ship: the hero must NOT drift
  toward generic-SaaS, consumer-AI sparkle, enterprise-compliance
  density, or crypto / web3 glow. See `.impeccable.md` §4.

## CTA pair

- **Primary:** "Start with Claude Code" — links to `/guides/claude-code`.
- **Secondary:** "Deploy to Vercel" — keeps the existing deploy button,
  visually smaller than the primary.

## What this draft does NOT cover (Phase 3 decides)

- Final color tokens (the design pass will confirm against the existing
  CSS custom properties in `app/globals.css`)
- Concrete screenshots (capture from the dogfood instance at handoff)
- Show HN launch copy — separate artifact (DOG-04)
- Metrics badges (star count, deployments) — freshness vs. stability
  tradeoff to be made by Phase 3 planner
- Animations on scroll (tempting but risks violating the "calm under
  pressure" tiebreaker; default to none until a specific moment earns
  it)

## Handoff checklist for Phase 3

- [ ] Confirm the 3-step install block matches the currently shipped
      install path (re-verify after each plan 02-0x that touches hooks
      or env vars)
- [ ] Update screenshots to reflect `/activity` day-grouping and the
      narrative `/my-agent` hero shipped in plan 02-03
- [ ] Ensure the hero CTA copy matches `/guides/claude-code` landing
      headline verbatim — consistency reduces friction
- [ ] Run the four-anti-references check on the rendered hero before
      publishing
- [ ] Decide YouTube vs Loom embed shape once plan 02-01 publishes the
      real screencast URL
