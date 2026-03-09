# DashClaw

> AI agent decision infrastructure: the self-hosted control plane that proves what your agents decided, why they decided it, and whether they should have.

---

## What This Is

DashClaw is a Next.js 15 platform that gives operators full governance, observability, and accountability over their AI agent fleets. Where most agent monitoring tools tell you what an agent did after the fact, DashClaw intercepts decisions before they execute, enforces no-code policies that can block or escalate risky actions, and maintains a cryptographically-traceable audit trail of every assumption and outcome.

The platform ships as a single codebase that serves two roles simultaneously. When deployed as `DASHCLAW_MODE=demo` (the public dashclaw.io website), it serves a fully interactive demo backed by fixture data. When self-hosted with `DASHCLAW_MODE=self_host` (the default), the same code connects to your Postgres database and real agent activity flows in via SDK. The middleware layer handles the switch transparently — no code changes needed between environments.

DashClaw is designed to be zero-dependency from an agent's perspective. The Node.js and Python SDKs use only standard library HTTP (no `axios`, no external packages), and the platform requires no LLM API keys to operate — all governance, evaluation, and scoring features work with rule-based logic by default. An LLM provider can be optionally configured to unlock semantic guard evaluation and AI-judge scoring, but nothing breaks without one.

---

## Architecture Overview

The system has four layers. The edge layer is a single Next.js middleware file (`middleware.js`) that handles authentication, rate limiting, CORS, org context injection, and demo-mode routing before any request reaches application code. The application layer is the Next.js App Router with 50+ API route directories and 30+ UI pages, all backed by a shared library in `app/lib/` and a repository pattern in `app/lib/repositories/` that enforces SQL discipline via CI. The data layer is Postgres — either a local Docker instance (direct TCP via the `postgres` package) or Neon serverless (via `@neondatabase/serverless`) — with optional Redis or Upstash for real-time SSE fan-out. The client layer includes two published SDKs (npm: `dashclaw`, PyPI: `dashclaw`), a Python CLI suite (`agent-tools/`), and a browser UI authenticated via NextAuth v4.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | `standalone` output for Docker |
| Language | JavaScript (ES Modules) | No TypeScript — migration is recommended |
| Styling | Tailwind CSS 3 | Dark-only theme; design tokens in `globals.css` |
| Database | Postgres (Neon or local) | Dual adapter; raw SQL via `@neondatabase/serverless` |
| ORM / Migrations | Drizzle ORM | Schema management only; runtime uses raw SQL |
| Auth (UI) | NextAuth v4 | GitHub, Google, OIDC, local admin password |
| Auth (agents/SDK) | API key via `x-api-key` header | SHA-256 hashed; multi-org support |
| Real-time | SSE via EventEmitter or Redis Streams | Upstash REST supported |
| Encryption | AES-256-GCM (AEAD) | For integration credentials at rest |
| Email | Resend | Signal alert notifications |
| Billing | Stripe | Checkout integration |
| Node SDK | `dashclaw` (npm) | 178+ methods, zero dependencies, ESM + CJS |
| Python SDK | `dashclaw` (PyPI) | `urllib` only, zero dependencies |
| Testing | Vitest | Unit tests in `__tests__/unit/` |
| CI | GitHub Actions | 9-gate pipeline (see below) |

---

## Getting Started

### Prerequisites

Node.js 20 or later is required. Docker is optional but recommended for local Postgres.

### Installation

```bash
git clone https://github.com/ucsandman/DashClaw.git
cd DashClaw
node scripts/setup.mjs
```

The interactive setup handles database selection (Docker / Neon / custom URL), secret generation, migrations, and the initial build. When it finishes, it prints a ready-to-use agent connection snippet.

Platform-specific installers are also available:

```bash
# Windows
install-windows.bat

# Mac / Linux
bash install-mac.sh
```

### Running Locally

```bash
npm run dev          # starts on :3000 with Turbopack
```

### Running Tests

```bash
npm run test -- --run          # unit tests (Vitest, non-watch)
npm run test:api               # full API integration test (~186 assertions)
npm run sdk:integration        # Node SDK cross-integration check
npm run sdk:integration:python # Python SDK unit tests
```

### Full CI Suite

```bash
npm run lint
npm run scripts:check-syntax
npm run docs:check
npm run openapi:check
npm run api:inventory:check
npm run route-sql:check
npm run test -- --run
npm run build
```

---

## Project Structure

```
app/
├── page.js                 # Landing page (marketing on dashclaw.io, home on self-hosted)
├── lib/                    # Core platform logic
│   ├── guard.js            # Guard policy evaluation engine
│   ├── signals.js          # Risk signal computation (shared by API + cron)
│   ├── security.js         # DLP regex scanner (18 patterns)
│   ├── encryption.js       # AES-256-GCM encryption for credentials
│   ├── llm.js              # Provider-agnostic LLM client (OpenAI, Anthropic, Google)
│   ├── eval.js             # 5-scorer evaluation engine (regex, contains, numeric, custom, llm_judge)
│   ├── learningAnalytics.js # Agent velocity + maturity tracking
│   ├── scoringProfiles.js  # Weighted multi-dimensional scoring (Phase 7)
│   ├── webhooks.js         # HMAC-signed outbound webhook delivery
│   ├── audit.js            # Fire-and-forget activity logging
│   ├── org.js              # Multi-tenant org context helpers
│   ├── auth.js             # NextAuth config (all providers)
│   └── repositories/       # 22 repository files (all SQL lives here, not in routes)
├── api/                    # 50+ API route directories
│   ├── actions/            # ActionRecord control plane (13 sub-routes)
│   ├── guard/              # Guard evaluation endpoint
│   ├── policies/           # Guard policy CRUD + test + proof + import
│   ├── compliance/         # Multi-framework compliance engine
│   ├── evaluations/        # Evaluation scores, scorers, batch runs
│   ├── scoring/            # Scoring profiles + risk templates (Phase 7)
│   ├── learning/           # Decisions, lessons, recommendations, analytics
│   ├── messages/           # Agent messaging hub (SSE real-time)
│   ├── prompts/            # Prompt template registry + versioning
│   ├── cron/               # Signal detection, memory maintenance, routing maintenance
│   └── ...                 # 40+ more domains
└── components/             # Shared UI primitives + dashboard widgets

sdk/                        # Node.js SDK (npm: dashclaw, v2.0.3)
sdk-python/                 # Python SDK (PyPI: dashclaw)
agent-tools/                # Python CLI tools for local agent memory, context, security
scripts/                    # Migrations, CI guards, integration tests, SDK release
docs/                       # RFCs, runbooks, parity matrix, OIDC setup guide
.claude/skills/             # Claude Code skill for platform operations
middleware.js               # The front door: auth, rate limiting, CORS, demo routing
```

### What Each Folder Is For

`app/lib/repositories/` is where all SQL queries live. The CI guard (`npm run route-sql:check`) blocks any new raw SQL from appearing inside route handlers. If you are writing a new API route, your SQL goes in a new or existing repository file.

`app/lib/` contains the platform's business logic: guard evaluation, signal computation, DLP scanning, embedding generation, webhook delivery, email notification, LLM abstraction, and scoring. Route handlers should call these functions, not implement logic directly.

`scripts/` is split between migration scripts (all idempotent, safe to re-run) and CI guard scripts that enforce API contract stability. If you add a new API route, run `npm run openapi:generate` and `npm run api:inventory:generate` to update the baselines, then commit them so the check gates pass.

`agent-tools/` is a standalone Python CLI suite that agents can run locally. It syncs data to the DashClaw dashboard but has its own local SQLite state. It is independent of the main Next.js app — changes there do not affect the web platform.

---

## Key Concepts

**Multi-tenancy via header injection.** Every authenticated request gets `x-org-id`, `x-org-role`, and `x-user-id` headers injected by middleware after verifying the API key or NextAuth session. Route handlers call `getOrgId(request)` from `app/lib/org.js` to scope all queries. Client-supplied values for these headers are always stripped. New routes must follow this pattern or they will serve cross-tenant data.

**ActionRecord as the unit of accountability.** An `action_record` is a structured log of a single agent decision: what the agent was trying to do (`declared_goal`), what it actually did (`action_type`), its risk assessment (`risk_score`), the outcome, and any open loops or assumptions it depended on. The 13 sub-routes under `/api/actions/` form the core of the platform.

**Guard evaluation is pre-action.** Agents call `POST /api/guard` with an action type and context before executing a risky action. The guard engine evaluates all active policies and returns `allow`, `warn`, `block`, or `require_approval`. The `require_approval` outcome pauses the agent and routes to the human approval queue at `/approvals`.

**Demo mode is entirely middleware-driven.** When `DASHCLAW_MODE=demo`, the middleware intercepts all `GET /api/*` requests and returns fixture data from `app/lib/demo/demoFixtures.js` before they reach any route handler. Writes return 403. This means the demo runs without a database. Every new endpoint that needs demo support needs a corresponding handler in middleware.

**The repository pattern is enforced by CI.** `npm run route-sql:check` parses all `app/api/**/route.js` files and fails the build if it finds raw SQL. All query logic belongs in `app/lib/repositories/*.repository.js`. This is not a suggestion — it is a CI gate.

---

## Key Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or TCP) |
| `NEXTAUTH_URL` | Yes | Canonical deployment URL |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret |
| `DASHCLAW_API_KEY` | Yes (prod) | Master API key; absent = 503 in production |
| `ENCRYPTION_KEY` | Yes (prod) | AES-256-GCM key for settings encryption |
| `CRON_SECRET` | Yes | Bearer token for `/api/cron/*` endpoints |
| `GITHUB_ID` / `GITHUB_SECRET` | OAuth | GitHub OAuth app credentials |
| `GOOGLE_ID` / `GOOGLE_SECRET` | OAuth | Google OAuth app credentials |
| `DASHCLAW_LOCAL_ADMIN_PASSWORD` | Optional | Local password login (no OAuth needed) |
| `DASHCLAW_MODE` | Optional | `demo` or `self_host` (default: `self_host`) |
| `RESEND_API_KEY` | Optional | Email alerts for signal notifications |
| `UPSTASH_REDIS_REST_URL` | Optional | Distributed rate limiting + SSE pub-sub |
| `OPENAI_API_KEY` | Optional | Enables semantic guard + embedding features |

---

## Deployment

**Fastest path: Vercel + Neon (both free tier)**

1. Create a Neon database at neon.tech
2. Fork this repo to your GitHub account
3. Import at vercel.com/new
4. Generate secrets: `node scripts/init-self-host-env.mjs`
5. Set environment variables in Vercel (see table above)
6. Deploy — tables are created automatically on first request

**Docker (local / self-hosted)**

```bash
docker-compose up
```

The compose file includes a Postgres container. The app auto-detects the TCP connection string and uses the direct `postgres` adapter instead of the Neon serverless adapter.

---

## Contributing

See `CONTRIBUTING.md`. The short version: run the full CI suite locally before opening a PR (`npm run lint && npm run docs:check && npm run openapi:check && npm run api:inventory:check && npm run route-sql:check && npm run test -- --run && npm run build`). All nine gates must pass.

---

## Security

See `docs/SECURITY.md` and `SECURITY_BASELINE_REVIEW_2026-02-14.md`. The platform received a comprehensive security audit in February 2026 with four CRITICAL and nine HIGH findings resolved. Key invariants: default-deny `/api/*`, org header stripping from clients, timing-safe API key comparison, AES-256-GCM for secrets at rest, SSRF protection on outbound webhooks, and DLP redaction before LLM calls.

---

*Built by [Practical Systems](https://practicalsystems.io)*
