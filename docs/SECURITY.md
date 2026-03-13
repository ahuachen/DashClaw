# Security Guide

This is the operator-facing security guide for DashClaw (self-host and cloud). It documents the security model, key controls, and how to run audits.

## 2026-03-13 Security Remediation

On March 13, 2026, a comprehensive security audit and remediation was performed to address supply chain and runtime vulnerabilities:

### Supply Chain Hardening
- **Dependency Patching**: Resolved 11 High severity and 3 Medium severity vulnerabilities identified via OSV Scanner.
- **`jspdf`**: Upgraded to `4.2.0` to remediate PDF Object Injection and Denial of Service (GHSA-67pg-wm7f-q7fj, GHSA-9vjf-qc39-jprp).
- **`minimatch` / `ajv`**: Upgraded to latest patched versions to eliminate ReDoS vulnerabilities.
- **`xlsx` Migration**: Migrated from the vulnerable `xlsx` package to the community-maintained `@e965/xlsx` fork to remediate Prototype Pollution and ReDoS risks (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) while preserving Excel export functionality.
- **`next`**: Upgraded to `^16.1.6` to remediate an Unbounded Memory Consumption vulnerability (GHSA-5f7q-jpqc-wp7h).

### Linter & Best Practices
- **ESLint Migration**: Migrated the `lint` script to use the standard ESLint CLI (`eslint .`) instead of the deprecated `next lint` wrapper.
- **React Hook Safety**: Refactored `DraggableDashboard.js` to remove unnecessary dependencies in `useMemo`, preventing redundant re-renders and improving client-side performance.

---

## Architecture and Trust Boundaries (High Level)

DashClaw has two primary inbound trust boundaries:

- Browser/operator: NextAuth session token (dashboard UI -> `/api/*`)
- Agent/SDK: API key in `x-api-key` (agent tooling/SDK -> `/api/*`)

Outbound trust boundaries:

- LLM provider calls (e.g., OpenAI) for embeddings/guard evaluation
- Webhook deliveries to operator-configured HTTPS endpoints

## Data Handling (What We Store)

DashClaw stores the data you send to it, including (depending on which features you use):

- Actions, events, messages, docs/snippets/content, webhooks, guard decisions, and related metadata
- Encrypted integration credentials (at rest), when configured via Settings/Integrations

DashClaw includes Data Loss Prevention (DLP) redaction to reduce the chance of secrets being stored or exfiltrated, but DLP is a best-effort control. Do not rely on it as your only defense.

## Core Controls

### Encryption at Rest (Integration Secrets)

- Integration credentials are encrypted in the database using AEAD (AES-256-GCM).
- Required: `ENCRYPTION_KEY` must be set and must be exactly 32 characters (32 ASCII characters recommended).
- Backward compatibility: legacy ciphertext formats are still decryptable so upgrades do not break existing installs.

### API Access Control (Default Deny)

- All `/api/*` routes are protected by default in `middleware.js`.
- Only a small allowlist of `PUBLIC_ROUTES` is unauthenticated (e.g., `/api/health`, `/api/setup/status`, `/api/setup/proof`, `/api/auth/*`, `/api/cron/*`, `/api/docs/raw`, `/api/prompts/*`).
- `/setup` is the one intentional pre-auth page exception on the UI side. It is public so first-time operators can diagnose broken auth/setup states, but the page uses a public-safe projection that exposes verification status only, not secrets or raw configuration values.
- `/api/setup/proof` follows the same projection model: anonymous callers receive a sanitized JSON proof artifact, while authenticated operators receive richer operational detail.
- `/api/setup/live-proof` is not public. It stays behind normal API auth and only mints signed proof tokens from successful SDK validation summaries. The token contains sanitized verification metadata only and is designed to be safe to attach to `/setup?proof=...`.
- Tenant context headers (`x-org-id`, `x-org-role`, `x-user-id`) are stripped from all inbound API requests to prevent spoofing; middleware injects trusted values only after authentication.
- Readonly API keys are enforced centrally: API-key requests with role `readonly` are blocked from non-GET/HEAD methods.
- Decrypted integration secrets are only returned to admin API-key callers; non-admin API keys receive encrypted payloads only.

Fail-closed behavior:

- In production (`NODE_ENV` not `development`), if `DASHCLAW_API_KEY` is not set, the API layer returns `503` and does not serve `/api/*`.

### Cron Endpoints (External Scheduler)

DashClaw exposes endpoints under `/api/cron/*` intended to be run on a schedule. These routes are allowlisted from browser/API-key auth, but they still require a shared secret:

- Required header: `Authorization: Bearer $CRON_SECRET`

This is compatible with any scheduler that can make HTTP requests (GitHub Actions, system cron, Windows Task Scheduler, Cloudflare, etc.).

Example (bash):

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_HOST/api/cron/signals"
```

### CORS

- In production, CORS is restricted to configured/known origins.
- In development, CORS may be permissive to support local workflows.

### Rate Limiting and Client IP Trust

- All `/api/*` routes (including `PUBLIC_ROUTES`) are rate limited in middleware.
- By default this is best-effort per-instance. For multi-instance deployments, distributed rate limiting is supported via Upstash REST:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Local/self-host tuning (middleware env vars):
  - `DASHCLAW_RATE_LIMIT_WINDOW_MS` (default: 60000)
  - `DASHCLAW_RATE_LIMIT_MAX` (default: 1000 in development, 100 otherwise)
  - `DASHCLAW_DISABLE_RATE_LIMIT=true` (dev only; do not use on public deployments)
- Self-hosting behind a proxy: set `TRUST_PROXY=true` if (and only if) you control your proxy and it sets `X-Forwarded-For` correctly. Otherwise, do not trust forwarded IPs for rate limiting/audit attribution.

### DLP Redaction (On Write + Before External Calls)

DashClaw scans and redacts common secret patterns (examples: OpenAI keys, AWS access keys, common API token shapes) in two places:

- Before storing user/agent free-text in high-risk ingestion endpoints (docs/snippets/content/sync/actions/loops/assumptions/approvals).
- Before sending content to external LLM APIs (embeddings + semantic guardrails), to reduce third-party exfil risk.

Limitations:

- DLP is pattern-based and can miss secrets (false negatives) or redact benign strings (false positives).
- Treat it as defense-in-depth; you should still keep secrets out of free text whenever possible.

### Webhook Security (SSRF + Optional Signing)

Outbound webhook delivery is hardened to reduce SSRF risk:

- HTTPS-only
- DNS resolution + private-IP blocking
- Redirects disabled
- Optional domain allowlist via `WEBHOOK_ALLOWED_DOMAINS`

Optional authenticity:

- If `GUARD_WEBHOOK_SECRET` is set, guard webhooks include:
  - `X-DashClaw-Timestamp`
  - `X-DashClaw-Signature: v1=<hmac>`

### Log Hygiene

- Webhook delivery logs redact payload and response bodies before persistence.
- Guard decision logs redact sensitive patterns before persistence.

### Analytics (Optional)

DashClaw supports Vercel Web Analytics (`@vercel/analytics`), but it is intentionally not enabled by default for self-hosts:

- Enabled automatically on Vercel deployments (`VERCEL=1`)
- Opt-in for non-Vercel hosts via `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true`

## Deployment Checklist

- [ ] Confirm `.env`, `.env.local`, and any secrets are not git-tracked (`git ls-files .env*` should be empty).
- [ ] Set required production env vars:
  - [ ] `DATABASE_URL`
  - [ ] `NEXTAUTH_URL`
  - [ ] `NEXTAUTH_SECRET`
  - [ ] `DASHCLAW_API_KEY` (required to enable `/api/*` in production)
  - [ ] `ENCRYPTION_KEY` (32 characters)
- [ ] Set optional security env vars as needed:
  - [ ] `TRUST_PROXY=true` (only if you control a reverse proxy)
  - [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (distributed rate limiting)
  - [ ] `WEBHOOK_ALLOWED_DOMAINS` (restrict outbound webhook targets)
  - [ ] `GUARD_WEBHOOK_SECRET` (sign guard webhooks)
  - [ ] `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true` (non-Vercel opt-in)
- [ ] Run the security scan: `node scripts/security-scan.js`

## Reporting Security Issues

Please do not open a public issue for security vulnerabilities. Email `practicalsystems@gmail.com` or open a private GitHub security advisory.

## Recent Hardening (2026-03)

- Fixed SSRF vulnerability in `app/lib/webhooks.js` by ensuring IPv4-mapped IPv6 addresses (e.g. `::ffff:127.0.0.1`) are properly detected and blocked by the `isPrivateIp` check.
- Fixed False Encryption vulnerability in `app/api/settings/route.js` by explicitly preventing frontend mask placeholders (`••••••••`) from overriding real secrets.
- Added cryptographic context binding (AAD) to the AES-256-GCM encryption in `app/lib/encryption.js` and `app/api/settings/route.js` to prevent database-level ciphertext swapping across different settings.
- Enforced prevention of Plan Privilege Escalation by completely stripping the `plan_name` field from the validation schema (`app/lib/validators/sync.js`) and database upsert statements (`app/lib/repositories/connections.repository.js`).

## Recent Hardening (2026-02)

- Fixed SSRF via DNS Rebinding TOCTOU in `app/lib/webhooks.js` by resolving IP once and forcing fetch to use the resolved IP.
- Fixed false encryption condition in `app/api/settings/route.js` handling falsy values and string booleans properly.
- Removed `plan_name` from bulk sync payload parsing and database upserts to prevent privilege escalation via spoofed plans.
- Added org-scoped guard to team member removal update (`/api/team/[userId]`) to prevent cross-tenant race-condition evictions.
- Added production guard on settings writes: when `NODE_ENV=production` and `ENCRYPTION_KEY` is missing, `/api/settings` POST now returns `503` with a clear misconfiguration error.
- Added org scoping in prompt version creation paths (`prompt_versions` max-version lookup and parent `prompt_templates` touch update).
- Added missing `org_id` guards to several `UPDATE`/`DELETE` statements in compliance/export, eval run updates, message/context thread updates, webhook failure counters, scoring profile touch updates, and onboarding user move.
- Normalized repository SQL in actions/evaluations repositories to Neon tagged-template style where non-standard placeholder/query patterns were used.
