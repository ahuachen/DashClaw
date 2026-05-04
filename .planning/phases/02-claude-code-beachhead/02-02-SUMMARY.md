---
phase: 02-claude-code-beachhead
plan: 02
subsystem: governance-channels
tags: [discord, ed25519, webhook, approval, telegram-parity, tweetnacl, governance-channel]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: actions.repository.js (getActionSummary + recordApproval with atomic status guard)
  - phase: 01.5-bug-triage
    provides: hook orphan-log + fail-closed policy (approval flow can run with hook in fail-closed mode)
provides:
  - Discord approval bridge parity with Telegram (inbound interactions webhook + outbound DM emitter)
  - Ed25519 signature verification utility usable by other webhook integrations
  - `fireDiscordApproval` fire-and-forget pattern mirroring `fireTelegramApproval`
  - Public Discord interactions endpoint authenticated entirely in-route (no API key)
  - Atomic cross-channel approval race handling (Telegram ↔ Discord on same action)
affects: [02-01, 02-03, CCI-01, CCI-04, /my-agent, mobile-first-approval]

# Tech tracking
tech-stack:
  added:
    - tweetnacl@1.0.3 (Ed25519 — Discord's canonical verify library)
  patterns:
    - "Raw-body signature verify BEFORE JSON.parse (Discord webhook pattern — request.text() then nacl verify then JSON.parse)"
    - "Public route + in-route crypto auth (mirrors Telegram /api/telegram/webhook via PUBLIC_ROUTES allowlist)"
    - "Fire-and-forget approval DM emitter with per-process DM channel cache + 403 invalidation"
    - "Deferred interaction ack (type 6) + PATCH @original for DB-work-after-ack flow within the 3-second Discord window"
    - "Uint8Array.from(Buffer.from(...)) for cross-realm tweetnacl inputs (jsdom test environment compat)"

key-files:
  created:
    - app/api/discord/interactions/route.js
    - app/lib/discordApprovals.js
    - __tests__/unit/discord-interactions-route.test.js
    - __tests__/unit/discord-approvals.test.js
    - __tests__/unit/discord-embed-payload.test.js
  modified:
    - app/api/actions/route.js
    - middleware.js
    - .env.example
    - PROJECT_DETAILS.md
    - __tests__/unit/mcp-tools.test.js
    - package.json (tweetnacl dep)
    - package-lock.json
    - docs/api-inventory.json
    - docs/api-inventory.md
    - docs/openapi/critical-stable.openapi.json
    - app/lib/doctor/generated/** (livingcode auto-regenerated)
    - public/livingcode/** (livingcode auto-regenerated)
    - public/downloads/dashclaw-platform-intelligence/** (livingcode auto-regenerated)
    - mcp-server/lib/routes-inventory.generated.json (livingcode auto-regenerated)

key-decisions:
  - "Use tweetnacl@1.0.3 (not native crypto) — Discord's canonical Ed25519 path, avoids raw-key-format ambiguity"
  - "PUBLIC_ROUTES allowlist for /api/discord/interactions — route authenticates itself via Ed25519; API-key auth would break Discord's callback model"
  - "Sender-identity mismatch collapses to 401 (not 403) — mirrors Telegram discipline, avoids leaking 'signature correct but user wrong'"
  - "5-min TIMESTAMP_SKEW_SECONDS anti-replay window — matches Discord's signed timestamp semantics"
  - "Response type 6 (DEFERRED_UPDATE_MESSAGE) acks silently within 3s; DB + PATCH @original run in after()"
  - "custom_id strict regex /^(ap|dn):(act_[a-z0-9_-]{1,57})$/ — bounds attack surface at regex entry"
  - "sdk-parity.md intentionally unchanged — webhook is consumed by Discord, not SDK callers; mirrors Telegram's absence from the parity matrix"

patterns-established:
  - "Governance-channel webhook pattern: PUBLIC_ROUTES + raw-body crypto verify + user_id allowlist + atomic recordApproval + edit-in-place feedback"
  - "Cross-realm Uint8Array compatibility: wrap all tweetnacl inputs in Uint8Array.from(Buffer.from(...)) so jsdom tests behave identically to Node prod"

requirements-completed: [CCI-03]

# Metrics
duration: 8min
completed: 2026-04-22
---

# Phase 02 Plan 02: Discord Approval Bridge Summary

**Discord DM approval bridge using tweetnacl Ed25519 verify + deferred interaction ack + PATCH @original, mirroring Telegram 1:1 via the shared `recordApproval` repository with atomic cross-channel race handling.**

## Performance

- **Duration:** ~8 min execution (plan authoring, research, and revision 1 tweetnacl decision excluded)
- **Started:** 2026-04-22T20:50:53Z
- **Completed:** 2026-04-22T20:58:47Z
- **Tasks:** 3 (Wave 0 RED tests + GREEN implementation + full-suite regression gate)
- **Files modified:** 16 (10 hand-edited + 6 livingcode-auto-regenerated)

## Accomplishments

- `/api/discord/interactions` ships with Ed25519 verify on raw body (T-02-02-01), 5-min anti-replay window (T-02-02-02), strict custom_id regex (T-02-02-03), sender-identity allowlist with 401 discipline (T-02-02-04), and idempotent race-handling via repository atomic UPDATE (T-02-02-07 inherited)
- `fireDiscordApproval` fire-and-forget DM emitter with per-process DM channel cache and 403-triggered cache invalidation (handles "user toggled DM permissions" case)
- Brand-orange embed (0xf97316, the ONE in-code hex permitted per `.impeccable.md`) with 4 fields, 200-char goal truncation, and Approve/Deny buttons
- One-line wiring into `app/api/actions/route.js` beside the existing Telegram emit — zero behavior change to response path, both emitters silent-no-op when env unset
- `middleware.js` PUBLIC_ROUTES allowlist entry parallel to `/api/telegram/webhook`
- Full STRIDE threat register (T-02-02-01..07) mitigated in code and asserted by tests; 11 + 9 + 6 = 26 Discord unit tests all green

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — Scaffold failing Discord tests (RED)** — `5486e45e` (test)
   - Pre-existing from prior executor session; confirmed RED at the time (production modules didn't exist)
2. **Task 2: Implement `/api/discord/interactions` route + `fireDiscordApproval` emitter + wiring (GREEN)** — `1fdf0199` (feat)
   - Inline Rule 1 fix folded into this commit: jsdom Uint8Array cross-realm fix in both test helper and route's verify function
3. **Task 3: Full-suite regression gate + static guardrails** — no code changes (verification only)

**Plan metadata:** pending (this SUMMARY.md + STATE.md + ROADMAP.md update will be the final commit)

## Files Created/Modified

### Created
- `app/api/discord/interactions/route.js` — PING handshake, Ed25519 verify, MESSAGE_COMPONENT approve/deny handler, `resolveApproval` + `editOriginal` + `buildResolvedText` helpers
- `app/lib/discordApprovals.js` — `fireDiscordApproval` + `buildEmbedPayload` + internal `isEnabled` / `openDmChannel` / `sendApprovalMessage`
- `__tests__/unit/discord-interactions-route.test.js` — 11 cases: 4 auth, 1 PING, 1 callback_data, 1 approve, 1 deny, 2 idempotency, 1 misconfig (all PASS)
- `__tests__/unit/discord-approvals.test.js` — 9 cases: 4 isEnabled gate, 2 fetch shape, 3 fire-and-forget (all PASS)
- `__tests__/unit/discord-embed-payload.test.js` — 6 cases: 4 fields, 200-char truncation, brand color, buttons, custom_id shape, footer (all PASS)

### Modified
- `app/api/actions/route.js` — one import + one `after()` line beside existing Telegram emit
- `middleware.js` — one line added to `PUBLIC_ROUTES` array
- `.env.example` — 5 DISCORD_* vars in a block mirroring the Telegram block (was pre-populated by user; block matched plan spec exactly, no duplicate added)
- `PROJECT_DETAILS.md` — one new row in routes-list section
- `__tests__/unit/mcp-tools.test.js` — one new test case under `dashclaw_wait_for_approval` asserting ≤2s resolution after status flip (SPEC CCI-03 bullet 3)
- `package.json` — tweetnacl@^1.0.3 in dependencies
- `docs/api-inventory.{json,md}` — regenerated, total routes 226 → 227
- Livingcode-auto-regenerated artifacts: `app/lib/doctor/generated/shape.json`, `checks-from-shape.mjs`, `public/livingcode/index.html`, `mcp-server/lib/routes-inventory.generated.json`, `public/downloads/dashclaw-platform-intelligence*`

## STRIDE Mitigation Verification

| Threat ID | Category | Mitigation site | Proof |
|-----------|----------|-----------------|-------|
| T-02-02-01 | Spoofing | `verifyDiscordSignature` on raw body before JSON.parse | `discord-interactions-route.test.js` tests 1–3 (missing sig / missing ts / bad sig → 401) |
| T-02-02-02 | Tampering (replay) | `TIMESTAMP_SKEW_SECONDS = 5 * 60` inside `verifyDiscordSignature` | Code: `app/api/discord/interactions/route.js:24,43` |
| T-02-02-03 | Spoofing (custom_id injection) | `CALLBACK_DATA_RE = /^(ap\|dn):(act_[a-z0-9_-]{1,57})$/` | `discord-interactions-route.test.js` callback_data validation test (malformed custom_id → type 6, no repo call) |
| T-02-02-04 | Spoofing (impersonation) | `body.user.id === DISCORD_APPROVER_USER_ID` gate, 401 on mismatch | `discord-interactions-route.test.js` auth test 4 |
| T-02-02-05 | Information Disclosure | `console.warn(err.message)` only, never headers/token | Code review: `app/api/discord/interactions/route.js:97,126`; `app/lib/discordApprovals.js:87,115,137` |
| T-02-02-06 | Denial of Service | Accepted (signature verify is first op, Vercel + Discord rate limits cap damage) | Documented in plan threat model |
| T-02-02-07 | Tampering (cross-channel race) | Repository atomic `UPDATE WHERE status='pending_approval' RETURNING *` returns null on race | `discord-interactions-route.test.js` idempotency test ("resolved by another channel") |

## Decisions Made

- **tweetnacl@1.0.3 over Node native crypto** — Discord's own docs and tweetnacl are the canonical pair for Interactions webhooks. Native crypto `verify('ed25519', ...)` works but requires raw-key format handling we'd have to rediscover; tweetnacl accepts the portal's hex public key directly after a single `Buffer.from(hex, 'hex')` coercion.
- **5-minute anti-replay window** — matches the signed-timestamp contract Discord's docs recommend; wider than necessary but tolerates NTP drift on low-budget self-host deployments.
- **PATCH @original instead of inline response content** — keeps the 3-second ack strict (type 6 silent ack) while giving users visible feedback on their DM. Matches Telegram's `editMessageText` pattern exactly.
- **Do NOT add Discord row to `docs/sdk-parity.md`** — webhook is consumed by Discord the service, not by SDK callers. Mirrors Telegram's absence (audited: 0 matches in sdk-parity.md for both "discord" and "telegram").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom Uint8Array cross-realm failure in tweetnacl inputs**
- **Found during:** Task 2 verification (running the Wave 0 tests against the Task 2 implementation)
- **Issue:** Under vitest+jsdom, `Buffer.from(...)` and `TextEncoder().encode(...)` outputs are NOT `instanceof Uint8Array` because jsdom installs its own realm's `Uint8Array` constructor. tweetnacl's `checkArrayTypes` does `arg instanceof Uint8Array` strictly, so every test that invoked `nacl.sign.detached(...)` (test helper) or `nacl.sign.detached.verify(...)` (route code) threw `TypeError: unexpected type, use Uint8Array`. The route's silent `try { ... } catch { return false }` turned this into "every signed request returns 401" — which masked the root cause and made 10 of 11 interaction-route tests fail. A prior session had attempted a partial fix (`new Uint8Array(secretKey)`, `TextEncoder`) but that still failed in the jsdom realm.
- **Fix:** Wrapped all tweetnacl inputs in `Uint8Array.from(Buffer.from(...))` to force the current realm's `Uint8Array` constructor. Identical behavior in Node prod (Buffer is already `instanceof Uint8Array` there) and jsdom tests (Uint8Array.from allocates in the correct realm).
- **Files modified:** `app/api/discord/interactions/route.js` (`verifyDiscordSignature`), `__tests__/unit/discord-interactions-route.test.js` (`signDiscord` helper, `signedRequest` skipSig guard)
- **Verification:** 26/26 Discord tests green; 1675/1680 full suite pass (5 skipped pre-existing).
- **Committed in:** `1fdf0199` (folded into Task 2 commit — this was the GREEN-state enabler, not a separate change)

### Pre-existing deltas (not deviations)
- `.env.example` Discord block was pre-populated by the user before this executor run; verified it matched the plan's specified variable names exactly (DISCORD_BOT_TOKEN, DISCORD_PUBLIC_KEY, DISCORD_APPROVER_USER_ID, DISCORD_APPROVER_ORG_ID, DASHCLAW_ALERTS_DISCORD) and left it as-is.
- `middleware.js` already had `/api/discord/interactions` in PUBLIC_ROUTES (committed in a prior session). Confirmed it was in the correct position directly beneath `/api/telegram/webhook`.
- Task 1 (Wave 0 test scaffolding) was pre-committed as `5486e45e` in a prior session, including `tweetnacl@1.0.3` install and the MCP 2s test case. This executor started from that baseline.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug: jsdom Uint8Array)
**Impact on plan:** Fix was necessary for GREEN state and essential for tests to be meaningful in CI. No scope creep. Zero new behavior in production (prod already used Buffer, which works in Node).

## Issues Encountered

- **Pre-existing test-helper bug masked by silent catch:** The route's `verifyDiscordSignature` wrapped nacl.verify in `try { ... } catch { return false }` specifically so untrusted inputs couldn't crash the route — a correct production stance. But in the test environment, the catch silently swallowed the jsdom Uint8Array mismatch, producing 401 for every test and making the failure appear to be an auth-logic bug rather than a test-env bug. Fixed by using `Uint8Array.from(Buffer.from(...))` which works identically in both realms.

## User Setup Required

External services require manual configuration by the operator. These steps are not gating this plan but are needed before the Discord bridge actually delivers approval DMs (they are tracked under plan 02-01's walkthrough checkpoint):

1. **Create a Discord application** at https://discord.com/developers/applications → enable Bot, invite to a mutual test server with no privileged intents.
2. **Set Interactions Endpoint URL** to `https://<deployment>/api/discord/interactions` in the Developer Portal → General Information. Discord will issue a PING handshake against this URL; the route MUST return `{type: 1}` for Discord to accept it (asserted by test `returns {type: 1} (PONG) for a signed type-1 PING`).
3. **Set the 5 env vars** from `.env.example` Discord block:
   - `DISCORD_BOT_TOKEN` (from Bot → Reset Token)
   - `DISCORD_PUBLIC_KEY` (from General Information, 64-char hex)
   - `DISCORD_APPROVER_USER_ID` (numeric; Developer Mode → Copy User ID)
   - `DISCORD_APPROVER_ORG_ID` (same value as TELEGRAM_APPROVER_ORG_ID in single-admin setups)
   - `DASHCLAW_ALERTS_DISCORD=false` (only as explicit kill-switch; omit to enable)

## Next Phase Readiness

- **Plan 02-03 (CCI-04 `/my-agent` denials rendering)**: ready — `recordApproval` now produces `approved_by=discord:<user_id>` rows alongside `telegram:<id>` rows, and `/my-agent` can distinguish channel origins without changes to the denial-rendering shape.
- **Plan 02-01 (CCI-01 walkthrough + manual smoke)**: ready — the walkthrough GIF can now capture a real Discord DM → button tap → status flip cycle on a DashClaw instance with the 5 env vars set.
- **Blocker for operator**: manual Developer Portal registration (3-step flow above) must happen per-instance. No automation is possible — Discord does not expose bot-creation APIs.

## Self-Check: PASSED

- **Files:** FOUND app/api/discord/interactions/route.js, FOUND app/lib/discordApprovals.js, FOUND all 3 new test files
- **Commits:** FOUND 5486e45e (Task 1), FOUND 1fdf0199 (Task 2)
- **Gates:** route-sql:check PASS, openapi:check PASS, api:inventory:check PASS, docs:check PASS, lint PASS, full `npm test` 1675 pass / 5 skip / 0 fail

---
*Phase: 02-claude-code-beachhead*
*Completed: 2026-04-22*
