# Messages in Governance Surfaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold agent-to-agent messaging into the governance surfaces (Mission Control and Decision detail) so messages are discoverable where operators already look, without leaving the orphaned `/messages` route as the only entry point.

**Architecture:** Minimal additive surgery. Keep the rich standalone `/messages` page as a deep-link target. On the Decision detail page, add a small correlation + thread metadata header above the existing message timeline (promoting the two pieces that today only live in `CommunicationTrail` on `/replay`). On Mission Control, add a compact "Recent Agent Comms" card fed by a pure selector over `/api/messages?direction=inbox`. No changes to `MessageTrail`, `CommunicationTrail`, `RecentMessagesCard`, `/dashboard`, or the sidebar in this plan — those are separate cleanups; this plan stays focused on making messages visible from Mission Control and Decision detail.

**Tech Stack:** Next.js 16 App Router, React, Tailwind, Vitest (jsdom), existing `useRealtime` hook, existing `/api/messages` and `/api/actions/[actionId]/messages` endpoints.

**Constraints from project memory:**
- No PRs. Commit and push to `main` after each task.
- Never hardcode hex — use CSS tokens from `app/globals.css` / Tailwind theme (e.g. `bg-surface-tertiary`, `border-border`, `text-brand`).
- Touch only what this plan covers; flag unrelated issues rather than fixing them.
- Full test suite runs in plan verification (`npm test`), not targeted patterns.

---

## File Structure

**New files:**
- `app/lib/messages/selectors.js` — pure selector `selectUrgentUnread(messages, { limit })` filtering + sorting recent agent messages for compact display. Pure function, easy to test.
- `__tests__/unit/message-selectors.test.js` — vitest coverage of the selector.
- `app/mission-control/components/RecentCommsCard.jsx` — Mission Control card rendering the top N urgent/unread messages with deep-links to `/messages` (full inbox) and per-message permalinks.

**Modified files:**
- `app/decisions/[actionId]/page.js` — add correlation badge + thread-name subheader above the Chronological Timeline card when `messages[]` is non-empty. Reuses the response data already fetched at line 53.
- `app/mission-control/page.js` — import and mount `RecentCommsCard` in the right-hand column; add one fetch to the existing `Promise.all` so SSR-like state is coherent.

**Untouched (explicit):**
- `app/components/MessageTrail.js`, `TimelineMessage` — already correct for its layout.
- `app/components/CommunicationTrail.js` — keep for `/replay`; its expanded bubble-chat UI is replay-specific.
- `app/components/RecentMessagesCard.js` + `DraggableDashboard.js` — live on orphaned `/dashboard`; out of scope.
- `app/components/Sidebar.js` — `/messages` stays reachable via deep-links from the new card; explicit sidebar entry is a separate UX decision.

---

## Task 1: Pure selector for urgent/unread messages

**Files:**
- Create: `app/lib/messages/selectors.js`
- Test: `__tests__/unit/message-selectors.test.js`

**Rationale:** A pure selector lets us unit-test the filter/sort/cap logic without React. The Mission Control card stays thin. `urgent` is a boolean in the schema; the selector and tests use truthy semantics to tolerate either boolean or numeric shapes.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/message-selectors.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { selectUrgentUnread } from '@/lib/messages/selectors.js';

describe('selectUrgentUnread', () => {
  const base = (over = {}) => ({
    id: 'm1',
    from_agent_id: 'agent_a',
    to_agent_id: 'agent_b',
    message_type: 'info',
    status: 'sent',
    urgent: false,
    is_read: false,
    created_at: '2026-04-14T12:00:00.000Z',
    ...over,
  });

  it('returns unread messages (status=sent, is_read=false)', () => {
    const msgs = [
      base({ id: 'unread', is_read: false, status: 'sent' }),
      base({ id: 'read', is_read: true, status: 'sent' }),
      base({ id: 'archived', is_read: false, status: 'archived' }),
    ];
    const result = selectUrgentUnread(msgs);
    expect(result.map(m => m.id)).toEqual(['unread']);
  });

  it('sorts urgent ahead of non-urgent, then by created_at desc', () => {
    const msgs = [
      base({ id: 'old_urgent', urgent: true, created_at: '2026-04-14T10:00:00.000Z' }),
      base({ id: 'new_normal', urgent: false, created_at: '2026-04-14T12:00:00.000Z' }),
      base({ id: 'new_urgent', urgent: true, created_at: '2026-04-14T11:00:00.000Z' }),
    ];
    const result = selectUrgentUnread(msgs);
    expect(result.map(m => m.id)).toEqual(['new_urgent', 'old_urgent', 'new_normal']);
  });

  it('treats urgent as truthy (tolerates boolean or numeric shape)', () => {
    const msgs = [
      base({ id: 'bool_urgent', urgent: true, created_at: '2026-04-14T09:00:00.000Z' }),
      base({ id: 'num_urgent', urgent: 1, created_at: '2026-04-14T08:00:00.000Z' }),
      base({ id: 'bool_normal', urgent: false, created_at: '2026-04-14T12:00:00.000Z' }),
      base({ id: 'num_normal', urgent: 0, created_at: '2026-04-14T11:00:00.000Z' }),
    ];
    const result = selectUrgentUnread(msgs);
    // urgent (true or 1) sorted by time desc, then non-urgent sorted by time desc
    expect(result.map(m => m.id)).toEqual(['bool_urgent', 'num_urgent', 'bool_normal', 'num_normal']);
  });

  it('caps result length with limit option (default 5)', () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      base({ id: `m${i}`, created_at: `2026-04-14T12:0${i}:00.000Z` })
    );
    expect(selectUrgentUnread(msgs)).toHaveLength(5);
    expect(selectUrgentUnread(msgs, { limit: 3 })).toHaveLength(3);
  });

  it('returns empty array for null/undefined/non-array input', () => {
    expect(selectUrgentUnread(null)).toEqual([]);
    expect(selectUrgentUnread(undefined)).toEqual([]);
    expect(selectUrgentUnread('nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/unit/message-selectors.test.js`
Expected: FAIL with "Failed to resolve import" or "selectUrgentUnread is not defined"

- [ ] **Step 3: Write minimal implementation**

Create `app/lib/messages/selectors.js`:

```javascript
/**
 * selectUrgentUnread — pure selector for the Mission Control Recent Comms card.
 *
 * Keeps only sent+unread messages, sorts urgent ahead of normal, then newest first.
 * @param {Array} messages  Raw list from /api/messages?direction=inbox
 * @param {{limit?: number}} opts
 * @returns {Array}
 */
export function selectUrgentUnread(messages, opts = {}) {
  const { limit = 5 } = opts;
  if (!Array.isArray(messages)) return [];

  const unread = messages.filter(m => m && m.status === 'sent' && !m.is_read);

  unread.sort((a, b) => {
    const ua = a.urgent ? 1 : 0;
    const ub = b.urgent ? 1 : 0;
    if (ua !== ub) return ub - ua;
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });

  return unread.slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/unit/message-selectors.test.js`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add app/lib/messages/selectors.js __tests__/unit/message-selectors.test.js
git commit -m "feat(messages): add selectUrgentUnread pure selector for comms surfacing"
```

---

## Task 2: RecentCommsCard component

**Files:**
- Create: `app/mission-control/components/RecentCommsCard.jsx`

**Rationale:** The Mission Control page already co-locates its bespoke cards under `app/mission-control/components/` (e.g. `OperationsFeed.jsx`, `RuntimeSummaryCard.jsx`). Follow that convention.

- [ ] **Step 1: Create the component**

Create `app/mission-control/components/RecentCommsCard.jsx`:

```javascript
'use client';

import Link from 'next/link';
import { MessageSquare, AlertCircle, Inbox, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { selectUrgentUnread } from '../../lib/messages/selectors.js';

const TYPE_VARIANTS = {
  action: 'warning',
  info: 'info',
  lesson: 'success',
  question: 'info',
  status: 'default',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * RecentCommsCard — Mission Control compact view of urgent/unread agent
 * messages. Deep-links to /messages for the full inbox.
 *
 * Props:
 *   messages: Array | null  Raw inbox payload; null = loading
 *   limit: number           Max rows to show (default 5)
 */
export default function RecentCommsCard({ messages, limit = 5 }) {
  if (messages === null) {
    return <CardSkeleton />;
  }

  const visible = selectUrgentUnread(messages, { limit });
  const unreadTotal = Array.isArray(messages)
    ? messages.filter(m => m && m.status === 'sent' && !m.is_read).length
    : 0;
  const overflow = Math.max(0, unreadTotal - visible.length);

  const viewAllLink = (
    <Link
      href="/messages"
      className="text-xs text-brand hover:text-brand-hover transition-colors inline-flex items-center gap-1"
    >
      View all <ArrowRight size={12} />
    </Link>
  );

  return (
    <Card hover={false}>
      <CardHeader
        title="Recent Agent Comms"
        icon={MessageSquare}
        count={unreadTotal > 0 ? unreadTotal : undefined}
        action={viewAllLink}
      />
      <CardContent>
        {visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No unread agent messages"
            description="Urgent and unread inter-agent messages will surface here."
          />
        ) : (
          <div className="space-y-1.5">
            {visible.map((msg) => (
              <Link
                key={msg.id}
                href={`/messages?message_id=${encodeURIComponent(msg.id)}`}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-surface-tertiary border border-border transition-colors duration-150 hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 border border-border bg-surface-secondary">
                  <MessageSquare size={12} className="text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand flex-shrink-0" />
                    {msg.urgent && (
                      <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                    )}
                    <span className="text-sm font-semibold text-text-primary truncate">
                      {msg.from_agent_id || 'Unknown'}
                      <span className="text-zinc-600 font-normal"> → </span>
                      <span className="text-zinc-300 font-normal">
                        {msg.to_agent_id || 'broadcast'}
                      </span>
                    </span>
                    <Badge variant={TYPE_VARIANTS[msg.message_type] || 'default'} size="xs">
                      {msg.message_type}
                    </Badge>
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-0.5">
                    {msg.subject || msg.body || '(no content)'}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-600 flex-shrink-0 mt-1">
                  {timeAgo(msg.created_at)}
                </span>
              </Link>
            ))}
            {overflow > 0 && (
              <div className="text-[10px] text-zinc-600 pt-1">
                +{overflow} more unread — <Link href="/messages" className="text-brand hover:text-brand-hover">view inbox</Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run lint to verify syntax**

Run: `npm run lint -- app/mission-control/components/RecentCommsCard.jsx`
Expected: PASS, zero warnings.

- [ ] **Step 3: Commit**

```bash
git add app/mission-control/components/RecentCommsCard.jsx
git commit -m "feat(mission-control): add RecentCommsCard component for urgent/unread agent messages"
```

---

## Task 3: Wire RecentCommsCard into Mission Control

**Files:**
- Modify: `app/mission-control/page.js`

**Rationale:** Add one fetch to the existing `Promise.all`, one state hook, and one card mount. Surgically minimal.

- [ ] **Step 1: Add import + state + fetch**

In `app/mission-control/page.js`, after line 19 (the `MissionControlCapabilityHealthCard` import), add:

```javascript
import RecentCommsCard from './components/RecentCommsCard.jsx';
```

After line 129 (the `capabilityHealthError` state), add:

```javascript
  const [messages, setMessages] = useState(null);
```

In the `Promise.all` at line 144, extend the array and destructuring:

```javascript
      const [signalsRes, loopsRes, healthRes, actionsRes, pendingRes, metricsRes, capabilityHealthRes, messagesRes] = await Promise.all([
        fetch(withParams('/api/actions/signals')),
        fetch(withParams('/api/actions/loops', ['status=open', 'limit=20'])),
        fetch('/api/health'),
        fetch(withParams('/api/actions', ['limit=12'])),
        fetch(withParams('/api/actions', ['status=pending_approval', 'limit=10'])),
        fetch(withParams('/api/actions/stats')),
        fetch('/api/capabilities/health?limit=20'),
        fetch(withParams('/api/messages', ['direction=inbox', 'limit=50'])),
      ]);
```

After the `capabilityHealthRes` handling block (around line 173), add:

```javascript
      if (messagesRes.ok) {
        const messagesJson = await messagesRes.json();
        setMessages(messagesJson.messages || []);
      } else {
        setMessages([]);
      }
```

In the `catch` block (around line 174), add `setMessages([]);` so the card exits its skeleton on failure.

In the `useRealtime` callback (around line 190), use a branched filter so `message.created` gates on from/to agent fields instead of the generic `agent_id` field that message envelopes don't have:

```javascript
  useRealtime(useCallback((event, payload) => {
    if (!['action.created', 'action.updated', 'loop.created', 'loop.updated', 'guard.decision.created', 'signal.detected', 'message.created'].includes(event)) return;

    if (agentId) {
      if (event === 'message.created') {
        const msg = payload?.message || payload;
        if (msg && msg.from_agent_id !== agentId && msg.to_agent_id !== agentId) return;
      } else {
        const source = payload.action || payload.loop || payload.decision || payload;
        if (source.agent_id && source.agent_id !== agentId) return;
      }
    }

    fetchAll();
  }, [agentId, fetchAll]));
```

Rationale: Branches the filter by event type so `message.created` gates on from/to agent fields instead of the generic `agent_id` field that message envelopes don't have.

- [ ] **Step 2: Mount the card**

In the right-hand column (after the `RuntimeSummaryCard` wrapper around line 564), add:

```javascript
        {/* Recent Agent Comms */}
        <RecentCommsCard messages={messages} />
```

- [ ] **Step 3: Run lint**

Run: `npm run lint -- app/mission-control/page.js`
Expected: PASS.

- [ ] **Step 4: Start dev server and eyeball**

Run: `npm run dev`
Navigate to `http://localhost:3000/mission-control`.
Expected:
- Card appears under Runtime Summary on desktop.
- Shows skeleton on first paint.
- Either shows up to 5 urgent/unread messages with badges, or the empty state "No unread agent messages".
- Clicking a message row navigates to `/messages?message_id=…`.
- Clicking "View all" navigates to `/messages`.

Test with user (per global rules: ask user to test in browser). Report findings back in chat; do not claim success without eyeballing.

- [ ] **Step 5: Commit**

```bash
git add app/mission-control/page.js
git commit -m "feat(mission-control): mount RecentCommsCard in right-column grid"
```

---

## Task 4: Decision detail — correlation + thread header

**Files:**
- Modify: `app/decisions/[actionId]/page.js`

**Rationale:** The page already fetches messages at line 53 and iterates them into the timeline at line 458. Today it loses two useful signals that only surface in `/replay` via `CommunicationTrail`: (1) the `correlation` field ("explicit" vs "time_window") which tells the operator whether the message linkage is tagged or inferred, and (2) the first thread name when messages share a thread. Promote both to a small header above the Chronological Timeline card.
The fetch resets prior state up front so re-invocation cannot leak stale correlation or thread names, and queries `/api/messages/threads?limit=100` so the thread lookup covers the endpoint's maximum page size.

- [ ] **Step 1: Track correlation + thread metadata in existing fetch**

In `app/decisions/[actionId]/page.js`, add two state hooks near the existing `messages` state (around line 29):

```javascript
  const [messageCorrelation, setMessageCorrelation] = useState('none');
  const [messageThreadName, setMessageThreadName] = useState(null);
```

Replace the existing `fetch(/api/actions/${actionId}/messages)` block (lines ~51-58) with:

```javascript
      // Fetch correlated messages + metadata for the timeline header
      try {
        setMessages([]);
        setMessageCorrelation('none');
        setMessageThreadName(null);
        const msgRes = await fetch(`/api/actions/${actionId}/messages`);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const msgs = msgData.messages || [];
          setMessages(msgs);
          setMessageCorrelation(msgData.correlation || 'none');

          const firstThreadId = msgs.find(m => m.thread_id)?.thread_id;
          if (firstThreadId) {
            try {
              const tRes = await fetch('/api/messages/threads?limit=100');
              if (tRes.ok) {
                const tData = await tRes.json();
                const thread = (tData.threads || []).find(t => t.id === firstThreadId);
                if (thread?.name) setMessageThreadName(thread.name);
              }
            } catch { /* thread fetch is best-effort */ }
          }
        }
      } catch { /* messages are optional */ }
```

- [ ] **Step 2: Render the header strip above the Chronological Timeline card**

Locate the Chronological Timeline `<Card>` (around line 449-450). Immediately inside the Card, *before* `<CardHeader …>`, the card already has just the header; we want a new sub-row below `CardHeader` that shows correlation + thread. Modify the block at lines 449-454 from:

```javascript
              <Card hover={false}>
                <CardHeader title="Chronological Timeline" icon={Clock} count={timelineEvents.length} />
                <CardContent>
                  <div className="space-y-0">
                    {timelineEvents.length === 0 && (
                      <div className="text-sm text-zinc-500 py-4">No timeline events to display.</div>
                    )}
```

to:

```javascript
              <Card hover={false}>
                <CardHeader title="Chronological Timeline" icon={Clock} count={timelineEvents.length} />
                <CardContent>
                  {(messages.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 pb-3 mb-3 border-b border-border text-[11px]">
                      <span className="text-zinc-500 uppercase tracking-wider font-medium">
                        Messages: {messages.length}
                      </span>
                      {messageCorrelation === 'time_window' && (
                        <span
                          className="text-[10px] font-bold text-amber-500/80 uppercase tracking-widest border border-amber-500/20 bg-amber-500/10 rounded px-1.5 py-0.5"
                          title="No messages tagged this action explicitly; showing messages sent during the action's time window."
                        >
                          inferred from timing
                        </span>
                      )}
                      {messageCorrelation === 'explicit' && (
                        <span
                          className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest border border-emerald-500/20 bg-emerald-500/10 rounded px-1.5 py-0.5"
                          title="Messages were tagged with this action_id by the SDK."
                        >
                          explicitly linked
                        </span>
                      )}
                      {messageThreadName && (
                        <span className="text-zinc-500">
                          Thread: <span className="text-zinc-300">{messageThreadName}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="space-y-0">
                    {timelineEvents.length === 0 && (
                      <div className="text-sm text-zinc-500 py-4">No timeline events to display.</div>
                    )}
```

- [ ] **Step 3: Lint**

Run: `npm run lint -- app/decisions/[actionId]/page.js`
Expected: PASS.

- [ ] **Step 4: Start dev server and eyeball**

Run: `npm run dev` (if not already).
Navigate to `http://localhost:3000/decisions` and click through to a decision that has correlated messages. Test three cases:
1. Decision with SDK-tagged messages → "explicitly linked" emerald pill.
2. Decision with only time-window correlated messages → "inferred from timing" amber pill.
3. Decision with messages in a thread → thread name shown.
4. Decision with zero messages → header strip hidden entirely; only the empty-timeline row renders.

Ask the user to eyeball in the browser and confirm before proceeding.

- [ ] **Step 5: Commit**

```bash
git add app/decisions/[actionId]/page.js
git commit -m "feat(decisions): surface message correlation + thread metadata on decision detail timeline"
```

---

## Task 5: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `message-selectors.test.js`.

If any pre-existing tests fail that are unrelated to this plan, STOP and report to the user — do not silently fix unrelated failures (project rule: flag, don't fix).

- [ ] **Step 2: Run lint across the project**

Run: `npm run lint`
Expected: zero new errors. If pre-existing warnings appear in files you did not touch, leave them.

- [ ] **Step 3: Run the API + OpenAPI guardrails**

Run: `npm run openapi:check && npm run api:inventory:check`
Expected: no drift (this plan does not add or change API routes).

- [ ] **Step 4: User acceptance**

Ask the user to:
1. Reload `/mission-control` on the dev server and confirm the Recent Agent Comms card renders (or shows empty state) and links work.
2. Open a decision detail page with messages and confirm the correlation pill + thread name appear as expected.

Do not claim "done" until the user confirms.

- [ ] **Step 5: Push to main**

```bash
git push origin main
```

(Per `feedback_no_prs.md`: commit and push to main, no PRs.)

---

## Out of Scope (explicitly deferred)

- Sidebar link to `/messages` — future IA decision.
- Cleanup of `RecentMessagesCard` on orphaned `/dashboard`.
- Consolidating `MessageTrail` / `TimelineMessage` / `CommunicationTrail` into one component family.
- Adding `decision_id` as a first-class message column (today correlation is inferred or via `action_id`).
- Filters on the new card (by agent, by type, etc.).

Raise these as separate plans if the user prioritizes them.
