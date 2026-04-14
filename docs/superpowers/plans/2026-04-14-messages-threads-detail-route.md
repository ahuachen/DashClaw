# `GET /api/messages/threads/[threadId]` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-id thread lookup route so the decision detail page can resolve a single thread name without paginating through `/api/messages/threads`, eliminating the pagination ceiling surfaced by the messages-in-governance follow-up review.

**Architecture:** Thin HTTP wrapper over the existing `getThreadById(sql, orgId, threadId)` repository function (already imported and used by the PATCH handler in `app/api/messages/threads/route.js`). New route at `app/api/messages/threads/[threadId]/route.js` exposes a `GET` handler with org scoping and a 404 branch. The decision detail page switches its thread-name lookup from the list endpoint to the new per-id endpoint. OpenAPI + API inventory regenerate automatically via the pre-commit hook.

**Tech Stack:** Next.js 16 App Router route handler, existing `getSql` / `getOrgId` helpers, vitest for route tests. No SDK method added in this plan — the route is HTTP-discoverable via docs and can get a typed SDK surface in a separate follow-up.

**Constraints from project memory:**
- No PRs. Commit and push to main.
- When adding an API route, update: `app/docs/page.js`, `sdk/README.md`, `sdk-python/README.md`, `docs/sdk-parity.md`, `docs/api-inventory.md` (auto-regen), `PROJECT_DETAILS.md`. SDK method surface is deferred to a follow-up — the docs describe the HTTP endpoint only.
- Run `npm test`, `npm run lint`, `npm run openapi:check`, `npm run api:inventory:check` in final verification.
- Tokenization / `.impeccable.md` rules do not apply (no UI change beyond a URL swap).

---

## File Structure

**New files:**
- `app/api/messages/threads/[threadId]/route.js` — GET handler; 200 with `{ thread }` on hit, 404 on miss, 400 on invalid-prefix id, 500 on internal error.
- `__tests__/unit/messages-threads-detail.route.test.js` — vitest coverage for the four response shapes, mocking `getSql` and `getOrgId`.

**Modified files:**
- `app/decisions/[actionId]/page.js` — replace the list-and-find thread lookup with a direct `GET /api/messages/threads/${encodeURIComponent(firstThreadId)}`.
- `app/docs/page.js` — add the new route to `navItems` and render a `MethodEntry` describing it.
- `sdk/README.md` — document the HTTP route under a "Threads" section so the "Copy as Markdown" button surfaces it.
- `sdk-python/README.md` — same doc addition, python-side.
- `docs/sdk-parity.md` — bump the route count and mark the new route as HTTP-exposed, SDK-unbound in both Node and Python columns.
- `PROJECT_DETAILS.md` — add the new route to the canonical route list.

**Auto-regenerated (pre-commit hook):**
- `docs/api-inventory.json`
- `docs/api-inventory.md`
- `docs/openapi/critical-stable.openapi.json`

**Untouched (explicit out-of-scope):**
- The Node SDK (`sdk/src/*`) — no new `getThread(id)` method in this plan. Separate follow-up.
- The Python SDK (`sdk-python/*`) — same.
- `/api/messages/threads` list route — still valid and still used by `/messages` page and anywhere else; no changes.
- `CommunicationTrail.js` still uses the list endpoint — leaving it alone; can migrate in a separate pass when that component is next touched.

---

## Task 1: Add the route handler

**Files:**
- Create: `app/api/messages/threads/[threadId]/route.js`

- [ ] **Step 1: Write the route**

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { getThreadById } from '../../../../lib/repositories/messagesContext.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { threadId } = await params;

    if (!threadId || !threadId.startsWith('mt_')) {
      return NextResponse.json({ error: 'Valid thread_id required' }, { status: 400 });
    }

    const thread = await getThreadById(sql, orgId, threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    console.error('Message thread GET error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching thread' }, { status: 500 });
  }
}
```

Rationale points:
- Prefix validation guards against path-traversal garbage and keeps 400 errors terse.
- `getThreadById` already filters by `org_id`, so cross-org lookup is blocked at the repo layer; no need to double-check here.
- Response shape matches the `PATCH` handler (`{ thread }`), so clients reading either get the same payload.

- [ ] **Step 2: Lint**

Run: `npm run lint -- "app/api/messages/threads/[threadId]/route.js"`
Expected: zero warnings.

- [ ] **Step 3: Commit**

```bash
git add "app/api/messages/threads/[threadId]/route.js"
git commit -m "feat(messages): add GET /api/messages/threads/[threadId] per-id lookup"
```

Let the pre-commit hook regenerate `docs/api-inventory.*` and `docs/openapi/*`; they will be captured in the commit.

---

## Task 2: Route handler tests

**Files:**
- Create: `__tests__/unit/messages-threads-detail.route.test.js`

**Rationale:** Follow the mocking pattern used in existing route tests like `__tests__/unit/action-messages.route.test.js` and `__tests__/unit/action-detail.route.test.js`. Mock `getSql` to return a stub and `getOrgId` to return a deterministic org, and mock the repository module so the test pins on `getThreadById`'s return value.

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db.js', () => ({ getSql: vi.fn(() => ({})) }));
vi.mock('@/lib/org.js', () => ({ getOrgId: vi.fn(() => 'org_test') }));
vi.mock('@/lib/repositories/messagesContext.repository.js', () => ({
  getThreadById: vi.fn(),
}));

const { getThreadById } = await import('@/lib/repositories/messagesContext.repository.js');

function requestFor(pathSuffix) {
  return new Request(`http://localhost/api/messages/threads/${pathSuffix}`);
}

describe('GET /api/messages/threads/[threadId]', () => {
  beforeEach(() => {
    getThreadById.mockReset();
  });

  it('returns 200 with the thread body when it exists', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockResolvedValueOnce({
      id: 'mt_abc123',
      name: 'Incident #42',
      status: 'open',
      org_id: 'org_test',
    });

    const res = await GET(requestFor('mt_abc123'), { params: Promise.resolve({ threadId: 'mt_abc123' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thread.id).toBe('mt_abc123');
    expect(body.thread.name).toBe('Incident #42');
  });

  it('returns 404 when the thread does not exist in the org', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockResolvedValueOnce(null);

    const res = await GET(requestFor('mt_missing'), { params: Promise.resolve({ threadId: 'mt_missing' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 400 for an id without the mt_ prefix', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');

    const res = await GET(requestFor('nope'), { params: Promise.resolve({ threadId: 'nope' }) });
    expect(res.status).toBe(400);
    expect(getThreadById).not.toHaveBeenCalled();
  });

  it('returns 500 when the repository throws', async () => {
    const { GET } = await import('@/api/messages/threads/[threadId]/route.js');
    getThreadById.mockRejectedValueOnce(new Error('db down'));

    const res = await GET(requestFor('mt_abc123'), { params: Promise.resolve({ threadId: 'mt_abc123' }) });
    expect(res.status).toBe(500);
  });
});
```

Note: the vitest config aliases `@` → `./app`, so the route import `@/api/messages/threads/[threadId]/route.js` resolves correctly and the repository import matches the mock.

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- --run __tests__/unit/messages-threads-detail.route.test.js`
Expected: FAIL — the route file does not exist yet. (If Task 1 already landed in an earlier iteration, the test may pass immediately; that's acceptable.)

- [ ] **Step 3: If Task 1 landed before this task in your execution order, tests pass now**

If the previous implementer landed Task 1 first, the test suite passes immediately — TDD order was inverted but behavior is identical. Note in the report.

- [ ] **Step 4: Commit**

```bash
git add __tests__/unit/messages-threads-detail.route.test.js
git commit -m "test(messages): cover GET /api/messages/threads/[threadId] route"
```

---

## Task 3: Switch the decision detail page to the per-id endpoint

**Files:**
- Modify: `app/decisions/[actionId]/page.js`

- [ ] **Step 1: Update the thread-name lookup**

Locate the block (currently around lines 66-74 after the recent hardening):

```javascript
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
```

Replace with:

```javascript
          const firstThreadId = msgs.find(m => m.thread_id)?.thread_id;
          if (firstThreadId) {
            try {
              const tRes = await fetch(`/api/messages/threads/${encodeURIComponent(firstThreadId)}`);
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.thread?.name) setMessageThreadName(tData.thread.name);
              }
            } catch { /* thread fetch is best-effort */ }
          }
```

Behavior delta:
- O(1) lookup instead of list-and-find.
- No pagination ceiling.
- 404 from the new endpoint silently leaves `messageThreadName` null (same fail-quiet behavior as before).

- [ ] **Step 2: Lint**

Run: `npm run lint -- "app/decisions/[actionId]/page.js"`
Expected: zero warnings.

- [ ] **Step 3: Commit**

```bash
git add "app/decisions/[actionId]/page.js"
git commit -m "refactor(decisions): use per-id thread endpoint for header lookup"
```

---

## Task 4: Update web docs (`app/docs/page.js`)

**Files:**
- Modify: `app/docs/page.js`

**Rationale:** The `/docs` page is the canonical web-facing surface; the "Copy as Markdown" button reads through `/api/docs/raw` which follows the same structure. Memory entry "SDK Documentation Checklist" explicitly lists this file.

- [ ] **Step 1: Locate the Threads section in `navItems`**

Grep the file for the existing `/api/messages/threads` documentation entry. Determine the exact position pattern (immediately after that entry is the natural insertion point).

- [ ] **Step 2: Add the new entry**

Append a new `MethodEntry` for `GET /api/messages/threads/{threadId}` with:
- Method: `GET`
- Path: `/api/messages/threads/{threadId}`
- Request: path parameter `threadId` (string, prefix `mt_`)
- Response shape: `{ thread: { id, org_id, name, participants, status, summary, created_by, resolved_at, created_at, updated_at } }`
- Status codes: 200 success, 400 invalid id, 404 not found, 500 internal error
- Scope: org-scoped; returns only threads belonging to the caller's org.

Follow the formatting convention of the existing `GET /api/messages/threads` entry — do NOT invent new JSX structure.

- [ ] **Step 3: Update the `navItems` array**

Add the new route under the same section as the list route. Use whatever anchor ID the docs page uses (e.g. `threads-get-by-id` — match existing casing).

- [ ] **Step 4: Lint**

Run: `npm run lint -- app/docs/page.js`
Expected: zero warnings.

- [ ] **Step 5: Commit**

```bash
git add app/docs/page.js
git commit -m "docs(web): document GET /api/messages/threads/[threadId]"
```

---

## Task 5: Update the SDK READMEs and parity matrix

**Files:**
- Modify: `sdk/README.md`
- Modify: `sdk-python/README.md`
- Modify: `docs/sdk-parity.md`
- Modify: `PROJECT_DETAILS.md`

**Rationale:** These docs enumerate all HTTP routes. The SDKs don't yet expose a typed method for this route (see plan out-of-scope note), so the entries should describe the HTTP endpoint only, matching how the list route is documented today for both SDKs.

- [ ] **Step 1: Locate the Threads section in each file**

For each file, grep for the current `/api/messages/threads` or "Message Threads" heading. Add the new route immediately after the list route entry.

- [ ] **Step 2: Add the entry text**

Minimum content per file:
- **Route:** `GET /api/messages/threads/{threadId}`
- **Auth:** API key (same as list route).
- **Request:** path parameter `threadId` beginning with `mt_`.
- **Response (200):** `{ "thread": { "id": "mt_...", "name": "...", "status": "open|resolved", "summary": "...", "participants": [...], ... } }`
- **Errors:** 400 invalid id, 404 not found, 500.
- **Example curl** for each README.

Match the tone and formatting of the neighboring route entries exactly. Do not rewrite or reorganize unrelated sections.

For `docs/sdk-parity.md`, bump the route count (it currently states "80 methods" in CLAUDE.md — the parity matrix has its own table; increment the appropriate cell and mark the new route as HTTP-only under both Node and Python columns).

For `PROJECT_DETAILS.md`, add the new route to the route list; order alphabetically within its section.

- [ ] **Step 3: Sanity check**

Run: `npm run docs:check`
Expected: pass. If the check enforces a particular doc shape that the new entries violate, fix the entries before committing.

- [ ] **Step 4: Commit**

```bash
git add sdk/README.md sdk-python/README.md docs/sdk-parity.md PROJECT_DETAILS.md
git commit -m "docs(sdk): document GET /api/messages/threads/[threadId] in README + parity"
```

---

## Task 6: Regenerate API inventory + OpenAPI and verify

The pre-commit hook already regenerates `docs/api-inventory.*` and `docs/openapi/*` on changes that touch `app/api/`. Confirm the artifacts are up to date.

- [ ] **Step 1: Regenerate explicitly**

Run:
```bash
npm run api:inventory:generate
npm run openapi:generate
```

Expected: both exit cleanly. If either regenerates files, inspect the diff — it should only add the new route.

- [ ] **Step 2: Verify drift checks pass**

Run:
```bash
npm run api:inventory:check
npm run openapi:check
```

Expected: both pass.

- [ ] **Step 3: Commit any regenerated artifacts**

If the pre-commit hook already swept them in earlier tasks, `git status` shows clean — skip the commit. Otherwise:

```bash
git add docs/api-inventory.json docs/api-inventory.md docs/openapi/critical-stable.openapi.json
git commit -m "chore(docs): regenerate API inventory + OpenAPI for threads/[threadId]"
```

---

## Task 7: Full verification + push

- [ ] **Step 1: `npm test`**

Run: `npm test -- --run`
Expected: all tests pass (1508+ pre-existing + the 4 new route tests = 1512+).

- [ ] **Step 2: `npm run lint`**

Expected: zero warnings.

- [ ] **Step 3: `npm run openapi:check && npm run api:inventory:check`**

Expected: both pass.

- [ ] **Step 4: Ask user to smoke-test**

Reload a decision detail page that previously rendered a thread name and confirm the thread name still appears (now sourced from the new endpoint). Also spot-check that `/messages` (the full inbox) still works — the list endpoint is unchanged but worth a sanity glance.

- [ ] **Step 5: Push**

```bash
git push origin main
```

---

## Out of Scope (explicit)

- Typed SDK method on `sdk/` (Node) or `sdk-python/` (Python). Easy follow-up: `getThread(threadId)` (Node) / `get_thread(thread_id)` (Python). The parity matrix gets recounted then.
- Migrating `app/components/CommunicationTrail.js` off the list endpoint. It still works; migrate when that component is next touched.
- Caching headers on the new route. Thread names rarely change but also aren't hot enough to warrant an `ETag`/`Cache-Control` header dance right now.
- A `HEAD` handler for the route. Not needed by any known caller.
- Extending the response to embed message counts per thread. The current consumers only need `thread.name`; adding counts would belong in a separate ticket with broader thread-detail UX.
