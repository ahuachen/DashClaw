# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- Route files: `app/api/[resource]/route.js` (Next.js App Router convention)
- Repository files: `app/lib/repositories/[entity].repository.js` (kebab-case with `.repository` suffix)
- Library/utility files: `app/lib/[feature].js` (kebab-case, plain `.js`)
- Test files: `__tests__/unit/[subject].test.js` or `.route.test.js` (camelCase subject, `.test.js` suffix)

**Functions:**
- Handler exports: `GET`, `POST`, `PATCH`, `DELETE` (uppercase, Next.js route convention)
- Library functions: `camelCase` (e.g., `validateActionRecord`, `generateApiKey`, `estimateCost`)
- Repository functions: `camelCase` (e.g., `listAgentsForOrg`, `createActionRecord`, `attachAgentConnections`)
- Private helpers: `camelCase` (e.g., `isMissingTable`, `maxIso`, `redactAny`)

**Variables:**
- Environment: `SCREAMING_SNAKE_CASE` (e.g., `DATABASE_URL`, `NODE_ENV`, `DASHCLAW_API_KEY`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `ACTION_TYPES`, `LOOP_PRIORITIES`, `ACTION_STATUSES`)
- Local/parameter variables: `camelCase` (e.g., `agentId`, `orgId`, `includeConnections`)
- URL search parameters: `snake_case` (e.g., `include_connections`, `agent_id`, `exclude_status`)
- Database columns: `snake_case` (e.g., `agent_id`, `org_id`, `timestamp_start`)

**IDs and Prefixes (Critical):**
- Snippet IDs: `sn_` prefix (e.g., `sn_abc123`)
- Message thread IDs: `mt_` prefix (e.g., `mt_msg456`)
- Context thread IDs: `ct_` prefix (e.g., `ct_ctx789`)
- Learning recommendation IDs: `lrec_` prefix (e.g., `lrec_rec123`)
- Routing task IDs: `rt_` prefix (e.g., `rt_task456`)
- Evaluation IDs: `evs_` prefix (e.g., `evs_eval789`)
- Organization: `org_` prefix (e.g., `org_1`, `org_42`)
- Agent: `agent_` prefix (e.g., `agent_123`, `agent_builder`)

**Types:**
- React components: `PascalCase` (e.g., `PageLayout`, `PublicNavbar`, `MethodEntry`)

**SDK Naming (Important Distinction):**
- Node SDK uses `camelCase` method names (e.g., `createAction`, `recordAssumption`, `updateOutcome`, `create_action` deprecated)
- Python SDK uses `snake_case` method names (e.g., `create_action`, `record_assumption`, `update_outcome`)
- API responses and database always use `snake_case` (e.g., `action_id`, `timestamp_start`)

## Code Style

**Formatting:**
- ESLint config: `.eslintrc.json` extends `next/core-web-vitals`
- No Prettier config in root (formatter not enforced, relies on ESLint)
- JavaScript (not TypeScript) in `app/` directory
- File imports use absolute paths with `@/` alias (e.g., `@/lib/db.js`, `@/api/agents/route.js`)

**Linting:**
- Tool: ESLint 8.57.1
- Config: `.eslintrc.json` with `next/core-web-vitals` preset
- Run: `npm run lint`
- Pre-commit guardrails: `npm run pre-commit` runs multiple validation checks

**Guardrail Scripts (Pre-commit Enforcement):**
- `npm run route-sql:check` — Enforces no direct SQL in route files; must use repository layer
- `npm run openapi:check` — Validates OpenAPI spec hasn't drifted from code
- `npm run api:inventory:check` — Verifies API route inventory is current
- `npm run docs:check` — Ensures SDK docs match actual API surface
- `npm run contracts:check` — Validates repository method contracts (modes: default or `--mode=warn`)

## Import Organization

**Order:**
1. Node/external imports first (e.g., `import crypto from 'crypto'`, `import fs from 'node:fs/promises'`)
2. Third-party packages (e.g., `import { NextResponse } from 'next/server'`, `import { describe, it, expect } from 'vitest'`)
3. Local imports from `@/` paths (e.g., `import { getSql } from '@/lib/db.js'`)
4. Blank line between groups

**Path Aliases:**
- `@/` maps to `app/` directory (absolute path resolution for imports)
- All local imports use `@/lib/`, `@/api/`, etc.

**Example (from `app/api/agents/route.js`):**
```javascript
import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { attachAgentConnections, listAgentsForOrg } from '../../lib/repositories/agents.repository.js';
```

## Error Handling

**Patterns:**
- Try-catch blocks at route handler level, catch returns `apiErrorResponse(error, 'LABEL')`
- `apiErrorResponse()` helper in `app/lib/apiErrors.js` detects common deployment issues (DB schema, connection, missing env vars)
- Database errors logged with context: `console.error('[API] error:', error)`
- Background operations use `.catch()` to prevent promise rejections blocking main response: `.catch(() => {})` or `.catch(err => console.warn('...'))`
- No swallowing of errors — always log before returning safe fallback

**Example (from `app/api/agents/route.js`):**
```javascript
export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const agents = await listAgentsForOrg(sql, orgId);
    return NextResponse.json({ agents, lastUpdated: new Date().toISOString() });
  } catch (error) {
    console.error('Agents API error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching agents', agents: [] },
      { status: 500 }
    );
  }
}
```

**Validation Pattern:**
```javascript
const { valid, data, errors } = validateActionRecord(body);
if (!valid) {
  return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
}
```

## Logging

**Framework:** Console (no external logging library)

**Patterns:**
- `console.error('[LABEL] message:', variable)` for errors (e.g., `console.error('[API] error:', error)`)
- `console.warn('[LABEL] message:', variable)` for background failures (e.g., `console.warn('[API] Background indexing failed:', e.message)`)
- `console.log('[LABEL] message:', variable)` for mock driver fallback only
- Never log environment variables, auth headers, or API keys
- Always include context label `[COMPONENT]` at start (e.g., `[API]`, `[DB]`, `[DB-MOCK]`)

## Comments

**When to Comment:**
- Block-level JSDoc for exported functions (describe purpose, parameters, returns)
- Section separators for logical groupings (e.g., `// ─────────────────────────────────────────────────────────────────────────────` in `app/lib/repositories/capabilities.repository.js`)
- Clarify non-obvious intent (e.g., why a workaround exists, why error is caught and ignored)
- Security-critical logic gets explanatory comments (e.g., "SECURITY: redact likely secrets before storing")

**JSDoc/TSDoc:**
- `/** */` multiline format above exported functions
- `@param {type} name - description` for parameters
- `@returns {type} description` for return values
- Example (from `app/lib/db.js`):
```javascript
/**
 * Standardized Database Connection Utility for DashClaw.
 *
 * - Neon URLs: use @neondatabase/serverless (fetch/WebSocket)
 * - Local/self-host Postgres URLs: use postgres (direct TCP)
 *
 * The returned object is a tagged-template function with a `.query(text, params)` method.
 */
export function getSql() { ... }
```

## Function Design

**Size:** Keep functions focused — most are 20-50 lines; complex ones broken into smaller pieces

**Parameters:**
- Named objects preferred over many positional arguments
- Database functions accept `(sql, orgId, options)` pattern
- Route handlers accept `(request)` only

**Return Values:**
- Functions return structured objects: `{ valid, data, errors }` or `{ actions, total, stats }`
- Repositories return promises: `Promise<Array>`, `Promise<Object>`, `Promise<boolean>`
- Validation returns `{ valid: boolean, data: Object, errors: Array<string> }`

**Example (from `app/lib/validate.js`):**
```javascript
function validateField(key, value, rule) {
  if (value === undefined || value === null) {
    if (rule.required) return `${key} is required`;
    return null;
  }
  // ... type checking logic
}
```

## Module Design

**Exports:**
- Named exports preferred (e.g., `export function listAgentsForOrg(sql, orgId) { ... }`)
- Route handlers use `export async function GET(request)`, `export async function POST(request)`
- Repositories export multiple focused functions, not default object

**Barrel Files:**
- Not used — direct imports from source files (e.g., `import { getSql } from '@/lib/db.js'`)

## Database Patterns

**SQL Layer Rule (Non-Negotiable):**
- **NO direct SQL in route files** (`app/api/*/route.js`)
- All database access must go through repository layer (`app/lib/repositories/*.repository.js`)
- Route-sql guardrail enforces this at pre-commit: `npm run route-sql:check`
- SQL tagged templates and `.query()` calls only in repository files

**Query Style:**
- Use postgres client's tagged template syntax: `` sql`SELECT * FROM table WHERE id = $1` ``
- Or `.query(text, params)` method with parameterized queries
- No string concatenation in queries

**Example (from `app/lib/repositories/agents.repository.js`):**
```javascript
const rows = await sql.query(
  `
    SELECT agent_id, MAX(agent_name) as agent_name, COUNT(*) as action_count
    FROM action_records
    WHERE org_id = $1
    GROUP BY agent_id
  `,
  [orgId]
);
```

## Next.js App Router Conventions

**Route File Structure:**
- Route file location: `app/api/[resource]/route.js`
- Export handler functions: `GET`, `POST`, `PATCH`, `DELETE` (uppercase)
- Set cache behavior: `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` for dynamic routes
- Use `NextResponse.json()` for responses

**Example (from `app/api/agents/route.js`):**
```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) { ... }
export async function POST(request) { ... }
```

## Validation Pattern

**Schema-based validation:**
- Define schema objects with field rules: `{ type, required, enum, maxLength, min, max }`
- Use `validateField()` to check individual values against rules
- Return `{ valid, data, errors }` tuple

**Location:** `app/lib/validate.js` contains all validation schemas and logic

## Thread System Terminology

**Critical Distinction:**
- **Context threads** (`ct_*`): Via `/api/context/threads` — for reasoning context, decision tracking
- **Message threads** (`mt_*`): Via `/api/messages/threads` — for conversation history, human collaboration
- Do NOT confuse: they are separate systems with different purposes and different ID prefixes

---

*Convention analysis: 2026-04-11*
