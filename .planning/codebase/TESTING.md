# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- Framework: Vitest 4.1.0
- Config: No explicit `vitest.config.js` in root (uses default)
- Entry point: `__tests__/` directory
- Package manager script: `npm test` → runs vitest

**Assertion Library:**
- Vitest built-in (via `vitest` package imports)
- Uses: `expect(value).toBe()`, `expect(fn).toHaveBeenCalled()`, etc.

**Run Commands:**
```bash
npm test                    # Run all tests (vitest)
npm test -- --coverage      # Run with coverage (via @vitest/coverage-v8)
npm run sdk:integration     # Cross-SDK integration tests (Node/Python)
npm run sdk:integration:python  # Python SDK unittest runner
npm run test:api            # Full API test suite
npm run startup:smoke       # Startup smoke tests
```

## Test File Organization

**Location:**
- All unit tests: `__tests__/unit/` directory
- Co-located in same project, not in `src/` mirrors

**Naming:**
- Format: `[subject].test.js` (e.g., `validate.test.js`, `security-headers.test.js`)
- Route tests: `[feature].route.test.js` (e.g., `agents.route.test.js`, `policies.route.test.js`)
- Repository contract tests: `repositories.contract.test.js`, `[entity].repository.test.js`
- Component tests: `[component].test.js`

**Directory Structure:**
```
__tests__/
├── unit/
│   ├── validate.test.js
│   ├── agents.route.test.js
│   ├── repositories.contract.test.js
│   ├── security-headers.test.js
│   └── [80+ other test files]
└── helpers.js              # Shared test utilities
```

## Test Structure

**Suite Organization:**
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('featureName', () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
  });

  afterEach(() => {
    // Cleanup after each test
    process.env.NODE_ENV = originalValue;
  });

  describe('nested context', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { ...data };
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result.field).toBe(expectedValue);
    });
  });
});
```

**Patterns:**

1. **Setup Pattern:**
   - `beforeEach()` clears mocks and resets environment
   - `afterEach()` restores original values (e.g., `process.env.NODE_ENV`)
   - Mocks defined with `vi.hoisted()` at top for module-level injection

2. **Teardown Pattern:**
   - `afterEach()` restores `process.env` values changed during test
   - Mocks cleared: `vi.clearAllMocks()`

3. **Assertion Pattern:**
   - `.toBe()` for primitives and exact identity
   - `.toEqual()` for object/array deep equality
   - `.toHaveBeenCalled()`, `.toHaveBeenCalledWith()` for mock verification
   - `.toContain()` for substring/array membership
   - `.resolves.toBe()` or `.rejects.toThrow()` for promises

**Example (from `__tests__/unit/agents.route.test.js`):**
```javascript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockListAgentsForOrg, mockAttachAgentConnections } = vi.hoisted(() => ({
  mockListAgentsForOrg: vi.fn(),
  mockAttachAgentConnections: vi.fn(),
}));

vi.mock('@/lib/repositories/agents.repository.js', () => ({
  listAgentsForOrg: mockListAgentsForOrg,
  attachAgentConnections: mockAttachAgentConnections,
}));

import { GET } from '@/api/agents/route.js';

describe('/api/agents GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
    mockListAgentsForOrg.mockResolvedValue([]);
  });

  it('returns agents for the org', async () => {
    const agents = [
      { agent_id: 'agent_1', agent_name: 'Builder', status: 'online' },
    ];
    mockListAgentsForOrg.mockResolvedValue(agents);

    const res = await GET(makeRequest('http://localhost/api/agents', {
      headers: { 'x-org-id': 'org_1' },
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agents).toHaveLength(1);
  });
});
```

## Mocking

**Framework:** Vitest's `vi` object

**Patterns:**

1. **Module Mocking:**
   ```javascript
   vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
   vi.mock('@/lib/repositories/agents.repository.js', () => ({
     listAgentsForOrg: mockListAgentsForOrg,
     attachAgentConnections: mockAttachAgentConnections,
   }));
   ```

2. **Hoisted Mocks (for module-level injection):**
   ```javascript
   const { mockSql, mockListAgents } = vi.hoisted(() => ({
     mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
     mockListAgents: vi.fn(),
   }));
   
   vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
   ```

3. **Function Mocks:**
   ```javascript
   const mockFn = vi.fn();
   mockFn.mockResolvedValue(data);        // Return resolved promise
   mockFn.mockRejectedValue(error);       // Return rejected promise
   mockFn.mockImplementation(impl);       // Custom implementation
   ```

4. **Mock Verification:**
   ```javascript
   expect(mockListAgentsForOrg).toHaveBeenCalled();
   expect(mockListAgentsForOrg).toHaveBeenCalledWith(mockSql, 'org_1');
   expect(mockListAgentsForOrg).not.toHaveBeenCalled();
   ```

**What to Mock:**
- External services: DB client, HTTP clients, auth providers
- Repository layer functions (in route tests)
- Registry/routing operations
- Environment-dependent operations

**What NOT to Mock:**
- Validation functions (test the actual logic)
- Helper utilities like `createSqlMock()`, `makeRequest()`
- Core business logic if testing end-to-end behavior

## Fixtures and Factories

**Test Data Pattern:**
Helper functions create mock data with sensible defaults:

```javascript
function makeRequest(url, { headers = {}, body } = {}) {
  const parsed = new URL(url);
  return {
    url,
    headers: new Headers(headers),
    json: async () => body,
    nextUrl: parsed,
  };
}

function makeTaskRow(overrides = {}) {
  return {
    id: 'rt_test123',
    org_id: 'org_1',
    title: 'Test task',
    status: 'pending',
    ...overrides,  // Allow field overrides
  };
}

function makeAgent(overrides = {}) {
  return {
    id: 'a1',
    name: 'Agent 1',
    capabilities: JSON.stringify(['code']),
    status: 'available',
    ...overrides,
  };
}
```

**Location:**
- Shared factories: `__tests__/helpers.js` (e.g., `makeRequest()`, `createSqlMock()`)
- Test-specific factories: Inline in test file (e.g., `makeTaskRow()`, `makeAgent()`, `makeTestResponse()`)

**Database Mock (`createSqlMock`):**
```javascript
export function createSqlMock({ taggedResponses = [], queryResponses = [] } = {}) {
  const taggedCalls = [];
  const queryCalls = [];

  const sql = (strings, ...values) => {
    taggedCalls.push({
      text: String.raw({ raw: strings }, ...Array(values.length).fill('?')),
      values,
    });
    if (taggedResponses.length === 0) return Promise.resolve([]);
    return Promise.resolve(taggedResponses.shift());
  };

  sql.query = async (text, params = []) => {
    queryCalls.push({ text, params });
    if (queryResponses.length === 0) return [];
    return queryResponses.shift();
  };

  sql.taggedCalls = taggedCalls;      // Track calls for assertions
  sql.queryCalls = queryCalls;
  return sql;
}
```

**Usage Example:**
```javascript
const sql = createSqlMock({
  queryResponses: [
    [{ action_id: 'a1' }],           // First query response
    [{ total: '2' }],                 // Second query response
    [{ total: '2', completed: '1' }], // Third query response
  ],
});

const result = await actionsRepository.listActions(sql, 'org_1', { limit: 10 });
expect(sql.queryCalls).toHaveLength(3);
expect(sql.queryCalls[0].text).toContain('FROM action_records');
```

## Coverage

**Requirements:** No explicit coverage threshold enforced

**View Coverage:**
```bash
npm test -- --coverage
```

**Tool:** `@vitest/coverage-v8` (v8 engine for coverage reports)

## Test Types

**Unit Tests:**
- Scope: Individual functions, validation logic, repository methods
- Approach: Mocked dependencies, isolated behavior
- Location: `__tests__/unit/`
- Examples: `validate.test.js`, `drift.test.js`, `feedback.test.js`

**Integration Tests (Repository Contract):**
- Scope: Repository methods with mocked SQL to verify contract (parameter order, return shape)
- Approach: `createSqlMock()` to simulate DB client
- Location: `__tests__/unit/repositories.contract.test.js`
- Verifies: Methods scope by `org_id`, return correct types, call SQL with expected params

**Route Tests:**
- Scope: Full route handler (GET/POST/PATCH/DELETE) with mocked dependencies
- Approach: Mock repositories, create fake `Request`, execute handler
- Location: `__tests__/unit/[feature].route.test.js`
- Example: `agents.route.test.js` tests GET behavior, status codes, response shape

**Security Tests:**
- Scope: Security headers, input validation, SSRF/injection prevention
- Approach: Unit-style with mocked request/response
- Location: `__tests__/unit/security-*.test.js`
- Examples: `security-headers.test.js` tests CSP/HSTS/XSS headers

**E2E Tests:**
- Framework: Not currently used in codebase
- Alternative: `npm run test:api` runs full API test suite against live server
- Startup: `npm run startup:smoke` performs startup readiness checks

## Common Patterns

**Async Testing:**
```javascript
it('should return resolved value', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expectedValue);
});

it('should handle promise rejection', () => {
  return expect(asyncFunction()).rejects.toThrow('error message');
});

it('uses mockResolvedValue', async () => {
  mockFn.mockResolvedValue({ data: 'value' });
  const result = await mockFn();
  expect(result.data).toBe('value');
});
```

**Error Testing:**
```javascript
it('should validate required fields', () => {
  const result = validateActionRecord({ agent_id: 'agent_1' });
  expect(result.valid).toBe(false);
  expect(result.errors).toContain('action_type is required');
});

it('should enforce enum values', () => {
  const result = validateActionRecord({
    agent_id: 'agent_1',
    action_type: 'invalid-type',
  });
  expect(result.valid).toBe(false);
  expect(result.errors[0]).toContain('must be one of');
});
```

**Query Verification (Repository Tests):**
```javascript
const sql = createSqlMock({ queryResponses: [[{ action_id: 'a1' }]] });
await actionsRepository.listActions(sql, 'org_1', { limit: 10 });

expect(sql.queryCalls[0].text).toContain('FROM action_records');
expect(sql.queryCalls[0].params).toEqual(['org_1', undefined, undefined, undefined, 10, 0]);
```

## Guardrail Check Scripts

Pre-commit hooks and validation scripts enforce quality:

**API Contract Validation:**
- `npm run openapi:generate` — Generate OpenAPI spec from route handlers
- `npm run openapi:check` — Verify OpenAPI spec matches current code (detects API drift)

**Documentation:**
- `npm run docs:check` — Ensure SDK docs match API surface
- `npm run api:inventory:generate` — Auto-generate API route inventory
- `npm run api:inventory:check` — Verify inventory is up-to-date

**Database Access:**
- `npm run route-sql:check` — Enforce repository pattern (no direct SQL in routes)
- `npm run route-sql:baseline:generate` — Create baseline snapshot of SQL usage in routes

**SDK Integration:**
- `npm run sdk:integration` — Test Node SDK against live server
- `npm run sdk:integration:python` — Run Python SDK unittest suite

**Contract Testing:**
- `npm run contracts:check` — Validate repository method contracts (strict mode)
- `npm run contracts:check:warn` — Contract validation in warn-only mode

**Pre-commit Hook:**
- `npm run pre-commit` — Runs: generate-api-inventory, generate-openapi, stage artifacts, contracts-check (warn)
- Runs automatically before commits (via git hooks)
- Failing steps marked `failHook: true` will block commit

## Test Coverage by Feature

**Core Platform:**
- Actions: `actions.route.test.js`, `action-detail.route.test.js`, `action-messages.test.js`
- Agents: `agents.route.test.js`, `agents.repository.test.js`
- Health/Setup: `health.route.test.js`, `setup-status.route.test.js`, `setup-proof.route.test.js`
- Webhooks: `webhooks.route.test.js`, `webhooks.approval.test.js`

**Governance:**
- Guard: `guard.route.test.js`
- Policies: `policies.route.test.js`, `policies-import.route.test.js`, `policies-proof.route.test.js`
- Compliance: `compliance-*.route.test.js` (8+ files)

**Learning Loop:**
- Learning recommendations: `learning-recommendations.route.test.js`, `learning-recommendation-*.route.test.js` (4 files)
- Learning analytics: `learning-analytics*.route.test.js` (3 files)

**Routing:**
- Routing registry/router: `routing-registry.contract.test.js`, `routing-router.test.js`
- Routing routes: `routing-*.route.test.js` (5 files: agents, health, stats, tasks detail, tasks)

**Security:**
- Security headers: `security-headers.test.js`
- Security scanner: `security-scanner.test.js`, `security-scan.route.test.js`
- Prompt injection guard: `prompt-injection-guard.test.js`

**Utilities & Validation:**
- Core validation: `validate.test.js`
- Repository contracts: `repositories.contract.test.js`
- Auth/config: `auth-config.test.js`
- Signals: `signals.test.js`

---

*Testing analysis: 2026-04-11*
