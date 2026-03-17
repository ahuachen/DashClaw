# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout

```
project-root/
├── app/                      # Next.js App Router application
│   ├── api/                  # API routes (RESTful endpoints)
│   ├── (extensions)/         # Modular operational intelligence pages
│   ├── lib/                  # Shared utilities and services
│   ├── components/           # Reusable React components
│   ├── hooks/                # React hooks for pages
│   ├── layout.js             # Root layout
│   ├── page.js               # Landing/home page
│   └── [feature]/            # Feature pages (decisions, mission-control, etc.)
├── sdk/                      # Node.js SDK (published to npm)
├── sdk-python/               # Python SDK (published to PyPI)
├── examples/                 # Integration examples and reference implementations
├── scripts/                  # Build, migration, and validation scripts
├── docs/                     # Documentation and generated artifacts
├── schema/                   # Database schema definitions
├── drizzle/                  # Drizzle ORM migrations
├── public/                   # Static assets
├── hooks/                    # Pre-commit hooks (Python/integration)
├── tasks/                    # Project tracking (todo.md, lessons.md)
├── .github/                  # GitHub Actions workflows
├── .claude/                  # Claude Code skills and knowledge base
├── middleware.js             # Next.js middleware (auth, session)
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── package.json              # Node.js dependencies and scripts
└── vitest.config.js          # Unit test configuration
```

## Directory Purposes

**`app/api/`:**
- Purpose: REST API routes for SDK consumption
- Contains: Route handlers (route.js files) organized by feature
- Key files: `actions/route.js`, `approvals/`, `assumptions/`, `agents/`
- Pattern: Each feature has a directory with `route.js` (GET/POST), subdirectories for nested routes
- Governance boundary: 7 canonical routes only (checked via `npm run governance:boundary:check`)
- Legacy routes: Archived non-governance features in `app/api/_archive/`

**`app/lib/`:**
- Purpose: Shared business logic, database access, utilities
- Contains:
  - `repositories/*.repository.js` — Data access layer (SQL queries abstracted)
  - `*.js` utilities (auth, db, validation, guardrails, notifications, etc.)
  - `guards/` — Policy enforcement
  - `validators/` — Input validation
  - `notification-adapters/` — Webhook delivery
- Pattern: No direct SQL in routes; all database operations go through repositories
- Naming: `camelCase` for services (e.g., `compliance.js`, `scoringProfiles.js`, `webhooks.js`)

**`app/components/`:**
- Purpose: Reusable React UI components
- Contains: React client components (marked with `'use client'`)
- Naming: PascalCase (e.g., `ActivityTimeline.js`, `ContextCard.js`, `PageLayout.js`)
- Pattern: Component files are `.js` (not `.jsx`), import from `lucide-react` for icons

**`app/(extensions)/` and feature pages:**
- Purpose: User-facing pages and operational intelligence interfaces
- Location: `app/decisions/`, `app/mission-control/`, `app/setup/`, `app/compliance/`, etc.
- Pattern: Each feature has `page.js` (client component with `'use client'`) and optional `_components/` for private components
- Routing: Next.js App Router uses directory-to-URL mapping (e.g., `app/decisions/page.js` → `/decisions`)
- Dynamic routes: `[featureId]/page.js` for detail pages (e.g., `app/decisions/[actionId]/page.js` → `/decisions/123`)

**`sdk/`:**
- Purpose: Node.js SDK (published as `dashclaw` npm package)
- Contains: `dashclaw.js` (main SDK), `index.cjs` (CommonJS entry), legacy SDK in `legacy/`
- Naming: `camelCase` method names (matches JavaScript conventions)
- Export: Published to npm as `dashclaw`

**`sdk-python/`:**
- Purpose: Python SDK (published as `dashclaw` on PyPI)
- Contains: `dashclaw/` package directory, `setup.py`, tests
- Naming: `snake_case` method names (matches Python conventions)

**`app/lib/repositories/`:**
- Purpose: All SQL queries abstracted here (guardrail against SQL in routes)
- Naming: `[feature].repository.js` (e.g., `actions.repository.js`, `agents.repository.js`)
- Pattern: Each file exports functions like `createAction()`, `listActions()`, `updateAgent()`
- Usage: Routes import and call repository functions; repositories call `getSql()` for database access

**`app/lib/guardrails/`:**
- Purpose: Policy evaluation and enforcement packs
- Contains: `packs/` (development, startup-growth, smb-safe, enterprise-strict), generators, schema
- Pattern: Modular guardrail packs with different strictness levels

**`scripts/`:**
- Purpose: Build-time, migration, and validation tasks
- Naming: `[task-name].mjs` (e.g., `generate-openapi.mjs`, `check-api-boundary.mjs`)
- Pattern: Helper scripts `_load-env.mjs`, `_db.mjs`, `_run-with-env.mjs` for common setup
- Run via: `npm run [script-name]` (defined in `package.json` scripts)

**`docs/`:**
- Purpose: Generated and manual documentation
- Contains:
  - `architecture/` — Design docs
  - `openapi/` — OpenAPI specifications (auto-generated)
  - `api-inventory.md` — Route catalog
  - `sdk-parity.md` — SDK method parity matrix
  - `lessons/` — Postmortems and retrospectives

**`schema/` and `drizzle/`:**
- Purpose: Database schema definition (Drizzle ORM)
- Contains: Schema definitions in `schema/`, migrations in `drizzle/`
- Usage: `npm run db:generate` generates migrations, `npm run db:push` applies to database

**`__tests__/`:**
- Purpose: Unit and integration tests
- Contains: `unit/` for test files, `helpers.js` for test utilities
- Runner: Vitest (`npm run test`)

## Key File Locations

**Entry Points:**
- `app/page.js` — Landing page
- `middleware.js` — Request authentication and session middleware
- `app/api/actions/route.js` — Main governance action endpoint
- `app/api/approvals/route.js` — Action approval endpoint
- `app/mission-control/page.js` — Live decision stream UI
- `app/decisions/page.js` — Action ledger and causal chain UI

**Configuration:**
- `next.config.js` — Next.js build config, security headers, CSP, rewrites
- `middleware.js` — Auth, session validation, routing logic
- `package.json` — Dependencies, scripts, version metadata
- `tailwind.config.js` — Tailwind CSS theme and plugin configuration
- `vitest.config.js` — Unit test runner config
- `drizzle.config.js` — Database ORM configuration

**Core Logic:**
- `app/lib/db.js` — Database connection and SQL helper
- `app/lib/org.js` — Organization context (org ID, role extraction)
- `app/lib/auth.js` — Authentication utilities
- `app/lib/repositories/actions.repository.js` — Action CRUD
- `app/lib/repositories/agents.repository.js` — Agent CRUD
- `app/lib/guard.js` — Guardrail evaluation
- `app/lib/guardrails/` — Policy packs and generators

**Shared Utilities:**
- `app/lib/validate.js` — Input validation helpers
- `app/lib/validators/` — Validation schemas
- `app/lib/security.js` — Sensitive data detection
- `app/lib/notifications.js` — Event publishing
- `app/lib/compliance.js` — Compliance tracking
- `app/lib/scoring.js` — Scoring profile management
- `app/lib/webhooks.js` — Webhook event delivery

**SDK Entry Points:**
- `sdk/dashclaw.js` — Node.js SDK main export
- `sdk/index.cjs` — CommonJS wrapper
- `sdk-python/dashclaw/__init__.py` — Python SDK main export

## Naming Conventions

**Files:**
- **Routes:** `route.js` for endpoint handlers
- **Repositories:** `[feature].repository.js` (e.g., `actions.repository.js`)
- **Components:** `PascalCase.js` (e.g., `ActivityTimeline.js`)
- **Pages:** `page.js` for route segments, `layout.js` for layout wrappers
- **Services:** `camelCase.js` (e.g., `compliance.js`, `webhooks.js`, `guard.js`)
- **Hooks:** `use[Feature].js` (e.g., `useRealtime.js`, `useAgentFilter.js`)
- **Utilities:** `camelCase.js` or `kebab-case.mjs` for scripts

**Directories:**
- **Features:** `kebab-case` (e.g., `mission-control/`, `api-keys/`, `bug-hunter/`)
- **Nested routes:** Dynamic segments in `[brackets]` (e.g., `[actionId]/`, `[agentId]/`)
- **Internal components:** `_components/` or `_[name]/` for private/internal components

**Functions/Variables:**
- **camelCase:** All functions, variables, exports (JavaScript convention)
- **UPPERCASE:** Constants (e.g., `DEFAULT_TIMEOUT`, `MAX_RETRIES`)
- **PascalCase:** React components, classes, types

**API Routes:**
- **Canonical routes:** `/api/actions`, `/api/approvals`, `/api/assumptions`, `/api/agents`, `/api/signals`, `/api/scoring`, `/api/orgs` (7 total)
- **Sub-routes:** `/api/[feature]/[id]`, `/api/[feature]/[action]`
- **Rewrites:** `next.config.js` provides backward compatibility (old SDK paths → canonical routes)

## Where to Add New Code

**New API Endpoint:**
- Create `app/api/[feature]/route.js` for base endpoint
- Create `app/api/[feature]/[id]/route.js` for resource detail
- Export `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`
- Import repository functions from `app/lib/repositories/[feature].repository.js`
- Check governance boundary: `npm run governance:boundary:check`
- Update `sdk/README.md`, `sdk-python/README.md`, and `docs/api-inventory.md`

**New Repository/Data Access:**
- Create `app/lib/repositories/[feature].repository.js`
- Export functions like `create[Feature]()`, `list[Features]()`, `update[Feature]()`
- Use `getSql()` for database queries (imported from `app/lib/db.js`)
- No direct SQL in route files

**New Feature Page:**
- Create `app/[feature]/page.js` with `'use client'` at top
- Import `PageLayout` from `app/components/PageLayout`
- Use `useSession()` for auth, `useAgentFilter()` for filtering
- Place private/feature-specific components in `app/[feature]/_components/`
- Add to main navigation in `app/components/Navigation.js` if needed

**New Component:**
- Create `app/components/[Component].js`
- Use `'use client'` directive if it has hooks or interactivity
- Import icons from `lucide-react`
- Use Tailwind classes for styling

**New Utility/Service:**
- Create `app/lib/[service].js`
- Export named functions (e.g., `export function doThing()`)
- Avoid default exports unless it's a single-purpose module

**New Test:**
- Create `__tests__/unit/[feature].test.js`
- Use Vitest syntax (`describe`, `it`, `expect`)
- Import helpers from `__tests__/helpers.js`
- Run with `npm run test`

**New Script:**
- Create `scripts/[task-name].mjs`
- Use `.mjs` extension for ES modules
- Import `_load-env.mjs` or `_run-with-env.mjs` for setup
- Add entry to `package.json` scripts
- Add to documentation in `QUICK-START.md` or task list

## Special Directories

**`app/api/_archive/`:**
- Purpose: Legacy non-governance API endpoints
- Generated: No, manually moved
- Committed: Yes, preserved for backward compatibility
- Usage: Not used in governance loop; available for agents that need non-governance features

**`drizzle/`:**
- Purpose: Database migrations
- Generated: Yes, via `npm run db:generate`
- Committed: Yes, migrations are versioned
- Usage: Applied to database via `npm run db:push`

**`.next/`:**
- Purpose: Build output from `next build`
- Generated: Yes
- Committed: No (in `.gitignore`)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes, via `npm install`
- Committed: No (in `.gitignore`)

**`public/`:**
- Purpose: Static assets served at root `/`
- Generated: No
- Committed: Yes

**`tasks/`:**
- Purpose: Session work tracking (todo.md, lessons.md, in-progress plans)
- Generated: No
- Committed: Yes (knowledge base for future sessions)

**`docs/openapi/`:**
- Purpose: OpenAPI specifications
- Generated: Yes, via `npm run openapi:generate` (committed)
- Committed: Yes
- Usage: SDK documentation generation, API contract validation

## Thread and ID Naming

- **Snippets:** `sn_[id]` prefix
- **Message threads:** `mt_[id]` prefix
- **Context threads:** `ct_[id]` prefix
- **Actions:** `ac_[id]` prefix
- **Agents:** `ag_[id]` prefix

---

*Structure analysis: 2026-03-17*
