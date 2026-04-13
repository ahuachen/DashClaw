# External Integrations

**Analysis Date:** 2026-04-11

## APIs & External Services

**LLM Providers:**
- OpenAI — Guard decision evaluations, behavioral AI embeddings, semantic scoring
  - SDK/Client: `openai` 6.33.0 (lazy-loaded)
  - Auth: `OPENAI_API_KEY` or `GUARD_LLM_KEY`
  - Endpoint: `/api/mcp/` can delegate guard decisions to OpenAI gpt-4o-mini
  - Implementation: `app/lib/llm.js`, `app/lib/embeddings.js`

- Anthropic Claude — LLM fallback for guard decisions, predictive risk
  - Auth: `ANTHROPIC_API_KEY`
  - Model: claude-haiku-4-5 (default for cost control)
  - Implementation: `app/lib/llm.js` (provider auto-detection)

- Google Gemini — LLM fallback (lowest priority)
  - Auth: `GOOGLE_AI_API_KEY`
  - Model: gemini-1.5-flash
  - Implementation: `app/lib/llm.js`

**Billing & Payments:**
- Stripe — Subscription checkout, customer management, plan upgrades
  - SDK: `stripe` 21.0.1
  - Auth: `STRIPE_SECRET_KEY` (server-side only)
  - Public key: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Webhook secret: `STRIPE_WEBHOOK_SECRET`
  - Routes: `app/api/billing/checkout/route.js`, `app/api/billing/portal/route.js`
  - Features: checkout sessions, customer portal, subscription lifecycle

**Messaging & Alerts:**
- Resend — Email notifications for governance signals
  - SDK/Client: HTTP API via native fetch
  - Auth: `RESEND_API_KEY`
  - Adapter: `app/lib/notification-adapters/email.js`
  - Usage: Alert emails for risk signals, approvals pending
  - Fallback: SendGrid if Resend unavailable

- SendGrid — Email alternative
  - Auth: `SENDGRID_API_KEY`
  - Adapter: `app/lib/notification-adapters/email.js`

- Slack — Native signal notifications
  - Auth: `SLACK_WEBHOOK_URL` or `SLACK_BOT_TOKEN`
  - Adapter: `app/lib/notification-adapters/slack.js`
  - Usage: Post risk signals and approval events to Slack channels

- Discord — Native signal notifications
  - Auth: `DISCORD_WEBHOOK_URL`
  - Adapter: `app/lib/notification-adapters/discord.js`

- GitHub — Issue/PR creation for governance signals
  - Auth: `GITHUB_TOKEN` or OAuth credentials
  - Adapter: `app/lib/notification-adapters/github.js`

- Linear — Issue creation for signals and approvals
  - Auth: `LINEAR_API_KEY`
  - Adapter: `app/lib/notification-adapters/linear.js`

- Telegram Bot API — Inline Approve/Reject push for `pending_approval` actions
  - Auth: `TELEGRAM_BOT_TOKEN` (Bot API token from @BotFather)
  - Allowlist: `TELEGRAM_ADMIN_CHAT_ID` (numeric chat ID permitted to approve)
  - Webhook auth: `TELEGRAM_WEBHOOK_SECRET` (verified via `X-Telegram-Bot-Api-Secret-Token` header on inbound callbacks)
  - Org mapping: `TELEGRAM_APPROVER_ORG_ID` (which org's actions this Telegram chat can resolve)
  - Kill switch: `DASHCLAW_ALERTS_TELEGRAM=false` (disables outbound even when token is set)
  - Emitter: `app/lib/telegramApprovals.js` (`fireTelegramApproval()`)
  - Inbound webhook: `app/api/telegram/webhook/route.js` — receives Bot API callback_query, resolves action via `/api/approvals/:id`
  - Usage: Fire-and-forget push of `pending_approval` notifications with inline keyboard; one-tap approve/reject

## Data Storage

**Databases:**
- PostgreSQL (primary)
  - Version: 12+ (no version constraint, but 14+ recommended)
  - Connection: `DATABASE_URL` (tcp for self-hosted, fetch for Neon)
  - Client libraries: `postgres` 3.4.9 (TCP), `@neondatabase/serverless` 1.0.2 (Neon)
  - ORM: Drizzle 0.45.2
  - Schema: `schema/schema.js` (Drizzle table definitions)
  - Migrations: Drizzle-Kit in `drizzle/` directory
  - Key tables: organizations, users, api_keys, action_records, signals, decisions, assumptions, approvals, learningLoop, webhooks
  - Features: vector embeddings (pgvector extension for behavioral AI)

- In-Memory Event Cache (default)
  - Realtime event stream for SSE connections (mission control live feed)
  - Location: `app/lib/events.js` (MemoryRealtimeBackend class)
  - Fallback when Redis unavailable
  - Bounded by REALTIME_REPLAY_MAX_EVENTS (default 1000)

**Optional Distributed Cache:**
- Redis (optional, cross-instance realtime pub/sub)
  - Client: `redis` 4.7.1
  - Connection: `REDIS_URL` or `REALTIME_REDIS_URL`
  - Usage: Distributed event pub/sub for multi-instance deployments, replacing in-memory backend
  - When enabled: REALTIME_BACKEND=redis
  - Fallback: Memory backend if URL missing or unreachable
  - Implementation: `app/lib/events.js` (RedisRealtimeBackend class)

**Local Embedded DB:**
- SQLite (better-sqlite3 12.8.0) — Used by scripts and optional local state; not primary runtime

**File Storage:**
- Local filesystem only — No S3 or external blob storage configured
- Artifacts and reports: stored in PostgreSQL or generated on-demand

## Authentication & Identity

**OAuth Providers:**
- GitHub OAuth 2.0 — User login and Slack/GitHub integrations
  - Credentials: `GITHUB_ID`, `GITHUB_SECRET` (or legacy: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`)
  - Implementation: `app/lib/auth.js` via NextAuth `GitHubProvider`

- Google OAuth 2.0 — User login
  - Credentials: `GOOGLE_ID`, `GOOGLE_SECRET` (or legacy: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
  - Implementation: `app/lib/auth.js` via NextAuth `GoogleProvider`

- OIDC (OpenID Connect) — Enterprise SSO (e.g., Authentik, Keycloak)
  - Credentials: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`
  - Optional endpoints: `OIDC_AUTHORIZATION_URL`, `OIDC_TOKEN_URL`, `OIDC_USERINFO_URL` (for discovery workarounds)
  - Display name: `OIDC_DISPLAY_NAME` (default: "OIDC")
  - Implementation: `app/lib/auth.js`

**Session Management:**
- NextAuth 4.24.13 — JWT-based sessions (not database sessions)
  - Configuration: `app/lib/authOptions` (session strategy: jwt)
  - Signing secret: `NEXTAUTH_SECRET`
  - Base URL: `NEXTAUTH_URL`
  - Local fallback: `DASHCLAW_LOCAL_ADMIN_PASSWORD` (for solo/self-hosted, skips OAuth)

**API Authentication:**
- API keys mapped to organizations
  - Key structure: `key_*` prefixes (stored hashed in database)
  - Storage: `organizations.api_key_hash`, `organizations.api_key_prefix`
  - Validation: Routes check `x-api-key` header via `DASHCLAW_API_KEY` env var
  - Mapping: Default org is `org_default` (overridable via `DASHCLAW_API_KEY_ORG`)

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Rollbar, or similar)
- Reliance: Console logs (stdout for Vercel/container deployment)
- Error format: Structured via `app/lib/apiErrors.js`

**Logs:**
- Console-based logging (no external log aggregation configured)
- Vercel/container stdout/stderr streams logs
- Structured fields: timestamps, request IDs, event types
- Security: No environment variables or auth headers logged

**Application Insights:**
- Vercel Web Analytics (optional, controlled by `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`)
- Internal analytics stored in PostgreSQL (`analytics` table via `analytics.repository.js`)
- No third-party analytics SDKs other than Vercel

## CI/CD & Deployment

**Hosting Platform:**
- Vercel (primary) — Free tier deployment
- Alternative: Docker/standalone (output: standalone, no external Node server)
- Environment: `VERCEL_URL` used for callback URLs and origin detection

**CI Pipeline:**
- None detected (no GitHub Actions workflows in `.github/workflows/`)
- Pre-commit hooks available via `npm run pre-commit`
- Manual deployment via `vercel` CLI or git push to linked branch

**Cron Jobs (Vercel):**
- `GET /api/cron/signals` — Hourly signal evaluation and webhook firing
- `GET /api/cron/memory-maintenance` — Memory eviction and cleanup
- Protected by `CRON_SECRET` (generated: `openssl rand -hex 32`)

## Environment Configuration

**Required env vars (core runtime):**
- `DATABASE_URL` — PostgreSQL connection string (local: `postgresql://dashclaw:dashclaw@localhost:5432/dashclaw`, Neon: serverless URL)
- `DASHCLAW_API_KEY` — API key protecting `/api/*` endpoints
- `ENCRYPTION_KEY` — 32-character encryption key for sensitive settings
- `NEXTAUTH_URL` — NextAuth base URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` — 32-character signing secret for JWT sessions

**Optional but recommended:**
- `DASHCLAW_LOCAL_ADMIN_PASSWORD` — Enables local password auth (skips OAuth)
- `CRON_SECRET` — Protects cron endpoints
- `ALLOWED_ORIGIN` — CORS restriction (e.g., https://your-app.vercel.app)
- `TRUST_PROXY` — Trust x-forwarded-for from reverse proxy (default: false)

**Realtime & Rate Limiting:**
- `REALTIME_BACKEND` — memory (default) or redis
- `REDIS_URL` — Redis connection for distributed state
- `REALTIME_REPLAY_WINDOW_SECONDS` — Event replay window (default: 600)
- `REALTIME_REPLAY_MAX_EVENTS` — Event buffer size (default: 1000)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — Alternative Redis provider

- `DASHCLAW_DISABLE_RATE_LIMIT` — Disable rate limiting (dev only)
- `DASHCLAW_RATE_LIMIT_WINDOW_MS` — Rate limit window (default: 60000)
- `DASHCLAW_RATE_LIMIT_MAX` — Max requests per window (default: 1000)

**Webhook & SSRF Protection:**
- `WEBHOOK_ALLOWED_DOMAINS` — Comma-separated list of trusted webhook domains (e.g., slack.com,discord.com)

**Telegram approval bridge (optional):**
- `TELEGRAM_BOT_TOKEN` — Bot API token from @BotFather (feature is off when blank)
- `TELEGRAM_ADMIN_CHAT_ID` — Numeric chat ID allowed to approve actions
- `TELEGRAM_WEBHOOK_SECRET` — 32+ random chars, verified on inbound `/api/telegram/webhook` requests
- `TELEGRAM_APPROVER_ORG_ID` — Org ID to resolve Telegram approvals against
- `DASHCLAW_ALERTS_TELEGRAM` — Set to `false` to disable outbound Telegram alerts even when token is present

**Mode & Driver Control:**
- `DASHCLAW_MODE` — self_host (default) or demo (read-only sandbox)
- `NEXT_PUBLIC_DASHCLAW_MODE` — Public mode indicator
- `DASHCLAW_DB_DRIVER` — Force driver: postgres (TCP) or neon (serverless)
- `DASHCLAW_DB_POOL_MAX` — Connection pool size (default: 10)

**Security & Governance:**
- `ENFORCE_AGENT_SIGNATURES` — Require signed actions (default: true in production)
- `DASHCLAW_CLOSED_ENROLLMENT` — Require pre-registration (default: false)

**Secrets location:**
- `.env` file (development) — Not committed; contains local secrets
- Vercel Secrets panel (production) — Environment variables stored securely
- Never commit `.env` or `.env.local`; use `.env.example` as template

## Webhooks & Callbacks

**Incoming Webhooks:**
- `POST /api/webhooks/stripe` — Stripe event subscriptions (checkout.session.completed, customer.subscription.updated)
- `POST /api/webhooks/[webhookId]` — Custom webhook sink (user-defined URL targets)
- `POST /api/telegram/webhook` — Telegram Bot API callback sink (authed via `X-Telegram-Bot-Api-Secret-Token`); handles inline Approve/Reject button taps

**Outgoing Webhooks:**
- Approval events (`approval_pending`, `approval_approved`, `approval_rejected`)
- Signal detection events (risk alerts fired)
- Delivery targets: Slack, Discord, GitHub issues, Linear issues, email (Resend/SendGrid)
- Implementation: `app/lib/webhooks.js`, notification adapters in `app/lib/notification-adapters/`

## MCP Server Integration

**Protocol:**
- JSON-RPC 2.0 over HTTP POST (not WebSocket)
- Endpoint: `POST /api/mcp`
- Auth: x-api-key header (validated by middleware)

**Capabilities:**
- Tools: DashClaw SDK methods exposed as MCP tools (guard, createAction, updateOutcome, recordAssumption, etc.)
- Resources: Governance data (agent history, decision logs, learning curves, rendered prompts)
- Protocol version: 2025-03-26

**Implementation:**
- Entry: `app/api/mcp/route.js` (stateless JSON-RPC handler)
- Client: `mcp-server/lib/client.js` (calls back to same instance via localhost API)
- Tools: `mcp-server/lib/tools.js` (TOOL_DEFINITIONS, handler mapping)
- Resources: `mcp-server/lib/resources.js` (RESOURCE_DEFINITIONS, data templates)

## Third-Party SDKs & Libraries

**Model Context Protocol (MCP):**
- @modelcontextprotocol/server 2.0.0-alpha.2 — Provides JSON-RPC transport layer
- Note: Custom implementation; not using full MCP SDK, only the alpha server module

**Data Export & Generation:**
- docx 9.6.1 — Word document generation (compliance reports)
- @e965/xlsx 0.20.3 — Excel export (decision logs, analytics)
- html2pdf.js 0.14.0 — PDF export (evidence bundles, audit reports)

---

*Integration audit: 2026-04-11*
