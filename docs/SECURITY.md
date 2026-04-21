# Security Guide

This is the operator-facing security guide for DashClaw (self-host and cloud). It documents the security model, key controls, and how to run audits.

## 2026-04-21 Bug Hunt Hardening

Three consecutive read-only reviewer sweeps surfaced and remediated a
set of security-relevant issues across the runtime. Highlights (see
CHANGELOG for per-finding detail):

### Sandbox for org-supplied expressions
- `app/lib/scoringProfiles.js` (`custom_function` data source) and
  `app/lib/eval.js` (`_executeCustomFunction` scorer) previously evaluated
  JavaScript strings stored by any org member via the scoring-dimension
  and scorer APIs. The evaluator ran in the enclosing realm with full
  access to `process.env`, `require`, filesystem, and network — an
  RCE-class path reachable by any member account. Both now run the
  supplied body inside a `node:vm` context seeded with only the allowed
  fields and a 100ms timeout. `node:vm` is not a complete security
  boundary against prototype-chain escapes, but it blocks direct access
  to outer-scope globals — a large surface reduction.

### Webhook SSRF — DNS rebinding window closed
- `assertSafeWebhookUrl` in `app/lib/webhooks.js` resolves DNS and
  validates that every returned IP is public. The prior implementation
  let `fetch` re-resolve the hostname at connect time, leaving a
  DNS-rebinding window where a short-TTL record could flip to a private
  IP between the two lookups. Both `deliverWebhook` and
  `deliverGuardWebhook` now build an `undici` `Agent` whose
  `connect.lookup` is pinned to a validated IP and pass it to fetch via
  `dispatcher`. The original URL is still used for TLS SNI / certificate
  matching — only the IP resolution is overridden.

### Setup/migrate requires auth after first-run init
- `POST /api/setup/migrate` was in `PUBLIC_ROUTES` with no handler-side
  auth. First-run bootstrap needs it public (the 8-minute flow runs
  before any key exists), but nothing clamped access after init. Now
  gates on the presence of `org_default`: before init, public; after
  init, requires a Bearer token matching `DASHCLAW_API_KEY` (timing-safe)
  or an admin-role `api_keys` row. Without this, any unauthenticated
  POST could re-run DDL, force `plan='pro'` on the default org, and
  seed a predictable `api_keys` hash.

### Turnstile fails closed in production
- `verifyTurnstile` in `app/lib/hosted/turnstile.js` previously returned
  `{ ok: true, bypassed: true }` whenever `TURNSTILE_SECRET_KEY` was
  unset — so an operator who deployed with `DASHCLAW_HOSTED=true` but
  forgot the secret served unprotected workspace provisioning. The
  bypass is now gated on `NODE_ENV !== 'production'`. Local dev and
  vitest (`NODE_ENV='test'`) retain the convenience; production refuses
  to run without the secret.

### Cross-tenant message spoofing blocked
- `POST /api/messages` previously accepted the caller-supplied
  `from_agent_id` / `to_agent_id` without verifying those agents
  belonged to the caller's org — a valid API key holder could inject
  ledger entries that claimed to originate from another org's agent.
  Both fields are now checked via `agentExistsInOrg` against
  `agent_presence` / `agent_identities` / `agent_pairings` /
  `action_records`; mismatches return 403.

### Webhook audit trail no longer fire-and-forget
- `deliverWebhook` and `deliverGuardWebhook` now await the
  `webhook_deliveries` INSERT before returning. On failure the response
  carries `delivery_logged: false` so downstream replay and forensic
  tooling can distinguish "delivered and logged" from "delivered but
  audit lost".

### Cleanup secret comparison is timing-safe
- `app/api/hosted/cleanup/route.js` replaced `===` on
  `HOSTED_CLEANUP_SECRET` and `CRON_SECRET` with the existing
  `timingSafeCompare` helper. Practical risk was low for long secrets
  but the pattern diverged from every other secret comparison in the
  codebase.

### Compare-and-set on governance state machines
- Action PATCH terminal-state gate (F03), assumption invalidate gate
  (F31), open-loop status gate (F07), eval-run pending→running gate
  (F52), access-rule uniqueness via partial unique indexes (F04).
  These close a family of read-check-then-update TOCTOU holes where
  two concurrent operators could both win and silently clobber each
  other's audit-trail text, or where one caller could rewrite a
  terminal ledger row. All transitions are now atomic at the SQL layer.

### Governance mutation gates
- `POST` / `PATCH /api/workflows/templates[/:id]` now require
  `x-org-role: admin` like the sibling `DELETE` already did (F32).
  A non-admin member could previously rewrite a production template's
  steps or create new ones. `/api/setup/migrate` tightening (above)
  is also in this family.

### Auto-migrate stops swallowing real DDL errors
- `scripts/auto-migrate.mjs` previously logged non-SAFE_CODES errors
  at Warning and continued, leaving partial schemas on production
  instances. Now fails the build when real DDL errors are detected.
  pgvector-dependent statements are skipped deliberately when the
  extension is unavailable (CI Postgres), with cascade tracking so
  dependent indexes/FKs on skipped tables also skip.

---

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

- **HITL Approval Flow Hardening**:
  - **Explicit Metadata tracking**: Added `approved_by` and `approved_at` columns to the `action_records` table to provide a machine-readable source of truth for human decisions, moving away from relying solely on status transitions.
  - **SDK Verification**: Refactored `waitForApproval` in the DashClaw SDK (`sdk/dashclaw.js`) to strictly require `approved_by` metadata before resolving. The SDK now throws an error if an action leaves the `pending_approval` state without explicit approval metadata, preventing "auto-approval" bugs.
  - **Visual Distinction**: Renamed the status for unresolved assumptions to `unresolved_assumption` (labeled "Awaiting Validation") in the Mission Control UI to prevent visual conflation with pending approvals.
  - **Redaction**: Integrated DLP redaction into the approval reasoning flow to ensure human operators do not accidentally persist secrets when documenting approval decisions.

- Fixed SSRF vulnerability in `app/lib/webhooks.js` by ensuring IPv4-mapped IPv6 addresses (e.g. `::ffff:127.0.0.1`) are properly detected and blocked by the `isPrivateIp` check.
- Fixed False Encryption vulnerability in `app/api/settings/route.js` by explicitly preventing frontend mask placeholders (`••••••••`) from overriding real secrets.
- Added cryptographic context binding (AAD) to the AES-256-GCM encryption in `app/lib/encryption.js` and `app/api/settings/route.js` to prevent database-level ciphertext swapping across different settings.
- Enforced prevention of Plan Privilege Escalation by completely stripping the `plan_name` field from the validation schema (`app/lib/validators/sync.js`) and database upsert statements (`app/lib/repositories/connections.repository.js`).
- **Log Sanitization**: Sanitized API key generation and revocation logs in `app/api/keys/route.js` to prevent accidental leakage of sensitive error messages or database details.
- **Scanner Compliance**: Renamed sensitive-looking variables (e.g., `secret_warning` -> `storageWarning`, `demo_secret_mask` -> `masked_val`) in fixtures and route responses to improve signal-to-noise ratio in security scans while maintaining production compliance.
- **Structural Decomposition**: Modernized the `middleware.js` and `readiness.mjs` architectures by extracting complex logic into modular services, reducing the attack surface of monolithic files.

## Recent Hardening (2026-02)

- Fixed SSRF via DNS Rebinding TOCTOU in `app/lib/webhooks.js` by resolving IP once and forcing fetch to use the resolved IP.
- Fixed false encryption condition in `app/api/settings/route.js` handling falsy values and string booleans properly.
- Removed `plan_name` from bulk sync payload parsing and database upserts to prevent privilege escalation via spoofed plans.
- Added org-scoped guard to team member removal update (`/api/team/[userId]`) to prevent cross-tenant race-condition evictions.
- Added production guard on settings writes: when `NODE_ENV=production` and `ENCRYPTION_KEY` is missing, `/api/settings` POST now returns `503` with a clear misconfiguration error.
- Added org scoping in prompt version creation paths (`prompt_versions` max-version lookup and parent `prompt_templates` touch update).
- Added missing `org_id` guards to several `UPDATE`/`DELETE` statements in compliance/export, eval run updates, message/context thread updates, webhook failure counters, scoring profile touch updates, and onboarding user move.
- Normalized repository SQL in actions/evaluations repositories to Neon tagged-template style where non-standard placeholder/query patterns were used.
