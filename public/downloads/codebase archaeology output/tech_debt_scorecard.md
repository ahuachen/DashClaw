# Tech Debt Scorecard: DashClaw Platform

**Overall Score: 79/100** (higher = healthier)

> This is a healthy, actively maintained platform that has received serious engineering attention. The score reflects real structural debt around the size and complexity of `middleware.js` and the absence of TypeScript, which are the two areas most worth addressing before the codebase grows further.

---

## Score Breakdown

| Category | Score | Weight | Notes |
|---|---|---|---|
| Code Hygiene | 17/25 | 25% | JavaScript instead of TypeScript; `middleware.js` is 1,100+ lines doing too much |
| Security Patterns | 24/25 | 25% | Industry-strength hardening; one in-memory rate limiter concern at scale |
| Documentation | 20/20 | 20% | Exceptional: CHANGELOG, PROJECT_DETAILS.md, README, CLAUDE.md, CONTRIBUTING.md all excellent |
| Dependency Health | 13/15 | 15% | All major deps current; `xlsx` v0.18.5 has known advisory; `next-auth` v4 is pre-GA v5 |
| Structural Clarity | 15/15 | 15% | Repository pattern is well executed; clear separation of API, lib, and component layers |

---

## Critical Issues (fix first)

**1. `middleware.js` is doing five jobs in one file (1,100+ lines)**
- Location: `middleware.js` root
- The file handles auth, rate limiting, CORS, demo fixture serving, API key caching, org resolution, local admin sessions, and IP detection. This is one of the highest-risk files in the codebase to modify. A bug here takes down the entire platform. The demo fixture logic alone (the `demo*` helper functions) accounts for roughly 600 lines and should be its own module.
- Recommended action: extract `demoHandlers.js`, `rateLimiter.js`, and `apiKeyResolver.js` as separate modules. Middleware becomes an orchestrator, not an implementor.

**2. No TypeScript**
- Location: entire codebase
- DashClaw is a pure JavaScript codebase running a security-sensitive multi-tenant API with 50+ route directories. The absence of static types means that org ID injection bugs, parameter type mismatches, and API contract drift are all caught at runtime (or not at all). The Zod usage in sync validation is a good signal that the team values schema safety — TypeScript would extend that discipline to the entire surface.
- Recommended action: gradual migration starting with `app/lib/` core modules (guard, signals, encryption, org).

**3. In-memory rate limiter and API key cache are instance-local**
- Location: `middleware.js` (`rateLimitMap`, `apiKeyCache`)
- On serverless or multi-instance deployments, each instance has its own rate limit counter. A distributed attacker hitting multiple instances can effectively bypass the per-IP rate limit. The optional Upstash integration addresses this but is not the default.
- Recommended action: make Upstash the recommended default for production; add a warning at startup if `UPSTASH_REDIS_REST_URL` is not set and `NODE_ENV=production`.

**4. `better-sqlite3` dependency creates a dual-database model that is easy to confuse**
- Location: `package.json`, agent-tools internals
- The platform supports both Neon serverless Postgres and local SQLite (for agent-tools). A new contributor can easily wire up the wrong adapter. The local SQLite path is invisible from the main app's code but present in the installed dependencies.
- Recommended action: document the exact role of `better-sqlite3` in the repo map; confirm it is only used in agent-tools scripts and not imported anywhere in `app/`.

**5. `xlsx` package carries a known advisory**
- Location: `package.json` — `"xlsx": "^0.18.5"`
- The SheetJS community edition (xlsx) has had security advisories and the project has had licensing complications. Consider evaluating `exceljs` as a drop-in alternative.

---

## High Priority

**Prompt template variable regex fix was patched but regex escaping in JS is a class of bug worth a unit test suite**
- `app/lib/prompt.js` had a backslash-escaping bug that was caught in v1.10.1. Regex-based template engines are brittle. Consider a dedicated test file for every supported variable format (spaces, nested braces, special characters).

**Demo fixture logic in middleware creates a maintenance trap**
- Every new API route that needs demo support requires a matching handler added inside `middleware.js`. This has already produced a very long file. The fixture system should be data-driven, not code-driven.

**`next-auth` v4 is aging**
- NextAuth v5 (now Auth.js) is a significantly different API. v4 will receive security patches for a while, but the migration is non-trivial and gets harder the longer it is deferred.

**SSE connection capping is best-effort**
- The 10,000-entry deduplication set and 30-minute max duration are applied per-instance. Under high traffic, memory pressure from SSE connections could become significant.

---

## Observations (things that are working well)

**The security posture is genuinely impressive for an early-stage platform.** The February 2026 baseline audit caught and resolved four CRITICAL and nine HIGH severity findings. SSRF protection, HSTS preload, AES-256-GCM AEAD, timing-safe comparisons, default-deny middleware, body size limits, DLP redaction on write, and canonical JSON signing are all present. Most platforms this age do not have this level of hardening.

**The repository pattern is consistently applied.** All database access goes through `app/lib/repositories/*.repository.js`. The CI guardrail (`npm run route-sql:check`) blocks direct SQL in route handlers. This is a pattern that keeps the codebase maintainable as it grows.

**The documentation suite is best-in-class.** `PROJECT_DETAILS.md` is a complete architectural reference with schema-level details, invariant descriptions, and pattern explanations. The CHANGELOG going back to v1.0.0 with semantic versioning tells a clear story of the platform's evolution. New contributors have everything they need.

**The SDK parity discipline is strong.** Node.js and Python SDKs track each other feature-for-feature. The `docs/sdk-parity.md` matrix and `npm run sdk:integration:python` CI gate prevent divergence. This is rare and valuable.

**The CI guard script suite is genuinely useful.** `openapi:check`, `api:inventory:check`, `route-sql:check`, and `docs:check` all catch specific categories of regression automatically. This reflects a team that has been burned by specific problems and closed the loop.

---

## Recommended Sprint

**Priority 1 — Extract demo fixture logic from middleware.js**
Split `middleware.js` into `middleware.js` (orchestration only) and `app/lib/demo/demoHandlers.js` (all the `demo*` functions). This is the single highest-leverage refactor for long-term maintainability and is low risk if done carefully.

**Priority 2 — Add TypeScript to `app/lib/` core modules**
Start with `org.js`, `guard.js`, `signals.js`, and `encryption.js`. These are the most security-sensitive files and the ones where type errors have the highest blast radius. Enable `allowJs` in tsconfig to avoid a big-bang migration.

**Priority 3 — Audit and replace the `xlsx` dependency**
Evaluate `exceljs` as a drop-in. If the usage is limited to one or two routes, this is a small change with meaningful supply-chain risk reduction.

**Priority 4 — Make distributed rate limiting the production default**
Move Upstash from "optional" to "strongly recommended for production" in the documentation and add a startup warning when it is absent in production environments.

**Priority 5 — Add a prompt template regression test suite**
Create `__tests__/unit/prompt.test.js` with cases covering all supported variable formats, edge cases (empty strings, missing variables, special characters). The existing bug pattern suggests this module is under-tested relative to its risk surface.
