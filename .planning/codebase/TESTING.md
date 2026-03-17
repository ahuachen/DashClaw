# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `vitest.config.js`

**Assertion Library:**
- Vitest built-in (`expect`)

**React Testing:**
- `@testing-library/react` 16.x
- `jsdom` 29.x (configured as Vitest environment)
- `@vitejs/plugin-react` for JSX transform

**Coverage:**
- `@vitest/coverage-v8` available but no coverage thresholds enforced

**Run Commands:**
```bash
npm run test            # Run in watch mode (interactive)
npm run test -- --run   # Run once (CI mode, used in .github/workflows/ci.yml)
```

## Test File Organization

**Location:**
- All tests are co-located in `__tests__/unit/` at the project root
- Shared helpers live in `__tests__/helpers.js`
- No co-located `*.test.js` files next to source files

**Naming:**
- Route tests: `{route-name}.route.test.js` — e.g., `actions.route.test.js`, `guard.route.test.js`
- Repository contract tests: `{name}.repository.test.js` or `repositories.contract.test.js`
- Pure logic tests: `{module-name}.test.js` — e.g., `guard-engine.test.js`, `scoring-profiles.test.js`
- SDK tests: `sdk-v2.test.js`, `hitl.test.js`

**Structure:**
```
__tests__/
├── helpers.js          # makeRequest(), createSqlMock() shared factories
└── unit/
    ├── actions.route.test.js
    ├── agents.repository.test.js
    ├── guard-engine.test.js
    ├── sdk-v2.test.js
    └── ... (76 total test files)
```

## Test Structure

**Route Test Pattern:**
```javascript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

// 1. Declare all mocks via vi.hoisted() FIRST
const { mockSql, mockFoo, mockBar } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockFoo: vi.fn(),
  mockBar: vi.fn(),
}));

// 2. vi.mock() calls at module level (before imports)
vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/foo.js', () => ({ foo: mockFoo }));

// 3. Import the route AFTER mocks
import { GET, POST, DELETE } from '@/api/actions/route.js';

// 4. Default values used across tests
const defaultQuota = { allowed: true, usage: 0, limit: 1000, percent: 0 };

// 5. beforeEach resets all mocks and env
beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://unit-test';
  process.env.NODE_ENV = 'test';
  delete process.env.SOME_FEATURE_FLAG;

  mockSql.mockImplementation(async () => []);
  mockFoo.mockResolvedValue(defaultQuota);
});

// 6. Describe blocks by HTTP method or logical group
describe('/api/actions GET', () => {
  it('returns actions with pagination defaults', async () => {
    mockFoo.mockResolvedValue({ actions: [], total: 0, stats: {} });
    const res = await GET(makeRequest('http://localhost/api/actions', {
      headers: { 'x-org-id': 'org_1' },
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.actions).toHaveLength(0);
  });
});
```

**Pure Logic Test Pattern:**
```javascript
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from '@/lib/module.js';

describe('functionUnderTest', () => {
  it('does the expected thing', () => {
    const result = functionUnderTest(input);
    expect(result).toBe(expectedOutput);
  });
});
```

## Mocking

**Framework:** Vitest (`vi.mock`, `vi.fn`, `vi.hoisted`)

**Critical Rule — hoisting order:**
All mock factory functions must be declared inside `vi.hoisted()` BEFORE any `vi.mock()` calls. This is required because `vi.mock()` is hoisted to the top of the file by Vitest's transform, and references to variables declared with `const` would be in the temporal dead zone otherwise.

```javascript
// CORRECT: Declare mocks with vi.hoisted() first
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock('@/lib/module.js', () => ({ fn: mockFn }));

// WRONG: This causes a ReferenceError at runtime
const mockFn = vi.fn();
vi.mock('@/lib/module.js', () => ({ fn: mockFn }));
```

**SQL Client Mock — Standard Pattern:**
```javascript
// Supports both tagged-template calls (sql`...`) and .query() calls
const mockSql = Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) });

// Set default behavior in beforeEach
mockSql.mockImplementation(async () => []);
mockSql.query.mockImplementation(async () => []);

// Override per test for specific responses
mockSql.mockResolvedValueOnce([{ id: 'row_1' }]);
mockSql.query.mockResolvedValueOnce([{ count: 5 }]);
```

**SDK / fetch Mock Pattern:**
```javascript
function mockFetch(data = {}, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  });
}

// In test
global.fetch = mockFetch({ action_id: 'act_1' });
global.fetch = mockFetch({ error: 'Blocked' }, false, 403);
```

**What to Mock:**
- `@/lib/db.js` — always mock `getSql` to return a `mockSql` instance
- `@/lib/repositories/*.repository.js` — mock all repository functions used by the route
- `@/lib/validate.js` — mock validators (return `{ valid: true/false, data, errors }`)
- `@/lib/events.js` — mock `publishOrgEvent` (verify it was called with correct args)
- `@/lib/usage.js` — mock quota/billing functions
- External services: `@/lib/identity.js`, `@/lib/security.js`, `@/lib/embeddings.js`
- `global.fetch` — for SDK tests

**What NOT to Mock:**
- The route module being tested (import it directly after mocks)
- `../helpers.js` (always import real helpers)
- Pure utility functions with no side effects (test them directly)
- `next/server` — use actual `NextResponse` from the real module

## Fixtures and Factories

**`makeRequest` — Mock Next.js Request:**
Located at `__tests__/helpers.js`.

```javascript
import { makeRequest } from '../helpers.js';

// Minimal GET request with org header
const req = makeRequest('http://localhost/api/actions', {
  headers: { 'x-org-id': 'org_1' },
});

// POST with body and role header
const req = makeRequest('http://localhost/api/policies', {
  headers: { 'x-org-id': 'org_1', 'x-org-role': 'admin' },
  body: { name: 'Block Deploy', policy_type: 'block_action_type' },
});

// GET with query params (encode them in the URL string)
const req = makeRequest('http://localhost/api/actions?agent_id=a1&status=running', {
  headers: { 'x-org-id': 'org_1' },
});
```

**`createSqlMock` — Stateful SQL Mock:**
Located at `__tests__/helpers.js`. Use for repository contract tests where you need to assert on SQL text/params.

```javascript
import { createSqlMock } from '../helpers.js';

const sql = createSqlMock({
  taggedResponses: [[{ action_id: 'a1' }]],   // Consumed in order for sql`` calls
  queryResponses: [[{ total: '5' }]],           // Consumed in order for sql.query() calls
});

// After test, assert on what was called
expect(sql.taggedCalls[0].text).toContain('INSERT INTO action_records');
expect(sql.queryCalls[0].params).toEqual(['org_1', 'agent_1']);
```

**Inline Default Fixtures:**
Define default objects at the top of each test file, not in helper files:

```javascript
const defaultGuardDecision = { decision: 'allow', reasons: [], warnings: [], matched_policies: [] };
const defaultQuota = { allowed: true, usage: 0, limit: 1000, percent: 0 };
const defaultAction = { action_id: 'act_test', agent_id: 'agent_1', action_type: 'build', declared_goal: 'Test' };
```

## Coverage

**Requirements:** No enforced thresholds

**View Coverage:**
```bash
npx vitest --coverage
```

## Test Types

**Unit Tests (76 files in `__tests__/unit/`):**
All tests are unit tests. Three sub-categories:

1. **Route handler tests** (e.g., `actions.route.test.js`, `guard.route.test.js`): Import and call route handler functions directly (`GET`, `POST`, `PATCH`, `DELETE`). Mock all dependencies. Assert on HTTP status codes, response bodies, and side-effect mock invocations.

2. **Repository contract tests** (e.g., `repositories.contract.test.js`, `agents.repository.test.js`, `routing-registry.contract.test.js`): Import repository functions directly. Use `createSqlMock` to verify SQL text structure and parameter ordering. Assert that the correct tables are queried and the correct data shapes are returned.

3. **Pure logic tests** (e.g., `guard-engine.test.js`, `scoring-profiles.test.js`, `missionControl.test.js`): Import pure utility functions. No HTTP setup. Test business logic in isolation.

**Integration Tests:**
- `npm run sdk:integration` — cross-SDK behavioral contract (Node.js)
- `npm run sdk:integration:python` — Python SDK contract parity
- `npm run test:api` — full API smoke test against a live server (requires env)

**E2E Tests:** Not used.

**Live SDK Tests:**
- `npm run sdk:live` — exercises SDK against a real running instance
- `npm run sdk:live:python` — Python equivalent

## Common Patterns

**Testing HTTP Status Codes:**
```javascript
const res = await POST(makeRequest(url, { headers, body }));
expect(res.status).toBe(201);
const data = await res.json();
expect(data.action_id).toBeDefined();
```

**Testing Role-Based Access Control:**
```javascript
it('returns 403 for non-admins', async () => {
  const res = await DELETE(makeRequest(url, {
    headers: { 'x-org-id': 'org_1', 'x-org-role': 'member' },
  }));
  expect(res.status).toBe(403);
});
```

**Testing Feature Flags via `process.env`:**
```javascript
beforeEach(() => {
  delete process.env.ENFORCE_AGENT_SIGNATURES;
  delete process.env.DASHCLAW_CLOSED_ENROLLMENT;
});

it('returns 403 when closed enrollment blocks unknown agent', async () => {
  process.env.DASHCLAW_CLOSED_ENROLLMENT = 'true';
  mockHasAgentAction.mockResolvedValue(false);
  const res = await POST(makeRequest(url, { headers, body }));
  expect(res.status).toBe(403);
  const data = await res.json();
  expect(data.code).toBe('AGENT_NOT_REGISTERED');
});
```

**Testing Error Responses with Structured Codes:**
```javascript
it('returns 402 when quota exceeded', async () => {
  mockCheckQuotaFast.mockResolvedValue({ allowed: false, usage: 1000, limit: 1000, percent: 100 });
  const res = await POST(makeRequest(url, { headers, body }));
  expect(res.status).toBe(402);
  const data = await res.json();
  expect(data.code).toBe('QUOTA_EXCEEDED');
});
```

**Testing Mock Call Arguments:**
```javascript
it('publishes POLICY_UPDATED event on create', async () => {
  // ... setup ...
  await POST(makeRequest(url, { headers, body }));
  expect(mockPublishOrgEvent).toHaveBeenCalledWith(
    'policy.updated',
    expect.objectContaining({ change_type: 'created' })
  );
});
```

**Testing Async Error Paths:**
```javascript
it('returns 500 on repository error', async () => {
  mockListActions.mockRejectedValue(new Error('db down'));
  const res = await GET(makeRequest(url, { headers }));
  expect(res.status).toBe(500);
});
```

**Testing SDK Error Classes:**
```javascript
it('throws GuardBlockedError on block response', async () => {
  global.fetch = mockFetch({ reason: 'Cost too high', error: 'generic' }, false, 403);
  await expect(claw.guard({ action_type: 'test' })).rejects.toThrow('Cost too high');
});

// Check error properties
try {
  await claw.guard({ action_type: 'test' });
} catch (err) {
  expect(err.status).toBe(422);
  expect(err.details).toEqual({ field: 'x' });
}
```

**Testing SQL Query Structure (Repository Contracts):**
```javascript
it('scopes query to org', async () => {
  const sql = createSqlMock({ queryResponses: [[{ action_id: 'a1' }], [{ total: '1' }], []] });
  await actionsRepository.listActions(sql, 'org_1', { limit: 10 });
  expect(sql.queryCalls[0].text).toContain('FROM action_records');
  expect(sql.queryCalls[0].params[0]).toBe('org_1');
});
```

## CI Integration

Tests run in CI via `.github/workflows/ci.yml`. The full CI sequence is:

1. `npm run lint`
2. `npm run docs:check`
3. `npm run openapi:check`
4. `npm run api:inventory:check`
5. `npm run governance:boundary:check`
6. `npm run route-sql:check`
7. `npm run reliability:ws1:check`
8. `node scripts/security-scan.js`
9. **`npm run test -- --run`** (unit tests)
10. `npm run sdk:integration`
11. `npm run sdk:integration:python`
12. `npm run build`

All checks must pass before a build succeeds. Tests run with `--run` flag (single-pass, no watch).

---

*Testing analysis: 2026-03-17*
