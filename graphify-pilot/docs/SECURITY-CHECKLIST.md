# Security Checklist

Quick reference for secure development and deployment of DashClaw.

## Repository Hygiene (Always)

- [ ] `.env`, `.env.local`, `.env.*` are not git-tracked: `git ls-files .env*` should be empty.
- [ ] `secrets/` is gitignored and never committed.
- [ ] `node_modules/`, `.next/`, and other build artifacts are gitignored.
- [ ] Local caches (example: `.npm-cache/`) are gitignored.

## Before Every Commit

- [ ] Review what is staged: `git diff --cached --name-only`
- [ ] Run the security scan: `node scripts/security-scan.js`
- [ ] Run basic CI parity:
  - [ ] `npm run lint`
  - [ ] `npm run build`

## Before Every Deploy (Production)

- [ ] `DASHCLAW_API_KEY` is set (required to enable `/api/*` in production).
- [ ] `NEXTAUTH_URL` + `NEXTAUTH_SECRET` are set.
- [ ] `ENCRYPTION_KEY` is set and is exactly 32 characters.
- [ ] `DATABASE_URL` is set via environment variables (not committed anywhere).
- [ ] If behind a reverse proxy you control: set `TRUST_PROXY=true` (otherwise leave it unset).
- [ ] If multi-instance: configure distributed rate limiting:
  - [ ] `UPSTASH_REDIS_REST_URL`
  - [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] If you use outbound webhooks:
  - [ ] Consider setting `WEBHOOK_ALLOWED_DOMAINS`
  - [ ] Consider setting `GUARD_WEBHOOK_SECRET` to sign guard webhooks

## If Credentials Are Leaked

1. Rotate first, investigate second.
2. Treat DB credentials, OAuth client secrets, and API keys as compromised.
3. After rotation, run `node scripts/security-scan.js` and review recent logs and webhook deliveries.

## Dependency Maintenance (Recommended)

- [ ] Review and merge Dependabot PRs for patch/minor updates when CI is green.
- [ ] Treat major version bumps as planned changes (test locally and stage behind a PR).
- [ ] Run `npm audit --omit=dev` (runtime risk) and `npm audit` (dev + runtime) periodically.

