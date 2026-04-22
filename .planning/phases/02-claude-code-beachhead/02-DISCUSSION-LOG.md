# Phase 2: Claude Code Beachhead - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 02-claude-code-beachhead
**Areas discussed:** Discord setup UX & multi-org mapping, Discord delivery channel, /my-agent narrative voice & layout, README rewrite structure

---

## Discord setup UX & multi-org mapping

### How should a user enable the Discord approval flow?

| Option | Description | Selected |
|--------|-------------|----------|
| ENV-only, mirror Telegram | DISCORD_BOT_TOKEN + DISCORD_APPROVER_USER_ID + DISCORD_APPROVER_ORG_ID + kill switch. Zero new UI. Same pattern as Telegram. | ✓ |
| UI setup flow at /setup/integrations/discord | Guided page with paste-token + test-send + select-org | |
| Hybrid: ENV for self-host, UI for hosted | Two paths. Max flexibility, double surface. | |

**User's choice:** ENV-only, mirror Telegram

### Single-org like Telegram, or multi-org mapping?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-org | One bot = one org via DISCORD_APPROVER_ORG_ID. Matches Telegram. | ✓ |
| Mapping table (approver_user_id → org_id) | New table, supports multi-org. More schema. | |
| Discord server → org mapping | guild_id-based org inference | |

**User's choice:** Single-org

### Where does the user learn how to create the Discord bot?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated section in /guides/claude-code | All beachhead content in one page | ✓ |
| Separate /setup/discord page | Decoupled from Claude Code guide | |
| README + linked docs | Repo-reader oriented | |

**User's choice:** Dedicated section in /guides/claude-code

---

## Discord delivery channel

### Where should the bot post approval messages?

| Option | Description | Selected |
|--------|-------------|----------|
| DM the admin user | Push notification to phone, opens into DM with buttons. No server setup. | ✓ |
| Post to a specific server channel | Via DISCORD_APPROVER_CHANNEL_ID. Needs invited bot + notif config. | |
| Both — DM primary, channel as audit log | Team-visibility; overkill for Phase 2 | |

**User's choice:** DM the admin user

### What fields should the approval embed show on Discord?

| Option | Description | Selected |
|--------|-------------|----------|
| Agent + action_type + goal + risk_score | 4 fields, matches Telegram buildResolvedText shape | ✓ |
| Agent + command preview (raw) | Compact, less framing | |
| Full context (agent + goal + type + args + risk + policy_matched) | Max rigor, risk of embed overflow | |

**User's choice:** Agent + action_type + goal + risk_score

### When a decision is made, what happens to the original Discord message?

| Option | Description | Selected |
|--------|-------------|----------|
| Edit in place, strip buttons (Telegram parity) | APPROVED/DENIED + timestamp inline, buttons removed | ✓ |
| Post a reply, leave original intact | Extra message, more Discord spam | |
| Delete the message entirely | Clean but destroys DM audit trail | |

**User's choice:** Edit in place, strip buttons

---

## /my-agent narrative voice & layout

### Visual structure?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrative hero + activity list | Big English sentence up top, list below. Story-first. | ✓ |
| Stat cards + detail rows | 4 number cards + rows. Dashboard-y. | |
| Narrative + stat chips + list (hybrid) | Sentence + compact chips + list | |

**User's choice:** Narrative hero + activity list

### Today / This week toggle — default view and scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Default Today, toggle to This week | Lands on today, one click to 7 days | ✓ |
| Default This week, toggle to Today | Longer story on load | |
| Timeline slider (hours → days → week) | Continuous range picker | |

**User's choice:** Default Today, toggle to This week

### Empty state when agent hasn't run anything yet?

| Option | Description | Selected |
|--------|-------------|----------|
| Install-prompt hero | 3-step setup reminder with link to /guides/claude-code | ✓ |
| Minimal "No activity" placeholder | Clean, wastes teaching opportunity | |
| Demo-mode preview | Fake data. Confuses users, violates .impeccable.md principle. | |

**User's choice:** Install-prompt hero

### Denials — how prominent on /my-agent?

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned at top with reason | Denied actions first, blocking policy inline | ✓ |
| Chronological with amber/red color coding | In timestamp order, visually distinct | |
| Separate "Denials" tab | Dedicated tab hides the alarm behind a click | |

**User's choice:** Pinned at top with reason

---

## README rewrite structure

### How should the README reshape around Claude Code without losing existing content?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Code lead, existing content below | "Govern Claude Code in 5 minutes" top, existing stays below fold | ✓ |
| Split files: README + GETTING-STARTED.md | README stays general, new file for Claude Code | |
| Full rewrite — Claude Code framing replaces current intro | Aggressive; alienates generic-framework visitors | |

**User's choice:** Claude Code lead, existing content below

### The current README top has `npx dashclaw-demo` (10-second demo). Keep it on the Claude Code path?

| Option | Description | Selected |
|--------|-------------|----------|
| Move below the fold, keep as "Try the Replay demo" | Preserves the 10-sec hook for non-Claude-Code visitors | ✓ |
| Remove entirely | Loses a genuine good hook | |
| Merge into Claude Code path | Tightest story, most copy rework | |

**User's choice:** Move below the fold, keep as "Try the Replay demo"

### Screencast placement in README?

| Option | Description | Selected |
|--------|-------------|----------|
| Embedded GIF preview + link to full video | Autoplay GIF, clicks to YouTube/Loom | ✓ |
| YouTube thumbnail with play-button overlay | Static, fastest loading | |
| Text link only, no preview | Most minimal, weakest hook | |

**User's choice:** Embedded GIF preview + link to full video

### Homepage draft — what kind of artifact should Phase 2 produce?

| Option | Description | Selected |
|--------|-------------|----------|
| Copy + section outline | 300-500 words draft + hero visual outline | ✓ |
| HTML/JSX mockup committed to /docs/ | Rendered preview, more work | |
| Just headline + subhead + bullet points | Shortest viable, leaves Phase 3 blank-slate | |

**User's choice:** Copy + section outline

---

## Claude's Discretion

- Ed25519 verification library choice (`tweetnacl` vs `@noble/ed25519` vs native)
- `dashclaw_wait_for_approval` polling interval (current ≤5s; may tighten to ~2s for 10s round-trip)
- Screencast hosting platform (Loom vs YouTube vs self-hosted)
- Discord denial-reason modal (MODAL_SUBMIT) — optional nicety
- `/my-agent` copy voice specifics (emoji use, sentence tone)

## Deferred Ideas

- Multi-org Discord mapping (`discord_approvers` table)
- Discord server channel posting alongside DM
- Discord denial-reason modal
- Slack approval bridge
- Email/SMS approval fallback
- Mac/Linux walkthrough recordings
- `/my-agent` timeline slider
- `/my-agent` demo-mode preview (rejected)
- Discord UI setup flow at `/setup/integrations/discord`
