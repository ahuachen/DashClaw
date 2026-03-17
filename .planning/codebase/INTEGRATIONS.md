# External Integrations

**Analysis Date:** 2026-03-17

## APIs & External Services

**Language Models:**
- OpenAI API — LLM inference and embedding generation
  - SDK/Client: `openai` npm package
  - Config: OPENAI_API_KEY environment variable
  - Used in: `app/lib/embeddings.js` for token estimation and model inference
  - Health check: `POST https://api.openai.com/v1/models` with Bearer auth

- Anthropic API — Claude model access
  - Config: ANTHROPIC_API_KEY environment variable
  - Health check: `POST https://api.anthropic.com/v1/messages` with x-api-key header

**Billing & Payments:**
- Stripe API — Subscription management and billing
  - SDK/Client: `stripe` npm package
  - Config: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
  - Price objects: STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM
  - Health check: `GET https://api.stripe.com/v1/balance` with Basic auth
  - Usage: `app/api/usage/route.js` tracks stripe_customer_id and stripe_subscription_id
  - Test endpoint: `app/api/settings/test/route.js` validates Stripe credentials

**Email:**
- Resend API — Transactional email service
  - SDK/Client: `resend` npm package
  - Config: RESEND_API_KEY
  - Used in: Email alerts via `app/lib/notification-adapters/email.js`
  - Health check: Validates API key with test request

**Communication & Notifications:**
- Slack API — Workspace messaging and alerts
  - Auth methods: SLACK_BOT_TOKEN (bot authentication) or SLACK_WEBHOOK_URL
  - Endpoints:
    - `https://slack.com/api/auth.test` — Credential validation
    - `https://slack.com/api/chat.postMessage` — Message posting
  - Adapter: `app/lib/notification-adapters/slack.js`
  - Signal format: Rich block message format with severity indicators
  - Configuration: SLACK_CHANNEL_ID or SLACK_DEFAULT_CHANNEL

- Discord API — Webhook-based messaging
  - Auth method: DISCORD_WEBHOOK_URL
  - Health check: `GET` to webhook URL (200 OK = valid)
  - Adapter: `app/lib/notification-adapters/discord.js`
  - Used in: Signal and alert delivery

**Issue Tracking & CI/CD:**
- GitHub API — Repository integration and PR/issue automation
  - Auth method: GITHUB_TOKEN (personal access token)
  - Endpoints: `https://api.github.com/user` — Auth validation
  - OAuth provider: GitHub OAuth (GITHUB_ID, GITHUB_SECRET)
  - Adapter: `app/lib/notification-adapters/github.js`
  - Used in: GitHub OAuth sign-in and issue creation for alerts

- Linear API — Issue tracking and project management
  - Auth method: LINEAR_API_KEY
  - Endpoint: `https://api.linear.app/graphql` (GraphQL)
  - Health check: `{ viewer { id } }` query
  - Adapter: `app/lib/notification-adapters/linear.js`

**Authentication Providers:**
- GitHub OAuth — Sign-in via GitHub
  - Config: GITHUB_ID, GITHUB_SECRET
  - Provided by: NextAuth.js `GitHubProvider`

- Google OAuth — Sign-in via Google account
  - Config: GOOGLE_ID, GOOGLE_SECRET
  - Provided by: NextAuth.js `GoogleProvider`

- OIDC Provider — Generic OpenID Connect (Authentik, Keycloak, etc.)
  - Config: OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_DISPLAY_NAME
  - Scope: openid email profile
  - Used in: Multi-tenant enterprise SSO scenarios

**Cloud & Database:**
- Neon (Postgres Serverless) — Managed PostgreSQL
  - Connection: @neondatabase/serverless client for HTTP/WebSocket access
  - Config: DATABASE_URL matching pattern `*.neon.tech`
  - API: NEON_API_KEY (optional) for account management
  - Health check: `GET https://console.neon.tech/api/v2/projects` with Bearer auth

- Upstash Redis (Optional) — Distributed cache and pub/sub
  - Config: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
  - Used for: Distributed rate limiting and cross-instance realtime messaging
  - Fallback: In-memory store when not configured

- Vercel — Deployment and analytics platform
  - Package: `@vercel/analytics`
  - Auto-enabled on Vercel deployments
  - Manual enable: NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true

## Data Storage

**Databases:**
- PostgreSQL (primary)
  - Connection options:
    - Direct TCP via `postgres` driver (local/self-host)
    - Serverless via `@neondatabase/serverless` (Neon)
  - Client: Drizzle ORM ^0.45.1
  - Schema: `schema/schema.js` (managed by Drizzle Kit)
  - Migrations: `npm run db:generate`, `npm run db:push`

**File Storage:**
- Local filesystem — Session files, exported reports
- Generated exports: Excel (.xlsx), Word (.docx), PDF

**Caching:**
- In-memory (default) — Single-instance event replay and session cache
- Redis (optional) — Distributed cache across multiple instances (Upstash or self-managed)

## Authentication & Identity

**Auth Provider:**
- NextAuth.js ^4.24.13 — Multi-provider session management
  - Session store: Database-backed via Drizzle ORM
  - Providers supported:
    - Local password (DASHCLAW_LOCAL_ADMIN_PASSWORD)
    - GitHub OAuth
    - Google OAuth
    - OIDC (generic)
  - Config location: `app/lib/auth.js`, `app/lib/authConfig.mjs`

**Agent Identity:**
- API Key authentication (DASHCLAW_API_KEY)
  - Org mapping: DASHCLAW_API_KEY_ORG (default: org_default)
  - Agent signatures: Optional enforcement (ENFORCE_AGENT_SIGNATURES=true)
  - Enrollment: Optional closed enrollment (DASHCLAW_CLOSED_ENROLLMENT=false)

## Monitoring & Observability

**Error Tracking:**
- None detected in codebase — Rely on application logs and health checks

**Logs:**
- Console logging (stdout/stderr)
- Structured log format in health checks
- Cron job logs via npm scripts

**Health Checks:**
- Integration health check endpoints: `app/api/integrations/health/route.js`
- Cron validation: `app/api/cron/integration-health/route.js` (every 6 hours)
- Per-provider health functions in `app/lib/integration-health.js` (OpenAI, Anthropic, Slack, Discord, Linear, GitHub, Neon, Resend)

## CI/CD & Deployment

**Hosting:**
- Vercel (recommended) — Native Next.js support with analytics
- Docker (self-hosted) — Dockerfile provided at `Dockerfile`

**CI Pipeline:**
- GitHub Actions — Governance boundary check on PR
  - Enforces minimal 7-route API surface
  - Command: `npm run governance:boundary:check`

**API Contract Validation:**
- OpenAPI schema generation: `npm run openapi:generate`
- Schema drift detection: `npm run openapi:check`
- Output: `docs/openapi/critical-stable.openapi.json` (committed)

**Database Migrations:**
- Drizzle Kit: `npm run db:generate`, `npm run db:push`
- Manual schema updates via `app/lib/schemaCheck.js`

## Environment Configuration

**Required env vars:**
- DATABASE_URL — PostgreSQL or Neon connection string
- DASHCLAW_API_KEY — API authentication token
- ENCRYPTION_KEY — 32-char key for settings encryption
- NEXTAUTH_SECRET — Session encryption key (32+ chars)
- CRON_SECRET — Cron job authentication (64-char hex)

**Optional env vars:**
- OPENAI_API_KEY, ANTHROPIC_API_KEY — LLM inference
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET — Billing
- RESEND_API_KEY — Email delivery
- SLACK_BOT_TOKEN, SLACK_WEBHOOK_URL — Slack notifications
- DISCORD_WEBHOOK_URL — Discord notifications
- GITHUB_TOKEN — GitHub integration
- LINEAR_API_KEY — Linear integration
- GITHUB_ID, GITHUB_SECRET — GitHub OAuth
- GOOGLE_ID, GOOGLE_SECRET — Google OAuth
- OIDC_ISSUER_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET — OIDC sign-in
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN — Distributed rate limiting

**Secrets location:**
- `.env` file (local development, not committed)
- Environment variables (production deployment)
- Vercel Secrets (if deploying to Vercel)
- GitHub Secrets (if using GitHub Actions)

**SSRF Protection:**
- WEBHOOK_ALLOWED_DOMAINS — Comma-separated trusted webhook domains
- Default: No restrictions (configure for production)
- Validation in `app/lib/webhooks.js`

## Webhooks & Callbacks

**Incoming:**
- Stripe webhook handler (expected at `/api/webhooks` for billing events)
- Generic webhook delivery: `app/api/webhooks/route.js` (custom payloads)
- Integration health checks triggered on-demand: `app/api/cron/integration-health/route.js`

**Outgoing:**
- Signal notifications via adapters:
  - Slack (webhook or bot token + channel)
  - Discord (webhook URL)
  - GitHub (create issues/PRs)
  - Linear (GraphQL mutations)
  - Email (Resend API)
- Webhook HMAC signing: `app/lib/webhooks.js` includes crypto signature validation
- Safe URL validation: Rejects private IPs, requires HTTPS, no credentials in URL

## Scheduled Jobs (Cron)

**Routes:** `app/api/cron/` (protected by CRON_SECRET)

- `/api/cron/signals` — Signal detection and notification (every 5 min)
- `/api/cron/integration-health` — Credential validation for all orgs (every 6 hours)
- `/api/cron/learning-episodes-backfill` — Learning loop data processing
- `/api/cron/learning-recommendations` — ML-based recommendations
- `/api/cron/memory-maintenance` — Cleanup stale data
- `/api/cron/routing-maintenance` — Keep routing indices fresh

---

*Integration audit: 2026-03-17*
