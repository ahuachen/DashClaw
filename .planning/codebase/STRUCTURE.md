# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```
dashclaw-platform/
├── app/                              # Next.js App Router application
│   ├── layout.js                     # Root layout (fonts, auth wrapper, metadata)
│   ├── page.js                       # Landing page (public, no auth)
│   ├── globals.css                   # Global Tailwind styles + CSS tokens
│   ├── api/                          # API route handlers (app/api/*/route.js)
│   │   ├── guard/                    # Policy evaluation
│   │   │   ├── route.js              # POST guard, GET decisions history
│   │   │   └── decisions/            # Nested: /api/guard/decisions
│   │   ├── actions/                  # Action lifecycle (create, read, update)
│   │   │   ├── route.js              # GET actions list, POST create
│   │   │   └── [actionId]/           # Dynamic: /api/actions/:actionId
│   │   ├── policies/                 # Policy management (CRUD)
│   │   ├── assumptions/              # Record reasoning basis
│   │   ├── signals/                  # Anomaly detection queries
│   │   ├── health/                   # System readiness check
│   │   ├── approvals/                # Human review queue (waitForApproval)
│   │   ├── workflows/                # Workflow execution
│   │   │   ├── templates/            # Template registry
│   │   │   │   ├── route.js          # GET list, POST create
│   │   │   │   └── [templateId]/     # Dynamic: /api/workflows/templates/:id
│   │   │   ├── draft/                # Draft/editing endpoint
│   │   │   └── routes for execute, launch, runs
│   │   ├── capabilities/             # Capability registry and invocation
│   │   │   ├── route.js              # GET list, POST create
│   │   │   └── [capabilityId]/       # Dynamic: /api/capabilities/:id
│   │   ├── knowledge/                # Knowledge collections and semantic search
│   │   ├── model-strategies/         # LLM provider strategies
│   │   ├── artifacts/                # Durable artifacts and evidence bundles
│   │   ├── operations/               # Operations feed and summary
│   │   ├── analytics/                # Cost, usage, policy stats
│   │   ├── billing/                  # Stripe checkout and portal
│   │   ├── webhooks/                 # Third-party webhooks (Stripe, integrations)
│   │   ├── cron/                     # Background jobs
│   │   │   ├── signals               # Signal computation
│   │   │   ├── integration-health    # Credential validation
│   │   │   └── reset-meters          # Monthly quota reset
│   │   ├── integrations/             # External service credential health
│   │   ├── identities/               # Agent identity pairing
│   │   ├── pairings/                 # Agent pairing enrollment
│   │   ├── auth/                     # Next.js Auth routes
│   │   ├── docs/                     # Swagger/OpenAPI and SDK docs
│   │   ├── settings/                 # Org settings (BYOK, webhooks)
│   │   ├── mcp/                      # Model Context Protocol endpoint
│   │   ├── stream/                   # Server-Sent Events (real-time)
│   │   ├── _archive/                 # Legacy platform features (archived)
│   │   ├── compliance/               # Audit evidence
│   │   ├── drift/                    # Reasoning drift detection
│   │   ├── evaluations/              # LLM-as-judge scoring
│   │   ├── scoring/                  # Multi-dimensional risk
│   │   └── [other routes]/
│   ├── components/                   # Reusable React components
│   │   ├── ui/                       # Base UI components (Card, Badge, Button, etc.)
│   │   ├── PageLayout.js             # Standard page wrapper
│   │   ├── SessionWrapper.js         # Auth context provider
│   │   ├── SystemStatusBar.js        # Global org posture bar
│   │   ├── DashClawLogo.js           # Logo component
│   │   ├── MissionControlOperatorLens.js
│   │   ├── OperationsFeed.jsx        # Operations feed display
│   │   ├── RuntimeSummaryCard.jsx    # Runtime metrics
│   │   ├── CapabilityHealthCard.js   # Capability status
│   │   └── [80+ other components]/
│   ├── hooks/                        # React hooks
│   │   ├── useRealtime.js            # WebSocket/SSE for live updates
│   │   ├── useAgentFilter.js         # Agent filtering context
│   │   └── [other custom hooks]/
│   ├── lib/                          # Business logic and utilities (non-component)
│   │   ├── db.js                     # Database connection (Neon/Postgres adapter)
│   │   ├── guard.js                  # Guard policy evaluation engine
│   │   ├── signals.js                # Anomaly detection (Autonomy Spikes, Stale)
│   │   ├── auth.js                   # Multi-tenant auth helpers
│   │   ├── org.js                    # Org scoping (getOrgId, getOrgRole)
│   │   ├── validate.js               # Zod schemas for input validation
│   │   ├── apiErrors.js              # Structured error responses
│   │   ├── events.js                 # Event pub/sub and publishing
│   │   ├── billing.js                # Token cost estimation
│   │   ├── capability-invoke.js      # HTTP capability execution
│   │   ├── mapping.js                # Dot-path request/response mapping
│   │   ├── workflow-executor.js      # Sequential workflow step execution
│   │   ├── step-handlers.js          # Handlers for prompt/capability/knowledge steps
│   │   ├── template-vars.js          # Variable substitution engine
│   │   ├── usage.js                  # Quota enforcement (PLAN_LIMITS, checkQuota)
│   │   ├── policy-generator.js       # LLM-to-policy conversion
│   │   ├── integration-health.js     # Credential health checks
│   │   ├── predictive-risk.js        # Statistical + LLM risk scoring
│   │   ├── security.js               # Input sanitization, data leakage detection
│   │   ├── identity.js               # Agent signature verification
│   │   ├── embeddings.js             # OpenAI embedding generation
│   │   ├── knowledge-ingest.js       # Knowledge collection ingestion
│   │   ├── colors.js                 # Agent color mapping
│   │   ├── formatCost.js             # Cost display formatting
│   │   ├── isDemoMode.js             # Demo mode flag
│   │   ├── AgentFilterContext.js     # React context for agent filtering
│   │   ├── notification-adapters/    # Native alert delivery
│   │   │   ├── slack.js
│   │   │   ├── discord.js
│   │   │   ├── linear.js
│   │   │   ├── github.js
│   │   │   └── email.js
│   │   ├── repositories/             # Data access layer (SQL encapsulation)
│   │   │   ├── actions.repository.js
│   │   │   ├── agents.repository.js
│   │   │   ├── capabilities.repository.js
│   │   │   ├── workflow-templates.repository.js
│   │   │   ├── workflow-runs.repository.js
│   │   │   ├── knowledge.repository.js
│   │   │   ├── model-strategies.repository.js
│   │   │   ├── guardrails.repository.js
│   │   │   ├── assumptions.repository.js
│   │   │   ├── evaluations.repository.js
│   │   │   ├── artifacts.repository.js
│   │   │   ├── settings.repository.js
│   │   │   ├── analytics.repository.js
│   │   │   └── [30+ other repositories]/
│   │   ├── compliance/               # Audit/compliance logic
│   │   ├── guardrails/               # Policy enforcement utilities
│   │   ├── contracts/                # Capability contracts validation
│   │   └── demo/                     # Demo data generators
│   ├── [feature dirs]/               # UI pages for features
│   │   ├── mission-control/          # Strategic posture + operations feed + runtime summary
│   │   ├── decisions/                # Decision ledger (causal chain view)
│   │   ├── setup/                    # Readiness verification + onboarding
│   │   ├── connect/                  # 8-minute governance quickstart
│   │   ├── actions/                  # Action detail/replay
│   │   ├── agents/                   # Agent profiles + governance posture
│   │   ├── policies/                 # Policy builder and management
│   │   ├── analytics/                # Cost/usage analytics
│   │   ├── workflows/                # Workflow builder and execution history
│   │   ├── capabilities/             # Capability registry UI
│   │   ├── knowledge/                # Knowledge collections UI
│   │   ├── approvals/                # Approval queue
│   │   ├── assumptions/              # Assumption tracking
│   │   ├── signals/                  # Signal alerts and history
│   │   ├── integrations/             # External service connections
│   │   └── [40+ other feature dirs]/
├── sdk/                              # Node.js SDK (v2, 5-method stable)
│   ├── dashclaw.js                   # Main SDK class (guard, createAction, updateOutcome, recordAssumption, waitForApproval)
│   ├── index.cjs                     # CommonJS export
│   ├── package.json                  # npm package metadata
│   ├── README.md                     # SDK documentation (copy/paste to /docs via /api/docs/raw)
│   └── legacy/                       # Archived v1 SDK (96% smaller surface)
├── sdk-python/                       # Python SDK (snake_case, same 5 methods)
│   ├── dashclaw/                     # Package directory
│   │   ├── __init__.py               # Main DashClaw class
│   │   ├── client.py
│   │   └── errors.py
│   ├── README.md                     # Python documentation
│   ├── pyproject.toml                # Poetry/PyPI metadata
│   └── tests/                        # Unit tests
├── docs/                             # Documentation and specifications
│   ├── architecture/                 # Architecture decision records
│   ├── api-inventory.md              # Auto-generated route inventory
│   ├── api-inventory.json            # Machine-readable route manifest
│   ├── openapi/                      # OpenAPI schema (auto-generated)
│   │   └── critical-stable.openapi.json
│   ├── sdk-parity.md                 # SDK method coverage matrix
│   ├── sdk-reference.md              # SDK method examples
│   ├── route-sql-baseline.json       # SQL guardrail baseline
│   └── [other docs]/
├── examples/                         # Framework integration examples
│   ├── first-governed-action.js
│   ├── first-governed-action.py
│   ├── anthropic-governed-agent/
│   ├── openai-agents-governed/
│   ├── langgraph-governed/
│   ├── crewai-governed/
│   ├── managed-agent-mcp/
│   └── [10+ other examples]/
├── scripts/                          # Automation and maintenance
│   ├── generate-openapi.mjs          # OpenAPI schema generation
│   ├── check-openapi-diff.mjs        # Pre-commit: detect API drift
│   ├── generate-api-inventory.mjs    # Route inventory generator
│   ├── check-api-inventory-diff.mjs  # Pre-commit: route count check
│   ├── validate-docs.mjs             # Documentation consistency
│   ├── check-route-sql-guard.mjs     # Ensure SQL only in repositories
│   ├── check-contracts.mjs           # Capability contract validation
│   ├── run-pre-commit-checks.mjs     # Pre-commit hook orchestrator
│   ├── setup.mjs                     # Local environment setup
│   ├── init-self-host-env.mjs        # Self-hosting initialization
│   ├── auto-migrate.mjs              # Idempotent DB schema migration
│   └── [20+ other scripts]/
├── drizzle/                          # Database schema (Drizzle ORM)
│   ├── 0000_clammy_falcon.sql        # Initial schema (action_records, policies, etc.)
│   ├── 0001_agent_messages_action_index.sql
│   ├── 0002_agent_sessions_and_permission_level.sql
│   └── meta/
├── __tests__/                        # Test suite (Vitest + jsdom)
│   ├── unit/                         # Unit tests
│   │   ├── [test files].test.js
│   └── [other test dirs]/
├── mcp-server/                       # MCP (Model Context Protocol) server
│   ├── dashclaw-mcp.js               # Exported tools/resources
│   └── [MCP integration]/
├── public/                           # Static assets
│   ├── favicons/
│   ├── social/                       # OG/Twitter card images
│   └── config/
├── agent-tools/                      # Agent tool definitions (registrations)
├── contracts/                        # API contract tests
├── .claude/                          # Claude Code metadata
│   ├── hooks/
│   │   └── impeccable-reminder.py    # Design context injection hook
│   ├── skills/
│   └── worktrees/
├── .github/                          # GitHub Actions workflows
│   ├── workflows/
│   │   ├── test.yml                  # CI: test, lint, OpenAPI check
│   │   └── [other workflows]/
│   └── codeql/
├── .planning/                        # GSD planning documents (generated)
│   └── codebase/
│       ├── ARCHITECTURE.md           # This file
│       ├── STRUCTURE.md              # This file
│       └── [other analysis docs]/
├── .env.example                      # Environment variable template
├── .env                              # Local config (git-ignored)
├── .env.local                        # Override for local dev
├── .gitignore                        # Git exclusions (includes .env, node_modules)
├── .impeccable.md                    # Design system and brand guidelines
├── PROJECT_DETAILS.md                # Canonical system map (source of truth)
├── QUICK-START.md                    # 8-minute governance aha moment
├── CLAUDE.md                         # Project rules for Claude Code
├── README.md                         # Main project overview
├── package.json                      # Node dependencies + scripts
├── package-lock.json                 # Dependency lock
├── next.config.js                    # Next.js configuration
├── tailwind.config.js                # Tailwind CSS theme (with brand tokens)
├── tsconfig.json                     # TypeScript config (if using TS)
└── LICENSE                           # MIT license
```

## Directory Purposes

**app/api/***
- Purpose: All HTTP endpoints for agents (SDKs) and UI clients
- Each directory is a route segment; `route.js` exports `GET`, `POST`, `PATCH`, `DELETE` handlers
- Dynamic segments use `[paramName]/` syntax; access via `params` argument in handler
- Constraint: No SQL; all data access via repositories in `app/lib/repositories/`

**app/components/**
- Purpose: Reusable React components across pages
- Subdirectory `ui/` contains base components (Card, Badge, Button, etc.); import as `from '../components/ui/Card'`
- Stateless presentational components; state logic in parent pages or hooks
- Naming: PascalCase files (e.g., `MissionControlOperatorLens.js`)

**app/hooks/**
- Purpose: Custom React hooks for shared logic
- Exported from module-level files (e.g., `useRealtime.js`)
- Pattern: `export function useHookName() { ... }`
- Used by: Page components and feature components

**app/lib/**
- Purpose: All non-React business logic, utilities, data access
- Does NOT contain React components; only exported functions/classes
- Repositories: `app/lib/repositories/*.repository.js` — all SQL goes here, exported as async functions
- Leaf files: Single responsibility (e.g., `guard.js` is only guard evaluation)

**app/lib/repositories/**
- Purpose: Encapsulate all SQL queries and data mutations
- Naming: `[Entity].repository.js` (e.g., `actions.repository.js`, `capabilities.repository.js`)
- Pattern: Export async functions like `listActions(sql, orgId, filters)` that return promises
- Constraint: ALL database interactions must go through repositories; no SQL in route handlers
- Parameter: First param is always `sql` (database connection from `getSql()`)

**app/[feature]/**
- Purpose: Feature-specific UI pages and nested routes
- Each feature dir has `page.js` (the page component) and optional nested dirs
- Dynamic routes use `[paramName]/` syntax for detail pages (e.g., `actions/[actionId]/page.js`)
- Constraint: Keep component trees shallow; extract complex UI to `app/components/`

**sdk/**
- Purpose: Node.js SDK v2 (5-method stable surface)
- Single file `dashclaw.js` exports `class DashClaw` with methods: `guard()`, `createAction()`, `updateOutcome()`, `recordAssumption()`, `waitForApproval()`
- Pattern: All methods call `_request(path, method, body)` which returns parsed JSON
- Errors: Throws `GuardBlockedError` on policy block, generic `Error` on other failures
- Published to npm as `dashclaw` package

**sdk-python/**
- Purpose: Python SDK v2 (same 5 methods, snake_case)
- Pattern: `from dashclaw import DashClaw` then `client = DashClaw(...)`
- Published to PyPI as `dashclaw` package

**drizzle/**
- Purpose: Database schema migrations (Drizzle ORM)
- File naming: `0000_*.sql` (numbered, immutable, append-only)
- Pattern: Each migration file is idempotent and represents a schema state
- Applied via `scripts/auto-migrate.mjs` on deploy

**scripts/**
- Purpose: Automation, testing, setup, documentation generation
- Naming: `*.mjs` (ES modules) or `*.js` (CommonJS for Node < 16)
- Exit on error: Process exits with non-zero on failure (caught by CI)
- Examples: API schema generation, pre-commit hooks, self-host setup

**docs/**
- Purpose: Machine-readable specifications, decision records, API references
- Auto-generated: `api-inventory.md`, `openapi/critical-stable.openapi.json` (via scripts)
- Maintained manually: Architecture decision records, SDK reference

**examples/**
- Purpose: Working, end-to-end examples for different agent frameworks
- Naming: Each framework has a dir or file (e.g., `anthropic-governed-agent/`, `openai-agents-governed/`)
- Contract: Every example must have a README and work from `npm run example:X`

**__tests__/**
- Purpose: Test suite (Vitest + jsdom)
- Location: `__tests__/unit/` for unit tests; collocated tests in `[feature].test.js`
- Pattern: Each test file imports and mocks dependencies; uses `describe()` and `test()` from Vitest

## Key File Locations

**Entry Points:**
- `app/layout.js` — Root layout (renders <html>, applies fonts, wraps with SessionWrapper)
- `app/page.js` — Home/landing page (public, no auth required)
- `sdk/dashclaw.js` — SDK main class (agent initialization and method definitions)
- `sdk/index.cjs` — CommonJS export for Node.js require()

**Configuration:**
- `package.json` — npm dependencies, scripts, metadata
- `next.config.js` — Next.js config (turbopack, rewrites, redirects)
- `tailwind.config.js` — Tailwind theme (extends with brand tokens from `globals.css`)
- `tsconfig.json` — TypeScript compiler options
- `.env.example` — Environment variable template (git-committed)
- `.env` — Local environment (git-ignored, not committed)
- `.impeccable.md` — Design system and brand guidelines (read before UI changes)

**Core Logic:**
- `app/lib/guard.js` — Guard policy evaluation engine
- `app/lib/db.js` — Database connection (adapter selection: Neon vs. Postgres)
- `app/lib/events.js` — Event publishing and pub/sub
- `app/lib/workflow-executor.js` — Workflow step execution
- `app/lib/repositories/actions.repository.js` — Action lifecycle data access

**Essential Surfaces:**
- `app/mission-control/page.js` — Strategic posture + operations feed
- `app/decisions/page.js` — Decision ledger (causal chain view)
- `app/setup/page.js` — Readiness verification + onboarding
- `app/connect/page.js` — 8-minute governance quickstart

**Database Schema:**
- `drizzle/0000_clammy_falcon.sql` — Complete schema (all tables: action_records, guard_policies, etc.)

**Testing:**
- `__tests__/unit/` — All unit tests
- `npm run test` — Run tests (Vitest watch mode)
- `npm run test -- --run` — Run tests once (CI mode)

## Naming Conventions

**Files:**
- JavaScript route handlers: `route.js` (always lowercase, in API dirs)
- Page components: `page.js` (always lowercase, in feature dirs)
- Layout wrappers: `layout.js` (always lowercase)
- React components: PascalCase (e.g., `PageLayout.js`, `MissionControlOperatorLens.js`)
- Utilities/libraries: camelCase (e.g., `guard.js`, `capability-invoke.js`)
- Repositories: `[Entity].repository.js` (camelCase entity name, `.repository.js` suffix)
- Tests: `[feature].test.js` or `__tests__/[area]/[test].test.js`

**Directories:**
- Feature pages: kebab-case (e.g., `mission-control/`, `api-keys/`, `model-strategies/`)
- API routes: kebab-case (e.g., `app/api/guard/`, `app/api/model-strategies/`)
- Dynamic segments: `[paramName]` (e.g., `[actionId]`, `[agentId]`, `[templateId]`)
- Nested routes: lowercase dir under parent (e.g., `app/api/workflows/templates/[templateId]/execute/`)

**Functions/Classes:**
- Exported async functions (utils): camelCase (e.g., `evaluateGuard()`, `listActions()`)
- React hooks: `use` prefix + camelCase (e.g., `useRealtime()`, `useAgentFilter()`)
- Repository functions: camelCase verb + noun (e.g., `listActions()`, `createActionRecord()`, `updateOutcome()`)

**Constants/Types:**
- Enums: UPPER_SNAKE_CASE (e.g., `PLAN_LIMITS`, `EVENTS`, `STATUS`)
- Type/interface names: PascalCase (Zod schemas, JSDoc types)

## Where to Add New Code

**New Feature (Page + API):**
- Feature page: Create `app/[feature-name]/page.js` (React client component with 'use client')
- Related components: `app/components/[FeatureName]*.js`
- API route: Create `app/api/[feature]/route.js` with GET/POST handlers
- Data access: Create `app/lib/repositories/[feature].repository.js` with all SQL queries
- Logic: Create `app/lib/[feature].js` for business logic if needed
- Tests: Create `__tests__/unit/[feature].test.js`

**New Component/Module:**
- Reusable component: `app/components/[ComponentName].js` (PascalCase)
- Base UI component: `app/components/ui/[Component].js`
- Logic library: `app/lib/[module].js` (camelCase)
- Example: Add to `examples/[framework]/` if demonstrating framework integration

**Utilities:**
- Shared helpers: `app/lib/[utility].js` (e.g., `app/lib/colors.js`, `app/lib/formatCost.js`)
- Repositories: Always `app/lib/repositories/[Entity].repository.js` (no exceptions)
- Validation: Add Zod schemas to `app/lib/validate.js` or dedicated `app/lib/validators/[domain].js`

**API Routes:**
- Standard CRUD: `app/api/[resource]/route.js` handles `GET`, `POST`; dynamic `app/api/[resource]/[id]/route.js` handles `GET`, `PATCH`, `DELETE`
- Nested routes: For sub-resources, create nested dirs (e.g., `app/api/workflows/templates/[templateId]/execute/route.js`)
- Cron jobs: Create `app/api/cron/[job-name]/route.js` (GET handler only, triggered by scheduler)
- Webhooks: Create `app/api/webhooks/[service]/route.js` (POST handler for incoming events)

**Database Schema Changes:**
- New table: Add CREATE TABLE to new migration file `drizzle/[next-number]_[description].sql`
- Schema modification: Append ALTER TABLE to new migration file
- Migration runs automatically via `scripts/auto-migrate.mjs` on deploy

## Special Directories

**app/api/_archive/**
- Purpose: Physically quarantined legacy platform features (Messaging, CRM, Workspace, Memory Health)
- Generated: No (manually maintained)
- Committed: Yes (Git-tracked but isolated from core runtime)
- Migration: Routes here should not be called by new code; use core runtime equivalents

**app/lib/compliance/**
- Purpose: Audit evidence and compliance reporting logic
- Generated: No
- Committed: Yes
- Usage: Called by `/api/compliance/*` endpoints for audit trail generation

**app/lib/guardrails/**
- Purpose: Policy evaluation utilities and rule application helpers
- Generated: No
- Committed: Yes
- Usage: Used by `app/lib/guard.js` to apply policy rules

**app/lib/demo/**
- Purpose: Demo data generators and sample data
- Generated: No
- Committed: Yes
- Usage: Used when `isDemoMode` is true; does not touch real database

**.planning/codebase/**
- Purpose: Analysis documents generated by GSD mapping
- Generated: Yes (created by gsd-map-codebase agent)
- Committed: Yes (Git-tracked for reference)
- Contents: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md

**docs/**
- Purpose: API documentation and architectural references
- Auto-generated: `api-inventory.md`, `openapi/critical-stable.openapi.json` (via scripts on pre-commit)
- Manually maintained: Architecture decision records, SDK reference, deployment guides
- Committed: Yes (generated docs committed after script validation)
