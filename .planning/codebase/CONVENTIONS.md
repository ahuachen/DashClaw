# Coding Conventions

**Analysis Date:** 2026-03-17

## Naming Patterns

**Files:**
- `camelCase` for utility and library files: `app/lib/auth.js`, `app/lib/db.js`, `app/hooks/useRealtime.js`
- `PascalCase` for React components: `app/components/ActivityTimeline.js`, `app/components/AgentFilterDropdown.js`
- Descriptive `.repository.js` suffix for data access layer: `app/lib/repositories/actions.repository.js`
- Kebab-case for route folders: `app/api/actions/[actionId]/`, `app/api/(extensions)/`

**Functions:**
- `camelCase` for all function declarations: `createActionRecord()`, `listActions()`, `validateField()`
- Prefix with verb: `get*`, `create*`, `update*`, `delete*`, `has*`, `record*`, `list*`
- React hooks start with `use`: `useRealtime()`, `useAgentFilter()`, `useTileSize()`
- Private/internal functions prefixed with underscore: `_getSql()`, `_setSql()`
- Event handlers named with `on` prefix: `onEvent()`, `onEventRef`
- Builder functions named with `build` prefix: `buildActionEvent()`, `buildGuardEvent()`

**Variables:**
- `camelCase` throughout: `action_id`, `agent_name`, `orgId`, `costEstimate`
- Database column names use `snake_case`: `action_id`, `agent_id`, `org_id`, `timestamp_start`
- Constants in `UPPER_SNAKE_CASE`: `ACTION_TYPES`, `LOOP_STATUSES`, `OUTCOME_FIELDS`, `MAX_TOKENS`
- Booleans prefixed with `is` or `has`: `isProd`, `hasGitHub`, `isNewAgent`, `verified`
- Configuration variables in `CONSTANT_CASE`: `DATABASE_URL`, `NODE_ENV`, `DASHCLAW_CLOSED_ENROLLMENT`

**Types:**
- Schema objects defined in `CONSTANT_CASE`: `ACTION_RECORD_SCHEMA`, `OPEN_LOOP_SCHEMA`, `ASSUMPTION_SCHEMA`
- Type enum arrays in `CONSTANT_CASE`: `ACTION_TYPES`, `ACTION_STATUSES`, `LOOP_TYPES`, `LOOP_STATUSES`, `LOOP_PRIORITIES`
- Type discriminants use lowercase prefixes: `act_*` for action IDs, `sn_*` for snippets, `mt_*` for message threads, `ct_*` for context threads, `org_*` for organizations, `usr_*` for users

## Code Style

**Formatting:**
- ESLint configuration: `app/.eslintrc.json` extends `next/core-web-vitals`
- No explicit Prettier config detected; follows Next.js defaults
- 2-space indentation (implicit)
- Line length: no hard limit enforced, but favor readability

**Linting:**
- Run with: `npm run lint`
- Enforces Next.js/ESLint best practices
- Check syntax of scripts: `npm run scripts:check-syntax`

**File Structure:**
- One main export per file when possible
- Organize imports by category (standard library, third-party, internal)
- No wildcard exports (`export * from`); explicit named exports preferred

## Import Organization

**Order:**
1. Standard library and Node.js modules (`crypto`, `path`)
2. Next.js and React (`'next/server'`, `'react'`, `'next-auth'`)
3. External dependencies (`zod`, `drizzle-orm`, `postgres`)
4. Internal app code (`app/lib`, `app/hooks`, `app/components`)
5. Local relative imports (`./db.js`, `../validate.js`)

**Path Aliases:**
- `@` resolves to `app/` directory (configured in `vitest.config.js` and Next.js)
- Used in tests and components: `import { Card } from '@/components/ui/Card'`
- Prefer explicit relative paths in Node.js code: `import { getSql } from '../../lib/db.js'`

**Import Styles:**
- Use destructuring for multiple named imports: `import { Card, CardHeader, CardContent } from './ui/Card'`
- Use default imports for single main exports: `import Link from 'next/link'`
- Dynamic imports for large optional dependencies: `const { openai } = await import('openai')`

## Error Handling

**Patterns:**
- Wrap async route handlers in `try/catch` blocks
- Always log errors with context prefix: `console.error('[AUTH] signIn callback error:', err.message)`
- Use structured logging: `[COMPONENT] event: description`
- Graceful degradation where possible (e.g., allow sign-in even if DB upsert fails)
- Return `NextResponse.json()` with appropriate HTTP status codes in API routes
- Never swallow errors silently; log or propagate
- Catch validation errors and return `{ status: 400, error: 'Validation failed', details: errors }`
- Implement rate-limiting and quota checks: return `{ status: 402, error: 'Quota exceeded' }`
- Security violations return `{ status: 403 }` or `{ status: 401 }`

**Error Responses:**
- Structure: `{ error: string, code?: string, details?: object }`
- Example: `{ error: 'Action blocked by policy', action: blockedAction, decision: guardDecision }`
- Include operation context in error messages: `'Actions API POST error: ${error}'`

**Fire-and-Forget Operations:**
- Use `Promise.all()` wrapped in `.catch()` for non-blocking background work
- Log warnings for failed background operations: `console.warn('[API] Background indexing failed:', e.message)`
- Never block HTTP response on background task completion

## Logging

**Framework:** `console` (built-in, no external logger)

**Patterns:**
- Prefix all logs with context in brackets: `[AUTH]`, `[API]`, `[DB-MOCK]`, `[realtime]`
- Log severity matches prefix convention: info/debug/warn/error
- Example: `console.error('[AUTH] signIn callback error:', err.message)`
- Example: `console.warn('[DB] DATABASE_URL not set. Falling back to safe mock driver.')`
- Example: `console.log('[DB-MOCK] Executed query:', strings?.[0] || '')`
- Never log environment variables, API keys, or sensitive data
- Use structured error logging with message and selective context
- Browser logging from hooks: `console.warn('[realtime] subscriber error:', e?.message || e)`

## Comments

**When to Comment:**
- Security-critical sections: `// SECURITY: ...`
- Non-obvious behavior or workarounds: `// Use globalThis to survive Next.js dev mode hot reloads`
- Complex multi-step operations: `// Neon serverless URLs typically include ".neon.tech"`
- Trade-offs and design decisions: `// Allow sign-in even if DB upsert fails (graceful degradation)`
- Temporary workarounds or known limitations

**What NOT to Comment:**
- Obvious code: `const x = 5; // Set x to 5`
- Self-documenting function names and variable names
- Implementation details already clear from code

**Format:**
- Single-line comments: `// comment`
- Multi-line: Use `/* */` for blocks exceeding 3 lines
- JSDoc not used; prefer inline comments for non-library code
- Security comments stand out: `// SECURITY: ...` or `// HACK: ...` for temporary fixes

## Function Design

**Size:**
- Aim for functions under 100 lines
- Route handlers intentionally longer (50-200 lines) due to inline validation and error handling
- Repository functions typically 10-50 lines
- Extract complex logic into helper functions

**Parameters:**
- Prefer object parameters with destructuring for 3+ parameters
- Example: `function listActions(sql, orgId, filters = {}) { const { agent_id, status, limit = 50, offset = 0 } = filters; }`
- Keep positional parameters for critical deps: `(sql, orgId, ...)`
- Use default values for optional params: `filters = {}`, `headers = {}`

**Return Values:**
- Return structured objects when returning multiple values: `{ actions, total, stats }`
- Use `null` or `undefined` explicitly for missing data (not false)
- SQL query results always return arrays; check `.length > 0` before accessing `[0]`
- Async functions always return Promise

**Async/Await:**
- Prefer `async/await` over `.then()` chains
- Use `Promise.all()` for parallel operations
- Catch errors with `try/catch` blocks, not `.catch()`

## Module Design

**Exports:**
- Named exports for utility functions: `export async function getSql() { ... }`
- Single default export only for entry points or when semantic clarity demands it
- Export constants alongside functions: `export const EVENTS = { ... }`
- Avoid exporting internal state or private functions

**Barrel Files:**
- Used minimally; prefer explicit imports
- `app/lib/contracts/index.js` exports multiple contract types
- `app/components/ui/` may barrel-export UI primitives

**File Organization:**
- One main concern per file
- Related types/schemas defined at top of file: `const ACTION_TYPES = [...]`
- Validation schemas inline: `const ACTION_RECORD_SCHEMA = { ... }`
- Helper functions defined before main export
- Repository files follow pattern: imports → type definitions → helper functions → main CRUD exports

## Validation

**Pattern:**
- Hand-rolled validators, no external schema libraries
- Centralized validation schemas in `app/lib/validate.js`
- Field-level validation: type, length, enum, min/max bounds
- Example:
```javascript
function validateField(key, value, rule) {
  if (value === undefined || value === null) {
    if (rule.required) return `${key} is required`;
    return null;
  }
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `${key} must be a string`;
      if (rule.maxLength && value.length > rule.maxLength) return `${key} exceeds max length`;
      break;
    // ... more cases
  }
  return null;
}
```
- Validation returns `{ valid: boolean, data: object, errors: string[] }`
- Apply validation early in route handlers before processing

**Security Validation:**
- Clamp numeric inputs to reasonable bounds: `Math.max(0, Math.min(value, MAX_BOUND))`
- Redact sensitive fields before storage: `scanSensitiveData()`, `redactAny()`
- Verify agent signatures before processing: `verifyAgentSignature()`
- Check quotas and permissions early in handler

## Data Access

**Pattern:**
- Repository layer in `app/lib/repositories/*.repository.js`
- No SQL in route files; all queries in repositories
- Database connection via `getSql()` from `app/lib/db.js`
- Neon serverless or Postgres via `postgres` library based on URL
- SQL template strings (tagged templates): `` sql`SELECT * FROM table WHERE id = ${id}` ``
- Parameterized queries always; never string interpolation for user input

**Transaction Handling:**
- Not implemented; each query is independent
- Use `Promise.all()` for batch operations
- Ensure related deletions ordered: delete dependents before parents

---

*Convention analysis: 2026-03-17*
