# DashClaw Security Fix Checklist (2026-02-14)

Status legend:
- `[ ]` todo
- `[-]` in progress
- `[x]` done
- `[?]` suspected / needs confirmation

## Critical

- [x] Protect `/api/*` by default in `middleware.js` (default-deny) and allowlist only truly public endpoints.
- [x] Strip attacker-supplied `x-org-id`, `x-org-role`, `x-user-id` headers for *all* `/api/*` requests (not only protected list).
- [x] Ensure `/api/stream`, `/api/swarm/graph`, `/api/usage` require auth and cannot be org-spoofed.

## High

- [x] Enforce `readonly` API key role (block non-read methods for API-key requests).
- [x] Restrict decrypted settings access (do not decrypt for non-admin API keys).
- [x] Upgrade encryption from AES-256-CBC to AEAD (AES-256-GCM) with backward-compatible decrypt.

## Medium

- [x] Harden outbound webhook delivery against SSRF:
  - DNS resolution + private-range blocking
  - disable redirects
  - keep existing URL validation as defense-in-depth
- [x] Reduce `/api/health` info leakage (no raw backend error messages in response).
- [x] Bound in-memory caches in `middleware.js` (rateLimitMap + apiKeyCache) and reduce spoofable-IP impact for self-host.
- [x] Redact sensitive patterns before sending content to third-party LLMs (OpenAI embeddings + semantic guardrail).
- [x] Rate limit public `/api/*` endpoints (including `PUBLIC_ROUTES`) to reduce DoS and brute-force pressure.
- [x] Optional distributed rate limiting (Upstash REST) for multi-instance deployments.
- [x] Strengthen CSP directives (without removing Next.js-required allowances).
- [x] Optional guard webhook authentication (HMAC via `GUARD_WEBHOOK_SECRET`).
- [x] DLP-redact webhook delivery logs before persisting (payload/response_body).

## Data Handling (At-Rest DLP)

- [x] Redact secrets before storing shared docs/snippets/content (DLP on write).
- [x] Redact secrets in bulk sync ingestion (`/api/sync`) for free-text fields.
- [x] Redact secrets before storing actions/loops/assumptions (DLP on write).

## Functional/Correctness

- [x] Fix `app/api/handoffs/route.js` runtime errors (missing `getSql` and missing `scanSensitiveData` import).
- [x] Fix quota-check call signature mismatch in `app/api/onboarding/api-key/route.js` (currently latent because OSS quotas are infinite).

## Docs and Maintenance

- [x] Update security docs to capture the full remediation set and self-host configuration knobs:
  - `docs/SECURITY.md`
  - `docs/SECURITY-CHECKLIST.md`
  - `SECURITY_BASELINE_REVIEW_2026-02-14.md`
- [x] Optional Vercel Web Analytics (enabled on Vercel; opt-in for self-host via `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true`).
- [x] Mitigate dev-only `npm audit` advisory for nested `esbuild` via targeted `overrides` (without forcing unrelated packages to downgrade).
- [x] Ignore local npm cache directory (`.npm-cache/`) to prevent accidental commits.
