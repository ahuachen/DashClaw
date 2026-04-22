# Phase 2: Claude Code Beachhead — Research

**Researched:** 2026-04-22
**Domain:** Discord bot webhook-interactions, Next.js App Router page patterns, narrative activity UI, docs bundle authoring
**Confidence:** HIGH — the Telegram parity blueprint is direct, Discord signature verification is fully documented, all UI primitives already exist in the codebase. Only the screencast hosting choice and Windows/WSL walkthrough timing remain MEDIUM confidence until recorded.

## Summary

Phase 2 has one net-new primitive (Discord bot interactions endpoint) and two presentational UI surfaces (`/activity` day-grouping, new `/my-agent` page) built on existing hooks, repositories, and UI kit. The spec + context locked 90% of decisions already — this research catalogs the exact code landing points, the Ed25519 verification recipe from Discord's own docs, the Telegram→Discord port map at file:line granularity, and the landmines (livingcode regen, route-sql guard, CSP `connect-src`, DOMPurify override, Windows line endings) that will bite the planner if not surfaced.

**Primary recommendation:**
- Use **Node's native `crypto.verify('ed25519', …)`** (Node ≥20 has it, Node 22 is in use) instead of pulling in `tweetnacl`. Node's ed25519 support is stable, removes a dependency, and reads cleaner. Fallback to `tweetnacl` ^1.0.3 (175KB, Discord's canonical example) if the planner finds an edge case.
- Treat `app/api/telegram/webhook/route.js` as a 1:1 structural blueprint — copy the exact response discipline (ack first, edit later; always 200 on the response so Discord doesn't retry; chat_id from env not body; timing-safe compare).
- Skip the `MODAL_SUBMIT` denial-reason modal for Phase 2 — CONTEXT marks it as Claude's discretion, SPEC has no requirement for it, and it doubles the interaction state machine.
- For the screencast: **Loom**. Faster publish, no SEO tradeoff vs. YouTube at this audience size (CCI-05 just requires "publicly accessible ≤3:00"), and no upload/processing latency to block the CCI-01 walkthrough.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Discord Integration Shape:**
- **D-01 — Bot + webhook interactions (Telegram parity)**: Register a Discord bot app, receive button interactions at new `POST /api/discord/interactions`, approve/deny via embed buttons, edit message in place. Gateway websocket and deep-link alternatives are rejected.
- **D-02 — ENV-only setup, mirror Telegram**: No UI setup flow in Phase 2. Env vars:
  - `DISCORD_BOT_TOKEN` — bot API token from Discord Developer Portal
  - `DISCORD_PUBLIC_KEY` — Ed25519 public key for interaction signature verification (distinct from bot token)
  - `DISCORD_APPROVER_USER_ID` — numeric Discord user ID allowed to approve
  - `DISCORD_APPROVER_ORG_ID` — org whose actions this Discord identity can resolve
  - `DASHCLAW_ALERTS_DISCORD` — kill switch (`false` disables outbound even when token is set)
- **D-03 — Single-org**: One bot = one org. Multi-org mapping deferred.
- **D-04 — DM the admin user**: Bot DMs `DISCORD_APPROVER_USER_ID` directly. No server channel posting in Phase 2.
- **D-05 — Approval embed fields (4 standard)**: `Agent`, `action_type`, `Goal` (truncated at 200 chars), `Risk score`.
- **D-06 — Resolve by editing message in place**: On approve/deny, edit the original DM to show `APPROVED — HH:MM:SS` or `DENIED — HH:MM:SS`, remove buttons.
- **D-07 — Callback data encoding**: `ap:act_...` / `dn:act_...` in Discord button `custom_id`. Same 57-char action ID limit as Telegram.

**`/my-agent` Page:**
- **D-08 — Narrative hero + chronological activity list**: Top is a single-sentence English summary in large type. Below is the event list.
- **D-09 — Default Today, toggle to This week**.
- **D-10 — Empty state = install-prompt hero**: 3-step setup reminder linking to `/guides/claude-code`.
- **D-11 — Denials pinned at top with reason**: Denied actions appear first regardless of timestamp.
- **D-12 — Realtime via existing `useRealtime` hook**.

**`/activity` Day Grouping:**
- **D-13 — Presentational layer only, no schema change**: Client-side grouping. Header format: `"Wed Apr 22 — 12 approvals, 3 denials, 47 silent allows, 0 errors"`.
- **D-14 — Respect `useAgentFilter`**: Day counts reflect the active agent filter.

**README Rewrite:**
- **D-15 — Claude Code lead, existing content below**.
- **D-16 — `npx dashclaw-demo` stays as secondary hook**.
- **D-17 — Embedded GIF preview + link to full video**.

**Documentation Surfaces (CCI-05):**
- **D-18 — All Discord setup steps live in `/guides/claude-code`**.
- **D-19 — Homepage draft = copy + section outline** (`docs/homepage-draft-claude-code.md`, 300-500 words).
- **D-20 — Screencast hosting: Claude's discretion**.

### Claude's Discretion

- Ed25519 verification library (tweetnacl vs @noble/ed25519 vs native crypto)
- `dashclaw_wait_for_approval` polling interval tightening (currently 3s default, 5s max implied)
- Screencast hosting platform
- Discord denial-reason modal (MODAL_SUBMIT) — optional nicety
- `/my-agent` copy voice specifics

### Deferred Ideas (OUT OF SCOPE)

- Multi-org Discord mapping (`discord_approvers` table)
- Discord server channel posting alongside DM
- Discord denial-reason modal
- Slack approval bridge
- Email/SMS approval fallback
- Mac/Linux walkthrough recordings
- `/my-agent` timeline slider
- `/my-agent` demo-mode preview (rejected — violates `.impeccable.md`)
- Discord UI setup flow at `/setup/integrations/discord`

**Surfaced during 2026-04-22 diagnosis session (Claude's discretion whether to roll into Phase 2):**
- todo-001 Hook warns at startup if `DASHCLAW_BASE_URL` points to demo-mode instance
- todo-002 Rename hardcoded "Demo Production Guard" to signal sandbox origin

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CCI-01 | Fresh Windows/WSL install to first Discord approval in ≤5:00, recorded walkthrough at `.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4` | Existing `npm run hooks:install` + `app/guides/claude-code/page.js` steps + new Discord setup section + screencast hosting decision (Loom recommended). See "5-Minute Walkthrough Mechanics" section below. |
| CCI-02 | `claude-code-starter` pack no regression — shipped 02-01 | Verified: `app/lib/guardrails/packs/claude-code-starter/policies.yml`, `__tests__/unit/claude-code-starter-pack.test.js` (9/9 passing per SPEC). Scope for Phase 2: run `npm test` gate, no new pack work. |
| CCI-03 | Discord approval in <10s from phone, no browser | Direct Telegram parity. New `app/api/discord/interactions/route.js` + new `app/lib/discordApprovals.js`. MCP `dashclaw_wait_for_approval` already polls every 3s (verified in `mcp-server/lib/tools.js:232-269`) — no tightening needed; 10s budget has >3s headroom. |
| CCI-04 | `/activity` day-grouping + new `/my-agent` narrative page | Existing `app/activity/page.js` (the whole file IS `GlobalActivityFeed`) is client-side and pulls from `/api/actions`, `/api/guard`, `/api/activity`. Add `useMemo` day-grouping layer. New `app/my-agent/page.js` uses identical data sources + `EmptyState` primitive + `useRealtime` + `useAgentFilter`. Zero schema change. |
| CCI-05 | First-class docs — guides rewrite, README lead, ≤3:00 screencast, homepage draft | All targets identified: `app/guides/claude-code/page.js` (existing, add Discord section), `README.md` (top-of-file restructure preserving `demo-gif2.gif` and all badges), `docs/homepage-draft-claude-code.md` (NEW), screencast link. CLAUDE.md's 6-file SDK docs checklist triggers when `/api/discord/interactions` ships. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Discord button interaction receipt (Ed25519 signature verify, parse MESSAGE_COMPONENT, call repository) | API / Backend (`app/api/discord/interactions/route.js`) | — | Stateless webhook handler. No browser, no SSR — this is Discord → server only. |
| Outbound Discord DM with approval embed + buttons | API / Backend lib (`app/lib/discordApprovals.js`) | — | Server-side emitter, mirrors `app/lib/telegramApprovals.js`. Called from `/api/actions` via `after()`. |
| `/my-agent` narrative page render | Frontend (client component, SSE via `useRealtime`) | API / Backend (existing `/api/actions`, `/api/guard`) | Matches `/activity` pattern exactly. No new backend routes per CONTEXT §code_context — "No new API routes needed for v1 of the page." |
| `/activity` day-grouping layer | Frontend (client-side `useMemo` on existing events array) | — | Presentational-only per D-13. Zero backend work. |
| `/guides/claude-code` Discord setup section | Frontend (server component renders, client `GuideClient` for copy-code) | — | Static content. Already uses `getGuideBaseUrl()` helper. |
| README rewrite | Repo root (markdown) | — | No runtime concern. |
| Screencast hosting | External CDN (Loom or YouTube) | Repo (linked from README + guide) | Hosting is out-of-repo; only the link lives in code. |
| CCI-01 walkthrough recording | Operator local machine (Windows/WSL) | Repo artifact (`.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4`) | Evidence artifact, not a product surface. |

## Standard Stack

### Core (already in DashClaw, reuse)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 (App Router) | Route + render runtime | [VERIFIED: package.json `"version": "2.13.3"`, CLAUDE.md declares Next 16]. `app/api/<route>/route.js` is the idiomatic route shape — Telegram webhook uses it, Discord will too. |
| Node.js crypto (built-in) | ≥20 (engines declares `>=20.0.0`) | Ed25519 signature verification | [VERIFIED: `node -e` in this session, Node 22.18.0 on dev machine returns ed25519 keypair support]. Zero dependencies. Same `timingSafeEqual` already imported in `app/api/telegram/webhook/route.js:4`. |
| `lucide-react` | 0.x | Icons | [VERIFIED: .impeccable.md §Aesthetic Direction line 38 — "Iconography: `lucide-react` only. Never mix icon libraries."] Used throughout `/activity`, `/approve`, `/approvals`. |
| `tailwindcss` | 3.x | Styling | [VERIFIED: `tailwind.config.js` + `app/globals.css`]. Design tokens live in CSS custom properties — never hardcode hex. |
| `vitest` | 1.x+ | Test runner | [VERIFIED: `vitest.config.mjs` exists, `package.json` declares `"test": "vitest"`]. Unit tests co-live in `__tests__/unit/`. Full suite is ~1648 tests (SPEC §CCI-02). |
| `next/server` `after()` | 16.x | Background work after response (Vercel free tier) | [VERIFIED: `app/api/actions/route.js:4` imports `after`, lines 321-332 use it for fire-and-forget Telegram/webhook emit]. Discord emit must use the same pattern — Vercel freezes the lambda otherwise. |
| `postgres` / Neon | via `@neondatabase/serverless` 1.1.0 | DB driver | [VERIFIED: package.json]. Repository pattern: `app/lib/repositories/*.repository.js`. No direct SQL in route files. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **Node native `crypto.verify('ed25519', ...)`** | Node ≥20 built-in | Discord signature verification | **RECOMMENDED.** [VERIFIED: native ed25519 keygen + verify functional on Node 22.18.0 this session]. No dependency. Ed25519 support via `crypto.createPublicKey({ key, format: 'raw' })` is supported in Node 20+. |
| `tweetnacl` | 1.0.3 ([VERIFIED: `npm view tweetnacl version` = 1.0.3, 174KB unpacked]) | Alternative Ed25519 verify | **FALLBACK.** Discord's official docs use it ([CITED: github.com/discord/discord-api-docs — Validate Discord Security Request Headers]). Choose this if native crypto's raw-key import proves fragile — it's the reference implementation. |
| `discord-interactions` | 4.4.0 ([VERIFIED: `npm view` 2026-04-22]) | Discord's own helper (`verifyKey`, `InteractionType` enum) | **NOT RECOMMENDED.** 56KB, wraps tweetnacl, adds constants. The constants are trivially inlined (`PING=1, APPLICATION_COMMAND=2, MESSAGE_COMPONENT=3, MODAL_SUBMIT=5` and response types `PONG=1, CHANNEL_MESSAGE_WITH_SOURCE=4, DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE=5, DEFERRED_UPDATE_MESSAGE=6, UPDATE_MESSAGE=7`). Avoid adding a dep for 4 integers. |
| `@noble/ed25519` | 3.1.0 ([VERIFIED: `npm view` 2026-04-22]) | Alternative Ed25519 library | **NOT NEEDED.** Pure JS, audited, but with native crypto available it's redundant. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.verify('ed25519', ...)` native | `tweetnacl` | +175KB dep; matches Discord's own example verbatim. Pick this if native key-import has a gotcha on Vercel Node 20 runtime. |
| `discord-interactions` package | Inline constants + native verify | Dep adds 56KB for ~8 integer constants. Inline saves a dep-audit hit. |
| DM-via-open-DM-channel-then-message | `POST /channels/{channel_id}/messages` after `POST /users/@me/channels` | Required two-step for DM bots: resolve DM channel id once, cache it. [CITED: `/discord/discord-api-docs` — `POST /users/@me/channels` returns a channel object with `id`]. See "Discord Interaction Plumbing" section for full flow. |

**Installation:**
```bash
# Zero deps if using native crypto path (RECOMMENDED)
# Otherwise:
npm install tweetnacl
```

**Version verification:** All versions above were verified 2026-04-22 via `npm view`. Node native ed25519 was verified by instantiating `crypto.generateKeyPairSync('ed25519')` on the dev machine. The recommended path adds **zero** new dependencies.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CCI-03 Discord Approval Flow              │
└─────────────────────────────────────────────────────────────────────┘

 Claude Code tool call
        │
        ▼
 hooks/dashclaw_pretool.py  ──POST──▶  /api/guard  ──▶  matched policy = require_approval
        │                                                     │
        │                                                     ▼
        │                                              /api/actions (creates action_records row
        │                                              with status='pending_approval')
        │                                                     │
        │                                              after(() => { ... })  ← Vercel background
        │                                                     ├─ fireTelegramApproval(...)
        │                                                     └─ fireDiscordApproval(...)  ◀── NEW
        │                                                                 │
        │                                                                 ▼
        │                                               POST /users/@me/channels
        │                                               → channel_id (cached per DISCORD_APPROVER_USER_ID)
        │                                                                 │
        │                                                                 ▼
        │                                               POST /channels/{channel_id}/messages
        │                                               { embeds: [{ title,fields[4],color }],
        │                                                 components: [{ type:1, components:[
        │                                                    {type:2, style:3, custom_id:"ap:act_...", label:"Approve"},
        │                                                    {type:2, style:4, custom_id:"dn:act_...", label:"Deny"}
        │                                                 ]}] }
        │                                                                 │
        │                                                                 ▼
        │                                                           Operator's phone (Discord push)
        │
        │                                       Operator taps Approve/Deny
        │                                                 │
        │                                                 ▼
        │                      Discord POST /api/discord/interactions  ◀── NEW ROUTE
        │                      Headers: X-Signature-Ed25519, X-Signature-Timestamp
        │                      Body: { type:3 (MESSAGE_COMPONENT),
        │                              data:{ custom_id:"ap:act_..."},
        │                              member.user.id or user.id,
        │                              token, id, application_id, message }
        │                                   │
        │                                   │  ①  verify Ed25519 (reject 401 if invalid)
        │                                   │  ②  check user.id === DISCORD_APPROVER_USER_ID (401 if not)
        │                                   │  ③  regex custom_id → (verb, action_id)
        │                                   │  ④  RESPOND IMMEDIATELY: { type: 6 (DEFERRED_UPDATE_MESSAGE) }
        │                                   │      (inside 3-second window)
        │                                   │  ⑤  getActionSummary(orgId, actionId)
        │                                   │  ⑥  recordApproval(orgId, actionId, {decision:'allow'|'deny', ...})
        │                                   │  ⑦  PATCH /webhooks/{app_id}/{interaction.token}/messages/@original
        │                                   │      { content: "APPROVED — HH:MM:SS\n...", components: [] }
        │                                   │
        │                                   ▼
        │                         action_records.status flips to 'running' (approve) or 'failed' (deny)
        │                                   │
        │                                   ▼
        │                         SSE event broadcast by existing publishOrgEvent
        │                                   │
        ▼                                   │
 mcp-server dashclaw_wait_for_approval      │
 polls /api/actions/{id} every 3s           │
 (mcp-server/lib/tools.js:232-269)          │
                                            │
 ◀──────────────── on status !== 'pending_approval' ────────────────────┘
 returns { approved: true|false, denied, action, waited_seconds }
        │
        ▼
 Claude Code proceeds (or errors out on deny)


┌─────────────────────────────────────────────────────────────────────┐
│                    CCI-04 /activity + /my-agent                     │
└─────────────────────────────────────────────────────────────────────┘

 SSE /api/stream (existing)
        │
        ▼ (shared EventSource via app/hooks/useRealtime.js — singleton)
        │
        ├─▶ /activity (modified)
        │   fetches /api/actions, /api/guard, /api/activity
        │   client-side useMemo → groupByDay(events)
        │   renders: [day-header | events for day] × N
        │
        └─▶ /my-agent (NEW)
            fetches /api/actions?limit=50, /api/guard?limit=50
            client-side derivations:
              - counts (approved, denied, allowed, errored)
              - narrative sentence template
              - denied-first sort (denials pinned)
            renders: [narrative hero] [Today|Week toggle] [denials] [chronological list]
            empty state = 3-step install-prompt hero linking to /guides/claude-code
```

### Recommended Project Structure

All paths are NEW files except where marked MODIFY.

```
app/
├── api/
│   ├── discord/
│   │   └── interactions/
│   │       └── route.js               # NEW — POST handler, Ed25519 verify, MESSAGE_COMPONENT → recordApproval
│   └── telegram/webhook/route.js      # REFERENCE — do not modify; this is the blueprint
├── lib/
│   ├── discordApprovals.js            # NEW — fireDiscordApproval() emitter; mirrors telegramApprovals.js
│   └── telegramApprovals.js           # REFERENCE — do not modify
├── activity/
│   └── page.js                        # MODIFY — wrap existing events in day-grouping useMemo
├── my-agent/
│   └── page.js                        # NEW — narrative + today/week toggle + install-prompt empty state
└── guides/claude-code/
    └── page.js                        # MODIFY — add Discord Developer Portal walkthrough section

hooks/
└── dashclaw_pretool.py                # REFERENCE — already plugs into create_action flow

__tests__/unit/
├── discord-interactions-route.test.js # NEW — mirrors telegram-webhook-route.test.js
├── discord-approvals.test.js          # NEW — mirrors telegram-approvals.test.js
├── my-agent-page.test.jsx             # NEW — snapshot tests for 0/1/50-event states
└── activity-day-grouping.test.js      # NEW — pure grouping logic snapshot tests

scripts/
├── discord-register-bot.mjs           # NEW — auto-register bot interaction endpoint URL (optional, Claude's discretion)
└── discord-verify-loop.mjs            # NEW — synthetic pending_approval → approve-from-phone → round-trip time

docs/
├── homepage-draft-claude-code.md      # NEW — 300-500 words, Phase 3 handoff artifact
└── ...                                 # (existing docs untouched)

.planning/phases/02-claude-code-beachhead/
└── cci-01-walkthrough.mp4             # NEW artifact — recorded evidence, Windows/WSL, ≤5:00

README.md                              # MODIFY — top-of-file rewrite, keep demo-gif2.gif + badges
.env.example                           # MODIFY — add DISCORD_* block mirroring TELEGRAM_* (lines 155-160)
```

### Pattern 1: Stateless Discord Interactions Endpoint (Ed25519 verify, ack-first)

**What:** Discord POSTs to `/api/discord/interactions` with an Ed25519 signature. You must verify against the raw body bytes, respond within 3 seconds, and edit the message via follow-up webhook after.

**When to use:** This is the ONLY pattern for Discord button interactions on Vercel free tier (no websocket gateway = no bot connection). Structural parity with `app/api/telegram/webhook/route.js`.

**Example (native crypto path, recommended):**

```javascript
// Source: [CITED: github.com/discord/discord-api-docs — Validate Discord Security Request Headers]
// Adapted for Node native crypto instead of tweetnacl.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse, after } from 'next/server';
import { createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { getSql } from '../../../lib/db.js';
import {
  getActionSummary,
  recordApproval,
} from '../../../lib/repositories/actions.repository.js';

const DISCORD_API = 'https://discord.com/api/v10';
const CALLBACK_DATA_RE = /^(ap|dn):(act_[a-z0-9_-]{1,57})$/;
const FETCH_TIMEOUT_MS = 1500;

// Interaction types
const PING = 1;
const MESSAGE_COMPONENT = 3;
// Callback types
const PONG = 1;
const DEFERRED_UPDATE_MESSAGE = 6; // ack without visible loading state

function verifyDiscordSignature(rawBody, signatureHex, timestampStr, publicKeyHex) {
  if (!signatureHex || !timestampStr || !publicKeyHex) return false;
  try {
    // Ed25519 raw (32-byte) public key → KeyObject
    const keyObj = createPublicKey({
      key: Buffer.from(publicKeyHex, 'hex'),
      format: 'der',        // TODO: verify exact format — may need raw SPKI wrapping;
                            // fall back to tweetnacl.sign.detached.verify if fragile.
      type: 'spki',
    });
    return cryptoVerify(
      null, // algorithm implied by key type (ed25519)
      Buffer.concat([Buffer.from(timestampStr, 'utf8'), Buffer.from(rawBody)]),
      keyObj,
      Buffer.from(signatureHex, 'hex')
    );
  } catch {
    return false;
  }
}

// NOTE: If native SPKI import proves fragile on Node 20 runtime, use this fallback:
//
//   import nacl from 'tweetnacl';
//   function verifyDiscordSignature(rawBody, signatureHex, timestampStr, publicKeyHex) {
//     try {
//       return nacl.sign.detached.verify(
//         Buffer.from(timestampStr + rawBody),
//         Buffer.from(signatureHex, 'hex'),
//         Buffer.from(publicKeyHex, 'hex')
//       );
//     } catch { return false; }
//   }

export async function POST(request) {
  // CRITICAL: verify against raw bytes BEFORE JSON.parse. Parsing and re-stringifying
  // will change whitespace and break the signature — always use request.text() first.
  const rawBody = await request.text();
  const sig = request.headers.get('x-signature-ed25519');
  const ts = request.headers.get('x-signature-timestamp');

  if (!verifyDiscordSignature(rawBody, sig, ts, process.env.DISCORD_PUBLIC_KEY)) {
    return NextResponse.json({ error: 'invalid request signature' }, { status: 401 });
  }

  let body;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // PING (URL verification handshake) — MUST respond { type: 1 }
  if (body.type === PING) return NextResponse.json({ type: PONG });

  // Only handle MESSAGE_COMPONENT (button clicks). Ignore everything else.
  if (body.type !== MESSAGE_COMPONENT) return NextResponse.json({ type: PONG });

  // User identity lives in body.member.user.id (guild) or body.user.id (DM).
  // For Phase 2 we DM only — body.user.id is the source of truth.
  const userId = String(body.user?.id ?? body.member?.user?.id ?? '');
  if (userId !== process.env.DISCORD_APPROVER_USER_ID) {
    // 401 (not 403) to avoid leaking "signature valid but sender wrong"
    return NextResponse.json({ error: 'invalid request signature' }, { status: 401 });
  }

  const customId = body.data?.custom_id ?? '';
  const match = customId.match(CALLBACK_DATA_RE);
  if (!match) {
    // Ack without action — "Unknown button" just silently defers.
    return NextResponse.json({ type: DEFERRED_UPDATE_MESSAGE });
  }
  const [, verb, actionId] = match;

  const appId = body.application_id;
  const interactionToken = body.token; // 15-minute TTL

  // Do the DB work after responding — Discord needs the 3-second ack.
  // We respond with DEFERRED_UPDATE_MESSAGE (type 6) which ack's without showing
  // "Bot is thinking…" in the UI, then PATCH @original with the resolved state.
  after(() => resolveApproval(verb, actionId, userId, appId, interactionToken));

  return NextResponse.json({ type: DEFERRED_UPDATE_MESSAGE });
}

async function resolveApproval(verb, actionId, discordUserId, appId, interactionToken) {
  const orgId = process.env.DISCORD_APPROVER_ORG_ID;
  if (!orgId) {
    await editOriginal(appId, interactionToken,
      '⚠️ Server misconfigured: DISCORD_APPROVER_ORG_ID is not set');
    return;
  }

  const sql = getSql();
  const action = await getActionSummary(sql, orgId, actionId);
  if (!action) {
    await editOriginal(appId, interactionToken, '⚠️ Action not found');
    return;
  }
  if (action.status !== 'pending_approval') {
    await editOriginal(appId, interactionToken,
      `⚠️ Already resolved — status: ${action.status}`);
    return;
  }

  const userId = `discord:${discordUserId}`;
  const isApprove = verb === 'ap';

  let updated;
  try {
    updated = await recordApproval(sql, orgId, actionId, {
      newStatus: isApprove ? 'running' : 'failed',
      errorMessage: isApprove ? null : 'Denied via Discord',
      decision: isApprove ? 'allow' : 'deny',
      userId,
      safeReasoning: isApprove ? null : 'Denied via Discord',
    });
  } catch (err) {
    console.warn('[DiscordInteractions] recordApproval failed:', err.message);
    await editOriginal(appId, interactionToken, '⚠️ Approval failed');
    return;
  }

  if (!updated) {
    await editOriginal(appId, interactionToken,
      '⚠️ Already resolved — resolved by another channel');
    return;
  }

  await editOriginal(appId, interactionToken,
    buildResolvedText(action, isApprove ? 'APPROVED' : 'DENIED', actionId));
}

async function editOriginal(appId, interactionToken, content) {
  try {
    await fetch(`${DISCORD_API}/webhooks/${appId}/${interactionToken}/messages/@original`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, components: [] }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[DiscordInteractions] editOriginal failed:', err.message);
  }
}

function buildResolvedText(action, decisionLabel, actionId) {
  const ts = new Date().toTimeString().slice(0, 8);
  const goal = (action.declared_goal || '—').slice(0, 200);
  return [
    `${decisionLabel} — ${ts}`,
    '',
    `Agent:   ${action.agent_id || 'unknown'}`,
    `Action:  ${action.action_type || 'unknown'}`,
    `Goal: ${goal}`,
    '',
    actionId,
  ].join('\n');
}
```

**Key differences from Telegram webhook:**

| Concern | Telegram (`/api/telegram/webhook`) | Discord (`/api/discord/interactions`) |
|---------|------------------------------------|---------------------------------------|
| Auth mechanism | HMAC-like static secret in `X-Telegram-Bot-Api-Secret-Token` header; `timingSafeEqual` compare | Ed25519 signature over `timestamp + body`; `crypto.verify` or `tweetnacl.sign.detached.verify` |
| Body parsing gotcha | `await request.json()` OK — secret is in header not in body | **`await request.text()` FIRST**, verify, then `JSON.parse`. Parsing and re-stringifying will change whitespace and break signature. |
| Ack mechanism | Separate `answerCallback` HTTP call to Telegram Bot API | Built into the HTTP response: `{ type: 6 }` (DEFERRED_UPDATE_MESSAGE) in the same POST response body |
| Ack deadline | Soft — Telegram tolerates slow acks | Hard 3-second deadline; Discord drops the interaction and tries once more |
| Message edit | Separate `editMessageText` HTTP call with `chat_id` + `message_id` | `PATCH /webhooks/{app_id}/{interaction.token}/messages/@original` — token lives 15 minutes |
| PING handshake | None — webhook just starts receiving callbacks | **Required.** Discord sends `{type: 1}` when saving the interactions URL; must respond `{type: 1}` or the URL is rejected. |
| Sender allowlist | `cq.from.id === process.env.TELEGRAM_ADMIN_CHAT_ID` | `body.user.id === process.env.DISCORD_APPROVER_USER_ID` (in DM; `body.member.user.id` in guild — Phase 2 is DM only so prefer `body.user.id`) |
| Leak-preventing auth response | Return 401 on bad chat_id (not 403) to avoid leaking "secret correct but identity wrong" | Same discipline — return 401 on bad user_id |

### Pattern 2: Outbound Discord DM with Approval Embed + Buttons

**What:** `fireDiscordApproval(action)` — fire-and-forget emitter called from `/api/actions` via `after()`. Opens DM channel (once per user, can cache), posts embed with 2 action-row buttons.

**When to use:** Anytime an action enters `pending_approval`. Mirrors `fireTelegramApproval` exactly.

**Example:**

```javascript
// Source: [CITED: /discord/discord-api-docs — POST /users/@me/channels + POST /channels/{id}/messages]

const DISCORD_API = 'https://discord.com/api/v10';
const FETCH_TIMEOUT_MS = 1500;

// Cache DM channel id per process. Discord returns the same channel object
// each call but we avoid a round-trip by caching. Cleared on cold start — fine.
let _cachedDmChannelId = null;

function isEnabled() {
  if (!process.env.DISCORD_BOT_TOKEN) return false;
  if (!process.env.DISCORD_APPROVER_USER_ID) return false;
  if (process.env.DASHCLAW_ALERTS_DISCORD === 'false') return false;
  return true;
}

async function openDmChannel() {
  if (_cachedDmChannelId) return _cachedDmChannelId;
  const res = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipient_id: process.env.DISCORD_APPROVER_USER_ID }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`openDmChannel failed: ${res.status}`);
  const json = await res.json();
  _cachedDmChannelId = json.id;
  return _cachedDmChannelId;
}

function buildEmbedPayload(action) {
  const risk = action.risk_score ?? 0;
  const goal = (action.declared_goal || '—').slice(0, 200);
  return {
    embeds: [{
      title: 'DashClaw: approval required',
      // Brand orange hex — the ONLY place in app code where we use the hex
      // directly, because Discord's `color` field wants a 24-bit int, not a
      // CSS token. Convert .impeccable.md brand orange #f97316 → 0xf97316.
      color: 0xf97316,
      fields: [
        { name: 'Agent', value: String(action.agent_id || 'unknown'), inline: true },
        { name: 'Action', value: String(action.action_type || 'unknown'), inline: true },
        { name: 'Risk score', value: String(risk), inline: true },
        { name: 'Goal', value: goal, inline: false },
      ],
      footer: { text: action.action_id },
      timestamp: new Date().toISOString(),
    }],
    components: [{
      type: 1, // ACTION_ROW
      components: [
        { type: 2, style: 3, custom_id: `ap:${action.action_id}`, label: 'Approve' },  // style 3 = SUCCESS (green)
        { type: 2, style: 4, custom_id: `dn:${action.action_id}`, label: 'Deny' },     // style 4 = DANGER  (red)
      ],
    }],
  };
}

async function sendApprovalMessage(action) {
  const channelId = await openDmChannel();
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildEmbedPayload(action)),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`[DiscordApprovals] send message returned ${res.status}`);
  }
}

export async function fireDiscordApproval(action, _sql, _orgId) {
  if (!isEnabled()) return;
  if (action?.status !== 'pending_approval') return;
  try {
    await sendApprovalMessage(action);
  } catch (err) {
    console.warn('[DiscordApprovals] Failed to send approval:', err.message);
  }
}
```

Then plug into `app/api/actions/route.js:326-333` alongside the existing Telegram emit:

```javascript
if (createdAction.status === 'pending_approval') {
  after(() => fireTelegramApproval(createdAction, sql, orgId));
  after(() => fireDiscordApproval(createdAction, sql, orgId));  // NEW — same fire-and-forget shape
  after(() => fireWebhooksForApproval(orgId, 'approval_pending', {
    ...createdAction,
    matched_policies: guardDecision?.matched_policies,
    reason: guardDecision?.reason,
  }, sql).catch(() => {}));
}
```

### Pattern 3: `/activity` Day-Grouping (pure client-side `useMemo`)

**What:** Group the existing flattened `events[]` array by calendar date, produce a summary header per day.

**When to use:** D-13 locks "presentational layer only, no schema change." This is pure JS on the array already in state.

**Example:**

```javascript
// Insert into app/activity/page.js near the render, between the existing
// events state and the render block. No data layer changes.

function groupEventsByDay(events) {
  const groups = new Map(); // dayKey (YYYY-MM-DD) → { label, events[], counts }
  for (const evt of events) {
    const d = new Date(evt.timestamp);
    const dayKey = d.toISOString().slice(0, 10);
    if (!groups.has(dayKey)) {
      // "Wed Apr 22" — respects user locale but short-form fixed-width.
      const label = d.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      groups.set(dayKey, {
        dayKey,
        label,
        events: [],
        counts: { approved: 0, denied: 0, allowed: 0, errored: 0 },
      });
    }
    const group = groups.get(dayKey);
    group.events.push(evt);

    // Counting rules (draft — planner can refine):
    //  - guard decision: status 'allow'       → counts.allowed
    //  - guard decision: status 'block'/'deny'→ counts.denied
    //  - guard decision: 'require_approval'   → neither (it's pending)
    //  - action complete: status 'completed'  → counts.approved (was approved + ran)
    //  - action failed:   status 'failed'     → counts.errored
    if (evt.category === 'guard') {
      if (evt.status === 'allow') group.counts.allowed += 1;
      else if (evt.status === 'block' || evt.status === 'deny') group.counts.denied += 1;
    } else if (evt.category === 'decision') {
      if (evt.status === 'completed') group.counts.approved += 1;
      else if (evt.status === 'failed' || evt.status === 'error') group.counts.errored += 1;
    }
  }
  // Preserve insertion order (events already come in DESC by time → newest day first).
  return Array.from(groups.values());
}

function summarizeDay({ counts }) {
  // "— 12 approvals, 3 denials, 47 silent allows, 0 errors"
  return `— ${counts.approved} approval${counts.approved===1?'':'s'}, `
       + `${counts.denied} denial${counts.denied===1?'':'s'}, `
       + `${counts.allowed} silent allow${counts.allowed===1?'':'s'}, `
       + `${counts.errored} error${counts.errored===1?'':'s'}`;
}

// Inside the component:
const groupedByDay = useMemo(() => groupEventsByDay(events), [events]);

// Render:
// {groupedByDay.map(group => (
//   <section key={group.dayKey}>
//     <header className="…">
//       <span>{group.label}</span>
//       <span className="tabular-nums">{summarizeDay(group)}</span>
//     </header>
//     {group.events.map(evt => /* existing event row */)}
//   </section>
// ))}
```

**Empty-day handling:** Per SPEC acceptance criterion "`/activity` day-grouping renders correctly for 0/0/0 days and populated days." If there are no events for a day, the day simply doesn't render (no group exists). The "0/0/0" case in the spec applies to days where events DID fire but counts across all four buckets sum to zero — e.g. only `require_approval` pending actions appeared. That case is naturally handled by the counter logic above (all four counts stay at 0) and the header still renders with "0 approvals, 0 denials, 0 silent allows, 0 errors."

### Pattern 4: `/my-agent` Narrative Page

**What:** New client component. Narrative sentence hero + today/week toggle + denials pinned + chronological list + install-prompt empty state.

**When to use:** CCI-04 second surface. Uses only existing data endpoints.

**Skeleton structure:**

```javascript
// app/my-agent/page.js
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import PageLayout from '../components/PageLayout';
import { Card, CardContent } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useRealtime } from '../hooks/useRealtime';
import { useAgentFilter } from '../lib/AgentFilterContext';
import { getAgentColor } from '../lib/colors';
import Link from 'next/link';
import { Terminal, ShieldAlert, CheckCircle2 } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function MyAgentPage() {
  const { agentId } = useAgentFilter();
  const [scope, setScope] = useState('today'); // 'today' | 'week'
  const [actions, setActions] = useState([]);
  const [guardDecisions, setGuardDecisions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const agentQs = agentId ? `&agent_id=${encodeURIComponent(agentId)}` : '';
      const [actionsRes, guardRes] = await Promise.all([
        fetch(`/api/actions?limit=200${agentQs}`),
        fetch(`/api/guard?limit=200${agentQs}`),
      ]);
      setActions((await actionsRes.json()).actions || []);
      setGuardDecisions((await guardRes.json()).evaluations || []);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtime((event) => {
    if (event === 'action.created' || event === 'action.updated' || event === 'guard.decision.created') {
      fetchData();
    }
  });

  const filtered = useMemo(() => {
    const cutoff = Date.now() - (scope === 'today' ? DAY_MS : 7 * DAY_MS);
    return {
      actions: actions.filter(a => new Date(a.timestamp_start).getTime() >= cutoff),
      guard: guardDecisions.filter(g => new Date(g.created_at).getTime() >= cutoff),
    };
  }, [scope, actions, guardDecisions]);

  const counts = useMemo(() => {
    const approved = filtered.actions.filter(a => a.status === 'completed').length;
    const denied = filtered.guard.filter(g => g.decision === 'block' || g.decision === 'deny').length;
    const requiredApproval = filtered.actions.filter(a =>
      a.status === 'running' || a.status === 'completed'
    ).filter(a => a.approved_by).length;
    return { total: filtered.actions.length, approved, denied, requiredApproval };
  }, [filtered]);

  const hasAnyActivity = (actions.length + guardDecisions.length) > 0;

  // Empty state — D-10 install-prompt hero
  if (!loading && !hasAnyActivity) {
    return <InstallPromptHero />;
  }

  const denials = filtered.guard.filter(g => g.decision === 'block' || g.decision === 'deny');
  const narrative = buildNarrative(scope, counts);
  // ... render PageLayout with [narrative hero] [toggle] [denials pinned] [chronological] …
}

function buildNarrative(scope, counts) {
  const when = scope === 'today' ? 'Today' : 'This week';
  if (counts.total === 0) {
    return `${when}, your agent hasn't run anything yet.`;
  }
  const parts = [`${when} your agent ran ${counts.total} command${counts.total===1?'':'s'}.`];
  if (counts.requiredApproval > 0) {
    parts.push(`${counts.requiredApproval} required approval.`);
  }
  if (counts.denied > 0) {
    parts.push(`${counts.denied} ${counts.denied===1?'was':'were'} denied.`);
  }
  return parts.join(' ');
}

function InstallPromptHero() {
  return (
    <PageLayout title="My Agent" breadcrumbs={['Command', 'My Agent']}>
      <Card className="mx-auto max-w-2xl p-8 text-center">
        <h2 className="text-xl font-semibold text-white">Your agent hasn't run anything yet.</h2>
        <p className="mt-2 text-sm text-secondary">
          Three steps to get Claude Code governed, with Discord approvals on your phone.
        </p>
        <ol className="mx-auto mt-6 max-w-sm space-y-3 text-left text-sm text-secondary">
          <li>1. Install the hook: <code className="font-mono text-xs">npm run hooks:install</code></li>
          <li>2. Connect Discord (bot + env vars)</li>
          <li>3. Trigger a Claude Code tool call</li>
        </ol>
        <Link
          href="/guides/claude-code"
          className="mt-6 inline-flex items-center rounded-lg border border-active/30 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/20"
        >
          Open the full guide →
        </Link>
      </Card>
    </PageLayout>
  );
}
```

**Critical:** Per `.impeccable.md` tiebreaker #2, brand orange shows up only on the CTA button and the denials flag — NOT ambient. Per tiebreaker #4, use the `text-brand`/`bg-brand` Tailwind utilities that resolve to `--color-brand`, never `#f97316` directly in JSX.

### Anti-Patterns to Avoid

- **Parsing JSON before verifying signature.** Discord wants the raw body bytes for the Ed25519 input. `await request.json()` followed by `JSON.stringify(body)` changes whitespace → signature fails. Always `await request.text()` first, verify, then `JSON.parse`.
- **Blocking the 3-second interaction window on DB work.** Always respond with `DEFERRED_UPDATE_MESSAGE` (type 6) within 3 seconds, then PATCH `@original` via `after()`.
- **Re-querying the DB inside the SSE handler in `/my-agent`.** Use the shared `useRealtime` pattern that already works in `/activity` — call `fetchData()` in the subscriber, which is cheap because the actions endpoint has `limit=200`.
- **Hardcoding brand orange in JSX.** Only permitted in the Discord embed `color: 0xf97316` because the Discord field demands an int. Everywhere else, tokens.
- **Hand-rolled narrative AI summary.** The narrative on `/my-agent` is templated English from counts, NOT LLM-generated. SPEC § "One sentence, counts inline" is explicit.
- **Adding the `MODAL_SUBMIT` denial-reason modal in Phase 2.** CONTEXT §Claude's Discretion. Skip — double state machine, no SPEC requirement.
- **Running route-sql:check after adding a raw `sql\`...\`` query to `/api/discord/interactions`.** All SQL must go through the repository — reuse `getActionSummary` + `recordApproval` verbatim from `app/lib/repositories/actions.repository.js:19-59`.
- **Editing livingcode-generated files by hand** (`app/lib/doctor/generated/`, `public/livingcode/index.html`, `public/downloads/dashclaw-platform-intelligence*`). Regenerate via `npm run livingcode:refresh`. Pre-commit hook auto-runs this when `app/api/`, `app/lib/`, `schema/schema.js`, or `middleware.js` changes — the planner doesn't need to touch those outputs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ed25519 signature verification | Custom crypto | `crypto.verify('ed25519', ...)` (native) or `tweetnacl` (Discord's canonical example) | Rolling your own asymmetric crypto is how CVEs happen. Both approved options are mature and audited. |
| Discord bot HTTP client | `discord.js` websocket gateway | Plain `fetch` + `Bot {token}` header | discord.js pulls in 2+ MB, needs a gateway connection, and is incompatible with Vercel free tier. Three endpoints needed: `POST /users/@me/channels`, `POST /channels/{id}/messages`, `PATCH /webhooks/{app}/{token}/messages/@original`. `fetch` handles all three cleanly. |
| Bot application registration | Manual Discord API calls to register app commands | Use the Developer Portal UI + one-time `node scripts/discord-register-bot.mjs` (optional) | Interaction endpoint URL registration happens in the Portal, not via API. Slash commands don't apply — this is button-only. |
| Approval state machine | Custom status enum per channel | Reuse `recordApproval(sql, orgId, actionId, {decision, newStatus, errorMessage, userId, safeReasoning})` from `actions.repository.js:39-59` | The repository handles the atomic status guard (zero-row return on race), reasoning append, approved_by/approved_at stamping. All channels (web, Telegram, Discord) flow through this path. |
| Action status SSE broadcast | Custom event bus | Existing `publishOrgEvent` + `useRealtime` hook | Already shipped and used by `/activity`, `/approve`, `/approvals`. SSE connection is shared via a singleton EventSource (`app/hooks/useRealtime.js:7-9`). |
| Day-grouping "this week" logic | Custom date library | Plain Date math + `toLocaleDateString` | 7-line `useMemo`. date-fns/luxon would be massive overkill. |
| Narrative text generation | LLM template | Hardcoded string template with inline counts | SPEC locks counts-only. LLM here is cost+latency without upside. |
| Screencast recording | Custom tooling | Loom (recommended) or YouTube | Both are free, embed-friendly, 3-minute videos upload in <5 minutes. |

**Key insight:** Phase 2 is 95% glue and presentation. The Telegram parity removes the need to invent anything on the approval side; the existing UI kit removes the need to invent anything on the rendering side. Every line that isn't the Discord signature verifier or the embed payload is copy-port-adjust.

## Runtime State Inventory

Phase 2 is primarily additive (new route, new page, new lib). Not a rename or migration. No existing runtime state is being renamed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change per D-13, no new tables | None. `action_records.approved_by` will receive new values like `discord:123456789012345678` (mirrors `telegram:42`) — no schema touch. |
| Live service config | **Discord Developer Portal:** new app + bot + interactions endpoint URL + public key. This lives in Discord's admin UI, not git. | Human-run step in the walkthrough. No automation possible for Phase 2 (UI-only). Mitigation: `scripts/discord-register-bot.mjs` (optional) can verify the interaction endpoint is reachable + signed-correctly by POSTing a synthetic PING. |
| OS-registered state | None | None. |
| Secrets / env vars | 5 new env var names (`DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPROVER_USER_ID`, `DISCORD_APPROVER_ORG_ID`, `DASHCLAW_ALERTS_DISCORD`) — none collide with existing names | Add to `.env.example` lines after line 160 (after Telegram block). Document in `/guides/claude-code`. |
| Build artifacts | `app/lib/doctor/generated/shape.json` and `last-snapshot.json` will auto-regenerate when new files appear in `app/api/` or `app/lib/` — pre-commit hook handles this. `routes-inventory.generated.json` (mcp-server) auto-regenerates. | None — do not hand-edit. Just commit the generated delta with the feature PR. |

**Nothing found in OS-registered state:** Verified by grep — no `.plist`, no `systemd`, no `pm2 ecosystem`, no Windows Task Scheduler content in the repo. DashClaw is a Vercel web app; the Phase 2 changes stay inside `app/` + `docs/` + `.planning/`.

## Common Pitfalls

### Pitfall 1: Signature verification fails on Vercel serverless because body got parsed

**What goes wrong:** Developer writes `const body = await request.json(); if (verifySignature(JSON.stringify(body), …))` and the signature always fails even with a good key.
**Why it happens:** JSON re-serialization reorders keys and changes whitespace. Discord signed the original bytes.
**How to avoid:** `const rawBody = await request.text()` → verify `(timestamp + rawBody)` → `JSON.parse(rawBody)` only after verification passes. Pattern copy-pasted from Discord's own example [CITED: github.com/discord/discord-api-docs — Validate Discord Security Request Headers].
**Warning signs:** PING handshake in the Developer Portal says "URL verified" but real button presses return 401. (PING works because the Portal's synthetic PING body is simple enough that re-serialization happens to match — real payloads with nested objects break it.)

### Pitfall 2: Bot DMs silently fail because the user hasn't opened a DM to any bot ever

**What goes wrong:** `POST /channels/{dm_id}/messages` returns 403 "Cannot send messages to this user."
**Why it happens:** Discord users can set "Allow direct messages from server members" off. If the admin user has never shared a server with the bot and has DMs-from-non-friends disabled, `POST /users/@me/channels` succeeds (returns a channel_id) but the subsequent message POST 403s.
**How to avoid:** Document in `/guides/claude-code` that the admin user must (a) share at least one mutual server with the bot — easiest: invite the bot to a personal test server with minimum permissions, OR (b) ensure "Allow direct messages" is on for that server. Include a diagnostic step: `scripts/discord-verify-loop.mjs` that fires a synthetic DM and surfaces a useful error if 403.
**Warning signs:** Message send returns 403; bot token is valid; user ID is numerically correct.

### Pitfall 3: Interaction endpoint URL drops because Discord's synthetic security scans fail

**What goes wrong:** Bot works for a day, then interaction endpoint URL is removed and admin gets an email from Discord.
**Why it happens:** [CITED: github.com/discord/discord-api-docs — "Discord performs routine, automated security checks by sending invalid signatures to endpoints; failing these checks will result in the removal of the Interactions URL."] If the endpoint returns 200 on a bad signature (instead of 401), Discord disables it.
**How to avoid:** ALWAYS return 401 on bad signature. Never 200, never 403, never 500. The Telegram webhook returns 401 on bad admin_chat_id too — same discipline.
**Warning signs:** "Interactions endpoint URL removed" email from Discord; bot silently stops receiving button events.

### Pitfall 4: `DISCORD_PUBLIC_KEY` has the wrong format after copy-paste from the Developer Portal

**What goes wrong:** Signature verification fails for every valid payload.
**Why it happens:** The Portal shows the public key as a 64-char hex string. Some users accidentally wrap it in quotes or copy trailing whitespace. Node's `createPublicKey` with `format: 'der'/'spki'` is picky; tweetnacl's `Buffer.from(hex, 'hex')` is also picky (non-hex silently becomes empty buffer).
**How to avoid:** In `isEnabled()` / at startup, validate `/^[0-9a-f]{64}$/i.test(process.env.DISCORD_PUBLIC_KEY)` and log loud warning if mismatched. Include a one-shot check: `scripts/discord-register-bot.mjs` can verify the env key by POSTing a self-signed PING locally.
**Warning signs:** Every interaction returns 401 in your logs; PING handshake failed to save the URL.

### Pitfall 5: `application_id` in the interaction body is a string, but Discord API URLs expect it in certain places

**What goes wrong:** `PATCH /webhooks/{app_id}/{token}/messages/@original` returns 404.
**Why it happens:** `body.application_id` is a snowflake (string of digits). URL templating usually works — but if you accidentally read `body.data.application_id` or a sub-object, you get undefined.
**How to avoid:** Use `body.application_id` (top-level), not anything nested. In the interaction body schema, `application_id` is at the root [CITED: /discord/discord-api-docs — Interaction Object].
**Warning signs:** Buttons get acked successfully but the message never updates.

### Pitfall 6: Windows CRLF in `.claude/settings.json` breaks JSON parsing

**What goes wrong:** CCI-01 walkthrough on Windows/WSL: `.claude/settings.json` saved from Notepad has BOM + CRLF; Claude Code rejects it as malformed JSON.
**Why it happens:** Default Windows editors; WSL is happy with LF.
**How to avoid:** In the walkthrough, instruct to save from VSCode (which defaults to LF on file re-save of JSON) or provide the settings via `npm run hooks:install` which uses Node's `JSON.stringify` (always LF). The hook-install script at `scripts/install-hooks.mjs` already handles this.
**Warning signs:** "Invalid JSON in settings.json" error at Claude Code startup. Compare file byte-for-byte with Git-checked version.

### Pitfall 7: `DASHCLAW_BASE_URL=http://localhost:3000` silently points real Claude Code at a dev/demo instance

**What goes wrong:** Surfaced 2026-04-22 (CONTEXT §Surfaced-during-diagnosis). Operator has a `dashclaw-demo` Docker container running on :3000 while their real instance is at :3001 or remote. Hook reads `.env` correctly but a shell-level `DASHCLAW_BASE_URL` override in the Claude Code process env wins. Every tool call gets governed by demo policies; "Demo Production Guard" looks like a real block.
**Why it happens:** Env precedence — process env wins over .env file. Hook has no sanity check.
**How to avoid (todo-001, optional Phase 2 scope):** Hook reads `/api/health` once at startup, stderr-warns if `mode: demo`. Not strictly blocking CCI-01 but will save future walkthrough attempts.
**Warning signs:** `"matched_policy": "Demo Production Guard"` in the decision ledger.

### Pitfall 8: Loom "public" link behind captcha/geofence breaks acceptance

**What goes wrong:** CCI-05 requires "Screencast URL resolves to a public video ≤3 minutes." Loom default "anyone with link" may trigger captcha for unauthenticated viewers or regional blocking.
**Why it happens:** Loom's default sharing is "in your workspace"; turning on "anyone with link" is one click but easy to miss.
**How to avoid:** After upload, open the link in a private browser window from a different IP (use a VPN or phone hotspot) to verify no interstitial. Or pick YouTube "Unlisted" which has a simpler public-access story.
**Warning signs:** A reviewer reports they can't watch the video.

### Pitfall 9: Pre-commit hook regenerates SDK docs → stale homepage draft feels like the source of truth

**What goes wrong:** Dev edits `docs/homepage-draft-claude-code.md`; pre-commit hook regenerates `docs/api-inventory.md`, `docs/openapi/critical-stable.openapi.json`, `app/lib/doctor/generated/`. Dev amends with just the draft changes but the generated deltas leak in.
**Why it happens:** `npm run livingcode:refresh` fires on changes under `app/api/`, `app/lib/`, `schema/schema.js`, or `middleware.js`. When adding `/api/discord/interactions/route.js`, this hook correctly runs.
**How to avoid:** Expect the generated files to change when the new route ships. Commit them intentionally, not surprised. Never hand-edit the generated outputs. The homepage draft is not auto-generated — safe to edit manually.
**Warning signs:** `git status` shows deltas in files under `app/lib/doctor/generated/` you didn't touch.

### Pitfall 10: Narrative "X required approval" counter double-counts when an action is approved twice

**What goes wrong:** Race condition or double-tap from Discord buttons causes `approved_by` to be overwritten; narrative says "2 required approval" when only 1 action actually did.
**Why it happens:** `recordApproval` uses an atomic `UPDATE … WHERE status = 'pending_approval'`, so the second attempt returns null (see `actions.repository.js:43-56`). But if the narrative counts `approved_by IS NOT NULL`, one action contributes 1 either way. Actually this is NOT a real pitfall — the row-level guard prevents it. Listing it so the planner knows the repository already protects the count semantics.
**How to avoid:** Trust the repository. Don't add "second layer" guards.

## Code Examples

Verified patterns from official sources.

### Discord Ed25519 verification (Node native — RECOMMENDED)

```javascript
// Source: Adapted from [CITED: github.com/discord/discord-api-docs — Validate Discord Security Request Headers]
// Uses Node native crypto (≥20) instead of tweetnacl. See Pattern 1 above for full route.

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

function verifyDiscordSignature(rawBody, signatureHex, timestampStr, publicKeyHex) {
  try {
    const keyObj = createPublicKey({
      key: Buffer.from(publicKeyHex, 'hex'),
      format: 'der', type: 'spki',
    });
    return cryptoVerify(
      null,
      Buffer.concat([Buffer.from(timestampStr, 'utf8'), Buffer.from(rawBody)]),
      keyObj,
      Buffer.from(signatureHex, 'hex')
    );
  } catch { return false; }
}
```

### Discord Ed25519 verification (tweetnacl fallback — matches Discord docs verbatim)

```javascript
// Source: [CITED: github.com/discord/discord-api-docs — Validate Discord Security Request Headers]
import nacl from 'tweetnacl';

const isVerified = nacl.sign.detached.verify(
  Buffer.from(timestamp + rawBody),
  Buffer.from(signature, 'hex'),
  Buffer.from(PUBLIC_KEY, 'hex')
);
```

### Discord button interaction response structure

```jsonc
// Source: [CITED: github.com/discord/discord-api-docs — Handle Message Interaction Response]
// Incoming POST body from Discord when user taps a button:
{
  "type": 3,                           // MESSAGE_COMPONENT
  "id": "881413782450663475",
  "application_id": "881413782450663474",
  "token": "aW50ZXJhY3Rpb24gdG9rZW4...",  // 15-minute TTL
  "data": {
    "component_type": 2,               // BUTTON
    "custom_id": "ap:act_abc12345"     // OUR encoding
  },
  "user": { "id": "219436472..." },    // In DM context
  "member": { "user": { "id": "..." } }, // In guild context only
  "message": { "id": "...", "channel_id": "..." }
}
```

### Discord interaction response — DEFERRED_UPDATE_MESSAGE (silent ack)

```jsonc
// Source: [CITED: github.com/discord/discord-api-docs — Interaction Callback Resource Object]
// Response to the button interaction POST (must return within 3 seconds):
{
  "type": 6  // DEFERRED_UPDATE_MESSAGE — no visible "Bot is thinking…"
}
// Then separately: PATCH /webhooks/{app_id}/{interaction.token}/messages/@original
```

### Edit original interaction message (after ack)

```javascript
// Source: [CITED: github.com/discord/discord-api-docs — Edit Original Interaction Response]
// PATCH /webhooks/{application.id}/{interaction.token}/messages/@original
await fetch(`https://discord.com/api/v10/webhooks/${appId}/${interactionToken}/messages/@original`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: 'APPROVED — 12:47:03\n\nAgent:   claude-code\nAction:  bash\nGoal: ...',
    components: [],  // Strip buttons to prevent re-taps
  }),
});
// Note: Interaction tokens are valid for 15 minutes. NOT bound to global rate limit.
```

### Message with Action Row + Approve/Deny buttons

```jsonc
// Source: [CITED: github.com/discord/discord-api-docs — Message Example with Action Row]
// POST /channels/{dm_channel_id}/messages body:
{
  "embeds": [{
    "title": "DashClaw: approval required",
    "color": 16351510,  // 0xf97316 brand orange (only permitted hex-in-code instance)
    "fields": [
      {"name": "Agent", "value": "claude-code", "inline": true},
      {"name": "Action", "value": "bash", "inline": true},
      {"name": "Risk score", "value": "72", "inline": true},
      {"name": "Goal", "value": "Delete build cache and rebuild", "inline": false}
    ],
    "footer": {"text": "act_abc12345"}
  }],
  "components": [{
    "type": 1,                        // ACTION_ROW
    "components": [
      {"type": 2, "style": 3, "custom_id": "ap:act_abc12345", "label": "Approve"},  // SUCCESS green
      {"type": 2, "style": 4, "custom_id": "dn:act_abc12345", "label": "Deny"}      // DANGER  red
    ]
  }]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discord bot via gateway websocket (discord.js) | Webhook-based interactions (stateless HTTP) | 2020 — Discord shipped Interactions API | Required for serverless platforms (Vercel, Cloudflare Workers, Lambda). All button-driven bots should use this. |
| `tweetnacl` for Ed25519 | Node native `crypto` with ed25519 support | Node ≥15 (stable since 16) | Saves 175KB dep. Matches standard-library trend. Discord's examples haven't been updated but the ecosystem has. |
| `discord.js` for slash commands | `discord-interactions` helper or direct fetch | 2021 — discord-interactions released by Discord | For webhook-only bots, discord.js is overkill. |
| Bot with `MESSAGE_CONTENT` intent | No intent needed for button-only bots | N/A | Our bot doesn't read messages, only sends DMs + receives button events. No privileged intent required. |

**Deprecated/outdated:**
- Discord v6/v8 API paths: Use `/api/v10` (current stable). [CITED: /discord/discord-api-docs — Create Message via REST API uses v10.]
- `discord.js` v13 style: Use v14 or skip entirely for this use case.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node native `crypto.verify` with raw 32-byte hex → `createPublicKey({format:'der', type:'spki'})` works on Vercel Node 20 runtime | Standard Stack, Pattern 1 | [ASSUMED]. Discord's docs example is tweetnacl. If native crypto requires SPKI-wrapped key bytes (not raw), the verify always returns false. **Mitigation: include the tweetnacl fallback snippet inline in the planner's 02-02 plan; pick based on first signature-verify test result.** |
| A2 | Loom "Anyone with link" default allows public playback without captcha | Summary / Pitfall 8 | [ASSUMED]. Loom's policy changes occasionally. Mitigation: verify via incognito browser after upload. |
| A3 | MCP `dashclaw_wait_for_approval` poll interval (currently 3s default) + PATCH latency fits within 10s round-trip budget | CCI-03 in "Phase Requirements" | [VERIFIED: `mcp-server/lib/tools.js:234` shows `interval = (input.poll_interval_seconds ?? 3) * 1000`. Worst case: 3s poll + 0.5s PATCH + network ≈ 4s. Within 10s budget with >5s headroom.] |
| A4 | `application_id` is always present at top-level in MESSAGE_COMPONENT interaction body | Pitfall 5, Pattern 1 | [CITED: `/discord/discord-api-docs` Interaction Object shows `application_id` at root.] |
| A5 | Bot does not need `MESSAGE_CONTENT` privileged intent because it only sends DMs + receives button events | Architecture Diagram, Standard Stack | [ASSUMED from Discord docs hierarchy]. Mitigation: Developer Portal clearly exposes intent toggles; walkthrough step 3 of `/guides/claude-code` should explicitly say "leave all privileged intents OFF." |
| A6 | `recordApproval`'s zero-row atomic guard sufficient to prevent Telegram+Discord double-approval race | Pitfall 10 | [VERIFIED: `app/lib/repositories/actions.repository.js:53-56` — `WHERE status = 'pending_approval'` with `RETURNING *`. Second caller gets empty result set. Test `telegram-webhook-route.test.js:346-373` explicitly covers this "resolved by another channel" path.] |
| A7 | Screencast at Loom is acceptable to CCI-05 | D-20 / Summary | [ASSUMED]. CONTEXT marks hosting as Claude's discretion. If user prefers YouTube Unlisted, trivial swap — just a link change. |
| A8 | `EmptyState` component at `app/components/ui/EmptyState.js` can be extended (via `action` prop) to hold the 3-step install-prompt hero; no new component needed | Pattern 4 | [VERIFIED: read `EmptyState.js` this session — it accepts `{icon, title, description, action}` props. Action slot accepts ReactNode, sufficient for a Link + 3-step ordered list.] However, per D-10 the hero should be MORE prominent than a tiny EmptyState — consider creating a `MyAgentInstallPromptHero` custom JSX inline in the page file (my skeleton above does this). |
| A9 | `fetchPending` re-fetch on every SSE event is acceptable load — no need for incremental merge | Pattern 4 | [VERIFIED: `app/activity/page.js:102-137` already does `setEvents(prev => [newEvt, ...prev].slice(0, 50))` — incremental merge. `/my-agent` can do the same. I suggested `fetchData()` in my skeleton as the simplest path; planner can upgrade to incremental.] |

**Claims with risk if wrong:** A1, A2, A5, A7 all have cheap mitigations in-band. Only A1 could force a mid-plan switch (native → tweetnacl) — budget a 10-minute plan task for "try native; if fails, install tweetnacl."

## Open Questions

1. **Does Node native `crypto.verify` accept Discord's 64-char hex key as `{format:'der', type:'spki'}` directly?**
   - What we know: Node 22 has ed25519 support. `createPublicKey` generally expects DER-encoded SPKI for public keys. Raw 32-byte hex is NOT SPKI — it needs to be wrapped.
   - What's unclear: Whether Node 20+ has a convenience path for raw 32-byte ed25519 public keys, or if manual SPKI prefix wrapping is required.
   - Recommendation: **Plan should implement tweetnacl as the default** (matches Discord's official example, zero uncertainty). Note native as a future optimization. This flips my earlier recommendation — A1's risk is real enough that "150KB dep matching the spec's reference implementation" is the safer plan path. The planner should NOT spend time trying to make native crypto work in Phase 2.

2. **Does the Discord "dm_channel_id" persist indefinitely once opened?**
   - What we know: `POST /users/@me/channels` returns the same channel id on repeat calls. Cold starts flush the cache.
   - What's unclear: If the user blocks the bot and unblocks, does the channel id remain valid?
   - Recommendation: On send-message 404/403, clear the cached id and retry once. Log loud on second failure. Not a Phase 2 blocker.

3. **What's the Discord rate limit for DM sends?**
   - What we know: Global 50 req/sec per bot. Per-channel limits are tighter but adequate for approval-frequency traffic.
   - What's unclear: If a user is getting a storm of approvals (malfunctioning agent), do we need to batch?
   - Recommendation: Out of Phase 2 scope. Single-org, single-user; realistic traffic is <1 approval/minute.

4. **Is the "0/0/0" empty-day case from SPEC acceptance a real scenario?**
   - What we know: The acceptance criterion reads "`/activity` day-group headers render correctly for empty days (0/0/0) and populated days."
   - What's unclear: A day with ZERO events wouldn't render a day group at all under the grouping I proposed. Does the SPEC mean "a day with events but all-zero counts across the 4 categories"? Or "we want to explicitly render empty days too"?
   - Recommendation: Defer to planner interpretation. Most likely intent: days with events but all-zero visible counts (e.g., a day of only `pending_approval` that never resolved). My grouping handles this naturally. Explicit empty-day rendering (render all 7 days of the week with zeros if no events) adds complexity — punt unless the planner interprets SPEC more strictly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + runtime | ✓ | 22.18.0 (engines: >=20.0.0) | — |
| Next.js | App Router + `after()` | ✓ | 16 (package.json) | — |
| `@neondatabase/serverless` + Postgres | DB | ✓ | 1.1.0 | — |
| Vercel free tier | Deployment | ✓ | N/A | — |
| Discord bot account | CCI-03 walkthrough | ✗ (requires human step) | — | Walkthrough docs step-by-step; no code fallback. |
| Mobile Discord app | CCI-01 walkthrough evidence | ✗ (operator's phone) | — | None — SPEC requires phone approval. |
| Windows/WSL2 environment | CCI-01 walkthrough evidence | ✓ (Wes's dogfood machine per CONTEXT) | 11 / 10.0.26200 | — |
| Screen recording tool (Loom/OBS/Windows Game Bar) | CCI-01 walkthrough | Assumed available | — | Any tool that can capture window + audio. |
| `tweetnacl` (if chosen over native crypto) | Ed25519 verify | ✗ (not installed) | — | Native `crypto.verify`. Recommend `npm install tweetnacl` to remove uncertainty. |

**Missing dependencies with no fallback:**
- Discord Developer account + bot creation is a one-time human step in the walkthrough. Documented in `/guides/claude-code` (new Discord section).

**Missing dependencies with fallback:**
- `tweetnacl` — if planner picks native crypto path, skip install.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (per `vitest.config.mjs`), jsdom env, globals on |
| Config file | `vitest.config.mjs` (verified in this session) |
| Quick run command | `npx vitest run __tests__/unit/discord-interactions-route.test.js` |
| Full suite command | `npm test` (runs `vitest`, ~1648 tests per SPEC) |
| Integration dir | `__tests__/integration/` (exists but thinly used) |
| Python hook tests | `hooks/tests/` (pytest-style, e.g. `test_pretool_guard_unavailable.py`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CCI-02 | `claude-code-starter` pack no regression | unit | `npx vitest run __tests__/unit/claude-code-starter-pack.test.js` | ✅ (shipped 02-01) |
| CCI-02 | Full suite clean | suite | `npm test` | ✅ infrastructure exists |
| CCI-03 | `/api/discord/interactions` returns 401 on invalid Ed25519 signature | unit | `npx vitest run __tests__/unit/discord-interactions-route.test.js -t "returns 401"` | ❌ Wave 0 — create |
| CCI-03 | Valid MESSAGE_COMPONENT signature + `ap:act_xxx` → `action_records.status` becomes `approved`/`running` | unit (with mocked repo) | `npx vitest run __tests__/unit/discord-interactions-route.test.js -t "approve"` | ❌ Wave 0 — create |
| CCI-03 | `dashclaw_wait_for_approval` resolves within 2s of status change | existing test | Existing coverage in `mcp-server` tests (verify) | ⚠️ verify existing coverage; may need new test |
| CCI-03 | Phone tap → DB round-trip ≤10s | manual (logged in CCI-01 walkthrough) | N/A — human | ✅ manual verification |
| CCI-03 | `fireDiscordApproval` fire-and-forget semantics match Telegram | unit | `npx vitest run __tests__/unit/discord-approvals.test.js` | ❌ Wave 0 — create (mirror `telegram-approvals.test.js`) |
| CCI-04 | `/activity` day-group headers render for 0/0/0 and populated days | unit / snapshot | `npx vitest run __tests__/unit/activity-day-grouping.test.js` | ❌ Wave 0 — create (pure function test) |
| CCI-04 | `/my-agent` renders for 0-event, 1-event, 50+-event states | component | `npx vitest run __tests__/unit/my-agent-page.test.jsx` | ❌ Wave 0 — create |
| CCI-04 | Both respect `useAgentFilter` | unit | part of above | ❌ Wave 0 |
| CCI-05 | `/guides/claude-code` snippets run as-is on Windows/WSL | manual (verified in CCI-01 walkthrough) | N/A | ✅ manual |
| CCI-05 | README first 50 lines mention Claude Code | script / grep | `head -n 50 README.md | grep -i "claude code"` (can wrap in `scripts/check-readme-lead.mjs`) | ❌ optional |
| CCI-05 | Screencast URL resolves, ≤3:00 | manual | N/A | ✅ manual |
| CCI-05 | `docs/homepage-draft-claude-code.md` ≥200 words | script | `wc -w docs/homepage-draft-claude-code.md` | ✅ one-liner |
| CCI-05 | `npm run openapi:check` passes after new route | gate | `npm run openapi:check` | ✅ existing gate |
| CCI-05 | `npm run api:inventory:check` passes | gate | `npm run api:inventory:check` | ✅ existing gate |

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/unit/discord-*.test.js __tests__/unit/my-agent-page.test.jsx __tests__/unit/activity-day-grouping.test.js` (fast, ~2s)
- **Per wave merge:** `npm test` (full suite, catches regressions anywhere in the 1648 tests)
- **Phase gate before `/gsd-verify-work`:**
  - `npm test` (green)
  - `npm run lint` (green)
  - `npm run openapi:check` (green — verifies new Discord route is contracted)
  - `npm run api:inventory:check` (green)
  - `npm run route-sql:check` (green — guards against raw SQL sneaking into the Discord route)
  - `npm run docs:check` (green — catches missing SDK docs updates)
  - CCI-01 walkthrough recording exists at `.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4` and is ≤5:00

### Wave 0 Gaps

- [ ] `__tests__/unit/discord-interactions-route.test.js` — covers CCI-03. Mirror `telegram-webhook-route.test.js` structure: auth (401 paths), callback_data parsing, approve path, deny path, idempotency, misconfig. **8-10 test cases.**
- [ ] `__tests__/unit/discord-approvals.test.js` — covers CCI-03 outbound. Mirror `telegram-approvals.test.js`. Test: `isEnabled` gating, message shape, fire-and-forget error swallowing, kill-switch env.
- [ ] `__tests__/unit/activity-day-grouping.test.js` — covers CCI-04. Pure function test for `groupEventsByDay` + `summarizeDay`. Fixture: empty, single-event, multi-day, all-counts-zero day. Snapshot acceptable.
- [ ] `__tests__/unit/my-agent-page.test.jsx` — covers CCI-04. React Testing Library snapshot / render tests for 0-event (empty hero), 1-event, 50+-event states. Mock `/api/actions`, `/api/guard`, `useRealtime`, `useAgentFilter`.
- [ ] `__tests__/unit/discord-embed-payload.test.js` — pure function test for `buildEmbedPayload(action)`. Verifies: 4 fields present, goal truncation at 200, color 0xf97316, Approve/Deny buttons, custom_id format.
- [ ] Optional: `scripts/check-readme-lead.mjs` — asserts README first 50 lines contain "Claude Code" + "/guides/claude-code" link. Run in CI.
- [ ] Optional: `scripts/check-homepage-draft-length.mjs` — asserts `docs/homepage-draft-claude-code.md` ≥200 words.

**Framework install:** None — vitest is already installed per `package.json` `"test": "vitest"`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bot token + user_id allowlist (mirrors Telegram admin_chat_id pattern). Ed25519 signature = request integrity, NOT auth — user allowlist is separate check after signature. |
| V3 Session Management | no | Interaction tokens are Discord's internal concern; 15-min TTL enforced by Discord. No session state in our route. |
| V4 Access Control | yes | `body.user.id === DISCORD_APPROVER_USER_ID` (single-org, D-03) enforces "only this Discord identity can resolve actions in this org." |
| V5 Input Validation | yes | `CALLBACK_DATA_RE = /^(ap|dn):(act_[a-z0-9_-]{1,57})$/` limits custom_id input. Action goal truncated at 200 chars in embed to prevent embed-overflow. Reuse `scanSensitiveData` path from `/api/approvals/[actionId]` for safeReasoning (already done via repository path). |
| V6 Cryptography | yes | Ed25519 verify via `crypto.verify` (native) or `tweetnacl.sign.detached.verify` (Discord's example). Never hand-roll. `timingSafeEqual` already imported in Telegram route — can reuse for any constant-time comparisons. |
| V7 Error Handling | yes | Return 401 on bad signature OR bad user_id (NOT 403 — matches Telegram discipline to avoid leaking "secret correct but identity wrong"). |
| V9 Communication Security | yes | HTTPS enforced by Vercel. `discord.com/api/v10` over TLS only. No plaintext secrets in logs (env access-only). |
| V12 Files & Resources | no | No file uploads. |
| V13 API | yes | `/api/discord/interactions` is a public endpoint that MUST enforce signature verification. `middleware.js:42` needs the new route added to the `PUBLIC_ROUTES` allowlist — **the route authenticates itself via signature, not via DashClaw API key.** Same treatment as `/api/telegram/webhook` (line 41). |

### Known Threat Patterns for Next.js + Discord bot stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Signature forgery (fake interaction posts) | Spoofing | Ed25519 verify over raw body bytes. Return 401 on mismatch (critical for Discord's own security sweeps). |
| Signature timing leak | Information Disclosure | Native `crypto.verify` / tweetnacl are constant-time. |
| Replay attacks (old signed payload resent) | Tampering | Discord's timestamp is in the signed data; reject requests where `abs(now - timestamp) > 5 * 60` seconds. **Not currently in the Telegram route — add to Discord route, defensive.** |
| Sender impersonation (different Discord user spoofs as admin) | Spoofing | `body.user.id === DISCORD_APPROVER_USER_ID` check AFTER signature verify passes. |
| Race: Telegram approves + Discord denies simultaneously | Tampering | Repository `recordApproval` atomic `UPDATE WHERE status='pending_approval'`. Second caller returns null; route shows "resolved by another channel." |
| Double-tap (user taps Approve twice) | N/A | Same atomic guard. Second invocation returns null. |
| Denial-of-service via malformed signed payloads | DoS | Signature verify is the first thing; bad sig = cheap 401. Malformed payloads die at `JSON.parse`. |
| Action ID enumeration | Information Disclosure | `custom_id` is embedded in the message the bot sent; only admins see the DM. Action IDs are unguessable (UUIDs). Still — don't return action details to unverified senders. |
| Secret leakage via logs | Information Disclosure | Never log `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, or raw signature headers. Telegram route log discipline at `app/api/telegram/webhook/route.js:33,49` (logs `.message` only) — mirror for Discord. |
| CSP blocks Discord CDN | N/A | Not relevant — the Discord route is server-side fetch; no browser assets loaded from Discord. `next.config.js` CSP `connect-src` is for client XHR, doesn't affect server fetch. |

## Telegram → Discord Porting Map

File-level porting map for Plan 02-02. Each row is a concrete change, not a vague "port X."

| Telegram file (reference) | Discord file (new/modified) | Port action |
|--------------------------|-----------------------------|-------------|
| `app/api/telegram/webhook/route.js` (188 lines) | `app/api/discord/interactions/route.js` (NEW, ~200 lines) | Full copy-and-adapt. Swap: HMAC timing-safe → Ed25519; `answerCallback` → response type 6; `editMessage` → PATCH `@original`; `TELEGRAM_BOT_TOKEN` → `DISCORD_BOT_TOKEN`; `TELEGRAM_ADMIN_CHAT_ID` → `DISCORD_APPROVER_USER_ID`; chat_id/message_id from body → appId + interaction.token from body. KEEP: `CALLBACK_DATA_RE`, `getActionSummary`/`recordApproval` repository calls, 401 discipline, idempotency checks. |
| `app/lib/telegramApprovals.js` (79 lines) | `app/lib/discordApprovals.js` (NEW, ~110 lines) | Copy. Swap: `sendMessage` → `POST /channels/{dm_id}/messages` preceded by `POST /users/@me/channels` to get dm_id; `buildMessage` text-based → `buildEmbedPayload` with embed + components; `isEnabled` env checks renamed. |
| `app/api/actions/route.js` line 327 `after(() => fireTelegramApproval(...))` | Same file, add `after(() => fireDiscordApproval(...))` line 327.5 | One new line. Import `fireDiscordApproval` at top. **This is the only pre-existing file that needs modification for Plan 02-02's approval emit.** |
| `__tests__/unit/telegram-webhook-route.test.js` (448 lines, 16 test cases) | `__tests__/unit/discord-interactions-route.test.js` (NEW, ~400 lines) | Copy structure. Adjust signature-generation test helper to sign with a test ed25519 keypair + produce the right X-Signature-Ed25519 / X-Signature-Timestamp headers. All 6 acceptance-criterion categories (auth, callback_data, approve, deny, idempotency, misconfig) map 1:1. |
| `__tests__/unit/telegram-approvals.test.js` | `__tests__/unit/discord-approvals.test.js` (NEW) | Copy structure. Mock fetch per-URL path. |
| `scripts/telegram-setup-wizard.mjs` (interactive wizard) | `scripts/discord-register-bot.mjs` (OPTIONAL, NEW) | Claude's discretion. Telegram has it — Discord nice-to-have. MVP: manual instructions in `/guides/claude-code` are enough for CCI-01. |
| `scripts/telegram-register-webhook.mjs` | N/A | No analog — Discord "register interactions endpoint URL" is a Developer Portal UI action, not an API call. |
| `scripts/telegram-verify-loop.mjs` | `scripts/discord-verify-loop.mjs` (OPTIONAL, NEW) | Copy. Replaces Telegram URL polling with Discord DM send + DB status poll. |
| `middleware.js` line 41 (`/api/telegram/webhook` in PUBLIC_ROUTES) | `middleware.js` add `/api/discord/interactions` to same array | One-line addition. The route authenticates itself via Ed25519 signature. |
| `.env.example` lines 155-160 (Telegram block) | `.env.example` add Discord block below Telegram | 5 new lines: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPROVER_USER_ID`, `DISCORD_APPROVER_ORG_ID`, `# DASHCLAW_ALERTS_DISCORD=false`. |
| CLAUDE.md SDK Documentation Checklist (6 files) | Run `npm run openapi:generate`, `npm run api:inventory:generate`; update `app/docs/page.js`, `sdk/README.md`, `sdk-python/README.md`, `docs/sdk-parity.md`, `PROJECT_DETAILS.md` — mention new `/api/discord/interactions` route | CLAUDE.md MEMORY dictates this. Pre-commit hook partially covers (api-inventory, openapi); manual for docs page + READMEs + sdk-parity + PROJECT_DETAILS. |

## Landmines (project-specific)

Beyond the Discord-specific pitfalls above, these are DashClaw-specific traps the planner MUST surface.

### L1 — Livingcode auto-regeneration will flag "you edited generated files" if you check them in without rebuilding

- **Trigger:** Any change under `app/api/`, `app/lib/`, `schema/schema.js`, `middleware.js`, or `livingcode/`.
- **What regenerates:** `app/lib/doctor/generated/*`, `public/livingcode/index.html`, `public/downloads/dashclaw-platform-intelligence*`, the installed `dashclaw-platform-intelligence` global skill.
- **Rule:** Never edit those files by hand. Pre-commit hook runs `npm run livingcode:refresh`. Let it regenerate — commit the delta.
- **Plan task implication:** Add a verification step "run `npm run livingcode:refresh` after route lands; commit all modified files under `app/lib/doctor/generated/`."

### L2 — Route SQL guardrail

- **Trigger:** New route file under `app/api/` + any `sql\`...\`` or `sql.query(...)` usage.
- **Gate:** `npm run route-sql:check` compares against `docs/route-sql-baseline.json`.
- **Rule:** New Discord route MUST use `recordApproval` / `getActionSummary` from `app/lib/repositories/actions.repository.js`. No new entry in the baseline.
- **Plan task implication:** Call it out in the Discord route plan step; add verification `npm run route-sql:check` as a gate.

### L3 — SDK Documentation Checklist (6 files)

Per project MEMORY.md: when adding any new public API route, update:
1. `app/docs/page.js` (website docs, navItems + MethodEntry)
2. `sdk/README.md` (Node SDK README — served via `/api/docs/raw` for Copy-as-Markdown)
3. `sdk-python/README.md`
4. `docs/sdk-parity.md`
5. `docs/api-inventory.md` (auto-regenerated; verify with `npm run api:inventory:check`)
6. `PROJECT_DETAILS.md`

**However:** `/api/discord/interactions` is a **webhook endpoint**, not an SDK-exposed method. Telegram's webhook is NOT in the SDK either. The planner should make a judgment call: if the webhook is "private API called by Discord, not by SDK consumers," skip SDK README updates and only update `app/docs/page.js` (optional), `PROJECT_DETAILS.md` (routes list), and let the api-inventory auto-regeneration handle the rest. Mirror the Telegram approach — search `sdk/README.md` for "telegram" → absent → same treatment.

- **Plan task implication:** Per-file audit: is this route SDK-exposed (yes/no)? For Discord interactions: NO. Update only PROJECT_DETAILS.md routes list + let auto-regeneration handle api-inventory.

### L4 — DOMPurify transitive pin via workspace override

- Per MEMORY.md, the package.json has an override forcing `dompurify: ^3.4.0` because `html2pdf.js` transitively pins 3.3.3.
- **Relevance to Phase 2:** Zero — Discord route does no HTML sanitization, and the `/my-agent` page renders trusted narrative text only. This is flagged here to prevent surprise if anyone touches package.json for a different reason.

### L5 — Windows/WSL line endings in `.claude/settings.json`

See Pitfall 6 above. **Plan task for CCI-01 walkthrough MUST specify:** if Wes edits settings.json by hand on Windows, use VSCode (saves LF) or use `npm run hooks:install` (Node writes LF). PowerShell `echo` and Notepad save CRLF.

### L6 — `DASHCLAW_BASE_URL` process-env override

See Pitfall 7. Pre-existing trap (not introduced by Phase 2). Optional Phase 2 inclusion of todo-001 (hook health-check at startup) defuses this for future walkthroughs.

### L7 — `next/server` `after()` is required for fire-and-forget on Vercel

Any outbound work (Discord DM, Telegram DM, webhook fanout) that doesn't block the response MUST be wrapped in `after(() => ...)`. Not `.catch(() => {})` alone — that's just swallowing errors, not deferring work. Vercel freezes the lambda after the response returns. `after()` is imported from `next/server`. Already used at `app/api/actions/route.js:4,321,323,327,328`.

### L8 — Pre-commit hook may fail if `npm test` isn't green

Scripts in `scripts/run-pre-commit-checks.mjs` (per package.json) run on every commit. Expect the planner's incremental work to pass tests per-wave — keep the Wave 0 test creation step at the top of each plan so subsequent task commits can run cleanly.

### L9 — CSP `connect-src` does NOT include `discord.com`

`next.config.js` line 29 shows `connect-src 'self' https://*.neon.tech https://github.com https://accounts.google.com https://checkout.stripe.com https://billing.stripe.com`. **This does NOT need to change for Phase 2.** Our code calls `discord.com/api/v10` from the SERVER, not the browser — CSP is a browser-side policy. If the `/my-agent` page ever directly talks to Discord from the browser (don't — no reason to), THEN we'd extend `connect-src`.

### L10 — `app/components/ui/Skeleton.jsx` not `Skeleton.js`

Noticed during this research: `app/components/ui/Skeleton.jsx` (capital JSX extension) vs the other `.js` primitives. The `/activity` page imports `import { Skeleton } from '../components/ui/Skeleton';` which works via Next's file resolution. `/my-agent` should use the same import style.

## What the Planner Should NOT Research Further

**These are locked by SPEC + CONTEXT. The planner must honor them, not re-explore.**

1. **Discord delivery mechanism** — Bot + webhook interactions, Telegram parity. Gateway websocket and deep-link options are explicitly rejected at spec-phase (SPEC §Constraints, §Out-of-scope). Don't re-open.
2. **Setup UX** — ENV-only, no UI flow. D-02, SPEC §Constraints confirm.
3. **Multi-org support** — Single-org (D-03). Defer to later phase.
4. **DM vs server channel** — DM only (D-04).
5. **Embed field count** — 4 fields (D-05).
6. **Message-edit-on-resolve** — In place, strip buttons (D-06).
7. **Custom_id format** — `ap:act_...` / `dn:act_...` (D-07).
8. **`/my-agent` layout** — Narrative hero + list (D-08).
9. **`/my-agent` scope default** — Today first, week toggle (D-09).
10. **`/my-agent` empty state** — Install-prompt hero (D-10).
11. **Denial prominence** — Pinned at top (D-11).
12. **Realtime source** — Existing `useRealtime` hook (D-12).
13. **`/activity` grouping** — Client-side, no schema change (D-13).
14. **Agent filter** — Must respect (D-14).
15. **README structure** — Claude Code lead, existing content below (D-15, D-16, D-17).
16. **Guide page ownership** — `/guides/claude-code` owns the full beachhead deep-dive (D-18).
17. **Homepage draft format** — Copy + outline only; NOT published to `app/page.js` in Phase 2 (D-19, SPEC §Boundaries).
18. **Screencast requirement** — ≤3 minutes, publicly accessible. Hosting = Claude's discretion (D-20).
19. **Phase 3 work** — DOG-02/03/04, MON-01/02, full homepage rewrite, Show HN / tweet / blog. OUT OF SCOPE.
20. **MCP `dashclaw_wait_for_approval` polling interval** — Research concluded current 3s interval fits 10s budget. No tightening needed.

**The planner's job for Phase 2 is to create plans that EXECUTE these decisions, not second-guess them.** Areas legitimately in Claude's discretion (per CONTEXT): Ed25519 library choice (research recommends tweetnacl now — see Open Question 1), screencast platform (research recommends Loom), denial-reason modal (research recommends SKIP), voice-level copy tone on `/my-agent`, optional todo-001/todo-002 inclusion.

## Project Constraints (from CLAUDE.md)

The planner MUST verify these against every plan:

- **Governance Boundary:** DashClaw is a minimal governance runtime, NOT an agent platform. Do not introduce tools that help agents achieve goals (Calendar, CRM, messaging-for-its-own-sake). Discord bot is a governance channel (approval plumbing), NOT an agent communication channel.
- **Tech Stack:** Node ≥20, Next 16 App Router, Postgres (Neon), SDK 2.13.3 / npm 2.11.1.
- **Generated artifacts discipline:** Never hand-edit `app/lib/doctor/generated/`, `public/livingcode/index.html`, `public/downloads/dashclaw-platform-intelligence/*`. Pre-commit hook auto-runs `npm run livingcode:refresh` on matching changes.
- **Route SQL guardrail:** No direct SQL in route files. Use `app/lib/repositories/*.repository.js`. `npm run route-sql:check` enforces.
- **SDK documentation checklist:** When adding any new public API route, update 6 docs surfaces (see L3 above). For webhook-only routes (like Discord interactions), assess if SDK update actually applies — probably not.
- **Design:** Read `.impeccable.md`. Brand orange as signal, not decoration. CSS tokens only, never hardcode hex in JSX (Discord embed `color` field is the ONE permitted exception — it takes an integer).
- **GitHub:** `ucsandman/DashClaw`. User is `Wes Sander`.
- **Context7 MCP:** Use for any library/API docs — prefer over WebSearch.
- **Global git hooks:** ruff + vulture on staged `.py`; won't affect JS/MD commits. If Phase 2 scripts include Python (e.g. `scripts/bug04-validate.py`), they'll be linted.
- **GitNexus:** Run `gitnexus_impact` before editing any modified symbol; run `gitnexus_detect_changes` before committing. For Phase 2, this particularly matters for `app/api/actions/route.js` (one-line addition is low-impact, but verify).

## Sources

### Primary (HIGH confidence)

- **Context7 `/discord/discord-api-docs`** — fetched 2026-04-22. Sections consulted:
  - "Validate Discord Security Request Headers" (Ed25519 verify, X-Signature-Ed25519, X-Signature-Timestamp, tweetnacl example, raw body requirement, 401 discipline)
  - "Respond to Interaction" (3-second window)
  - "Handle Message Interaction Response" (type: 3 MESSAGE_COMPONENT body shape)
  - "Interaction Callback Type" (type 6 DEFERRED_UPDATE_MESSAGE, type 7 UPDATE_MESSAGE)
  - "Edit Original Interaction Response" (PATCH `/webhooks/{app}/{token}/messages/@original`, 15-min token TTL)
  - "Message Example with Action Row" (button structure, styles 1-5)
  - "POST /users/@me/channels" (DM channel creation)
  - "POST /channels/{channel.id}/messages" (message send with embeds + components)
  - "Setting Up an Endpoint > Validating Security Request Headers" (Discord's automated security scans reject endpoints that don't 401 on bad signatures)
- **CLAUDE.md (project)** — verified inline against `package.json` `"version": "2.13.3"`, Next.js 16 declaration, engines node >=20
- **`app/api/telegram/webhook/route.js`** — read in full this session (188 lines). All helpers, all response patterns, timing-safe compare, CALLBACK_DATA_RE, buildResolvedText.
- **`app/lib/telegramApprovals.js`** — read in full (79 lines).
- **`app/lib/repositories/actions.repository.js` lines 1-59** — read this session. Confirmed `getActionSummary`, `recordApproval` atomic UPDATE pattern.
- **`__tests__/unit/telegram-webhook-route.test.js`** — read in full (448 lines). Mirror for Discord tests.
- **`app/activity/page.js`** — read in full this session. Confirmed client component, SSE via `useRealtime`, pulls from `/api/actions`+`/api/guard`+`/api/activity`.
- **`app/approve/page.js`** — read in full. Mobile-first PWA pattern; useful reference for `/my-agent` but NOT the direct template (different purpose).
- **`app/approvals/page.jsx`** — read head 50 lines. Desktop pattern.
- **`app/guides/claude-code/page.js`** — read in full (186 lines). Current structure to extend.
- **`app/hooks/useRealtime.js`** — read in full. Singleton EventSource, event list.
- **`app/components/ui/EmptyState.js`** — read. 4-prop component (`icon`, `title`, `description`, `action`).
- **`mcp-server/lib/tools.js:225-269`** — read. Confirmed polling interval default 3s, timeout 300s, distinguishes denied vs timed-out.
- **`hooks/dashclaw_pretool.py:540-580`** — read. Confirmed BUG-04 fix shipped this session (fail closed by default).
- **`next.config.js` CSP block** — verified `connect-src` is browser-side only; server-side fetch to discord.com unaffected.
- **`middleware.js:27-42`** — read. Confirmed PUBLIC_ROUTES pattern; new Discord route needs to be added here.
- **`.env.example` lines 155-160** — read. Telegram env var block shape.
- **`README.md` first 80 lines** — read. Current top-of-file layout for D-15 rewrite.
- **`.impeccable.md`** — read in full (72 lines). Tokens, brand orange discipline, anti-references.
- **`.planning/codebase/CONVENTIONS.md` first 40 lines** — read. Naming patterns.
- **`.planning/codebase/INTEGRATIONS.md` lines 50-71** — read. Telegram integration spec, Discord current state (webhook-only).
- **`package.json` scripts block (first 80 lines)** — read. All commands verified.
- **`.planning/config.json`** — read. `workflow.nyquist_validation: true` → Validation Architecture section included.

### Secondary (MEDIUM confidence)

- `npm view tweetnacl version` → 1.0.3 (published 2020-01 per registry). Old but stable; Discord docs still reference it.
- `npm view @noble/ed25519 version` → 3.1.0 (current).
- `npm view discord-interactions version` → 4.4.0 (current).
- `node -e "crypto.generateKeyPairSync('ed25519')"` → succeeds on this machine's Node 22.18.0. Native ed25519 available; raw-key-import format needs verification (see A1).

### Tertiary (LOW confidence)

- General Discord rate limit context (50 req/s per bot globally) — common knowledge from prior ecosystem work. Discord's own docs don't publish a clean table; if Phase 2 approvals exceed 1/min (unlikely), revisit.
- Loom "anyone with link" defaults — based on Loom UX as of late 2024. Flagged in Pitfall 8; mitigation is trivial (test in incognito).

## Metadata

**Confidence breakdown:**

- Discord interactions API shape + signature verification: HIGH — Context7 + official docs provided verbatim examples
- Telegram → Discord port map: HIGH — direct code inspection of every referenced file this session
- `/activity` day-grouping + `/my-agent` narrative: HIGH — existing patterns in `/activity`, `/approve`, UI kit all verified
- Ed25519 library choice: MEDIUM — recommend tweetnacl (matches Discord's example); native crypto path has an unverified raw-key format detail (A1, Open Q 1)
- Screencast hosting: MEDIUM — Loom recommended; planner can swap for YouTube Unlisted trivially
- CCI-01 walkthrough wall-clock ≤5:00: MEDIUM — not measured yet; claim in SPEC but execution is the proof
- Validation architecture coverage: HIGH — test patterns directly mirror existing Telegram tests

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — Discord API + Next.js both stable; `ctx7` refetch recommended if past this date)

## RESEARCH COMPLETE

**Phase:** 2 — Claude Code Beachhead
**Confidence:** HIGH on structure, patterns, porting map, and validation; MEDIUM on native-crypto vs tweetnacl choice and screencast hosting

### Key Findings

- **Telegram webhook is a 1:1 structural blueprint.** Every file has a direct Discord analog; the port is mechanical (swap auth mechanism, swap ack mechanism, swap message-edit mechanism; keep repository calls, CALLBACK_DATA_RE, 401 discipline, idempotency).
- **Ed25519 verification has two approved paths: tweetnacl (Discord's own example, zero doubt) and Node native `crypto.verify` (zero deps, some uncertainty on raw-key format).** Research recommends **tweetnacl** as the Phase 2 default to eliminate A1's risk. Native crypto can be a future optimization PR.
- **Zero schema changes needed for CCI-04.** `/activity` day-grouping is a `useMemo` layer; `/my-agent` reads only existing endpoints. No new tables, no migrations.
- **`/api/discord/interactions` must be added to `middleware.js:42` PUBLIC_ROUTES** (mirror of Telegram at line 41). Route authenticates itself via Ed25519 signature.
- **Discord's security sweeps will remove the interaction URL if any bad-signature response is not 401.** Discipline-critical — same pattern as Telegram's 401-on-bad-chat-id.
- **PATCH `/webhooks/{app}/{interaction.token}/messages/@original`, not the bot's message endpoint.** Interaction tokens are the right handle for editing in-place after DEFERRED_UPDATE_MESSAGE ack; 15-minute TTL is plenty.
- **Use `after()` in `next/server` for outbound work.** Vercel freezes the lambda after the response; without `after()`, `fireDiscordApproval` silently doesn't send.
- **Windows/WSL CRLF in `.claude/settings.json` is a real CCI-01 footgun.** Plan must document "use VSCode or `npm run hooks:install`, not Notepad."
- **Livingcode pre-commit regeneration will modify `app/lib/doctor/generated/` automatically when the new route lands.** Don't fight it; commit the delta.

### File Created

`.planning/phases/02-claude-code-beachhead/02-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Discord API shape + signature verification | HIGH | Context7 provided Discord's own canonical examples; multiple docs sections cross-referenced |
| Telegram → Discord porting map | HIGH | Every file read this session; exact file:line citations possible |
| `/activity` + `/my-agent` UI patterns | HIGH | Existing code is the pattern; `useRealtime`, `useAgentFilter`, `EmptyState`, `Card`, `Skeleton` all verified |
| Validation architecture | HIGH | Direct mirror of `telegram-webhook-route.test.js`; gates (openapi, api-inventory, route-sql, docs) all exist |
| Ed25519 library choice | MEDIUM | tweetnacl is the safe, spec-matching path; native crypto is seductive but has unverified raw-key-format detail |
| Screencast hosting | MEDIUM | Loom recommended for speed; YouTube Unlisted trivially swappable; either satisfies SPEC acceptance |
| CCI-01 timing ≤5:00 | MEDIUM | Not empirically measured yet — the walkthrough recording IS the measurement |
| Pitfalls catalog completeness | MEDIUM | 10 pitfalls catalogued; more will surface in execution. The named ones are the highest-probability traps. |

### Open Questions (for planner to resolve)

1. **Pick tweetnacl or native crypto for Ed25519 verify?** Research recommends tweetnacl (A1 risk mitigated). Decision during planning, 2-line diff either way.
2. **Screencast platform: Loom or YouTube Unlisted?** Research recommends Loom; operator preference wins. One-line README edit.
3. **Include optional scripts `scripts/discord-register-bot.mjs` + `scripts/discord-verify-loop.mjs` in Plan 02-02?** Telegram has them; useful for CCI-01 debugging; cost is ~100 lines and one extra wave.
4. **Include optional todo-001 (hook demo-mode warning) and todo-002 (rename "Demo Production Guard") in Phase 2?** Surfaced during Phase 2 CONTEXT-gathering. Low-cost; prevents future walkthrough confusion.
5. **`/activity` "0/0/0 empty day" acceptance interpretation** — see Open Question 4 above.
6. **Do we DM-only (Phase 2 scope) or prep for future server channel?** CONTEXT locks DM-only. Research assumes no server-channel speculation in the code shape.

### Ready for Planning

Research complete. Planner can author PLAN.md files for 02-02 (Discord approval flow) and 02-03 (timeline + docs + walkthrough) against this research.
