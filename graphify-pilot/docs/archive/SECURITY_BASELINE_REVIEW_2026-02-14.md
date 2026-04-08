# DashClaw Security Baseline Review (2026-02-14)

Scope: full repository baseline review + prioritized security findings.

## Status Update (2026-02-14)

This baseline review is retained as a historical record of what was found. As of 2026-02-14, the Critical/High/Medium items in this report have been remediated and documented.

Primary remediation commits (chronological):

- `6420c44` Security hardening baseline fixes (default-deny `/api/*`, header stripping, readonly enforcement, settings decryption gating, AEAD encryption migration, webhook SSRF hardening, DLP on write/exfil minimization).
- `c49e9be` Harden DLP for actions and trusted client IP.
- `a66ee67` Redact secrets in guard decision logs.
- `3b44ad6` Defense-in-depth: rate limit public endpoints, CSP tightening, webhook delivery log redaction.
- `3f8ab5a` Security hygiene: patch Next.js, add CodeQL/Dependabot, improve security scanner/docs.
- `4655aa6` Optional distributed rate limiting (Upstash REST).
- `9dfbffa` Optional Vercel Analytics (opt-in for self-host, automatic on Vercel).
- `4b181dd` + `3f1eca9` Dev dependency audit mitigation for nested `esbuild` advisory; ignore `.npm-cache/`.

Current reference docs:

- `docs/SECURITY.md`
- `docs/SECURITY-CHECKLIST.md`
- `SECURITY_FIX_CHECKLIST_2026-02-14.md`

## 1) SYSTEM OVERVIEW

- Primary stack: Next.js 15 App Router (`app/`), NextAuth v4 (GitHub + Google OAuth), Postgres, optional Redis realtime backend, external scheduler for `/api/cron/*` (optional).
- Core control points:
  - `middleware.js` (Edge): API-key auth (`x-api-key`) + NextAuth JWT session gating, org/role header injection (`x-org-id`, `x-org-role`, `x-user-id`), CORS, in-memory rate limiting, demo-mode routing.
  - `app/api/**/route.js`: multi-tenant API surface (78 endpoints) using `getOrgId()` / `getOrgRole()` (header-derived) and raw SQL via `@neondatabase/serverless`.
  - `app/lib/**`: shared domain logic (guardrails, events/SSE broker, DLP scan, encryption, repositories).
- External integrations observed:
  - OAuth: GitHub + Google (`app/lib/auth.js`, `app/api/auth/[...nextauth]/route.js`)
  - DB: Neon Postgres (`@neondatabase/serverless`)
  - Realtime: in-memory EventEmitter or Redis Streams/PubSub (`app/lib/events.js`)
  - LLM: OpenAI API (embeddings + semantic guardrail) (`app/lib/embeddings.js`, `app/lib/llm.js`)
  - Email: Resend (`app/lib/notifications.js`)
  - Outbound webhooks (`app/lib/webhooks.js`, `app/api/webhooks/**`)
- Cron: `/api/cron/*` protected by `CRON_SECRET` (`app/api/cron/**`)
- Trust boundaries (high level):
  - Browser UI (NextAuth cookie/JWT) -> `middleware.js` -> API routes -> Postgres/Redis
  - Agent/SDK clients (API key in `x-api-key`) -> `middleware.js` -> API routes -> Postgres/Redis
  - Public endpoints (`/api/health`, `/api/setup/status`, `/api/cron/*`, `/api/auth/*`) -> API routes
  - Outbound: webhook deliveries (server -> arbitrary HTTPS URL), LLM calls (server -> OpenAI API)

## 2) CRITICAL SECURITY RISKS

### Critical: Unauthenticated org header injection on "unclassified" API routes (data exfil + tenant breakout)

- Locations:
  - `middleware.js` (auth only applied when `pathname` matches `PROTECTED_ROUTES`; non-protected routes do not strip attacker-supplied `x-org-*` headers)
  - `app/api/stream/route.js` (uses `getOrgId(request)` with no auth check)
  - `app/api/swarm/graph/route.js` (uses `getOrgId(request)` with no auth check)
  - `app/api/usage/route.js` (uses `getOrgId(request)` with no auth check)
- Why risky:
  - `/api/stream`, `/api/swarm/graph`, `/api/usage` were not protected by middleware allowlist and still trusted `x-org-id` if attacker supplied it.
- Exploit scenario:
  - An unauthenticated internet client calls these endpoints with `x-org-id: org_victim` to read cross-tenant data; `/api/stream` enables realtime subscription to another org's action events.

### High: "readonly" API key role is mintable but not enforced anywhere (authorization model mismatch)

- Locations:
  - `app/api/orgs/[orgId]/keys/route.js` (allows creating keys with role `readonly`)
  - Repo-wide: role checks only gate "admin-only" management endpoints; no enforcement exists for "readonly" keys.
- Why risky:
  - Operators may issue "readonly" keys expecting they cannot mutate state; any route without explicit role enforcement will accept writes.
- Exploit scenario:
  - Third-party "readonly" key is used to POST messages/sync/actions and poison org data.

### High: API-key requests can retrieve decrypted integration secrets (over-broad secret access)

- Location: `app/api/settings/route.js` (decrypts encrypted settings if request has `x-api-key`; no role gate on GET)
- Why risky:
  - Any API key (including member/readonly) can fetch decrypted org credentials (OpenAI, GitHub, Slack, etc.).
- Exploit scenario:
  - Compromised agent key exfiltrates all stored third-party credentials for the org.

### High: Encryption uses AES-256-CBC without authentication (malleability, no integrity)

- Locations:
  - `app/lib/encryption.js` (AES-256-CBC)
  - `app/api/settings/route.js` (stores and decrypts ciphertext)
- Why risky:
  - CBC provides confidentiality but not integrity; ciphertext tampering is not reliably detected.
- Exploit scenario:
  - Attacker with DB write access flips bits in ciphertext to corrupt secrets and redirect integrations.

### Medium: Webhook SSRF protections are hostname-pattern based and bypassable via DNS / redirects

- Locations:
  - `app/lib/validate.js` (`isValidWebhookUrl` blocks obvious private hostnames but does not resolve DNS)
  - `app/lib/webhooks.js` (outbound `fetch` follows redirects by default)
- Exploit scenario:
  - Webhook URL resolves to internal IP (e.g., DNS trick), or redirects to internal services.

### Medium: Public health endpoint leaks detailed backend error messages

- Location: `app/api/health/route.js`
- Why risky:
  - DB/realtime error strings can leak deployment details and help attackers tune exploitation.

### Medium: In-memory rate limiting + API-key cache are unbounded; IP derived from attacker-controlled headers in self-host

- Locations:
  - `middleware.js` rate limiter and API key cache maps
- Why risky:
  - Memory growth DoS via unique spoofed IPs/keys; rate limiting can be bypassed in common self-host proxy setups.

## 3) SECRETS EXPOSURE FINDINGS

- Local working tree env files contain real-looking secrets (not observed as git-tracked in this repo state):
  - `.env.local`: `DASHCLAW_API_KEY=oc_live_...`, non-placeholder `DATABASE_URL=postgresql://...`
  - `.env`: `OPENCLAW_API_KEY=oc_live_...`
- Git history spot-check:
  - `.env.example` appears in history; `.env` and `.env.local` were not observed as committed in a quick history scan.
- Example/test patterns in tracked files:
  - `oc_live_...` and similar strings appear in docs/scripts as examples (e.g., bootstrap prompts, test scripts).

## 4) FUNCTIONALITY RISKS

- Broken API route implementation (runtime errors)
  - `app/api/handoffs/route.js` references `getSql()` and `scanSensitiveData()` but neither is defined/imported in the module.
- Invite API comment/intent mismatch vs middleware enforcement (suspected)
  - `app/api/invite/[token]/route.js` described as "public-ish" but middleware routes require session; likely intended but comment is misleading.
- Quota enforcement signature mismatch (latent)
  - `app/api/onboarding/api-key/route.js` calls `checkQuotaFast` with wrong parameter order vs `app/lib/usage.js`.

## 5) ARCHITECTURE IMPROVEMENTS

- Make authZ default-deny for `/api/*` and explicitly allowlist public endpoints.
- Implement and enforce real RBAC/permissions (including `readonly`).
- Stop relying on request headers as the "source of truth" for tenant context inside handlers.
- Replace AES-CBC with AEAD (AES-GCM) and support migration.
- Harden outbound webhook SSRF (DNS resolution, private-range blocking, redirect blocking, allowlist mode).

## 6) QUICK WINS

1. Protect all `/api/*` by default in `middleware.js` and always strip `x-org-*` headers from inbound requests.
2. Enforce `readonly` keys (block non-GET/HEAD writes) centrally.
3. Gate settings decryption behind admin role for API-key requests.
4. Fix `app/api/handoffs/route.js` runtime errors.
5. Reduce info leakage from `/api/health`.
6. Redact sensitive patterns before sending content to third-party LLMs (embeddings + semantic guardrail).
7. Redact sensitive patterns before storing agent-provided free text in actions/loops/assumptions (DLP on write).
8. Apply rate limiting even to unauthenticated public endpoints (`PUBLIC_ROUTES`) to reduce DoS pressure.
9. Strengthen CSP directives (keep current allowances until nonces/hashes are implemented).
10. Add optional HMAC signing for guard webhooks (env secret) and redact webhook delivery logs at rest.

## 7) SAFE HARDENING ROADMAP

1. Access control correctness first (protect-all-by-default; header stripping; regression tests).
2. RBAC enforcement (readonly semantics; tests).
3. Secrets protection (decryption permissions; data minimization).
4. Crypto upgrade (AEAD + backward-compatible decrypt).
5. Webhook/egress hardening (DNS/IP validation; redirect blocking).
6. DoS controls (bounded caches; safer IP derivation for self-host).
7. Defense-in-depth (tighten CSP; reduce dev bypass blast radius).
8. Third-party exfil minimization (DLP redaction for external AI calls; consider allowlisting `GUARD_LLM_BASE_URL`).
