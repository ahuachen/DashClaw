# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Next.js 16 App Router + API Routes + Repository Layer (3-tier)

**Key Characteristics:**
- Request flow: Route Handler → Repository → Database (no direct SQL in routes)
- Org-scoped multi-tenant via `getOrgId(request)` on every route
- Governance loop: Guard (policy eval) → Action Record (create) → Update Outcome (record result) → Stream (notification)
- Core surfaces are 5 mandatory routes; extensions are modular opt-in intelligence
- Database: Postgres (Neon or self-hosted) with Drizzle ORM schema
- Client-side: React 18 with client components consuming API via fetch

## Layers

**Presentation Layer (App Router Pages):**
- Purpose: Server-rendered and client-side UI surfaces for operators and monitoring
- Location: `app/` (page dirs like `app/mission-control/`, `app/decisions/`, `app/connect/`)
- Contains: Page components (`.js`), route segments, client component trees
- Depends on: API routes (`/api/*`), shared components (`app/components/`), hooks (`app/hooks/`)
- Used by: Browsers via Next.js App Router

**API Layer (Route Handlers):**
- Purpose: HTTP endpoints for agents (SDKs) and UI clients
- Location: `app/api/*/route.js` (e.g., `app/api/guard/route.js`, `app/api/actions/route.js`)
- Contains: Request/response validation, org-scoping, business logic orchestration
- Pattern: `export async function GET(request) { ... }` and `POST(request) { ... }`
- Depends on: Repositories (data access), libraries (`app/lib/*.js`), database (`getSql()`)
- Used by: SDK clients, UI clients, cron jobs, webhooks
- Constraint: No direct SQL in routes; all queries via repositories

**Repository Layer (Data Access):**
- Purpose: Encapsulate all database queries and data mutations
- Location: `app/lib/repositories/*.repository.js` (e.g., `actions.repository.js`, `capabilities.repository.js`)
- Contains: SQL queries, result mapping, atomic transactions
- Pattern: Exported async functions like `listActions(sql, orgId, filters)` returning promise
- Depends on: Database driver (tagged template SQL), Zod validation
- Used by: Routes, business logic libraries

**Library/Utility Layer:**
- Purpose: Cross-cutting business logic, validation, integration handlers
- Location: `app/lib/*.js` (e.g., `guard.js`, `signals.js`, `billing.js`)
- Contains: 
  - `guard.js` — Policy evaluation engine with predictive risk scoring
  - `signals.js` — Anomaly detection (Autonomy Spikes, Stale Actions)
  - `events.js` — Event publication and subscription
  - `db.js` — Database connection with Neon/Postgres adapter selection
  - `auth.js` — Multi-tenant identity and API key validation
  - `apiErrors.js` — Structured error responses
  - `capability-invoke.js` — HTTP capability execution with timeout/auth
  - `workflow-executor.js` — Sequential workflow step execution
  - `integration-health.js` — Credential validation for external services
  - `billing.js` — Token cost estimation for LLM calls
  - `policy-generator.js` — LLM-powered policy synthesis from natural language
- Depends on: Database, external services (OpenAI, Stripe), repositories

**Database Layer:**
- Purpose: Persistent data storage and state
- Location: Postgres (Neon cloud or self-hosted)
- Schema: Drizzle ORM migrations in `drizzle/*.sql`
- Key Tables:
  - `action_records` — Governed actions (intent → outcome)
  - `guard_policies` — Policy definitions and rules
  - `assumptions` — Reasoning basis for decisions
  - `workflow_templates` — Reusable workflow definitions
  - `capabilities` — HTTP capability registry
  - `knowledge_collections` — Semantic knowledge with pgvector embeddings
  - `api_keys` — Agent authentication tokens
  - `agent_presence` — Live agent heartbeat tracking

## Data Flow

**Governance Loop (Core 4-Step):**

1. **Guard (Policy Evaluation):**
   - Agent calls `POST /api/guard` with `{ action_type, risk_score, declared_goal, ... }`
   - Route validates input via `validateGuardInput()`
   - Calls `evaluateGuard(orgId, data, sql, options)` in `app/lib/guard.js`
   - Guard queries `guard_policies` from org, applies rules against intent
   - Returns `{ decision: 'allow'|'warn'|'block'|'require_approval', reason, action_id }`
   - If `include_signals=true`, also queries `computeSignals()` for anomalies

2. **Create Action (Record Start):**
   - Agent calls `POST /api/actions` with action details (type, goal, input_summary, etc.)
   - Route validates via `validateActionRecord()`
   - Checks quota via `checkQuotaFast()` from `app/lib/usage.js`
   - Inserts `action_records` row via `createActionRecord(sql, orgId, data)`
   - Returns `{ action_id: 'ac_...', status: 'started' }`
   - Publishes `EVENTS.ACTION_CREATED` to subscribers via `publishOrgEvent()`
   - If guard blocked pre-emptively, creates `action_records` with `status='blocked'`

3. **Update Outcome (Record Result):**
   - Agent calls `POST /api/actions/:actionId/outcome` with result (status, output, error_message)
   - Route updates `action_records` via `updateOutcome(sql, actionId, outcome)`
   - Records cost estimate via `estimateCost()` if LLM tokens present
   - Publishes `EVENTS.ACTION_OUTCOME` event
   - Triggers action alerts if policy-relevant (via `fireActionAlert()`)
   - Creates artifacts if workflow step generated outputs

4. **Stream (Notifications):**
   - All events flow through `app/lib/events.js` pub/sub
   - Subscribers filter by org_id and action properties
   - Notification adapters in `app/lib/notification-adapters/` dispatch to Slack, Discord, Email, etc.
   - Real-time clients subscribe via WebSocket or Server-Sent Events (SSE) at `/api/stream`
   - Mission Control `/mission-control` page fetches via `useRealtime()` hook

**Workflow Execution Flow:**

1. Agent launches workflow via `POST /api/workflows/templates/:templateId/execute`
2. Route calls `executeWorkflow(sql, orgId, template, variables)`
3. Executor in `app/lib/workflow-executor.js` iterates steps sequentially
4. Per step type (prompt, capability_invoke, knowledge_search):
   - Resolves variables via `app/lib/template-vars.js`
   - Executes step handler via `app/lib/step-handlers.js`
   - Creates child `action_records` row for step
   - Stores result in `workflow_step_results` table
5. Steps support conditional `continue_on_failure` to proceed on error
6. Final result includes all step outputs as rolling context

**State Management:**

- **Org Scoping:** Every route extracts `org_id` via `getOrgId(request)` from auth header; all queries filtered by org_id
- **Agent Identity:** Agents authenticated via API key (`x-api-key` header) or signed request (SHA256 HMAC in `signature` field)
- **Transactional Updates:** Action outcome transitions are atomic via single SQL UPDATE
- **Event Publishing:** State changes trigger domain events (`EVENTS.ACTION_CREATED`, `EVENTS.SIGNAL_TRIGGERED`) to notify UI and integrations
- **Polling vs. Streaming:** UI polls via `GET /api/actions` with offset/limit; server emits via SSE at `/api/stream` for real-time updates

## Key Abstractions

**Guard (Policy Engine):**
- Purpose: Evaluate intent against org policies to return decision
- Examples: `app/api/guard/route.js`, `app/lib/guard.js`
- Pattern: `evaluateGuard(orgId, context, sql, options)` returns `{ decision, reason, signals, action_id }`
- Integration: Risk scoring merges rules-based (policy) + predictive (historical failure rates) + LLM (high-stakes)

**Action Record:**
- Purpose: Immutable log of an agent-proposed action from intent → outcome
- Examples: `app/lib/repositories/actions.repository.js`
- Pattern: Single row in `action_records` with lifecycle fields (status, timestamp_start/end, cost_estimate)
- Schema: `action_id`, `status`, `declared_goal`, `reasoning`, `output_summary`, `error_message`, `approved_by`

**Capability (HTTP Invocation):**
- Purpose: Registry of external HTTP services agents can invoke through governance
- Examples: `app/api/capabilities/route.js`, `app/lib/capability-invoke.js`
- Pattern: Capability definition includes `source_url`, `method`, `request_mapping`, `response_mapping`, auth scheme
- Invocation: `POST /api/capabilities/:capabilityId/invoke` guards, executes, records, returns `{ status: 200|403|202, content }`

**Workflow Template:**
- Purpose: Reusable multi-step automation with conditional branching
- Examples: `app/api/workflows/templates/route.js`, `app/lib/workflow-executor.js`
- Pattern: Template has `steps: [{ type, config, condition?, continue_on_failure? }]` and model strategy reference
- Execution: Steps run sequentially, each creates child action, outputs become context for next step

**Signal (Anomaly):**
- Purpose: Real-time detection of governance-relevant pattern deviations
- Examples: `app/lib/signals.js`
- Pattern: `computeSignals(orgId, sql)` analyzes recent actions for Autonomy Spikes, Stale Actions, Cost Anomalies
- Usage: Returned with guard decision if `include_signals=true`; also triggers alerts via `/api/cron/signals`

**Assumption (Reasoning Basis):**
- Purpose: Record the factual/logical basis agents used for a decision
- Examples: `app/api/assumptions/route.js`, `app/lib/repositories/assumptions.repository.js`
- Pattern: Agent calls `POST /api/assumptions` with `{ action_id, assumption, basis }` after action outcome
- Integration: Displayed in decision replay; validated post-hoc for feedback loop

## Entry Points

**Web UI (Server-Side):**
- Location: `app/layout.js` (Root layout with SessionWrapper, fonts, analytics)
- Trigger: Browser navigation to `/`, `/mission-control`, `/decisions`, `/setup`, `/connect`
- Responsibilities: 
  - Root metadata, fonts, CSS globals
  - Session provider wrap for auth context
  - Layout for nested pages

**Home Page (Landing):**
- Location: `app/page.js`
- Trigger: `GET /` (public route, no auth required on first load)
- Responsibilities: Hero section, feature overview, framework quickstarts, demo toggle, setup banner

**API Routes (Agents & Clients):**
- **Core Governance:** `app/api/guard/route.js`, `app/api/actions/route.js`, `app/api/policies/route.js`, `app/api/assumptions/route.js`, `app/api/approvals/route.js`, `app/api/signals/route.js`, `app/api/health/route.js`
- **Extensions:** `app/api/workflows/`, `app/api/capabilities/`, `app/api/knowledge/`, `app/api/billing/`, `app/api/analytics/`
- Trigger: HTTP POST/GET from SDK clients, UI, cron, webhooks
- Responsibilities: Auth via `getOrgId()`, org-scoping, delegation to repositories

**Cron/Background Jobs:**
- Location: `app/api/cron/*` (Vercel Cron or external scheduler)
- Examples: `/api/cron/signals` (every 5 min), `/api/cron/integration-health` (every 6h)
- Trigger: Scheduled time (Vercel Cron HTTP GET)
- Responsibilities: Compute signals, validate credentials, archive meters

**SDK Entry Point:**
- Location: `sdk/dashclaw.js` (Node, v2.11.1), `sdk-python/dashclaw/__init__.py` (Python)
- Imports: `import { DashClaw } from 'dashclaw'` (named export — not a default export) or `from dashclaw import DashClaw`
- Methods: 80 v2 methods spanning Core Governance, Decision Integrity, Scoring, Messaging, Handoffs, Sessions, and Execution Studio (workflow templates, model strategies, knowledge collections, capability runtime). The minimal governance loop is `guard` → `createAction` → (optional) `waitForApproval` → `updateOutcome`. Full surface in `sdk/README.md`.
- Legacy subpath: `import { DashClaw } from 'dashclaw/legacy'` exposes the broader v1 compatibility surface (~2800 lines) for older integrations — pairing, SSE events, compliance, drift, activity logs, webhooks CRUD.
- Pattern: All methods make HTTP calls to the base URL with `x-api-key` header auth.

## Error Handling

**Strategy:** Structured error responses with org-scoped logging, fail-fast on critical errors

**Patterns:**
- **Validation Errors:** `{ error: 'Validation failed', details: [...] }` with 400 status
- **Auth Errors:** `{ error: 'Unauthorized' }` with 401 status; `{ error: 'Forbidden' }` with 403 for policy blocks
- **Not Found:** `{ error: 'Entity not found' }` with 404 status
- **Conflict:** `{ error: 'Duplicate key' }` with 409 status
- **Server Errors:** `{ error: 'Internal server error', request_id }` with 500; error logged with org_id and request context
- **Policy Block (Guard):** `{ decision: 'block', reason: '...', status: 403 }` returned to caller; action_record created with `status='blocked'`
- **Unhandled Rejection:** Node process configured to catch and exit on promise rejections (CLAUDE.md rule)

## Cross-Cutting Concerns

**Logging:** Intentional, org-scoped, no env var leaks
- Pattern: Log at route entry/exit with org_id, action_id, duration
- Framework: `console.log()` with structured context; no secrets logged
- Observability: Errors include `request_id` for tracing

**Validation:** Zod schemas applied at route entry
- Pattern: `validateGuardInput()`, `validateActionRecord()` return `{ valid, data, errors }`
- Scope: Request body shape, enum values (decision types, status), required fields
- Guard against: Prompt injection in `declared_goal` via `scanForPromptInjection()`, sensitive data in inputs via `scanSensitiveData()`

**Authentication:** Multi-method, org-scoped
- API Key: `x-api-key` header matched against `api_keys` table via `verifyApiKey()`
- User Session: Next.js Auth via `/api/auth/*`; session provider in `SessionWrapper`
- Agent Signature: Optional HMAC-SHA256 signature in `signature` field; verified via `verifyAgentSignature()`
- Org Scoping: All routes extract `org_id` via header or session; used to filter all queries

**Rate Limiting:** Per-org quota enforcement
- Pattern: `checkQuotaFast(orgId, plan)` returns boolean; increments meter via `incrementMeter(orgId, 'actions')`
- Scope: Action creation, workflow execution, knowledge ingestion
- Grace: Grace buffer allows small overage before hard block

**Cost Tracking:** Token-level metering
- Pattern: `estimateCost(tokens_in, tokens_out, model)` via pricing table in `app/lib/billing.js`
- Scope: LLM calls in workflows, model strategies, policy generator
- Billing: Stripe integration at `/api/billing/checkout` and `/api/webhooks/stripe`
