# Decision-Message Correlation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect governance decisions to agent messages — inline in the decisions ledger, on a dedicated timeline page, and in the swarm graph sidebar.

**Architecture:** Adds SDK action context for automatic message tagging, a summary mode on the existing messages correlation endpoint, message summary in the action detail API response, a "Messages" section in the decisions ledger expandable rows, a chronological timeline on the existing `/decisions/[actionId]` detail page, and inspectable edges in the swarm graph.

**Tech Stack:** Next.js 15 (App Router), React 18, Vitest, Drizzle ORM (Postgres/Neon), DashClaw SDK v2 (Node.js + Python)

---

## File Structure

**Create:**
- `__tests__/unit/sdk-action-context.test.js` — tests for SDK action context
- `sdk-python/tests/test_action_context.py` — tests for Python SDK action context
- `__tests__/unit/action-messages-summary.test.js` — tests for summary mode
- `__tests__/unit/action-detail-messages.test.js` — tests for message_summary in action detail
- `app/components/MessageTrail.js` — reusable message trail component for decisions ledger + detail page
- `drizzle/0001_agent_messages_action_index.sql` — migration for composite index

**Modify:**
- `sdk/dashclaw.js:446-457` — add `actionContext()` method
- `sdk-python/dashclaw/client.py:927-937` — add `action_context()` context manager
- `app/api/actions/[actionId]/messages/route.js:10-52` — add summary mode
- `app/lib/repositories/messagesContext.repository.js:175-197` — add summary query
- `app/lib/repositories/actions.repository.js:327-340` — include message_summary in `getActionWithRelations`
- `app/decisions/page.js:551-582` — add Messages section in expanded row
- `app/decisions/[actionId]/page.js:33-77` — fetch and render messages in timeline
- `app/swarm/page.js:78-82,244-268` — add edge content to sidebar

---

### Task 1: Database Index Migration

**Files:**
- Create: `drizzle/0001_agent_messages_action_index.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- drizzle/0001_agent_messages_action_index.sql
CREATE INDEX IF NOT EXISTS idx_agent_messages_org_action ON agent_messages(org_id, action_id);
```

- [ ] **Step 2: Verify the migration file is valid SQL**

Run: `node -e "const fs = require('fs'); const sql = fs.readFileSync('drizzle/0001_agent_messages_action_index.sql', 'utf8'); console.log('Migration SQL:', sql); console.log('OK')"`
Expected: Prints the SQL and "OK"

- [ ] **Step 3: Commit**

```bash
git add drizzle/0001_agent_messages_action_index.sql
git commit -m "feat: add composite index on agent_messages(org_id, action_id) for correlation lookups"
```

---

### Task 2: Node.js SDK — Action Context

**Files:**
- Modify: `sdk/dashclaw.js` (after line 457)
- Test: `__tests__/unit/sdk-action-context.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// __tests__/unit/sdk-action-context.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
const { DashClaw } = await import('../../sdk/dashclaw.js');

describe('DashClaw.actionContext()', () => {
  let claw;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    claw = new DashClaw({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      agentId: 'agent-1',
    });
  });

  it('returns a context object with sendMessage, recordAssumption, updateOutcome', () => {
    const ctx = claw.actionContext('act_123');
    expect(typeof ctx.sendMessage).toBe('function');
    expect(typeof ctx.recordAssumption).toBe('function');
    expect(typeof ctx.updateOutcome).toBe('function');
  });

  it('sendMessage auto-injects action_id into the request body', async () => {
    const ctx = claw.actionContext('act_123');
    await ctx.sendMessage({ to: 'agent-b', type: 'info', subject: 'Test', body: 'Hello' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.action_id).toBe('act_123');
    expect(body.from_agent_id).toBe('agent-1');
    expect(body.to_agent_id).toBe('agent-b');
    expect(body.body).toBe('Hello');
  });

  it('recordAssumption auto-injects action_id', async () => {
    const ctx = claw.actionContext('act_123');
    await ctx.recordAssumption({ assumption: 'Staging is clear' });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.action_id).toBe('act_123');
    expect(body.assumption).toBe('Staging is clear');
  });

  it('updateOutcome calls with the correct action_id in URL', async () => {
    const ctx = claw.actionContext('act_123');
    await ctx.updateOutcome({ status: 'completed', output_summary: 'Done' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/actions/act_123');
    const opts = mockFetch.mock.calls[0][1];
    const body = JSON.parse(opts.body);
    expect(body.status).toBe('completed');
  });

  it('sendMessage with explicit actionId parameter also works', async () => {
    await claw.sendMessage({
      to: 'agent-b',
      type: 'info',
      subject: 'Test',
      body: 'Direct',
      actionId: 'act_456',
    });

    const [, opts] = mockFetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.action_id).toBe('act_456');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/sdk-action-context.test.js`
Expected: FAIL — `claw.actionContext is not a function`

- [ ] **Step 3: Implement actionContext in the SDK**

Add the following after line 457 in `sdk/dashclaw.js` (after the `sendMessage` method):

```js
  /**
   * Create a scoped action context that auto-tags messages and assumptions
   * with the given action_id.
   * @param {string} actionId - The action_id to attach to all operations
   * @returns {{ sendMessage, recordAssumption, updateOutcome }}
   */
  actionContext(actionId) {
    return {
      sendMessage: ({ to, type, subject, body, threadId, urgent }) => {
        return this.sendMessage({ to, type, subject, body, threadId, urgent, actionId });
      },
      recordAssumption: (assumption) => {
        return this.recordAssumption({ ...assumption, action_id: actionId });
      },
      updateOutcome: (outcome) => {
        return this.updateOutcome(actionId, outcome);
      },
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/sdk-action-context.test.js`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add sdk/dashclaw.js __tests__/unit/sdk-action-context.test.js
git commit -m "feat(sdk): add actionContext() for automatic message-action tagging"
```

---

### Task 3: Python SDK — Action Context

**Files:**
- Modify: `sdk-python/dashclaw/client.py` (after line 937)
- Test: `sdk-python/tests/test_action_context.py`

- [ ] **Step 1: Write the failing test**

```python
# sdk-python/tests/test_action_context.py
import unittest
from unittest.mock import patch, MagicMock
import json

from dashclaw.client import DashClaw


class TestActionContext(unittest.TestCase):
    def setUp(self):
        self.claw = DashClaw(
            base_url="http://localhost:3000",
            api_key="test-key",
            agent_id="agent-1",
        )

    @patch.object(DashClaw, '_request')
    def test_context_manager_send_message_injects_action_id(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.send_message("Hello", to="agent-b")

        mock_req.assert_called_once()
        args, kwargs = mock_req.call_args
        # The call goes to /api/messages with POST
        self.assertEqual(args[0], "/api/messages")
        body = kwargs.get("body") or args[2] if len(args) > 2 else kwargs.get("json")
        self.assertEqual(body["action_id"], "act_123")
        self.assertEqual(body["from_agent_id"], "agent-1")
        self.assertEqual(body["to_agent_id"], "agent-b")

    @patch.object(DashClaw, '_request')
    def test_context_manager_record_assumption_injects_action_id(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.record_assumption({"assumption": "Staging is clear"})

        args, kwargs = mock_req.call_args
        body = kwargs.get("json") or (args[2] if len(args) > 2 else None)
        self.assertEqual(body["action_id"], "act_123")
        self.assertEqual(body["assumption"], "Staging is clear")

    @patch.object(DashClaw, '_request')
    def test_context_manager_update_outcome(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.update_outcome(status="completed", output_summary="Done")

        args, kwargs = mock_req.call_args
        self.assertIn("act_123", args[0])  # URL contains action_id

    @patch.object(DashClaw, '_request')
    def test_explicit_action_id_kwarg_on_send_message(self, mock_req):
        mock_req.return_value = {"success": True}
        self.claw.send_message("Direct", to="agent-b", action_id="act_456")

        args, kwargs = mock_req.call_args
        body = kwargs.get("body") or (args[2] if len(args) > 2 else None)
        self.assertEqual(body["action_id"], "act_456")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd sdk-python && python -m pytest tests/test_action_context.py -v`
Expected: FAIL — `DashClaw has no attribute 'action_context'`

- [ ] **Step 3: Implement action_context in the Python SDK**

Add the following after line 937 in `sdk-python/dashclaw/client.py` (after the `send_message` method):

```python
    @contextmanager
    def action_context(self, action_id):
        """Context manager that auto-tags messages and assumptions with action_id.

        Usage:
            with claw.action_context("act_123") as ctx:
                ctx.send_message("Hello", to="agent-b")
                ctx.record_assumption({"assumption": "Staging is clear"})
                ctx.update_outcome(status="completed")
        """
        class _ActionContext:
            def __init__(ctx_self):
                ctx_self.action_id = action_id

            def send_message(ctx_self, body, to=None, message_type="info", attachments=None, **kwargs):
                kwargs["action_id"] = action_id
                return self.send_message(body, to=to, message_type=message_type, attachments=attachments, **kwargs)

            def record_assumption(ctx_self, assumption):
                if isinstance(assumption, dict):
                    assumption = {**assumption, "action_id": action_id}
                return self.record_assumption(assumption)

            def update_outcome(ctx_self, status=None, **kwargs):
                return self.update_outcome(action_id, status=status, **kwargs)

        yield _ActionContext()
```

Note: The `contextlib.contextmanager` import already exists at line 8 of `client.py`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd sdk-python && python -m pytest tests/test_action_context.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-python/dashclaw/client.py sdk-python/tests/test_action_context.py
git commit -m "feat(sdk-python): add action_context() context manager for automatic message tagging"
```

---

### Task 4: API — Summary Mode on Messages Endpoint

**Files:**
- Modify: `app/api/actions/[actionId]/messages/route.js`
- Modify: `app/lib/repositories/messagesContext.repository.js`
- Test: `__tests__/unit/action-messages-summary.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/unit/action-messages-summary.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqlMock, makeRequest } from '../helpers.js';

let mockSql;

const { mockGetOrgId } = vi.hoisted(() => ({
  mockGetOrgId: vi.fn(() => 'org_test'),
}));

vi.mock('@/lib/db.js', () => ({
  getSql: () => mockSql,
}));
vi.mock('@/lib/org.js', () => ({
  getOrgId: mockGetOrgId,
}));

import { GET } from '@/api/actions/[actionId]/messages/route.js';

function req(query = '') {
  return makeRequest(`http://localhost/api/actions/act_1/messages${query}`, {
    headers: { 'x-org-id': 'org_test' },
  });
}

describe('/api/actions/[actionId]/messages?summary=true', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns summary with count and participants when summary=true', async () => {
    const summaryResult = [{
      total: '3',
      participants: 'agent-a,agent-b',
      correlation: 'explicit',
      first_message_at: '2026-01-01T00:00:00Z',
      last_message_at: '2026-01-01T00:05:00Z',
    }];

    mockSql = createSqlMock({ taggedResponses: [summaryResult] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req('?summary=true'), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(3);
    expect(data.participants).toEqual(['agent-a', 'agent-b']);
    expect(data.correlation).toBe('explicit');
    expect(data.first_message_at).toBe('2026-01-01T00:00:00Z');
    expect(data.last_message_at).toBe('2026-01-01T00:05:00Z');
  });

  it('returns zero summary when no messages found', async () => {
    mockSql = createSqlMock({ taggedResponses: [[]] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req('?summary=true'), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
    expect(data.participants).toEqual([]);
  });

  it('still returns full messages when summary param is absent', async () => {
    const messages = [
      { id: 'msg_1', from_agent_id: 'a1', to_agent_id: 'a2', message_type: 'action', subject: 'Test', body: 'Hello', thread_id: 't1', urgent: false, created_at: '2026-01-01T00:00:00Z', action_id: 'act_1' },
    ];
    mockSql = createSqlMock({ taggedResponses: [messages] });
    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].body).toBe('Hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/action-messages-summary.test.js`
Expected: FAIL — summary mode not implemented yet

- [ ] **Step 3: Add getMessageSummaryByActionId to the repository**

Add after `getMessagesInTimeWindow` (line 197) in `app/lib/repositories/messagesContext.repository.js`:

```js
export async function getMessageSummaryByActionId(sql, orgId, actionId) {
  const rows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(
        STRING_AGG(DISTINCT from_agent_id, ',') ||
        CASE WHEN STRING_AGG(DISTINCT to_agent_id, ',') IS NOT NULL
          THEN ',' || STRING_AGG(DISTINCT to_agent_id, ',') ELSE '' END,
        ''
      ) AS participants,
      MIN(created_at) AS first_message_at,
      MAX(created_at) AS last_message_at
    FROM agent_messages
    WHERE org_id = ${orgId} AND action_id = ${actionId}
  `;
  return rows[0] || { total: 0, participants: '', first_message_at: null, last_message_at: null };
}
```

- [ ] **Step 4: Add summary mode to the route handler**

Modify `app/api/actions/[actionId]/messages/route.js`. Add the summary branch after the actionId validation (after line 18, before line 21). The full GET handler becomes:

```js
export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    if (!actionId || (!actionId.startsWith('ar_') && !actionId.startsWith('act_'))) {
      return NextResponse.json({ error: 'Valid action_id required' }, { status: 400 });
    }

    // Summary mode: return count + participants only
    const summaryParam = request.nextUrl.searchParams.get('summary');
    if (summaryParam === 'true') {
      const summary = await getMessageSummaryByActionId(sql, orgId, actionId);
      const total = parseInt(summary.total, 10) || 0;
      const participants = summary.participants
        ? [...new Set(summary.participants.split(',').filter(Boolean))]
        : [];
      return NextResponse.json({
        total,
        participants,
        correlation: total > 0 ? 'explicit' : 'none',
        first_message_at: summary.first_message_at || null,
        last_message_at: summary.last_message_at || null,
      });
    }

    // Full mode: existing logic unchanged
    const explicit = await getMessagesByActionId(sql, orgId, actionId);
    if (explicit.length > 0) {
      return NextResponse.json({
        messages: explicit.map(m => ({ ...m, match_type: 'explicit' })),
        correlation: 'explicit',
        total: explicit.length,
      });
    }

    const action = await getActionTimeBounds(sql, orgId, actionId);
    if (!action) {
      return NextResponse.json({ messages: [], correlation: 'none', total: 0 });
    }

    const windowStart = action.timestamp_start || new Date().toISOString();
    const windowEnd = action.timestamp_end || new Date().toISOString();
    const correlated = await getMessagesInTimeWindow(sql, orgId, action.agent_id, windowStart, windowEnd);

    return NextResponse.json({
      messages: correlated.map(m => ({ ...m, match_type: 'time_window' })),
      correlation: correlated.length > 0 ? 'time_window' : 'none',
      total: correlated.length,
    });
  } catch (error) {
    console.error('[ACTIONS/MESSAGES] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
```

Add the import at the top of the route file:

```js
import { getMessagesByActionId, getMessagesInTimeWindow, getMessageSummaryByActionId } from '@/lib/repositories/messagesContext.repository.js';
```

- [ ] **Step 5: Run all message tests to verify pass**

Run: `npx vitest run __tests__/unit/action-messages-summary.test.js __tests__/unit/action-messages.route.test.js`
Expected: All tests PASS (new summary tests + existing correlation tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/actions/[actionId]/messages/route.js app/lib/repositories/messagesContext.repository.js __tests__/unit/action-messages-summary.test.js
git commit -m "feat(api): add summary mode to action messages endpoint"
```

---

### Task 5: API — Message Summary in Action Detail Response

**Files:**
- Modify: `app/lib/repositories/actions.repository.js:327-340`
- Test: `__tests__/unit/action-detail-messages.test.js`

- [ ] **Step 1: Write the failing test**

```js
// __tests__/unit/action-detail-messages.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqlMock, makeRequest } from '../helpers.js';

let mockSql;

const { mockGetOrgId } = vi.hoisted(() => ({
  mockGetOrgId: vi.fn(() => 'org_test'),
}));

vi.mock('@/lib/db.js', () => ({
  getSql: () => mockSql,
}));
vi.mock('@/lib/org.js', () => ({
  getOrgId: mockGetOrgId,
}));

import { GET } from '@/api/actions/[actionId]/route.js';

function req() {
  return makeRequest('http://localhost/api/actions/act_1', {
    headers: { 'x-org-id': 'org_test' },
  });
}

describe('GET /api/actions/[actionId] — message_summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes message_summary in the response', async () => {
    const actionRow = {
      action_id: 'act_1', agent_id: 'agent-1', agent_name: 'Agent One',
      action_type: 'deploy', declared_goal: 'Deploy config', status: 'completed',
      risk_score: 45, confidence: 82, timestamp_start: '2026-01-01T00:00:00Z',
    };
    const loops = [];
    const assumptions = [];
    const messageSummary = { total: 2, participants: 'agent-1,agent-2', first_message_at: '2026-01-01T00:00:00Z', last_message_at: '2026-01-01T00:01:00Z' };

    // getActionWithRelations does 4 parallel queries: action, loops, assumptions, message summary
    mockSql = createSqlMock({
      taggedResponses: [[actionRow], loops, assumptions, [messageSummary]],
    });

    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message_summary).toBeDefined();
    expect(data.message_summary.total).toBe(2);
    expect(data.message_summary.participants).toEqual(['agent-1', 'agent-2']);
  });

  it('returns message_summary with zero total when no messages', async () => {
    const actionRow = {
      action_id: 'act_1', agent_id: 'agent-1', status: 'completed',
      action_type: 'deploy', declared_goal: 'Deploy',
    };
    const emptyMessageSummary = { total: 0, participants: '', first_message_at: null, last_message_at: null };

    mockSql = createSqlMock({
      taggedResponses: [[actionRow], [], [], [emptyMessageSummary]],
    });

    const ctx = { params: Promise.resolve({ actionId: 'act_1' }) };
    const res = await GET(req(), ctx);
    const data = await res.json();
    expect(data.message_summary.total).toBe(0);
    expect(data.message_summary.participants).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/action-detail-messages.test.js`
Expected: FAIL — `data.message_summary` is undefined

- [ ] **Step 3: Add message summary to getActionWithRelations**

Modify `app/lib/repositories/actions.repository.js`, the `getActionWithRelations` function at lines 327-340:

```js
export async function getActionWithRelations(sql, orgId, actionId) {
  const [actions, loops, assumptions, msgSummaryRows] = await Promise.all([
    sql`SELECT * FROM action_records WHERE action_id = ${actionId} AND org_id = ${orgId}`,
    sql`SELECT * FROM open_loops WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at DESC`,
    sql`SELECT * FROM assumptions WHERE action_id = ${actionId} AND org_id = ${orgId} ORDER BY created_at DESC`,
    sql`SELECT COUNT(*)::int AS total,
        COALESCE(STRING_AGG(DISTINCT from_agent_id, ',') || CASE WHEN STRING_AGG(DISTINCT to_agent_id, ',') IS NOT NULL THEN ',' || STRING_AGG(DISTINCT to_agent_id, ',') ELSE '' END, '') AS participants,
        MIN(created_at) AS first_message_at,
        MAX(created_at) AS last_message_at
      FROM agent_messages WHERE org_id = ${orgId} AND action_id = ${actionId}`,
  ]);

  if (actions.length === 0) return null;

  const msgRaw = msgSummaryRows[0] || { total: 0, participants: '', first_message_at: null, last_message_at: null };
  const msgTotal = parseInt(msgRaw.total, 10) || 0;

  return {
    action: actions[0],
    open_loops: loops,
    assumptions,
    message_summary: {
      total: msgTotal,
      participants: msgRaw.participants ? [...new Set(msgRaw.participants.split(',').filter(Boolean))] : [],
      first_message_at: msgRaw.first_message_at || null,
      last_message_at: msgRaw.last_message_at || null,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/action-detail-messages.test.js`
Expected: All tests PASS

- [ ] **Step 5: Run existing action detail tests to check no regressions**

Run: `npx vitest run __tests__/unit/action-detail.route.test.js`
Expected: All existing tests still PASS (the new `message_summary` field is additive)

- [ ] **Step 6: Commit**

```bash
git add app/lib/repositories/actions.repository.js __tests__/unit/action-detail-messages.test.js
git commit -m "feat(api): include message_summary in action detail response"
```

---

### Task 6: MessageTrail Component

**Files:**
- Create: `app/components/MessageTrail.js`

- [ ] **Step 1: Create the MessageTrail component**

```js
// app/components/MessageTrail.js
'use client';

import { useState } from 'react';
import { MessageSquare, Link2, Link as LinkDashed, ChevronDown, ChevronRight } from 'lucide-react';

function MatchBadge({ type }) {
  if (type === 'explicit') {
    return (
      <span title="Explicitly tagged by SDK" className="inline-flex items-center gap-1 text-[10px] text-green-500">
        <Link2 size={10} />
        linked
      </span>
    );
  }
  return (
    <span title="Inferred from timestamp proximity (±60s)" className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
      <LinkDashed size={10} />
      inferred
    </span>
  );
}

function MessageCard({ message, compact }) {
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <MessageSquare size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-300 font-medium">{message.from_agent_id}</span>
          <span className="text-zinc-600">→</span>
          <span className="text-zinc-400">{message.to_agent_id || 'broadcast'}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-500">{time}</span>
          <MatchBadge type={message.match_type} />
        </div>
        <div className={`text-sm text-zinc-300 mt-0.5 ${compact ? 'line-clamp-2' : ''}`}>
          {message.body}
        </div>
      </div>
    </div>
  );
}

/**
 * MessageTrail — displays messages correlated to an action.
 *
 * Props:
 *   actionId: string — the action_id to fetch messages for
 *   summary: { total, participants } — from the action detail response
 *   compact: boolean — if true, truncate message bodies to 2 lines (ledger mode)
 *   defaultExpanded: boolean — if true, start expanded (detail page mode)
 */
export default function MessageTrail({ actionId, summary, compact = true, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!summary || summary.total === 0) return null;

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!messages) {
      setLoading(true);
      try {
        const res = await fetch(`/api/actions/${actionId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Messages ({summary.total})
        {summary.participants?.length > 0 && (
          <span className="normal-case tracking-normal text-zinc-600">
            — {summary.participants.join(', ')}
          </span>
        )}
      </button>
      {expanded && (
        <div className="mt-2 pl-1">
          {loading && <div className="text-xs text-zinc-500">Loading messages...</div>}
          {messages && messages.map(msg => (
            <MessageCard key={msg.id} message={msg} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * TimelineMessages — renders messages inline in a chronological timeline.
 * Used by the decision detail page.
 */
export function TimelineMessage({ message }) {
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <div className="flex gap-3 py-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
          <MessageSquare size={14} className="text-blue-400" />
        </div>
        <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-center gap-2 text-xs mb-1">
          <span className="text-zinc-500">{time}</span>
          <span className="text-zinc-500 uppercase font-medium">Message</span>
          <span className="text-zinc-300">{message.from_agent_id}</span>
          <span className="text-zinc-600">→</span>
          <span className="text-zinc-400">{message.to_agent_id || 'broadcast'}</span>
          <MatchBadge type={message.match_type} />
        </div>
        <div className="text-sm text-zinc-300 whitespace-pre-wrap">{message.body}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component renders without errors**

Run: `npx vitest run --passWithNoTests` (ensure no import/syntax errors break the build)
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/components/MessageTrail.js
git commit -m "feat(ui): add MessageTrail and TimelineMessage components"
```

---

### Task 7: Decisions Ledger — Inline Message Trail

**Files:**
- Modify: `app/decisions/page.js:551-582`

- [ ] **Step 1: Add MessageTrail import at the top of the file**

Add to the imports section of `app/decisions/page.js`:

```js
import MessageTrail from '../components/MessageTrail';
```

- [ ] **Step 2: Add MessageTrail section in the expanded row**

In `app/decisions/page.js`, find the section after assumptions rendering (after line 580, before the closing `</>` of the `{detail && (` block at line 581). Add the MessageTrail between assumptions and the "View full decision record" link.

Replace the block from line 551 to line 601:

```js
                        {detail && (
                          <>
                            {detail.open_loops?.length > 0 && (
                              <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Open Loops ({detail.open_loops.length})</div>
                                <div className="space-y-1">
                                  {detail.open_loops.map(loop => (
                                    <div key={loop.loop_id} className="flex items-center gap-2 text-sm">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${loop.status === 'open' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                      <span className="text-zinc-300">{loop.description}</span>
                                      <span className="text-xs text-zinc-600">({loop.loop_type} / {loop.priority})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {detail.assumptions?.length > 0 && (
                              <div>
                                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Assumptions ({detail.assumptions.length})</div>
                                <div className="space-y-1">
                                  {detail.assumptions.map(asm => (
                                    <div key={asm.assumption_id} className="flex items-center gap-2 text-sm">
                                      {asm.validated ? <CheckCircle2 size={14} className="text-green-400" /> : asm.invalidated ? <XCircle size={14} className="text-red-400" /> : <Clock size={14} className="text-zinc-500" />}
                                      <span className="text-zinc-300">{asm.assumption}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {detail.message_summary && (
                              <MessageTrail
                                actionId={action.action_id}
                                summary={detail.message_summary}
                                compact={true}
                              />
                            )}
                          </>
                        )}

                        <div className="pt-2 flex items-center gap-4">
                          <Link href={`/decisions/${action.action_id}`} className="text-sm text-brand hover:text-brand-hover transition-colors duration-150">
                            View full decision record
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `${window.location.origin}/replay/${action.action_id}`;
                              navigator.clipboard.writeText(url);
                              alert('Replay link copied to clipboard!');
                            }}
                            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors"
                          >
                            <ExternalLink size={12} />
                            Share Replay
                          </button>
                        </div>
```

- [ ] **Step 3: Verify the page builds without errors**

Run: `npx next build --no-lint 2>&1 | head -20` (quick build check)
Or: `npx vitest run --passWithNoTests`
Expected: No import or JSX errors

- [ ] **Step 4: Commit**

```bash
git add app/decisions/page.js
git commit -m "feat(ui): add inline message trail to decisions ledger expandable rows"
```

---

### Task 8: Decision Detail Page — Chronological Timeline with Messages

**Files:**
- Modify: `app/decisions/[actionId]/page.js`

- [ ] **Step 1: Add message fetch to the existing fetchData function**

In `app/decisions/[actionId]/page.js`, add a `messages` state variable near the other state declarations (around line 22):

```js
const [messages, setMessages] = useState([]);
```

Add the messages import at the top:

```js
import { TimelineMessage } from '../../components/MessageTrail';
```

In the `fetchData` function (line 33-77), add a messages fetch in parallel with the existing guard decision fetch. After line 43 (`setAssumptions(data.assumptions || []);`), add:

```js
      // Fetch correlated messages
      try {
        const msgRes = await fetch(`/api/actions/${actionId}/messages`);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          setMessages(msgData.messages || []);
        }
      } catch { /* messages are optional */ }
```

- [ ] **Step 2: Build the timeline data structure**

Add a `useMemo` after the existing helpers (around line 100) that merges all events into a sorted timeline:

```js
  const timelineEvents = useMemo(() => {
    if (!action) return [];
    const events = [];

    // Guard decision
    if (guardDecision) {
      events.push({
        type: 'guard',
        timestamp: guardDecision.created_at,
        data: guardDecision,
      });
    }

    // Messages
    messages.forEach(msg => {
      events.push({
        type: 'message',
        timestamp: msg.created_at,
        data: msg,
      });
    });

    // Action started
    if (action.timestamp_start) {
      events.push({
        type: 'action_start',
        timestamp: action.timestamp_start,
        data: action,
      });
    }

    // Assumptions
    assumptions.forEach(asm => {
      events.push({
        type: 'assumption',
        timestamp: asm.created_at || action.timestamp_start,
        data: asm,
      });
    });

    // Outcome
    if (action.timestamp_end) {
      events.push({
        type: 'outcome',
        timestamp: action.timestamp_end,
        data: action,
      });
    }

    // Open loops
    loops.forEach(loop => {
      events.push({
        type: 'open_loop',
        timestamp: loop.created_at || action.timestamp_end || action.timestamp_start,
        data: loop,
      });
    });

    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [action, guardDecision, messages, assumptions, loops]);
```

- [ ] **Step 3: Add a Timeline tab to the existing tab navigation**

The page already has an `activeTab` state initialized to `'timeline'` (line 21). Find the existing tab rendering section and ensure there's a "Timeline" tab that renders the chronological view.

In the tab content area, add a timeline rendering block. Find where the existing tabs render their content and add:

```js
{activeTab === 'timeline' && (
  <div className="space-y-0">
    {timelineEvents.length === 0 && (
      <div className="text-sm text-zinc-500 py-4">No timeline events to display.</div>
    )}
    {timelineEvents.map((event, idx) => {
      if (event.type === 'message') {
        return <TimelineMessage key={`msg-${event.data.id}`} message={event.data} />;
      }
      if (event.type === 'guard') {
        return (
          <div key={`guard-${idx}`} className="flex gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={14} className="text-emerald-400" />
              </div>
              <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <span className="text-zinc-500 uppercase font-medium">Guard</span>
              </div>
              <div className="text-sm text-zinc-300">
                Decision: <span className={event.data.decision === 'allow' ? 'text-green-400' : 'text-red-400'}>{event.data.decision?.toUpperCase()}</span>
                {event.data.risk_score != null && <span className="text-zinc-500 ml-2">(risk {event.data.risk_score})</span>}
              </div>
            </div>
          </div>
        );
      }
      if (event.type === 'action_start') {
        return (
          <div key={`start-${idx}`} className="flex gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Rocket size={14} className="text-blue-400" />
              </div>
              <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <span className="text-zinc-500 uppercase font-medium">Action Started</span>
              </div>
              <div className="text-sm text-zinc-300">
                {event.data.action_type} — {event.data.declared_goal}
              </div>
              {event.data.reasoning && (
                <div className="text-xs text-zinc-500 mt-1">{event.data.reasoning}</div>
              )}
            </div>
          </div>
        );
      }
      if (event.type === 'assumption') {
        return (
          <div key={`asm-${event.data.assumption_id || idx}`} className="flex gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Target size={14} className="text-purple-400" />
              </div>
              <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <span className="text-zinc-500 uppercase font-medium">Assumption</span>
                {event.data.validated ? <CheckCircle2 size={12} className="text-green-400" /> : event.data.invalidated ? <XCircle size={12} className="text-red-400" /> : <Clock size={12} className="text-zinc-500" />}
              </div>
              <div className="text-sm text-zinc-300">{event.data.assumption}</div>
            </div>
          </div>
        );
      }
      if (event.type === 'outcome') {
        const isSuccess = event.data.status === 'completed';
        return (
          <div key={`outcome-${idx}`} className="flex gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${isSuccess ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center flex-shrink-0`}>
                {isSuccess ? <CheckCircle2 size={14} className="text-green-400" /> : <XCircle size={14} className="text-red-400" />}
              </div>
              <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <span className="text-zinc-500 uppercase font-medium">Outcome</span>
              </div>
              <div className="text-sm text-zinc-300">{event.data.output_summary || event.data.error_message}</div>
              <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                {event.data.duration_ms && <span>{event.data.duration_ms}ms</span>}
                {event.data.cost_estimate > 0 && <span>${parseFloat(event.data.cost_estimate).toFixed(4)}</span>}
                {(event.data.tokens_in > 0 || event.data.tokens_out > 0) && (
                  <span>{event.data.tokens_in} in / {event.data.tokens_out} out</span>
                )}
              </div>
            </div>
          </div>
        );
      }
      if (event.type === 'open_loop') {
        return (
          <div key={`loop-${event.data.loop_id || idx}`} className="flex gap-3 py-3">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={14} className="text-yellow-400" />
              </div>
              <div className="w-px flex-1 bg-[rgba(255,255,255,0.06)] mt-2" />
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex items-center gap-2 text-xs mb-1">
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <span className="text-zinc-500 uppercase font-medium">Open Loop</span>
                <span className={`text-xs ${event.data.status === 'open' ? 'text-yellow-500' : 'text-green-500'}`}>{event.data.status}</span>
              </div>
              <div className="text-sm text-zinc-300">{event.data.description}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{event.data.loop_type} / {event.data.priority}</div>
            </div>
          </div>
        );
      }
      return null;
    })}
  </div>
)}
```

- [ ] **Step 4: Verify the page builds**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No build errors

- [ ] **Step 5: Commit**

```bash
git add app/decisions/[actionId]/page.js
git commit -m "feat(ui): add chronological message timeline to decision detail page"
```

---

### Task 9: Swarm Graph — Inspectable Edges

**Files:**
- Modify: `app/swarm/page.js`

- [ ] **Step 1: Find the link context fetch logic**

Read `app/swarm/page.js` and locate where `selectedLink` triggers a data fetch for `linkContext`. Find the `useEffect` or handler that populates `linkContext.shared_actions` and `linkContext.messages`.

- [ ] **Step 2: Find the sidebar rendering for selected links**

Locate the JSX section that renders when `selectedLink` is set. This is where we'll add message and action content.

- [ ] **Step 3: Add message and action content to the link sidebar**

Replace the existing link context sidebar section with content that shows:
- Message count and last 5 messages (compact cards with sender, body preview, timestamp)
- Shared action count and last 3 actions (goal, risk badge, status)
- "View all" links to filtered `/messages` and `/decisions` pages

The implementation should follow the existing sidebar pattern. In the link context section, replace the current content with:

```js
{selectedLink && (
  <div className="space-y-4">
    <div className="text-sm font-medium text-zinc-300">
      {selectedLink.source} ↔ {selectedLink.target}
    </div>

    {/* Messages between agents */}
    <div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
        Messages ({linkContext.messages?.length || 0})
      </div>
      {linkContext.loading ? (
        <div className="text-xs text-zinc-500">Loading...</div>
      ) : linkContext.messages?.length > 0 ? (
        <div className="space-y-2">
          {linkContext.messages.slice(0, 5).map(msg => (
            <div key={msg.id} className="p-2 bg-surface-tertiary rounded text-xs">
              <div className="flex items-center gap-1 text-zinc-500 mb-0.5">
                <span className="text-zinc-300">{msg.from_agent_id}</span>
                <span>→</span>
                <span>{msg.to_agent_id || 'broadcast'}</span>
                <span className="ml-auto">{new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
              </div>
              <div className="text-zinc-400 line-clamp-2">{msg.body}</div>
            </div>
          ))}
          {linkContext.messages.length > 5 && (
            <a
              href={`/messages?agents=${selectedLink.source},${selectedLink.target}`}
              className="text-xs text-brand hover:text-brand-hover"
            >
              View all {linkContext.messages.length} messages →
            </a>
          )}
        </div>
      ) : (
        <div className="text-xs text-zinc-600">No messages</div>
      )}
    </div>

    {/* Shared actions */}
    <div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
        Shared Actions ({linkContext.shared_actions?.length || 0})
      </div>
      {linkContext.shared_actions?.length > 0 ? (
        <div className="space-y-2">
          {linkContext.shared_actions.slice(0, 3).map(act => (
            <a key={act.action_id} href={`/decisions/${act.action_id}`} className="block p-2 bg-surface-tertiary rounded text-xs hover:bg-surface-secondary transition-colors">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  act.status === 'completed' ? 'bg-green-500' : act.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="text-zinc-300 truncate">{act.declared_goal || act.action_type}</span>
                {act.risk_score >= 70 && <span className="text-red-400 ml-auto">risk {act.risk_score}</span>}
                {act.risk_score >= 40 && act.risk_score < 70 && <span className="text-amber-400 ml-auto">risk {act.risk_score}</span>}
              </div>
            </a>
          ))}
          {linkContext.shared_actions.length > 3 && (
            <a
              href={`/decisions?agents=${selectedLink.source},${selectedLink.target}`}
              className="text-xs text-brand hover:text-brand-hover"
            >
              View all {linkContext.shared_actions.length} actions →
            </a>
          )}
        </div>
      ) : (
        <div className="text-xs text-zinc-600">No shared actions</div>
      )}
    </div>
  </div>
)}
```

Note: The exact insertion point depends on the current sidebar structure. Read the file first to find where `selectedLink` conditionally renders content, and replace that section.

- [ ] **Step 4: Verify the page builds**

Run: `npx next build --no-lint 2>&1 | head -20`
Expected: No build errors

- [ ] **Step 5: Commit**

```bash
git add app/swarm/page.js
git commit -m "feat(ui): add message and action content to swarm graph edge sidebar"
```

---

### Task 10: Final Integration Verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including new and existing tests

- [ ] **Step 2: Run governance boundary check**

Run: `npm run governance:boundary:check`
Expected: PASS — no new core API routes were added

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 4: Verify dev server starts**

Run: `npm run dev` (check it starts without errors, then Ctrl+C)
Expected: Server starts on port 3000

- [ ] **Step 5: Commit any lint fixes if needed**

```bash
git add -A
git commit -m "chore: lint fixes for decision-message correlation feature"
```

- [ ] **Step 6: Final summary commit**

Only if there were no lint-fix commits needed. Otherwise skip.
