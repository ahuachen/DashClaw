# DashClaw — Complete AI Context Document

> **Updated:** 2026-03-13
> **Purpose:** Give any AI model full context about the DashClaw platform in a single file.
> **Source of truth:** `PROJECT_DETAILS.md`, `README.md`, `sdk/README.md`, `docs/client-setup-guide.md`

---

## 1. What Is DashClaw?

DashClaw is an **AI agent decision infrastructure platform**. It serves as a governance and control plane for AI agent fleets, governing the lifecycle of agent decisions before they reach real-world systems.

DashClaw mirrors the lifecycle of a governed decision:
1. **Agent Intent** — The agent declares what it wants to do.
2. **Policy Evaluation** — DashClaw evaluates the intent against organizational policies.
3. **Decision Outcome** — The action is allowed, blocked, or requires human approval.
4. **Decision Evidence** — Verifiable proof of the governance process is recorded.

### Core Capabilities
- **Mission Control** — High-level fleet posture, active interventions, and live decision stream.
- **Decision Replay** — Visual causal chain visualization of single agent decisions.
- **Behavior Guard** — Policy enforcement before agents act (allow / warn / block / require_approval).
- **Risk Signals** — Automatic detection of dangerous behavior patterns (autonomy spikes, failure loops).
- **Assumption Tracking** — Log what agents believe; validate or invalidate later to detect drift.
- **Compliance Mapping** — SOC 2, ISO 27001, GDPR, NIST AI RMF, IMDA Agentic.
- **Multi-tenancy** — Isolated organizations, each with their own API keys and data.

### Deployment Model
DashClaw ships as one codebase serving two roles via `DASHCLAW_MODE`:

| Mode | Value | Behavior |
|------|-------|----------|
| Marketing/demo site | `DASHCLAW_MODE=demo` | No login, API returns fixtures, simulations enabled |
| Self-hosted (default) | `DASHCLAW_MODE=self_host` | GitHub/Google OAuth + real Postgres DB |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Next.js 15 (App Router) |
| Language | JavaScript |
| Styling | Tailwind CSS 3 + dark-only design tokens |
| Database | PostgreSQL via Neon (`@neondatabase/serverless`) or TCP (`postgres`) |
| Auth (UI) | NextAuth v4 (GitHub + Google OAuth, JWT strategy) |
| Auth (agents) | `x-api-key` header (DashClaw API keys) |
| ORM | Drizzle ORM (schema management only; raw SQL for queries) |
| Icons | lucide-react (no emoji in UI) |
| Testing | Vitest + jsdom |
| CI | GitHub Actions |
| Deployment | Vercel |
| SDK (Node) | `dashclaw` npm package — zero deps |
| SDK (Python) | `dashclaw` pip package — zero deps |

---

## 3. Architecture Overview

```
app/
├── page.js                    # Public landing page
├── layout.js                  # Root layout (Inter font, SessionWrapper)
├── globals.css                # CSS design tokens + Tailwind
├── mission-control/page.js    # Control Tower — Landing page (posture, interventions, live stream)
├── agents/page.js             # Agent Fleet — Overview, health, and permissions
├── actions/page.js            # Decisions Ledger — Global stream of governed actions
├── actions/[actionId]/page.js # Decision Replay — Visual causal chain of a decision
├── security/                  # Risk Signals — Spikes, failure loops, alerts
├── policies/                  # Guard Policies — Guardrail CRUD + test runner
├── compliance/                # Evidence — Control mapping and reports
├── activity/                  # Audit Log — Permanent record of platform activity
├── setup/                     # Settings — System configuration and verification
│
├── components/
│   ├── Sidebar.js             # Core Navigation (Command, Governance, Evidence, System)
│   ├── QuickStart.js          # Onboarding component (SDK guide + Decision Simulator)
│   ├── PageLayout.js          # Unified page shell
│   ├── AssumptionGraph.js     # Decision lineage visualization
│   └── ui/                    # Design system primitives
│
├── lib/
│   ├── guard.js               # Guard evaluation engine
│   ├── signals.js             # Risk signal computation
│   ├── security.js            # DLP / sensitive data scanning
│   ├── billing.js             # Token → USD cost estimation
│   └── audit.js               # Fire-and-forget activity logging
│
├── lib/repositories/          # All SQL queries live here (route-SQL guardrail)
│
└── api/                       # All API routes (Decision Control Plane)
```

### Key Invariants

1. **Mission Control as Landing Page**: Post-login, users are always sent to `/mission-control` for immediate operational posture.
2. **Decision Lineage Everywhere**: The product emphasizes the causal chain (Intent → Policy → Outcome) rather than isolated logs.
3. **Activation via Simulation**: New instances provide a "Run Simulation" feature to demonstrate governance without requiring an immediate SDK integration.
4. **No direct SQL in route files.** All queries go in `app/lib/repositories/*.repository.js`. CI blocks violations via `npm run route-sql:check`.
5. **Org context headers** (`x-org-id`, `x-org-role`, `x-user-id`) are injected by middleware only — never accepted from clients.
6. **Default-deny** for all `/api/*` routes — only explicit `PUBLIC_ROUTES` skip auth.

---

## 4. Auth & Multi-Tenancy

### Auth Flow (Browser)
1. `/login` → GitHub or Google OAuth (or Admin Password)
2. OAuth callback → NextAuth JWT cookie
3. Redirect to `/mission-control`
4. Every page route: `middleware.js` calls `getToken()` (Edge-compatible)
5. Session includes `user.role` (`admin` | `member`)

### Auth Flow (SDK / API Keys)
1. Agent sends `x-api-key: oc_live_xxx` header
2. Middleware resolves org:
   - Key matches `DASHCLAW_API_KEY` env → `org_default` (admin, fast path)
   - Otherwise → SHA-256 hash → `api_keys` table lookup
3. Middleware injects `x-org-id` and `x-org-role` headers
4. Every route calls `getOrgId(request)` from `app/lib/org.js`

### Role Capabilities

| Capability | Admin | Member |
|-----------|-------|--------|
| View all data | ✓ | ✓ |
| Use all APIs (SDK) | ✓ | ✓ |
| Generate/revoke API keys | ✓ | — |
| Invite team members | ✓ | — |
| Change roles | ✓ | — |
| Configure integrations | ✓ | — |
| Manage webhooks | ✓ | — |

---

## 5. Decision Lifecycle (The Core Narrative)

The platform is designed around the lifecycle of an agent decision:

### 1. Intent (Action Records)
Agents use the SDK to record what they intend to do. This captures:
- `declared_goal` (Intent)
- `reasoning` (Causality)
- `action_type` (Capability)

### 2. Governance (Guard)
Before acting, agents call `claw.guard()`. DashClaw evaluates:
- **Posture**: Current system risk level.
- **Policies**: Static and dynamic guardrails.
- **Signals**: Live risk indicators (e.g., recent failure rate).

### 3. Outcome
The decision is finalized and recorded in the **Decisions Ledger**. 
Failed or blocked decisions are surfaced in **Mission Control** for immediate operator intervention.

### 4. Evidence
Every step is preserved in the **Decision Replay** view, providing a cryptographically signed audit trail for compliance and debugging.

---

## 6. Key UI Components

- **Sidebar**: Collapsible navigation grouped by decision lifecycle (Command, Governance, Evidence, System).
- **Causal Timeline**: The heart of Decision Replay; visualizes the path from intent to outcome.
- **Posture Indicator**: Triple-state (Nominal, Elevated, Critical) summary of fleet risk.
- **QuickStart**: Onboarding card that guides users from SDK installation to their first simulated decision.
- **Assumption Graph**: Interactive SVG trace visualization of parent/child decision relationships.
