# Telegram Approval Bridge — v1 Design

**Date:** 2026-04-13
**Status:** Draft for review
**Owner:** Wes (brainstormed w/ Claude)

## Problem

DashClaw gates risky agent actions with `pending_approval` state, but operators today must be at their desk (dashboard), at a terminal (CLI), or have the mobile PWA open to respond. There is no passive, phone-native notification channel.

Effect: agents stall on approvals when the operator isn't actively watching. Result: slower demos, longer feedback loops, and no screencast-worthy "my agent pinged my phone" story to pin to the DashClaw landing page.

## Goal

When a DashClaw action enters `pending_approval`, send an interactive Telegram message with Approve / Reject buttons to a single configured admin chat. Button taps resolve the action via the existing approval code path and edit the message to show the result. The full round-trip runs on Vercel's free tier with no cron, no background workers, and no new DB tables.

## Non-goals (v1)

- Per-agent or per-user approvers — single `TELEGRAM_ADMIN_CHAT_ID`.
- Block notifications (only `pending_approval` emits).
- Outcome pings (completed / failed).
- Daily digests (requires cron; forbidden on free tier).
- Reason-prompt deny flow — one-tap with hardcoded `'Denied via Telegram'`.
- Settings-page UI (env-var + CLI setup only).
- Multi-approver / 2-of-N approval.
- Rich media, GIFs, or PWA deep links in the card.
- Rate-limit or replay-id dedup cache.

## Architecture

Two existing code paths already do most of the work:

- `app/api/actions/route.js:309-314` fires `fireActionAlert('pending_approval', ...)` when an action lands on `pending_approval`.
- `app/api/approvals/[actionId]/route.js` handles inbound approve/deny from dashboard, CLI, and PWA.
- `app/lib/actionAlerts.js` is the sanctioned fan-out home ("Discord (and future adapters)" in the file header).

Two new pieces are added:

1. **`app/lib/telegramApprovals.js`** — fire-and-forget emitter. Exports `fireTelegramApproval(action, sql, orgId)`. Reads env vars, builds the `sendMessage` payload with an inline keyboard, POSTs to the Telegram Bot API with a 1500 ms `AbortSignal.timeout`. Any error is `console.warn`-logged and swallowed.
2. **`app/api/telegram/webhook/route.js`** — inbound webhook. Validates the Telegram secret-token header and the callback sender's chat ID, parses `callback_data`, calls the existing approval code path, edits the original message with `editMessageText`, and acks the callback with `answerCallbackQuery`.

One call site is added in `app/api/actions/route.js` inside the existing `if (createdAction.status === 'pending_approval')` block at line 316, next to `fireWebhooksForApproval`:

```js
if (createdAction.status === 'pending_approval') {
  fireTelegramApproval(createdAction, sql, orgId);              // new
  fireWebhooksForApproval(orgId, 'approval_pending', { ... });  // existing
}
```

It is intentionally placed inside this block (not the `fireActionAlert` branch above it) because `fireActionAlert` fires for both `pending_approval` and `high_risk`, while Telegram v1 only cares about `pending_approval`.

### Data flow

```
agent → /api/actions → (status = pending_approval)
                      ├─ fireActionAlert          (existing, Discord)
                      ├─ fireWebhooksForApproval  (existing, generic webhooks)
                      └─ fireTelegramApproval     (new)
                                │
                                ▼
                       Telegram Bot API
                                │
                          (user taps button on phone)
                                │
                                ▼
           POST /api/telegram/webhook  (new)
                ├─ verify X-Telegram-Bot-Api-Secret-Token
                ├─ verify body.callback_query.from.id === TELEGRAM_ADMIN_CHAT_ID
                ├─ parse callback_data (ap:<id> | dn:<id>)
                ├─ re-read action; if already resolved, short-circuit
                ├─ call approveAction() via repository
                ├─ editMessageText → "✅ Approved" / "❌ Denied"
                └─ answerCallbackQuery (always, to stop the loading spinner)
```

Every edge is a single request / response. No SSE subscribers, no timers, no background workers.

## Configuration

Three env vars (add to `.env.example`):

```bash
# Telegram approval bridge (optional — feature is off if token is blank)
TELEGRAM_BOT_TOKEN=                 # from @BotFather
TELEGRAM_ADMIN_CHAT_ID=             # numeric chat ID allowed to approve
TELEGRAM_WEBHOOK_SECRET=            # random 32+ char string; verifies inbound callbacks
```

Optional kill switch mirroring the Discord toggle:

```bash
DASHCLAW_ALERTS_TELEGRAM=false      # default is on when token present
```

If `TELEGRAM_BOT_TOKEN` is empty, `fireTelegramApproval` returns immediately. Feature is opt-in per deploy.

### One-shot setup script

`scripts/telegram-register-webhook.js`, exposed as `npm run telegram:register -- --url https://your.vercel.app`:

1. Reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` from env.
2. POSTs to `https://api.telegram.org/bot<TOKEN>/setWebhook` with `url=<BASE>/api/telegram/webhook` and `secret_token=<SECRET>`.
3. Prints the Telegram API response for user confirmation.

No new DB tables. No schema migrations. No settings-repo rows.

## Message format

### Initial message (approval pending)

```
⏳ DashClaw approval needed

Agent:   openclaw-telegram
Action:  deploy
Risk:    80 • irreversible

Goal: Push release/v0.4.2 to production

act_1a2b3c4d
```

Inline keyboard below:

```
[ ✅ Approve ]   [ ❌ Reject ]
```

`callback_data` encoding:

- Approve → `ap:<action_id>`
- Reject  → `dn:<action_id>`

Telegram caps `callback_data` at 64 bytes; DashClaw action IDs (`act_` + ~16 chars) fit with room to spare.

### After Approve

```
✅ Approved by Telegram admin — 14:32:07

Agent:   openclaw-telegram
Action:  deploy
Goal: Push release/v0.4.2 to production

act_1a2b3c4d
```

Buttons are stripped via `reply_markup: { inline_keyboard: [] }`.

### After Reject

Same shape, "❌ Denied by Telegram admin — 14:32:07".

### Stale or already-resolved taps

`editMessageText` → "⚠️ Already resolved — status: completed" with buttons stripped. No approval call is made. `answerCallbackQuery` shows a toast: "Already resolved."

### Branding

Message style respects `.impeccable.md`: plain text, no emoji decoration beyond the status glyph, developer-reader first, no marketing prose. Telegram native styling means no CSS tokens to touch.

## Security

### Webhook authentication — two layers

1. **Secret-token header.** When registering the webhook we pass `secret_token = TELEGRAM_WEBHOOK_SECRET`. Telegram echoes it on every inbound POST as `X-Telegram-Bot-Api-Secret-Token`. Handler returns `401` on missing or mismatched values.
2. **Chat-ID allowlist.** We check `body.callback_query.from.id` (numeric, stringified) against `TELEGRAM_ADMIN_CHAT_ID`. Handler returns `403` on mismatch.

### Callback data validation

- Regex: `/^(ap|dn):act_[a-z0-9]{8,32}$/`.
- Unknown prefixes → `200` with an `answerCallbackQuery` toast, no DB writes, no retries from Telegram.

### Fire-and-forget on emit

- `fireTelegramApproval` wraps everything in try/catch.
- 1500 ms fetch timeout via `AbortSignal.timeout`.
- Any error → `console.warn` only. Never throws. Never blocks the `/api/actions` response.

### Idempotency on callback

- Handler re-reads the action from the DB before calling `approveAction`.
- If current status is anything other than `pending_approval`, short-circuits to the "already resolved" path.
- Prevents double-tap or stale-button double-resolution.

### Logging discipline

- Never log `TELEGRAM_BOT_TOKEN` or `TELEGRAM_WEBHOOK_SECRET`.
- Never log the full Telegram request body (contains user IDs and usernames).
- On error: log status code, action_id, and a generic error class.

### Rate limiting

- Not implemented in v1. Telegram rate-limits callbacks to 30 msg/sec per bot. Emit rate is bounded by `pending_approval` frequency. Revisit if v1.1 ships block notifications.

### Replay

- Accept duplicate `update_id`s. Idempotency check catches any state impact. A Redis-backed dedup cache can be added later if needed.

## Error handling

| Failure | Behavior |
|---|---|
| `TELEGRAM_BOT_TOKEN` empty | `fireTelegramApproval` returns silently; Telegram channel disabled |
| Telegram API returns 4xx / 5xx | Warn-logged, swallowed, `/api/actions` response unaffected |
| Network timeout (>1500 ms) | Warn-logged, swallowed |
| Telegram request lacks secret header | `401`, no DB work |
| Secret mismatch | `401`, no DB work |
| Sender chat ID mismatch | `403`, no DB work |
| Malformed `callback_data` | `200` + "Unknown button" toast |
| Button tapped on resolved action | `200` + "Already resolved" toast, message edited, no `approveAction` call |
| `approveAction` throws | Still ack callback so phone stops spinning; log the error |

## Testing

### Unit — `__tests__/unit/telegram-approvals.test.js` (new)

Mirror `webhook-failures.test.js`; global fetch mocked; no real network.

- Builds the correct `sendMessage` payload (text, inline keyboard, callback_data).
- Returns silently with no throw when:
  - `TELEGRAM_BOT_TOKEN` missing
  - `DASHCLAW_ALERTS_TELEGRAM=false`
  - Telegram returns 500
  - Telegram returns non-JSON
  - Network rejects / aborts on timeout

### Unit — `__tests__/unit/telegram-webhook-route.test.js` (new)

Mirror `approvals-route.test.js`; direct `POST` handler import; sql + fetch mocked.

- Missing secret header → `401`, no DB writes.
- Mismatched secret → `401`.
- Valid secret, sender chat_id not allowed → `403`.
- Malformed `callback_data` → `200` + toast, no DB writes.
- Valid `ap:<id>` on `pending_approval` → calls `approveAction(..., decision: 'approve')`, edits message, strips keyboard, acks callback.
- Valid `dn:<id>` → same with deny + reasoning `'Denied via Telegram'`.
- Valid tap on already-completed action → no `approveAction`, message edited to "Already resolved", ack with toast.
- `approveAction` throws → callback still acked, error logged.

### Smoke — none for v1

No UI surface. The existing `tests/smoke/dashboard.spec.js` covers dashboard pages; a webhook route has no page to render. Add a smoke test when / if `/settings/telegram` lands in v1.1.

### Manual verification — `scripts/telegram-verify-loop.js` (new, dev-only)

Not run in CI. Creates a synthetic `pending_approval` action locally, waits for the operator to tap Approve on their phone, polls `/api/actions/:id` until status flips, prints `round-trip succeeded in <N>s`. Used for first-time setup verification and as the screencast-generation tool.

### Coverage target

The two unit test files together should hit ~90% of the new code. Scripts are not unit-tested (standard repo practice).

## Files changed

### New

- `app/lib/telegramApprovals.js`
- `app/api/telegram/webhook/route.js`
- `scripts/telegram-register-webhook.js`
- `scripts/telegram-verify-loop.js`
- `__tests__/unit/telegram-approvals.test.js`
- `__tests__/unit/telegram-webhook-route.test.js`

### Modified

- `app/api/actions/route.js` — one call-site addition next to `fireActionAlert`.
- `.env.example` — three new env-var entries.
- `package.json` — `telegram:register` and `telegram:verify` scripts.
- `README.md` — short "Telegram approvals" section.

No schema migrations. No settings-repo changes. No change to the existing Discord or generic-webhook paths.

## v1.1 roadmap

In priority order:

1. **Block notifications** — reuse `fireTelegramApproval`'s fetch wrapper on the guard-block code path. Highest viral value for the screencast story.
2. **Deep link back to PWA** — third inline-keyboard row: `[ 🔎 Open in DashClaw ]` linking to `/approve/<id>`.
3. **Per-agent approvers** — migrate env vars to per-org settings repo with `{agent_id → [chat_id]}` map.
4. **Reason-prompt deny** — two-step state for richer audit trail.
5. **Settings page** (`/settings/telegram`) replacing the CLI script for setup.

## Distribution (not part of this build)

- Viral screencast (OpenClaw → DashClaw → phone approval → decision record) to be shot after ship.
- The `dashclaw-governed-openclaw` OpenClaw skill — separate repo, separate build; this v1 gives it the feature to advertise.
- Practical Systems outreach-approval flow reuses this bridge with zero extra code.
