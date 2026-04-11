# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- JavaScript (ES2021+) — App Router routes, API endpoints, middleware, utilities, client components
- TypeScript — Config files accept TS annotations (tsconfig.json style), but codebase is JS-based

**Secondary:**
- SQL — Drizzle ORM schema definitions and ad-hoc queries via `getSql()`
- Python — SDK available at `sdk-python/` (parity with Node SDK)

## Runtime

**Environment:**
- Node.js 20+ (required via `package.json` engines)
- Browser (React 18, client-side components)

**Package Manager:**
- npm (presumed; package-lock.json likely present)
- Lockfile: present (monolithic dependency versioning)

## Frameworks

**Core:**
- Next.js 16.2.3 — App Router (not Pages), server components, API routes under `app/api/`, image optimization, security headers
- React 18 — Frontend components, hooks, SSR via Next.js

**Backend/Data:**
- Drizzle ORM 0.45.2 — PostgreSQL schema, type-safe queries; schema at `schema/schema.js`, migrations in `drizzle/`
- postgres 3.4.9 — TCP driver for self-hosted PostgreSQL
- @neondatabase/serverless 1.0.2 — Serverless driver for Neon (fetch-based, used when DATABASE_URL contains `.neon.tech`)

**Testing:**
- Vitest 4.1.0 — Unit/integration test runner; config at `vitest.config.js`
- @testing-library/react 16.3.2 — React component testing utilities
- jsdom 29.0.1 — DOM environment for Vitest

**UI/Visualization:**
- TailwindCSS 3.3.0 — Utility-first CSS; theme tokens in `app/globals.css`
- Recharts 3.8.1 — Charting library (decision analytics, cost trends, signal severity)
- @xyflow/react 12.10.2 — Graph visualization (execution flows, action causal chains)
- d3-drag, d3-force, d3-selection 3.0.0 — Low-level graph interactions
- Lucide-react 0.577.0 — Icon library
- react-grid-layout 2.2.3 — Dashboard layout system
- react-markdown 10.1.0 — Markdown rendering for policy documents

**Build/Dev:**
- esbuild 0.28.0 — Code bundler, used by Drizzle Kit and scripts
- Turbopack — Next.js 16 dev server (via `npm run dev -- --turbopack`)
- PostCSS 8 — CSS transformation pipeline
- Autoprefixer 10.4.27 — Browser vendor prefixes

**Build Linting:**
- ESLint 8.57.1 — JS/TS linting; config at `.eslintrc.json` (extends `next/core-web-vitals`)
- eslint-config-next 15.5.14 — Next.js-specific linting rules

**Utilities & Codecs:**
- js-yaml 4.1.0 — YAML parsing (guardrail policies, compliance frameworks)
- zod 4.3.6 — Schema validation and parsing
- docx 9.6.1 — Word document generation (compliance reports, evidence exports)
- @e965/xlsx 0.20.3 — Excel export (analytics, audit logs)
- html2pdf.js 0.14.0 — PDF generation
- better-sqlite3 12.8.0 — Embedded database (fallback or local state; likely used in scripts)

## Key Dependencies

**Critical:**
- @modelcontextprotocol/server 2.0.0-alpha.2 — MCP server implementation at `/api/mcp` (JSON-RPC 2.0 transport)
- openai 6.33.0 — OpenAI API client (lazy-loaded; LLM guard evaluations, embeddings)
- next-auth 4.24.13 — Authentication via OAuth (GitHub, Google) + OIDC + local admin fallback

**Infrastructure:**
- redis 4.7.1 — Redis client for distributed realtime pub/sub (optional; memory backend fallback)
- stripe 21.0.1 — Billing integration (checkout sessions, subscriptions, customer management)
- resend 6.10.0 — Email alerts via Resend API
- @vercel/analytics 2.0.1 — Web analytics (conditional per NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS)
- dashclaw 2.10.0 — Self-referential: internal SDK package published to npm (used by external agents)

## Configuration

**Environment:**
- `.env.example` — Template of all supported configuration variables (5935 bytes; see INTEGRATIONS.md for full list)
- `.env.local` — Development environment (gitignored; not committed)
- `.env` — Current deployment env vars (contains secrets; gitignored)
- Environment modes: `self_host` (default, full DashClaw instance) or `demo` (read-only sandbox for dashclaw.io)

**Build Configuration:**
- `next.config.js` — Next.js settings: CSP headers, image remote patterns, API rewrites for backward compatibility
- `drizzle.config.js` — Drizzle ORM: PostgreSQL dialect, schema path, migrations output
- `tailwind.config.js` — Tailwind: content paths, brand color tokens, font families
- `postcss.config.js` — PostCSS: Tailwind + Autoprefixer
- `vitest.config.js` — Vitest: jsdom environment, path alias `@` → `./app`
- `tsconfig.json` — Not found; project is JavaScript-based but accepts TS comments

## Platform Requirements

**Development:**
- Node 20+ with npm
- PostgreSQL 12+ (local via Docker or Neon free tier)
- Recommended: Vercel CLI for preview deployments

**Production:**
- Vercel (primary deployment target, free tier)
- Alternative: Docker/container (output: standalone, no external Node server required)
- Database: Neon PostgreSQL (recommended) or self-hosted PostgreSQL
- Optional: Redis (Upstash or self-hosted) for distributed realtime events
- Optional: Stripe (billing), Resend (alerts), OAuth providers (GitHub, Google, OIDC)

## Commands

**Core Workflows:**
```bash
npm run dev                    # Start Next.js dev server on port 3000 (Turbopack)
npm run build                  # Production build (SSR + static generation)
npm start                      # Start production server
npm run lint                   # ESLint on entire repo

npm run db:generate            # Drizzle Kit: generate migrations from schema changes
npm run db:push                # Drizzle Kit: apply migrations to DATABASE_URL
```

**Governance & Documentation:**
```bash
npm run docs:check             # Validate SDK docs against actual routes
npm run openapi:generate       # Generate OpenAPI spec (docs/openapi/critical-stable.openapi.json)
npm run openapi:check          # Verify no OpenAPI drift
npm run api:inventory:generate # Generate API route inventory (docs/api-inventory.md)
npm run api:inventory:check    # Verify route counts match spec

npm run route-sql:baseline:generate  # Baseline SQL guardrail (no direct SQL in routes)
npm run route-sql:check              # Enforce guardrail compliance
npm run contracts:check              # Check SDK/API contracts
```

**Testing & Quality:**
```bash
npm run test                   # Vitest (unit/integration)
npm run sdk:integration        # Cross-platform SDK integration tests
npm run sdk:integration:python # Python SDK tests
npm run test:api               # Full API contract testing

npm run startup:smoke          # Smoke test: startup sequences
npm run reliability:evidence   # Collect platform convergence metrics
npm run scripts:check-syntax   # Validate all scripts syntax
```

**Operations & Setup:**
```bash
npm run setup                  # Interactive onboarding and setup
npm run init:self-host-env     # Generate .env for self-hosted deployment
npm run demo                   # Launch demo mode with fixtures
```

**Database Migrations & Data:**
```bash
npm run migrate:behavioral     # One-off: enable behavioral AI guardrails
npm run migrate:learning-loop  # One-off: set up learning loop tables
npm run backfill:learning-episodes    # Repopulate learning data
npm run rebuild:learning-recommendations # Recalculate scored recommendations
npm run backfill:embeddings    # Generate vector embeddings for actions
```

**Release & Analytics:**
```bash
npm run release:sdks           # Publish Node + Python SDKs to npm/PyPI
npm run traffic:poll           # Poll GitHub traffic stats (async)
npm run pre-commit             # Run pre-commit hooks (test + lint + validation)
```

---

*Stack analysis: 2026-04-11*
