# Phase 2: Claude Code Beachhead - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the Claude Code beachhead: Discord approval flow, human-readable agent activity timeline, and first-class documentation so a developer on Wes's Windows/WSL can go from `git clone` to first approved Claude Code tool call in ≤5 minutes, with the event visible on `/activity` (day-grouped) and narrativized on `/my-agent`, documented across dashclaw.io + README + a ≤3-minute screencast.

Plan 02-01 (claude-code-starter policy pack) shipped 2026-04-21 and is treated as complete (CCI-02 = no regression). Remaining work: Plan 02-02 (Discord approval) + Plan 02-03 (timeline + docs + walkthrough).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `02-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `02-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Discord bot app registration + `/api/discord/interactions` route + Ed25519 signature verification + button interaction handling
- `/activity` day-grouping presentational layer (no schema change)
- `/my-agent` new page with today/week toggle, narrative summary, denials pinned
- `/guides/claude-code` rewrite to reflect shipped integration + Discord path
- README Getting Started rewrite (Claude Code first)
- ≤3-minute screencast of end-to-end install and first approval
- Draft copy for Phase 3's homepage rewrite (`docs/homepage-draft-claude-code.md`)
- Recorded CCI-01 walkthrough on Windows/WSL as evidence

**Out of scope (from SPEC.md):**
- Flagship demo video (DOG-02) — Phase 3
- Homepage hero publish (DOG-03) — Phase 3
- Launch content: Show HN, tweet thread, blog post (DOG-04) — Phase 3
- Mac and Linux walkthroughs — deferred
- Cursor / Aider / Cody integrations — v2 milestone
- Monetization trigger wiring — Phase 3
- Discord gateway client (websocket) — rejected: Vercel free tier incompatible
- Deep-link web approval from Discord — rejected: violates CCI-03 "no browser required"
- Multi-org mapping table for Discord — deferred (see Deferred Ideas)

</spec_lock>

<decisions>
## Implementation Decisions

### Discord Integration Shape

- **D-01 — Bot + webhook interactions (Telegram parity)**: Register a Discord bot app, receive button interactions at new `POST /api/discord/interactions`, approve/deny via embed buttons, edit message in place. Mirrors the existing `/api/telegram/webhook` pattern one-to-one. Gateway websocket and deep-link alternatives were rejected at spec-phase time.
- **D-02 — ENV-only setup, mirror Telegram**: No UI setup flow in Phase 2. Configuration via env vars following the Telegram naming pattern:
  - `DISCORD_BOT_TOKEN` — bot API token from Discord Developer Portal
  - `DISCORD_PUBLIC_KEY` — Ed25519 public key for interaction signature verification (distinct from bot token)
  - `DISCORD_APPROVER_USER_ID` — numeric Discord user ID allowed to approve
  - `DISCORD_APPROVER_ORG_ID` — org whose actions this Discord identity can resolve
  - `DASHCLAW_ALERTS_DISCORD` — kill switch (`false` disables outbound even when token is set)
- **D-03 — Single-org**: One bot = one org, matching Telegram. Multi-org mapping table is a future phase.
- **D-04 — DM the admin user**: Bot DMs `DISCORD_APPROVER_USER_ID` directly. No server channel posting in Phase 2.
- **D-05 — Approval embed fields (4 standard)**: `Agent`, `action_type`, `Goal` (truncated at 200 chars), `Risk score`. Matches the shape of `buildResolvedText()` in `app/api/telegram/webhook/route.js`.
- **D-06 — Resolve by editing message in place**: On approve/deny, edit the original DM to show `APPROVED — HH:MM:SS` or `DENIED — HH:MM:SS`, remove buttons. Preserves DM history as a mobile-scannable audit trail. Exact parity with Telegram `editMessage`.
- **D-07 — Callback data encoding**: `ap:act_...` / `dn:act_...` in Discord button `custom_id`, matching the Telegram pattern. Same 57-char action ID limit.

### `/my-agent` Page

- **D-08 — Narrative hero + chronological activity list**: Top is a single-sentence English summary in large type ("Today your agent ran 47 commands. 3 required approval. 0 were denied."). Below is the event list. Story-first, not dashboard-first.
- **D-09 — Default Today, toggle to This week**: Lands on today's activity. One click switches to trailing 7 days. No timeline slider.
- **D-10 — Empty state = install-prompt hero**: When the user has no agent activity yet, the page shows a friendly block with the 3-step setup reminder (install hook → connect Discord → trigger a command) linking to `/guides/claude-code`. Turns the empty state into a re-onboarding moment.
- **D-11 — Denials pinned at top with reason**: Denied actions appear first in the list regardless of timestamp, showing the blocking policy name and reason inline. The "alarm" signal must be above the fold. Approvals and silent allows follow chronologically.
- **D-12 — Realtime via existing `useRealtime` hook**: Page updates live without manual refresh, using the same pattern `/activity`, `/approve`, and `/approvals` already use.

### `/activity` Day Grouping

- **D-13 — Presentational layer only, no schema change**: Group the existing GlobalActivityFeed events by calendar day client-side. One-line English header per day: `"Wed Apr 22 — 12 approvals, 3 denials, 47 silent allows, 0 errors"`. Individual events remain inspectable beneath each day header.
- **D-14 — Respect `useAgentFilter`**: Day counts reflect the active agent filter if one is set.

### README Rewrite

- **D-15 — Claude Code lead, existing content below**: Top of README becomes "Govern Claude Code in 5 minutes" with GIF preview + 3-step install + screencast link + pointer to `/guides/claude-code`. The existing multi-framework "Works with" list, Deploy button, `npx dashclaw-demo` block, and SDK snippets stay below the fold, not deleted.
- **D-16 — `npx dashclaw-demo` stays as secondary hook**: Moved below the Claude Code section, framed as "Try the Decision Replay demo in 10 seconds" for visitors who don't use Claude Code yet. Preserves the fast visual hook for non-beachhead users.
- **D-17 — Embedded GIF preview + link to full video**: Top-of-README uses a short autoplay GIF (like the current `demo-gif2.gif` slot) that links out to the full YouTube/Loom screencast on click. Matches the existing README pattern.

### Documentation Surfaces (CCI-05)

- **D-18 — All Discord setup steps live in `/guides/claude-code`**: One page owns the Claude Code beachhead deep-dive. Steps include: Discord Developer Portal walkthrough (create app, enable Bot, copy token, copy public key, set interactions endpoint URL, invite/enable DMs). No separate `/setup/discord` page.
- **D-19 — Homepage draft = copy + section outline**: `docs/homepage-draft-claude-code.md` contains ~300-500 words of draft headline/subhead/3 sections of body copy + an outline of what the hero visual should be. Not a rendered mockup. Phase 3 lifts from this into `app/page.js`.
- **D-20 — Screencast hosting: Claude's discretion**: Loom vs YouTube vs self-hosted left to the researcher/planner to decide based on embed support, permanence, and bandwidth cost. No strong preference captured. SEO favors YouTube; speed-to-publish favors Loom.

### Claude's Discretion

The following were deliberately not locked — downstream agents may choose reasonable defaults:

- **Ed25519 verification library**: `tweetnacl`, `@noble/ed25519`, or Node's native `crypto.verify` with Ed25519 keys. Discord's official docs example uses `tweetnacl`, so that's the most conservative path. Planner can pick.
- **`dashclaw_wait_for_approval` polling interval**: Current implementation polls every ≤5s. To honor the ≤10s round-trip budget in CCI-03, tightening to ~2s may be needed. Planner evaluates against Discord rate limits and DB load.
- **Screencast hosting platform**: See D-20.
- **Denial reason UX on Discord**: Whether Deny triggers an optional modal asking "Why?" before resolving (Discord supports `MODAL_SUBMIT` interactions) or just resolves immediately. Either is acceptable; modal is nicer but ~2x more code.
- **`/my-agent` copy voice** (emoji use, sentence-level tone): Follow `.impeccable.md` personality guidance. No explicit voice decision made.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Requirements
- `.planning/phases/02-claude-code-beachhead/02-SPEC.md` — **Locked requirements — MUST read before planning.** 5 CCI requirements, 15 acceptance criteria, explicit in/out scope, constraints, Windows/WSL platform target.

### Project-Level Context
- `.planning/PROJECT.md` — Core value statement, Vercel-free-tier constraint, route SQL guardrail, JavaScript-not-TypeScript, rejected out-of-scope items (homelab/enterprise/VC-scale)
- `.planning/REQUIREMENTS.md` — CCI-01 through CCI-05 source definitions, DOG/MON/FIX/USR requirement context for phase boundary
- `.planning/ROADMAP.md` §Phase 2 — Phase goal, success criteria, plan decomposition
- `.planning/STATE.md` — Current progress (note: stale as of 2026-04-22, should be updated)

### Code Maps
- `.planning/codebase/CONVENTIONS.md` — Naming, imports, error handling, validation pattern, route SQL rule (no direct SQL in routes), `@/` path alias, JavaScript/ESLint only
- `.planning/codebase/INTEGRATIONS.md` — Telegram approval bridge blueprint (§"Telegram approval bridge (optional)"), env var naming conventions, notification-adapter pattern, webhook routes

### Design Context
- `.impeccable.md` — Design context for `/my-agent`, `/activity` grouping, guides page rewrite, README, homepage draft. Key principles: evidence over decoration, brand orange as signal not noise, calm under pressure, token-first (no hardcoded hex), developer-reader first, WCAG 2.1 AA floor, four anti-references guardrail.

### Direct Blueprint (Telegram Parity)
- `app/api/telegram/webhook/route.js` — The direct pattern for `/api/discord/interactions`: timing-safe secret, CALLBACK_DATA_RE parsing, `answerCallback` + `editMessage` + `buildResolvedText` helpers, `recordApproval` repository call
- `app/lib/telegramApprovals.js` §`fireTelegramApproval()` — Outbound emitter pattern; the Discord equivalent will post to DM via bot token
- `app/lib/notification-adapters/discord.js` — Existing webhook-out adapter; keep as-is, add interactive bot posting alongside it

### Approval Plumbing
- `app/lib/repositories/actions.repository.js` §`recordApproval` — The write path every approval channel (web, Telegram, Discord) flows through. No direct SQL in routes
- `app/api/approvals/[actionId]/route.js` — Approval API endpoint that web UI and bots both hit
- `app/approve/page.js` — Mobile approval page pattern (vibrate API, realtime hook) — reference for `/my-agent` mobile considerations
- `app/approvals/page.jsx` — Desktop approvals page — reference for pending-actions fetch pattern and `useEffectiveRole` admin gating

### Hook & MCP Surfaces
- `hooks/dashclaw_pretool.py` §`handle_require_approval` and §`handle_block` — The PreToolUse hook that creates pending actions; `wait_for_approval` MCP tool polls the action status
- `mcp-server/lib/tools.js` §`dashclaw_wait_for_approval` — The MCP tool Claude Code uses; polling behavior must honor the ≤10s round-trip budget

### Activity Timeline Surfaces
- `app/activity/page.js` §`GlobalActivityFeed` — Raw event feed to add day-grouping on top of. Pulls from `/api/actions`, `/api/guard`, `/api/activity`. Uses `useAgentFilter`.
- `app/lib/AgentFilterContext.js` — Existing agent filter context; `/my-agent` and day-grouping both must respect it

### Documentation Targets
- `app/guides/claude-code/page.js` — Current guide; rewrite includes Discord setup steps
- `README.md` — Current layout (npx dashclaw-demo top, Works-with list, Deploy button, etc.) — shape for the rewrite
- `CLAUDE.md` §SDK Documentation Checklist — **MANDATORY**: any new API route triggers updates to docs page, sdk/README.md, sdk-python/README.md, sdk-parity.md, api-inventory.md, PROJECT_DETAILS.md. Run `npm run openapi:generate` + `npm run api:inventory:generate` after new routes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`app/api/telegram/webhook/route.js`** — Complete blueprint for `/api/discord/interactions`. Helpers like `secretsMatch`, `buildResolvedText`, `answerCallback`, `editMessage` translate directly to Discord equivalents (Ed25519 `verifyDiscordSignature`, embed construction, `PATCH /webhooks/{app_id}/{token}/messages/@original` to edit).
- **`app/lib/notification-adapters/discord.js`** — The existing one-way webhook adapter stays; Phase 2 adds a *second* Discord surface (interactive bot DM). Keep the webhook adapter for existing signal notification flows, don't conflate.
- **`app/approve/page.js`** — Mobile-first realtime approval pattern (`useRealtime` hook, `safeVibrate`, `useEffectiveRole`) — good reference for `/my-agent` mobile considerations.
- **`app/components/ui/EmptyState.js`** — Standard empty-state component; `/my-agent` install-prompt hero can extend it rather than building from scratch.
- **`app/components/ui/Card.js`, `Badge.js`, `Skeleton.js`** — UI primitives already used on `/activity` and `/approvals`. `/my-agent` reuses them for consistency.
- **`app/hooks/useEffectiveRole.js`** — Admin role gating; `/my-agent` may or may not gate admin-only — planner decides.
- **`app/hooks/useRealtime.js`** — SSE connection for live event updates; `/my-agent` and `/activity` day-grouping both consume this.
- **`app/lib/colors.js` §`getAgentColor`** — Per-agent color assignment; `/my-agent` denials list uses this for agent chips.

### Established Patterns

- **No direct SQL in route files** — Enforced by pre-commit `npm run route-sql:check`. Every new route (including `/api/discord/interactions`) must use `app/lib/repositories/*.repository.js`. Discord route uses `recordApproval` from `actions.repository.js`.
- **Env var naming** — `DISCORD_*` prefix with Telegram-parallel semantics. Kill switch `DASHCLAW_ALERTS_DISCORD=false` matches Telegram's `DASHCLAW_ALERTS_TELEGRAM=false`.
- **Timing-safe secret comparison** — `timingSafeEqual` pattern from `/api/telegram/webhook`. Discord uses Ed25519 signature instead of HMAC secret, but same "401 on signature mismatch" discipline.
- **Background `.catch(() => {})`** — Outbound notification posts don't block the main approval write path. Pattern from `fireTelegramApproval`.
- **`useAgentFilter` respected** — All activity views filter by selected agent; `/my-agent` and `/activity` day-grouping both must honor it.
- **`.impeccable.md` tokens + CSS variables** — No hardcoded hex. Tailwind theme extension + `app/globals.css` tokens only.

### Integration Points

- **`app/api/discord/interactions/route.js`** (NEW) — Receives Discord button interactions. Verifies Ed25519 signature, parses `MESSAGE_COMPONENT` payload, extracts `custom_id` (`ap:act_*` / `dn:act_*`), calls `recordApproval`, patches Discord message via follow-up webhook.
- **`app/lib/discordApprovals.js`** (NEW, parallel to `app/lib/telegramApprovals.js`) — `fireDiscordApproval()` emitter. Hook `dashclaw_pretool.py` → action creation → this emitter → DM posted.
- **`hooks/dashclaw_pretool.py` §`handle_require_approval`** — Already creates pending actions; plug Discord emitter into the same code path as Telegram.
- **`app/my-agent/page.js`** (NEW) — Next.js App Router page, client component for realtime. Pulls from `/api/actions` (recent) and `/api/guard` (recent). No new API routes needed for v1 of the page.
- **`app/activity/page.js`** — Modify existing page to add day-grouping presentational layer. No schema change.
- **`app/guides/claude-code/page.js`** — Existing file; rewrite to include Discord setup section.
- **`README.md`** — Top-of-file restructure. Preserve `public/images/demo-gif2.gif`, Deploy-to-Vercel button, all SDK badges.
- **`docs/homepage-draft-claude-code.md`** (NEW) — Draft copy artifact for Phase 3 handoff.

</code_context>

<specifics>
## Specific Ideas

- **Discord bot DM pattern**: User's phone lights up with a native Discord push notification → taps notification → opens DM → sees embed with 4 fields → taps Approve → DM updates to `APPROVED — 12:47:03` → Claude Code unblocks. Target round-trip ≤10s, target wall-clock for the tap action itself ≤3s.
- **README top copy intent** (approximate, planner refines): *"Govern Claude Code in 5 minutes — install the hook, connect Discord, approve risky tool calls from your phone. Built so your coding agent can never surprise you with a destructive action."* Then 3-step install block, then screencast GIF linking to full video.
- **`/my-agent` hero copy pattern**: *"Today your agent ran `{n}` commands. `{n_approved}` required approval. `{n_denied}` were denied."* — all three numbers inline, denials visually weighted (amber/red token from `.impeccable.md`). Zero states: *"Your agent hasn't run anything yet."*
- **Empty-state CTA**: 3 compact steps (install hook → connect Discord → trigger a command), each with a short sentence and a numbered checkmark that flips on as the user progresses.
- **Discord embed title convention**: `"DashClaw: approval required"` — matches Telegram tone. Keep brand color (Discord embed `color` field → `.impeccable.md` brand orange token → hex conversion at adapter boundary only).

</specifics>

<deferred>
## Deferred Ideas

- **Multi-org Discord mapping** (`discord_approvers` table): Approvers governing multiple orgs. Deferred — Phase 2 is single-org beachhead; revisit when a real user asks.
- **Discord server channel posting** (in addition to DM): Team visibility of governance events. Deferred to Phase 3 or later when team features are scoped.
- **Discord denial-reason modal**: `MODAL_SUBMIT` interaction asking "Why?" on Deny. Nice UX but ~2x code; Claude's discretion whether to include in Phase 2.
- **Slack approval bridge**: PROJECT.md mentions Slack as the next channel after Discord. Deferred — explicitly Phase 2+ work.
- **Email/SMS approval fallback**: If Discord is down. Deferred.
- **Mac/Linux walkthrough recordings**: Single-platform Windows/WSL is the Phase 2 measurable. Mac/Linux proofs are v2-milestone nice-to-have.
- **`/my-agent` timeline slider** (hours ↔ days ↔ weeks): Rejected in favor of simple Today/Week toggle. Re-surfaces if users complain the toggle is too coarse.
- **Demo-mode preview on `/my-agent`**: Fake data with "this is what it'll look like" banner. Rejected — violates "evidence over decoration" from `.impeccable.md` and confuses first-time users.
- **UI setup flow at `/setup/integrations/discord`**: Paste-token wizard. Deferred — Phase 2 is ENV-only mirroring Telegram.

### Surfaced during 2026-04-22 diagnosis session

- **[todo-001] Hook warns at startup if BASE_URL points to demo-mode instance** (`.planning/todos/pending/todo-001-hook-warns-on-demo-mode.md`). A stale `DASHCLAW_BASE_URL=http://localhost:3000` silently redirected real Claude Code traffic to a demo Docker container; block came back with `"Demo Production Guard"` which looked like a real policy. 30 min lost. Fix: `/api/health` check at hook start, stderr warning if `mode: demo`. Candidate for inclusion in Plan 02-02's hook touches.
- **[todo-002] Rename hardcoded "Demo Production Guard" to signal sandbox origin** (`.planning/todos/pending/todo-002-demo-guard-policy-name-clarity.md`). `demoMiddleware.js:624` catch-all block uses a policy name indistinguishable from real policies. Low-severity clarity fix.
- **[todo-003] Hook fails open on guard unavailable — same bug class as BUG-02** (`.planning/todos/pending/todo-003-guard-unavailable-fail-open.md`). **HIGH severity.** `dashclaw_pretool.py:557-560` silently exits 0 with no audit when `/api/guard` is unreachable, violating "always prove what it did." Candidate for REQUIREMENTS.md as BUG-04; may block Phase 2 launch same way BUG-02 did.

</deferred>

---

*Phase: 02-claude-code-beachhead*
*Context gathered: 2026-04-22*
