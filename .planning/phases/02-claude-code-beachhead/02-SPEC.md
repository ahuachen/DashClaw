# Phase 2: Claude Code Beachhead — Specification

**Created:** 2026-04-22
**Ambiguity score:** 0.165 (gate: ≤ 0.20)
**Requirements:** 5 locked

## Goal

A developer on Wes's Windows/WSL machine can go from "I just heard about DashClaw" to an approved Claude Code tool call in Discord in ≤5 minutes, with the event visible on `/activity` (day-grouped) and narrativized on `/my-agent`, documented end-to-end on dashclaw.io + the README + a ≤3-minute screencast.

## Background

Plan 02-01 shipped 2026-04-21 and is the foundation:
- `claude-code-starter` policy pack registered in PACK_PREVIEWS
- `hooks/dashclaw_pretool.py` PreToolUse hook (BUG-02 fixed — blocks now audit)
- MCP `dashclaw_wait_for_approval` tool
- `/guides/claude-code` page (initial version)

**Telegram** approval parity is fully built and is the direct blueprint for Discord:
- `/api/telegram/webhook` — stateless handler, timing-safe secret, inline-keyboard `ap:`/`dn:` callbacks, in-place message edit on resolve
- `/approve` mobile page (vibrate API + realtime)
- `/api/approvals/[actionId]` write path

**Discord** today is notification-only — `app/lib/notification-adapters/discord.js` posts embeds via `DISCORD_WEBHOOK_URL`. No bot app, no `/api/discord/interactions` route, no approve/deny round-trip.

**`/activity`** exists as a raw event feed (GlobalActivityFeed) merging `/api/actions`, `/api/guard`, `/api/activity`. No day-grouping, no narrative summary. No `/my-agent` page.

**Docs**: `/guides/claude-code/page.js` is a single guide; no README rewrite, no screencast, no homepage draft for the Claude Code framing.

## Requirements

1. **CCI-01 — 5-minute install-to-first-approval**: A fresh Windows/WSL install produces a visible approval event within 5 minutes, demonstrated by a recorded walkthrough.
   - Current: Pieces exist (hook, policy pack, MCP tool, Telegram approval). No end-to-end timed, recorded path on Windows/WSL. No Discord delivery yet (blocks CCI-03 dependency).
   - Target: `git clone` → `npm install` → configure `.claude/settings.json` PreToolUse hook → connect Discord → trigger a blocked command → see Discord buttons → approve from phone → Claude Code proceeds → event renders on `/activity` and `/my-agent`. Total wall-clock ≤5 minutes on Wes's Windows/WSL environment.
   - Acceptance: Screen-recorded walkthrough on a clean Claude Code workspace, timer visible. Recording stored at `.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4` (or equivalent artifact path), ≤5:00 duration from `git clone` to Discord approval confirmation.

2. **CCI-02 — Default coding-agent policy pack** *(shipped in 02-01)*: `claude-code-starter` pack enforces the silent-allow / always-block / require-approval semantics for coding agents.
   - Current: Pack shipped 2026-04-21 with 9/9 tests passing, registered in PACK_PREVIEWS, idempotent seed script, converter mapping `policy_type` → `applies_to` format.
   - Target: No regression. Pack continues to silently allow git commits/reads/test runs, always block destructive (`rm -rf`, mass delete, force-push to main), require approval for ambiguous (network calls, package installs, edits outside project).
   - Acceptance: `__tests__/unit/claude-code-starter-pack.test.js` passes. Full `npm test` suite (1648+ tests) passes with no regressions attributable to 02-02 or 02-03 plan work.

3. **CCI-03 — Discord approval in <10s from phone, no browser**: A registered Discord bot receives approval-required actions as embed messages with Approve/Deny buttons; tapping either button resolves the action server-side and edits the message in place.
   - Current: Discord adapter is webhook-out only. No bot registration, no `/api/discord/interactions` route, no interaction handler.
   - Target: Discord bot app registered. New `/api/discord/interactions` route verifies Ed25519 signatures (Discord standard), parses `MESSAGE_COMPONENT` interactions with `custom_id` of form `ap:act_...` / `dn:act_...`, calls the same `recordApproval` repository path the Telegram webhook uses, edits the original message via follow-up webhook. When Claude Code's `dashclaw_wait_for_approval` poll sees the new status, it returns. Phone-to-resolution round-trip median ≤10s under normal conditions.
   - Acceptance:
     - `/api/discord/interactions` returns 401 on missing/invalid signature (test).
     - A mocked `MESSAGE_COMPONENT` interaction with valid signature and `custom_id: "ap:act_test_xxx"` causes `action_records.status` to transition to `approved` (integration test).
     - The `dashclaw_wait_for_approval` MCP tool resolves within 2s of the status change (integration test).
     - End-to-end: button tap on Wes's phone → action status resolved in DB in ≤10s (manual verification, logged in walkthrough).

4. **CCI-04 — Human-readable agent activity**: Two surfaces — day-grouped summary on `/activity` AND dedicated `/my-agent` narrative page.
   - Current: `/activity` renders a raw chronological event list with no grouping. No `/my-agent` page.
   - Target:
     - `/activity`: events grouped by day, each day showing a one-line English summary header (e.g. "Wed Apr 22 — 12 approvals, 3 denials, 47 silent allows, 0 errors"). Events remain individually inspectable beneath.
     - `/my-agent`: new page with today/this-week toggle; top section is a narrative summary ("Your agent ran 47 commands today, 3 required approval, 0 were denied"); denials pinned; commands-run list with agent-colored chips; hero empty state for no activity. Uses existing `useRealtime` hook.
   - Acceptance:
     - `/activity` day-group headers render correctly for empty days (0/0/0) and populated days. Snapshot test on grouping logic.
     - `/my-agent` renders for 0-event, 1-event, and 50+-event user states. E2E test covers at least the today view.
     - Both pages respect the existing `useAgentFilter` context.

5. **CCI-05 — First-class documentation (deep-dive only; homepage is Phase 3 polish)**: Guides page rewritten around Claude Code, README section rewritten as Getting Started lead, ≤3-minute screencast, draft homepage section (NOT the final hero rewrite).
   - Current: `/guides/claude-code/page.js` exists. README has a generic DashClaw intro, not a Claude Code–first Getting Started. No screencast. No homepage draft for the Claude Code frame.
   - Target:
     - `/guides/claude-code/page.js` rewritten: install steps reflect shipped integration, include Discord approval path, link to the screencast.
     - README.md: top section becomes "Govern Claude Code in 5 minutes" leading the Getting Started flow; existing general content stays below.
     - Screencast ≤3 minutes published (YouTube/Loom), link embedded in guides page and README.
     - `docs/homepage-draft-claude-code.md`: draft copy + section structure for the Phase 3 homepage rewrite. Not published to `app/page.js` in Phase 2.
   - Acceptance:
     - All code snippets on `/guides/claude-code` run without modification on a fresh Windows/WSL clone (manually verified in CCI-01 walkthrough).
     - README's first 50 lines mention Claude Code and link to the guides page.
     - Screencast URL resolves to a public video ≤3 minutes.
     - `docs/homepage-draft-claude-code.md` exists and is at least ≥200 words, structurally reviewable.

## Boundaries

**In scope:**
- Discord bot app registration + `/api/discord/interactions` route + signature verification + button interaction handling
- `/activity` day-grouping presentational layer (no schema change)
- `/my-agent` new page with today/week toggle, narrative summary, denials pinned
- `/guides/claude-code` rewrite to reflect shipped integration + Discord path
- README Getting Started rewrite (Claude Code first)
- ≤3-minute screencast of the end-to-end install and first approval
- Draft copy for Phase 3's homepage rewrite (saved as `docs/homepage-draft-claude-code.md`)
- Recorded CCI-01 walkthrough on Windows/WSL as evidence

**Out of scope:**
- Flagship demo video (DOG-02) — Phase 3. The CCI-01 walkthrough is evidence, not a polished public demo.
- Homepage hero rewrite (DOG-03) — Phase 3. Phase 2 produces a draft only.
- Launch content: Show HN, tweet thread, public blog post (DOG-04) — Phase 3.
- Mac and Linux walkthroughs — deferred. Single-platform measurement on Windows/WSL is the phase target. If the integration works for Wes, later phases can broaden.
- Cursor / Aider / Cody integrations (EXP-01/02/03) — v2 milestone.
- Monetization trigger wiring (MON-01/02) — Phase 3.
- Native Discord gateway client (websocket) — rejected in Round 1 for Vercel-free-tier incompatibility.
- Deep-link web approval from Discord — rejected in Round 1 for violating CCI-03's "no browser required" constraint.
- Discord DM-only flow without server support — neither in nor out; bot must support both DM and server channels; the mechanism is the same.

## Constraints

- **Platform target**: Windows 11 + WSL2 (Wes's actual dogfood environment). Mac/Linux support is nice-to-have but not a success criterion.
- **Deployment**: Must remain on Vercel free tier. No long-running processes. Discord integration uses webhook interactions (stateless), not the gateway websocket.
- **Discord delivery pattern**: Bot app + `/api/discord/interactions` endpoint with Ed25519 signature verification. Mirrors the existing `/api/telegram/webhook` pattern (timing-safe secret, inline callbacks, in-place message edit).
- **Latency budget**: Discord button-to-DB-resolution ≤10s under normal network conditions. The `dashclaw_wait_for_approval` poll interval must be tight enough to honor this (current implementation poll ≤5s).
- **Route discipline**: No direct SQL in new route files. Use `app/lib/repositories/actions.repository.js` — follows project's route SQL guardrail.
- **SDK documentation checklist**: Any new public API route added by this phase triggers the 6-file SDK documentation update (memory: docs page, sdk/README.md, sdk-python/README.md, sdk-parity.md, api-inventory.md, PROJECT_DETAILS.md) and `npm run openapi:generate` + `npm run api:inventory:generate`.
- **Design**: `.impeccable.md` rules apply to `/my-agent`, `/activity` grouping, guides page, README, and homepage draft. No hardcoded hex; use CSS tokens.

## Acceptance Criteria

- [ ] CCI-01 walkthrough recording exists, is ≤5:00 wall-clock on Windows/WSL, and shows every step from `git clone` to "Claude Code proceeds after Discord approval"
- [ ] `__tests__/unit/claude-code-starter-pack.test.js` still passes (CCI-02 no regression)
- [ ] Full `npm test` suite passes with no 02-02 or 02-03 regressions
- [ ] `/api/discord/interactions` returns 401 on invalid Ed25519 signature
- [ ] Mocked valid Discord button interaction transitions `action_records.status` to `approved` or `denied` correctly
- [ ] `dashclaw_wait_for_approval` resolves within 2s of the status change
- [ ] Manual Discord phone-tap → DB-resolution round-trip is ≤10s (logged in walkthrough)
- [ ] `/activity` day-grouping renders correctly for 0/0/0 days and populated days
- [ ] `/my-agent` renders at 0-event, 1-event, and 50+-event states
- [ ] `/guides/claude-code` code snippets run as-is on Wes's fresh Windows/WSL (verified in CCI-01 walkthrough)
- [ ] README first 50 lines mention Claude Code and link to the guides page
- [ ] Screencast URL resolves, is publicly accessible, and is ≤3:00
- [ ] `docs/homepage-draft-claude-code.md` exists and is ≥200 words
- [ ] `npm run openapi:check` passes after new Discord route is added
- [ ] `npm run api:inventory:check` passes

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                      |
|--------------------|-------|------|--------|--------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Windows/WSL target, 5-min measurable       |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Phase 2/3 docs split explicit              |
| Constraint Clarity | 0.75  | 0.65 | ✓      | Vercel free tier + bot-webhook locked      |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 15 pass/fail criteria                      |
| **Ambiguity**      | 0.165 | ≤0.20| ✓      | Gate passed after 2 rounds                 |

## Interview Log

| Round | Perspective  | Question summary                          | Decision locked                                                    |
|-------|--------------|-------------------------------------------|--------------------------------------------------------------------|
| 1     | Researcher   | Discord delivery mechanism?               | Bot + webhook (Telegram parity) — Claude picked as optimal; other options disqualified (CCI-03 "no browser" rules out deep-link; Vercel free tier rules out gateway websocket) |
| 1     | Researcher   | Which "fresh machine" for CCI-01?         | Wes's Windows/WSL — aligns with Phase 2 dogfood decision           |
| 2     | Simplifier   | Minimum viable CCI-04 timeline?           | Both — day-group `/activity` AND new `/my-agent` narrative page    |
| 2     | Simplifier   | Phase 2/Phase 3 docs boundary?            | Phase 2 = guides + README + screencast + homepage draft; Phase 3 = polish + launch content + hero publish |

---

*Phase: 02-claude-code-beachhead*
*Spec created: 2026-04-22*
*Next step: /gsd-discuss-phase 2 — implementation decisions (Discord bot app setup, signature verification lib choice, `/my-agent` layout, screencast hosting, README rewrite structure)*
