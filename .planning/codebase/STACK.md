# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- JavaScript (Node.js) — Backend API routes, CLI scripts, database migrations
- JSX/React — Frontend UI components
- SQL — Database schema and Drizzle ORM migrations

**Secondary:**
- YAML — Configuration files (drizzle.config.js)

## Runtime

**Environment:**
- Node.js 20.0.0+ (specified in `package.json` engines)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (inferred from `.npmrc-cache/`)

## Frameworks

**Core:**
- Next.js ^16.1.6 — Full-stack React framework with App Router
- React ^18 — UI component library
- NextAuth.js ^4.24.13 — Authentication middleware

**Database & ORM:**
- Drizzle ORM ^0.45.1 — Type-safe SQL query builder
- Drizzle Kit ^0.31.9 — Schema migrations and DB introspection
- postgres ^3.4.8 — Native PostgreSQL driver
- @neondatabase/serverless ^1.0.2 — Serverless Postgres client (Neon)

**Testing:**
- Vitest ^4.1.0 — Fast unit test runner
- @vitest/coverage-v8 ^4.1.0 — Code coverage reporting
- @testing-library/react ^16.3.2 — React component testing utilities
- jsdom ^29.0.0 — DOM simulation for tests

**Build/Dev:**
- TurboSQL (invoked via `npm run dev` with `--turbopack`)
- Autoprefixer ^10.4.27 — CSS vendor prefixing
- PostCSS ^8 — CSS processing pipeline
- Tailwind CSS ^3.3.0 — Utility-first CSS framework
- ESLint ^8.57.1 — JavaScript linting (config in `.eslintrc.json`)
- Husky ^9.1.7 — Git hooks for pre-commit validation

## Key Dependencies

**Critical:**
- dashclaw ^2.2.1 — The SDK itself (self-referential, published to npm)
- zod ^4.3.6 — Schema validation and type narrowing
- js-yaml ^4.1.0 — YAML parsing for configuration

**Infrastructure & APIs:**
- stripe ^20.4.1 — Billing and subscription management
- openai ^6.27.0 — LLM inference and embeddings via OpenAI API
- resend ^6.9.3 — Email delivery service
- redis ^4.7.1 — Distributed caching and pub/sub (optional, for realtime)

**Data & Export:**
- @e965/xlsx ^0.20.3 — Excel file generation
- docx ^9.6.1 — Word document (.docx) generation
- html2pdf.js ^0.14.0 — PDF export from HTML
- react-markdown ^10.1.0 — Markdown rendering in React

**UI & Visualization:**
- lucide-react ^0.577.0 — Icon library
- recharts ^3.8.0 — Charting library for analytics
- react-grid-layout ^2.2.2 — Drag-drop grid layout for dashboards
- d3-drag, d3-force, d3-selection ^3.0.0 — Low-level D3 modules for custom visualizations

**Analytics & Monitoring:**
- @vercel/analytics 1.6.1 — Privacy-first page view analytics (Vercel deployments)

**Build & Bundling:**
- esbuild ^0.27.4 — Fast JavaScript bundler (used in scripts)

## Configuration

**Environment:**
- `.env.example` defines all required and optional variables
- `.env` (not committed) contains runtime secrets
- `.env.local` (not committed) for development overrides
- DASHCLAW_MODE: `self_host` (default) or `demo` (read-only sandbox)

**Database Configuration:**
- DATABASE_URL: PostgreSQL or Neon connection string
- DASHCLAW_DB_DRIVER: Auto-detected from URL (`postgres` or `neon`)

**Auth Configuration:**
- NEXTAUTH_URL and NEXTAUTH_SECRET for session management
- OAuth providers: GitHub, Google
- OIDC provider support (Authentik, Keycloak)
- DASHCLAW_LOCAL_ADMIN_PASSWORD: Local-only auth for solo deployments

**Encryption:**
- ENCRYPTION_KEY: 32-character key for sensitive settings encryption

**Rate Limiting:**
- In-memory limiter by default (single-instance)
- Optional Upstash Redis for distributed rate limiting (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)

**Cron Security:**
- CRON_SECRET: 64-char hex token for scheduled job authentication

## Platform Requirements

**Development:**
- Docker with PostgreSQL (recommended: `docker compose up -d db`)
- OR Neon account (free tier available at neon.tech)
- Node 20+
- npm

**Production:**
- Vercel (native deployment with analytics included)
- OR self-hosted (Docker Dockerfile provided)
- Postgres database (Neon or self-managed)
- Optional: Upstash Redis for distributed realtime

## Realtime Backend

**Default:** In-memory event bus (single-instance only)
- REALTIME_BACKEND=memory
- REALTIME_REPLAY_WINDOW_SECONDS=600
- REALTIME_REPLAY_MAX_EVENTS=1000

**Distributed:** Redis pub/sub for multi-instance deployments
- REALTIME_BACKEND=redis
- REDIS_URL=redis://localhost:6379

---

*Stack analysis: 2026-03-17*
