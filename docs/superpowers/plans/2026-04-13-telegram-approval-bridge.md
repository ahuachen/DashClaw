# Telegram Approval Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a DashClaw action enters `pending_approval`, send an interactive Telegram message with Approve / Reject buttons; button taps resolve the action through the existing approval code path.

**Architecture:** Two new modules + one call-site addition. `app/lib/telegramApprovals.js` is a fire-and-forget emitter (mirrors the existing `actionAlerts.js` Discord pattern). `app/api/telegram/webhook/route.js` is an inbound Next.js route that verifies Telegram's secret-token header and the caller's chat ID, then calls the existing `recordApproval` repository function. No DB schema changes. No background workers. All edges are single request/response so the feature runs on Vercel's free tier.

**Tech Stack:** Next.js 16 App Router, Vitest, existing repository pattern (`app/lib/repositories/actions.repository.js`), Telegram Bot API (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `setWebhook`).

**Spec:** `docs/superpowers/specs/2026-04-13-telegram-approval-bridge-design.md`

---

## File Structure

**New files:**

- `app/lib/telegramApprovals.js` — Emitter. Exports `fireTelegramApproval(action, sql, orgId)`. Fire-and-forget; never throws.
- `app/api/telegram/webhook/route.js` — Inbound callback route. Verifies auth, parses `callback_data`, calls `recordApproval`, edits the original message.
- `scripts/telegram-register-webhook.js` — One-shot: registers the webhook URL + secret with Telegram.
- `scripts/telegram-verify-loop.js` — Dev-only: creates a synthetic `pending_approval` action and polls until a human taps Approve on their phone.
- `__tests__/unit/telegram-approvals.test.js` — Unit tests for the emitter.
- `__tests__/unit/telegram-webhook-route.test.js` — Unit tests for the webhook handler.

**Modified files:**

- `app/api/actions/route.js` — One new call next to `fireWebhooksForApproval` at line 316.
- `.env.example` — Four new env vars.
- `package.json` — `telegram:register` and `telegram:verify` npm scripts.
- `README.md` — Short "Telegram approvals" section.

---

## Task 1: Emitter — config gate (no token, kill switch, wrong status)

**Files:**
- Create: `app/lib/telegramApprovals.js`
- Test: `__tests__/unit/telegram-approvals.test.js`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/unit/telegram-approvals.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

const { fireTelegramApproval } = await import('../../app/lib/telegramApprovals.js');

describe('fireTelegramApproval — config gate', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '12345';
    delete process.env.DASHCLAW_ALERTS_TELEGRAM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const pendingAction = {
    action_id: 'act_abc123def',
    status: 'pending_approval',
    agent_id: 'openclaw-telegram',
    action_type: 'deploy',
    risk_score: 80,
    reversible: false,
    declared_goal: 'Push release/v0.4.2 to production',
  };

  it('returns silently when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    fireTelegramApproval(pendingAction, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns silently when DASHCLAW_ALERTS_TELEGRAM === 'false'", async () => {
    process.env.DASHCLAW_ALERTS_TELEGRAM = 'false';
    fireTelegramApproval(pendingAction, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns silently when action status is not pending_approval', async () => {
    fireTelegramApproval({ ...pendingAction, status: 'running' }, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-approvals.test.js`
Expected: **FAIL** with `Cannot find module '../../app/lib/telegramApprovals.js'`

- [ ] **Step 3: Create the minimal emitter**

Create `app/lib/telegramApprovals.js`:

```js
/**
 * Telegram approval bridge — fires an interactive approval message to a
 * configured Telegram admin chat when an action enters pending_approval.
 * Mirrors actionAlerts.js — always fire-and-forget, never throws.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FETCH_TIMEOUT_MS = 1500;

function isEnabled() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return false;
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID) return false;
  if (process.env.DASHCLAW_ALERTS_TELEGRAM === 'false') return false;
  return true;
}

/**
 * Fire a Telegram approval message for a pending_approval action.
 * @param {object} action - the action record
 * @param {object} _sql - db handle (reserved for v1.1 per-agent routing)
 * @param {string} _orgId - org id (reserved for v1.1 per-agent routing)
 */
export function fireTelegramApproval(action, _sql, _orgId) {
  if (!isEnabled()) return;
  if (action?.status !== 'pending_approval') return;

  void (async () => {
    try {
      // payload + fetch arrive in Task 2
    } catch (err) {
      console.warn('[TelegramApprovals] Failed to send approval:', err.message);
    }
  })();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-approvals.test.js`
Expected: **PASS** — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/lib/telegramApprovals.js __tests__/unit/telegram-approvals.test.js
git commit -m "feat(telegram): scaffold approval emitter with config gate"
```

---

## Task 2: Emitter — build correct Telegram `sendMessage` payload

**Files:**
- Modify: `app/lib/telegramApprovals.js`
- Test: `__tests__/unit/telegram-approvals.test.js`

- [ ] **Step 1: Add the failing payload test**

Append to `__tests__/unit/telegram-approvals.test.js`:

```js
describe('fireTelegramApproval — payload', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    delete process.env.DASHCLAW_ALERTS_TELEGRAM;
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('POSTs to /sendMessage with chat_id, text, and inline keyboard', async () => {
    const action = {
      action_id: 'act_abc12345',
      status: 'pending_approval',
      agent_id: 'openclaw-telegram',
      action_type: 'deploy',
      risk_score: 80,
      reversible: false,
      declared_goal: 'Push release/v0.4.2 to production',
    };

    fireTelegramApproval(action, null, 'org_1');
    await new Promise((r) => setImmediate(r));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTBOT/sendMessage');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe('42');
    expect(body.text).toContain('openclaw-telegram');
    expect(body.text).toContain('deploy');
    expect(body.text).toContain('80');
    expect(body.text).toContain('irreversible');
    expect(body.text).toContain('Push release/v0.4.2 to production');
    expect(body.text).toContain('act_abc12345');

    expect(body.reply_markup.inline_keyboard).toEqual([[
      { text: '✅ Approve', callback_data: 'ap:act_abc12345' },
      { text: '❌ Reject',  callback_data: 'dn:act_abc12345' },
    ]]);
  });

  it('renders reversible actions with the reversible label', async () => {
    fireTelegramApproval({
      action_id: 'act_rev0001x',
      status: 'pending_approval',
      agent_id: 'a', action_type: 'review',
      risk_score: 10, reversible: true, declared_goal: 'read files',
    }, null, 'org_1');
    await new Promise((r) => setImmediate(r));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('reversible');
    expect(body.text).not.toContain('irreversible');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-approvals.test.js -t "payload"`
Expected: **FAIL** — `mockFetch` not called (emitter body still empty).

- [ ] **Step 3: Implement the payload builder and send call**

Replace the `fireTelegramApproval` body in `app/lib/telegramApprovals.js`:

```js
function buildMessage(action) {
  const risk = action.risk_score ?? 0;
  const reversible = action.reversible === false ? 'irreversible' : 'reversible';
  const goal = (action.declared_goal || '—').slice(0, 200);

  const text = [
    '⏳ DashClaw approval needed',
    '',
    `Agent:   ${action.agent_id || 'unknown'}`,
    `Action:  ${action.action_type || 'unknown'}`,
    `Risk:    ${risk} • ${reversible}`,
    '',
    `Goal: ${goal}`,
    '',
    action.action_id,
  ].join('\n');

  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Approve', callback_data: `ap:${action.action_id}` },
      { text: '❌ Reject',  callback_data: `dn:${action.action_id}` },
    ]],
  };

  return { text, reply_markup };
}

async function sendApprovalMessage(action) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat_id = process.env.TELEGRAM_ADMIN_CHAT_ID;
  const payload = buildMessage(action);

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, ...payload }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    console.warn(`[TelegramApprovals] sendMessage returned ${res.status}`);
  }
}

export function fireTelegramApproval(action, _sql, _orgId) {
  if (!isEnabled()) return;
  if (action?.status !== 'pending_approval') return;

  void (async () => {
    try {
      await sendApprovalMessage(action);
    } catch (err) {
      console.warn('[TelegramApprovals] Failed to send approval:', err.message);
    }
  })();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-approvals.test.js`
Expected: **PASS** — 5 tests total.

- [ ] **Step 5: Commit**

```bash
git add app/lib/telegramApprovals.js __tests__/unit/telegram-approvals.test.js
git commit -m "feat(telegram): build sendMessage payload with inline keyboard"
```

---

## Task 3: Emitter — fail-open on network errors, 5xx, and timeout

**Files:**
- Modify: `app/lib/telegramApprovals.js` (no code change expected — verify existing try/catch covers all cases)
- Test: `__tests__/unit/telegram-approvals.test.js`

- [ ] **Step 1: Add the failing resilience tests**

Append to `__tests__/unit/telegram-approvals.test.js`:

```js
describe('fireTelegramApproval — fail-open', () => {
  const originalEnv = { ...process.env };
  const action = {
    action_id: 'act_foo12345',
    status: 'pending_approval',
    agent_id: 'a', action_type: 'deploy',
    risk_score: 80, reversible: false, declared_goal: 'g',
  };
  let warnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    delete process.env.DASHCLAW_ALERTS_TELEGRAM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('does not throw when Telegram returns 500', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    expect(() => fireTelegramApproval(action, null, 'org_1')).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('sendMessage returned 500')
    );
  });

  it('does not throw when fetch rejects', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    expect(() => fireTelegramApproval(action, null, 'org_1')).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send approval'),
      expect.any(String),
    );
  });

  it('does not throw when fetch aborts (timeout)', async () => {
    mockFetch.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    expect(() => fireTelegramApproval(action, null, 'org_1')).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(warnSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify the tests pass on first run**

Run: `npx vitest run __tests__/unit/telegram-approvals.test.js`
Expected: **PASS** — 8 tests total. The existing try/catch + `AbortSignal.timeout(1500)` should already handle all three cases. If any test fails, fix the emitter so error paths reach `console.warn` without throwing.

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/telegram-approvals.test.js
git commit -m "test(telegram): verify emitter is fail-open on 5xx/network/timeout"
```

---

## Task 4: Wire the emitter into the action route

**Files:**
- Modify: `app/api/actions/route.js` (around line 316)

- [ ] **Step 1: Re-read the current hook block**

Open `app/api/actions/route.js` and confirm the block at lines 316–322 reads:

```js
if (createdAction.status === 'pending_approval') {
  fireWebhooksForApproval(orgId, 'approval_pending', {
    ...createdAction,
    matched_policies: guardDecision?.matched_policies,
    reason: guardDecision?.reason,
  }, sql).catch(() => {});
}
```

- [ ] **Step 2: Add the import**

Near the other lib imports at the top of `app/api/actions/route.js`, add:

```js
import { fireTelegramApproval } from '../../lib/telegramApprovals.js';
```

Keep the import sorted alphabetically with existing ones or match the file's existing ordering.

- [ ] **Step 3: Add the call site**

Replace the block at lines 316–322 with:

```js
if (createdAction.status === 'pending_approval') {
  fireTelegramApproval(createdAction, sql, orgId);
  fireWebhooksForApproval(orgId, 'approval_pending', {
    ...createdAction,
    matched_policies: guardDecision?.matched_policies,
    reason: guardDecision?.reason,
  }, sql).catch(() => {});
}
```

Rationale: `fireTelegramApproval` is synchronous (returns void immediately and schedules an async IIFE), so it does not need `.catch()`.

- [ ] **Step 4: Run the existing action-route tests to confirm no regression**

Run: `npx vitest run __tests__/unit/actions` (or whatever pattern matches the existing action tests)

Expected: **PASS** — all existing action-route tests continue to pass. If any fail, add the appropriate mock:

```js
vi.mock('../../app/lib/telegramApprovals.js', () => ({
  fireTelegramApproval: vi.fn(),
}));
```

- [ ] **Step 5: Commit**

```bash
git add app/api/actions/route.js
git commit -m "feat(telegram): wire approval emitter into action route"
```

---

## Task 5: Webhook route — secret-token and chat-id auth

**Files:**
- Create: `app/api/telegram/webhook/route.js`
- Test: `__tests__/unit/telegram-webhook-route.test.js`

- [ ] **Step 1: Write the failing auth tests**

Create `__tests__/unit/telegram-webhook-route.test.js`:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockFetch, mockGetActionStatus, mockRecordApproval } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetActionStatus: vi.fn(),
  mockRecordApproval: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);
vi.mock('../../app/lib/db.js', () => ({ getSql: () => ({}) }));
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  getActionStatus: (...a) => mockGetActionStatus(...a),
  recordApproval: (...a) => mockRecordApproval(...a),
}));

const { POST } = await import('../../app/api/telegram/webhook/route.js');

function req(body, headers = {}) {
  return makeRequest('http://localhost:3000/api/telegram/webhook', {
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/telegram/webhook — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns 401 when X-Telegram-Bot-Api-Secret-Token is missing', async () => {
    const res = await POST(req({ callback_query: { id: 'cq1' } }));
    expect(res.status).toBe(401);
    expect(mockGetActionStatus).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret does not match', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'WRONG' },
    ));
    expect(res.status).toBe(401);
    expect(mockGetActionStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when callback sender is not the admin chat', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 9999 }, data: 'ap:act_abc12345' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' },
    ));
    expect(res.status).toBe(403);
    expect(mockRecordApproval).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **FAIL** — `Cannot find module '../../app/api/telegram/webhook/route.js'`

- [ ] **Step 3: Scaffold the webhook route with auth layers**

Create `app/api/telegram/webhook/route.js`:

```js
import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import {
  getActionStatus,
  recordApproval,
} from '../../../lib/repositories/actions.repository.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FETCH_TIMEOUT_MS = 1500;
const CALLBACK_DATA_RE = /^(ap|dn):(act_[a-z0-9_-]{1,57})$/;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
function ok() {
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  const presented = request.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!presented || !expected || presented !== expected) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cq = body?.callback_query;
  if (!cq) return ok(); // non-callback update, ignore

  const senderId = String(cq.from?.id ?? '');
  if (senderId !== process.env.TELEGRAM_ADMIN_CHAT_ID) return forbidden();

  // Task 6 adds callback_data parsing + answerCallbackQuery.
  // Task 7 through Task 9 add approve/deny/idempotency.
  return ok();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **PASS** — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.js __tests__/unit/telegram-webhook-route.test.js
git commit -m "feat(telegram): webhook route scaffold with secret + chat_id auth"
```

---

## Task 6: Webhook — callback_data validation + answerCallbackQuery helper

**Files:**
- Modify: `app/api/telegram/webhook/route.js`
- Test: `__tests__/unit/telegram-webhook-route.test.js`

- [ ] **Step 1: Write the failing validation tests**

Append to `__tests__/unit/telegram-webhook-route.test.js`:

```js
describe('POST /api/telegram/webhook — callback_data validation', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('returns 200 and answers with toast when callback_data is malformed', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 42 }, data: 'WAT:act_abc' } },
      AUTH,
    ));
    expect(res.status).toBe(200);
    expect(mockGetActionStatus).not.toHaveBeenCalled();

    const ackCall = mockFetch.mock.calls.find(([u]) =>
      u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
    expect(JSON.parse(ackCall[1].body).text).toContain('Unknown');
  });

  it('returns 200 when callback_data is missing entirely', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 42 } } },
      AUTH,
    ));
    expect(res.status).toBe(200);
    expect(mockGetActionStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js -t "callback_data validation"`
Expected: **FAIL** — no `answerCallbackQuery` fetch was made.

- [ ] **Step 3: Add the helper and wire it**

Edit `app/api/telegram/webhook/route.js`. Add after the `ok()` helper:

```js
async function answerCallback(callback_query_id, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id, ...(text ? { text } : {}) }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[TelegramWebhook] answerCallback failed:', err.message);
  }
}
```

Then replace the final `return ok();` with:

```js
  const match = (cq.data ?? '').match(CALLBACK_DATA_RE);
  if (!match) {
    await answerCallback(cq.id, 'Unknown button');
    return ok();
  }
  const [, verb, action_id] = match;

  // Task 7 through Task 9 add approve/deny/idempotency using verb + action_id.
  return ok();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **PASS** — 5 tests total.

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.js __tests__/unit/telegram-webhook-route.test.js
git commit -m "feat(telegram): validate callback_data, toast on unknown button"
```

---

## Task 7: Webhook — approve happy path

**Files:**
- Modify: `app/api/telegram/webhook/route.js`
- Test: `__tests__/unit/telegram-webhook-route.test.js`

- [ ] **Step 1: Write the failing approve test**

Append to `__tests__/unit/telegram-webhook-route.test.js`:

```js
describe('POST /api/telegram/webhook — approve', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };
  const pending = {
    action_id: 'act_abc12345',
    status: 'pending_approval',
    agent_id: 'openclaw-tg',
    action_type: 'deploy',
    declared_goal: 'Push release v0.4.2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionStatus.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'running' });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('calls recordApproval with allow + synthesized user id, edits message, acks callback', async () => {
    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockGetActionStatus).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
    );
    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
      expect.objectContaining({
        decision: 'allow',
        newStatus: 'running',
        errorMessage: null,
        userId: 'telegram:42',
      }),
    );

    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    const editBody = JSON.parse(editCall[1].body);
    expect(editBody.chat_id).toBe(42);
    expect(editBody.message_id).toBe(1001);
    expect(editBody.text).toContain('✅ Approved');
    expect(editBody.reply_markup).toEqual({ inline_keyboard: [] });

    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js -t "approve"`
Expected: **FAIL** — `recordApproval` not called.

- [ ] **Step 3: Implement approve branch**

In `app/api/telegram/webhook/route.js`, add after `answerCallback`:

```js
async function editMessage(chat_id, message_id, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id, message_id, text,
        reply_markup: { inline_keyboard: [] },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[TelegramWebhook] editMessage failed:', err.message);
  }
}

function buildResolvedText(action, decisionLabel, action_id) {
  const ts = new Date().toTimeString().slice(0, 8);
  const goal = (action.declared_goal || '—').slice(0, 200);
  return [
    `${decisionLabel} — ${ts}`,
    '',
    `Agent:   ${action.agent_id || 'unknown'}`,
    `Action:  ${action.action_type || 'unknown'}`,
    `Goal: ${goal}`,
    '',
    action_id,
  ].join('\n');
}
```

Replace the `// Task 7 through Task 9 …` placeholder with:

```js
  const sql = getSql();
  const orgId = process.env.TELEGRAM_APPROVER_ORG_ID;
  const action = await getActionStatus(sql, orgId, action_id);

  if (!action || action.status !== 'pending_approval') {
    // Idempotency handled in Task 9.
    return ok();
  }

  const chat_id = cq.message?.chat?.id;
  const message_id = cq.message?.message_id;
  const userId = `telegram:${senderId}`;

  if (verb === 'ap') {
    await recordApproval(sql, orgId, action_id, {
      newStatus: 'running',
      errorMessage: null,
      decision: 'allow',
      userId,
      safeReasoning: null,
    });
    await Promise.all([
      answerCallback(cq.id),
      editMessage(chat_id, message_id,
        buildResolvedText(action, '✅ Approved by Telegram admin', action_id)),
    ]);
    return ok();
  }

  // Task 8 handles 'dn'.
  return ok();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **PASS** — 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.js __tests__/unit/telegram-webhook-route.test.js
git commit -m "feat(telegram): approve flow calls recordApproval and edits message"
```

---

## Task 8: Webhook — deny happy path

**Files:**
- Modify: `app/api/telegram/webhook/route.js`
- Test: `__tests__/unit/telegram-webhook-route.test.js`

- [ ] **Step 1: Write the failing deny test**

Append to `__tests__/unit/telegram-webhook-route.test.js`:

```js
describe('POST /api/telegram/webhook — deny', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };
  const pending = {
    action_id: 'act_abc12345',
    status: 'pending_approval',
    agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionStatus.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'failed' });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('calls recordApproval with deny + "Denied via Telegram" reason', async () => {
    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'dn:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
      expect.objectContaining({
        decision: 'deny',
        newStatus: 'failed',
        errorMessage: 'Denied via Telegram',
        userId: 'telegram:42',
      }),
    );
    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(JSON.parse(editCall[1].body).text).toContain('❌ Denied');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js -t "deny"`
Expected: **FAIL** — deny branch still returns `ok()` without calling `recordApproval`.

- [ ] **Step 3: Implement deny branch**

In `app/api/telegram/webhook/route.js`, replace the `// Task 8 handles 'dn'.` placeholder and the `return ok();` that follows it with:

```js
  // verb === 'dn'
  await recordApproval(sql, orgId, action_id, {
    newStatus: 'failed',
    errorMessage: 'Denied via Telegram',
    decision: 'deny',
    userId,
    safeReasoning: 'Denied via Telegram',
  });
  await Promise.all([
    answerCallback(cq.id),
    editMessage(chat_id, message_id,
      buildResolvedText(action, '❌ Denied by Telegram admin', action_id)),
  ]);
  return ok();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **PASS** — 7 tests total.

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.js __tests__/unit/telegram-webhook-route.test.js
git commit -m "feat(telegram): deny flow records denial with hardcoded reason"
```

---

## Task 9: Webhook — idempotency and approval-error resilience

**Files:**
- Modify: `app/api/telegram/webhook/route.js`
- Test: `__tests__/unit/telegram-webhook-route.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/unit/telegram-webhook-route.test.js`:

```js
describe('POST /api/telegram/webhook — idempotency and errors', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('does not call recordApproval when action is already resolved, and edits with "Already resolved"', async () => {
    mockGetActionStatus.mockResolvedValue({
      action_id: 'act_abc12345', status: 'completed',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).not.toHaveBeenCalled();

    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(JSON.parse(editCall[1].body).text).toContain('Already resolved');

    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
    expect(JSON.parse(ackCall[1].body).text).toContain('Already resolved');
  });

  it('short-circuits with "Action not found" when getActionStatus returns null', async () => {
    mockGetActionStatus.mockResolvedValue(null);

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).not.toHaveBeenCalled();
    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(JSON.parse(ackCall[1].body).text).toContain('Action not found');
  });

  it('still acks the callback when recordApproval throws', async () => {
    mockGetActionStatus.mockResolvedValue({
      action_id: 'act_abc12345', status: 'pending_approval',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });
    mockRecordApproval.mockRejectedValue(new Error('DB down'));

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
    expect(JSON.parse(ackCall[1].body).text).toContain('Approval failed');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js -t "idempotency"`
Expected: **FAIL** — currently the null + resolved branches return `ok()` without editing, and recordApproval errors propagate instead of acking.

- [ ] **Step 3: Flesh out the short-circuit and error branches**

In `app/api/telegram/webhook/route.js`, replace the existing:

```js
  if (!action || action.status !== 'pending_approval') {
    // Idempotency handled in Task 9.
    return ok();
  }
```

with:

```js
  const chat_id = cq.message?.chat?.id;
  const message_id = cq.message?.message_id;

  if (!action) {
    await Promise.all([
      answerCallback(cq.id, 'Action not found'),
      editMessage(chat_id, message_id, '⚠️ Action not found'),
    ]);
    return ok();
  }

  if (action.status !== 'pending_approval') {
    await Promise.all([
      answerCallback(cq.id, 'Already resolved'),
      editMessage(chat_id, message_id,
        `⚠️ Already resolved — status: ${action.status}`),
    ]);
    return ok();
  }
```

Then remove the now-duplicated `const chat_id` / `const message_id` lines that appear later in the function.

Wrap the `recordApproval` calls in try/catch. Replace the approve branch (inside `if (verb === 'ap')`) with:

```js
  if (verb === 'ap') {
    try {
      await recordApproval(sql, orgId, action_id, {
        newStatus: 'running',
        errorMessage: null,
        decision: 'allow',
        userId,
        safeReasoning: null,
      });
    } catch (err) {
      console.warn('[TelegramWebhook] recordApproval (approve) failed:', err.message);
      await answerCallback(cq.id, 'Approval failed');
      return ok();
    }
    await Promise.all([
      answerCallback(cq.id),
      editMessage(chat_id, message_id,
        buildResolvedText(action, '✅ Approved by Telegram admin', action_id)),
    ]);
    return ok();
  }
```

And wrap the deny branch similarly:

```js
  try {
    await recordApproval(sql, orgId, action_id, {
      newStatus: 'failed',
      errorMessage: 'Denied via Telegram',
      decision: 'deny',
      userId,
      safeReasoning: 'Denied via Telegram',
    });
  } catch (err) {
    console.warn('[TelegramWebhook] recordApproval (deny) failed:', err.message);
    await answerCallback(cq.id, 'Approval failed');
    return ok();
  }
  await Promise.all([
    answerCallback(cq.id),
    editMessage(chat_id, message_id,
      buildResolvedText(action, '❌ Denied by Telegram admin', action_id)),
  ]);
  return ok();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/telegram-webhook-route.test.js`
Expected: **PASS** — 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add app/api/telegram/webhook/route.js __tests__/unit/telegram-webhook-route.test.js
git commit -m "feat(telegram): idempotent webhook, ack callback even when approval fails"
```

---

## Task 10: Registration script + npm alias

**Files:**
- Create: `scripts/telegram-register-webhook.js`
- Modify: `package.json`

- [ ] **Step 1: Create the registration script**

Create `scripts/telegram-register-webhook.js`:

```js
#!/usr/bin/env node
/**
 * One-shot: registers the DashClaw Telegram webhook with the Bot API.
 *
 * Usage:
 *   npm run telegram:register -- --url https://my-dashclaw.vercel.app
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from env.
 */

const args = process.argv.slice(2);
const urlIdx = args.indexOf('--url');
const baseUrl = urlIdx >= 0 ? args[urlIdx + 1] : null;

if (!baseUrl) {
  console.error('Usage: npm run telegram:register -- --url https://your-instance.vercel.app');
  process.exit(1);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN env var is required');
  process.exit(1);
}
if (!secret) {
  console.error('TELEGRAM_WEBHOOK_SECRET env var is required');
  process.exit(1);
}

const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: webhookUrl, secret_token: secret }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
process.exit(data.ok ? 0 : 1);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, under `"scripts"`, add:

```json
"telegram:register": "node scripts/telegram-register-webhook.js"
```

Place it alphabetically near other single-word namespaced scripts (e.g. after any existing `route-sql:*` entries).

- [ ] **Step 3: Smoke-verify the script parses args correctly**

Run without args to confirm the usage message fires:

```bash
node scripts/telegram-register-webhook.js
```

Expected: prints `Usage: npm run telegram:register -- --url ...` and exits with code 1. (No actual Telegram call — no args provided.)

- [ ] **Step 4: Commit**

```bash
git add scripts/telegram-register-webhook.js package.json
git commit -m "feat(telegram): add registration script for Telegram setWebhook"
```

---

## Task 11: Verification loop script + npm alias

**Files:**
- Create: `scripts/telegram-verify-loop.js`
- Modify: `package.json`

- [ ] **Step 1: Create the verify script**

Create `scripts/telegram-verify-loop.js`:

```js
#!/usr/bin/env node
/**
 * Dev-only: creates a synthetic pending_approval action against a local
 * DashClaw instance, then polls until the action is resolved. Operator
 * taps Approve/Reject on their phone; the script prints the round-trip
 * time once status flips.
 *
 * Usage:
 *   npm run telegram:verify -- --base http://localhost:3000 --key oc_live_xxx
 */

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}

const base = arg('--base', 'http://localhost:3000').replace(/\/$/, '');
const apiKey = arg('--key', process.env.DASHCLAW_API_KEY);
const timeoutMs = Number(arg('--timeout', '600000')); // 10 min default

if (!apiKey) {
  console.error('Set DASHCLAW_API_KEY env or pass --key oc_live_...');
  process.exit(1);
}

const action_id = `act_verify${Date.now().toString(36)}`;

const create = await fetch(`${base}/api/actions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
  body: JSON.stringify({
    action_id,
    agent_id: 'telegram-verify',
    action_type: 'deploy',
    declared_goal: 'telegram:verify-loop smoke test',
    risk_score: 80,
    reversible: false,
    status: 'pending_approval',
  }),
});
if (!create.ok) {
  console.error(`Failed to create action: ${create.status} ${await create.text()}`);
  process.exit(1);
}
console.log(`Created ${action_id}. Approve/Reject on Telegram…`);

const start = Date.now();
while (Date.now() - start < timeoutMs) {
  await new Promise((r) => setTimeout(r, 1500));
  const res = await fetch(`${base}/api/actions/${action_id}`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) continue;
  const { action } = await res.json();
  if (action?.status && action.status !== 'pending_approval') {
    const s = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ round-trip succeeded in ${s}s — final status: ${action.status}`);
    process.exit(0);
  }
}
console.error('⌛ Timed out waiting for approval');
process.exit(2);
```

- [ ] **Step 2: Add the npm script**

In `package.json`, under `"scripts"`, add:

```json
"telegram:verify": "node scripts/telegram-verify-loop.js"
```

Place it next to `telegram:register`.

- [ ] **Step 3: Smoke-verify the script without an API key errors cleanly**

Run:

```bash
node scripts/telegram-verify-loop.js
```

Expected: exits with code 1 and message `Set DASHCLAW_API_KEY env or pass --key oc_live_...`.

- [ ] **Step 4: Commit**

```bash
git add scripts/telegram-verify-loop.js package.json
git commit -m "feat(telegram): add verify-loop script for round-trip smoke test"
```

---

## Task 12: `.env.example` entries + README section

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Add env-var entries**

Append to `.env.example`:

```bash
# Telegram approval bridge (optional — feature is off if TELEGRAM_BOT_TOKEN is blank)
TELEGRAM_BOT_TOKEN=                 # from @BotFather
TELEGRAM_ADMIN_CHAT_ID=             # numeric chat ID allowed to approve
TELEGRAM_WEBHOOK_SECRET=            # 32+ random chars; verifies inbound callbacks (openssl rand -hex 32)
TELEGRAM_APPROVER_ORG_ID=           # org id to resolve actions under (single-tenant self-host: your org_*)
# DASHCLAW_ALERTS_TELEGRAM=false    # explicit kill-switch when token is present
```

- [ ] **Step 2: Add the README section**

Append to `README.md` (after any existing "Discord alerts" or similar notifications section; otherwise near the bottom before licensing):

````markdown
## Telegram approvals (optional)

When an action lands on `pending_approval`, DashClaw can ping a Telegram admin chat with inline Approve / Reject buttons. One tap on your phone resolves the action.

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and grab the bot token.
2. Message your bot once; open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy your numeric `chat.id`.
3. Generate a webhook secret: `openssl rand -hex 32`.
4. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`, and `TELEGRAM_APPROVER_ORG_ID` in your deploy's env.
5. Register the webhook:

   ```bash
   npm run telegram:register -- --url https://my-dashclaw.vercel.app
   ```

6. (Optional) Smoke test the round-trip:

   ```bash
   DASHCLAW_API_KEY=oc_live_… npm run telegram:verify -- --base https://my-dashclaw.vercel.app
   ```

   Tap Approve on your phone — the script prints the round-trip time.

Telegram is an *additional* approval channel. The dashboard, CLI, and mobile PWA continue to work. If Telegram is unreachable, DashClaw warn-logs and moves on; approvals stay available via the other surfaces.
````

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs(telegram): document env vars and setup flow"
```

---

## Verification

Run the full unit suite:

```bash
npx vitest run __tests__/unit/telegram-approvals.test.js __tests__/unit/telegram-webhook-route.test.js
```

Expected: **PASS** — 18 tests across the two files (8 emitter + 10 webhook).

Run the entire test suite to confirm no regression:

```bash
npm test
```

Expected: all tests pass. If any existing action-route test fails due to the added import in Task 4, add the `fireTelegramApproval` mock as described in Task 4, Step 4.

Manual round-trip verification (requires Telegram-facing deploy):

```bash
npm run telegram:register -- --url https://my-dashclaw.vercel.app
DASHCLAW_API_KEY=oc_live_… npm run telegram:verify -- --base https://my-dashclaw.vercel.app
```

Tap Approve on your phone. Script prints `✅ round-trip succeeded in <N>s`.

---

## Spec Coverage

| Spec section | Implementing task(s) |
|---|---|
| Architecture: new emitter module | Tasks 1–3 |
| Architecture: new webhook route | Tasks 5–9 |
| Architecture: one call-site addition | Task 4 |
| Configuration: 4 env vars + kill switch | Tasks 1, 12 |
| Configuration: registration script | Task 10 |
| Message format: initial message | Task 2 |
| Message format: approved/denied edits | Tasks 7, 8 |
| Message format: idempotent "already resolved" | Task 9 |
| Security: secret-token header auth | Task 5 |
| Security: chat-id allowlist | Task 5 |
| Security: callback_data regex | Task 6 |
| Security: fire-and-forget with timeout | Tasks 2, 3 |
| Security: idempotency | Task 9 |
| Error handling: emitter fail-open | Task 3 |
| Error handling: callback still acked on recordApproval throw | Task 9 |
| Testing: unit tests for emitter | Tasks 1–3 |
| Testing: unit tests for webhook | Tasks 5–9 |
| Testing: manual verify loop | Task 11 |
| Files changed: `.env.example`, `README.md` | Task 12 |
