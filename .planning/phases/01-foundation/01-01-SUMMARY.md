---
phase: 1
plan: 1
subsystem: activation-fixes
tags: [lucide-react, csp, hsts, cookies, self-host, migrations, compat, FIX-01, FIX-02, FIX-03, FIX-04]
dependency_graph:
  requires: []
  provides: [FIX-01, FIX-02, FIX-03, FIX-04]
  affects: [middleware.js, next.config.js, app/api/auth/local/route.js, app/login/LocalPasswordForm.js, app/api/guard/route.js, app/api/keys/route.js, app/api/team/route.js, app/api/usage/route.js]
tech_stack:
  added: [app/lib/selfHost.js, app/lib/repositories/guard.repository.js, scripts/migrate-api-keys-compat.mjs, docs/smoke-tests/connect-api-key.md]
  patterns: [isSelfHostModeEnabled shared helper, repository pattern for guard decisions, isTLS-gated CSP/HSTS, scheme-based cookie Secure flag]
key_files:
  created:
    - __tests__/unit/lucide-exports.test.js
    - __tests__/unit/security-headers.test.js (extended)
    - app/lib/selfHost.js
    - app/lib/repositories/guard.repository.js
    - scripts/migrate-api-keys-compat.mjs
    - docs/smoke-tests/connect-api-key.md
  modified:
    - package.json (lucide-react pin)
    - next.config.js (isTLS gating)
    - app/api/auth/local/route.js (isHTTPS cookie, DASHCLAW_API_KEY_ORG JWT)
    - app/login/LocalPasswordForm.js (window.location.href hard redirect)
    - middleware.js (isSelfHostModeEnabled import + verifyOrgExists bypass + rate-limit key)
    - app/api/guard/route.js (repository delegation + self-host bypass)
    - app/api/keys/route.js (self-host bypass + 42P01 catch)
    - app/api/team/route.js (self-host bypass)
    - app/api/usage/route.js (self-host bypass + 42P01 catch)
    - scripts/migrate-multi-tenant.mjs (ADD COLUMN IF NOT EXISTS guards)
    - app/lib/setup/runtime-prerequisites.mjs (add migrate-api-keys-compat.mjs)
    - docker-compose.yml (env_file, build args, port 5433)
    - contracts/setup/runtime-prerequisites.json (baseline update)
    - __tests__/unit/guard.route.test.js (mock repository instead of raw sql)
decisions:
  - "lucide-react pinned to exact 0.577.0 (no ^ caret) to prevent future minor bump regression"
  - "isSelfHostModeEnabled() extracted to app/lib/selfHost.js for reuse across middleware + routes"
  - "guard route GET SQL moved to guard.repository.js (route-sql compliance + column compat)"
  - "migrate-api-keys-compat.mjs inserted BEFORE migrate-multi-tenant.mjs in SETUP_MIGRATION_SCRIPTS"
  - "window.location.href used instead of router.push to force full cookie send after login"
metrics:
  duration: ~30min
  completed: 2026-04-11
  tasks: 4
  files: 14
---

# Phase 1 Plan 1: Activation Fixes Summary

Close four known activation blockers (FIX-01..04) so a developer cloning DashClaw on Node 20 reaches a working dashboard and a self-hoster on a plain-HTTP LAN (or upgrader from a legacy schema) no longer bounces off broken cookies, silently-upgraded fetches, or crashed migrations.

## Requirements Closed

- **FIX-01**: lucide-react regression guard — `Github` icon regression test added, package pinned to `0.577.0` (no caret)
- **FIX-02**: Live smoke-test checklist created at `docs/smoke-tests/connect-api-key.md` — actual run deferred (requires hosted deploy access, see Follow-ups)
- **FIX-03**: Lief's LAN/CSP/HSTS/cookie fixes ported from `RyanTJoy/DashClaw` (commits `fa268c3`, `108be08`, `49c8ae3`)
- **FIX-04**: Elpolini's migration compat and self-host bypass ported from `elpolini/DashClaw` (commit `dbf5463`, HIGH-priority subset only)

## Commits Produced

| SHA | Description |
|-----|-------------|
| `4d8552a9` | test(01-01): lucide-react regression guard + pin (FIX-01) |
| `3dcb43dc` | feat(01-01): Lief's LAN/CSP/HSTS/cookie fixes (FIX-03) — Co-Authored-By: Lief (RyanTJoy) |
| `c74c3d0b` | feat(01-01): Elpolini migration compat + combined self-host bypass (FIX-04) — Co-Authored-By: Lief (RyanTJoy) + Elpolini |
| `467ada90` | chore(01-01): update contracts baseline for migrate-api-keys-compat.mjs |
| `55f652df` | docs(01-01): live smoke-test checklist for /docs and /connect (FIX-02) |

## Guardrail Evidence

- `npm run route-sql:check`: PASSED — SQL count dropped from 90 to 87 (guard GET moved to repository)
- `npm run lint`: PASSED — clean
- `npm run openapi:check`: PASSED — no API contract drift
- `npm run api:inventory:check`: PASSED — inventory current
- `npm run contracts:check`: PASSED — runtime-prerequisites.json baseline updated
- `npm test -- lucide-exports security-headers`: PASSED — 16 tests (3 new + 4 new + 9 existing)
- `npm test -- --run guard`: PASSED — 106 tests (updated to use repository mock)
- `npm test -- --run keys`: PASSED — 15 tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `replace_all` missed DELETE handler in local/route.js**
- Found during: Task 2
- Issue: `replace_all` on `secure: process.env.NODE_ENV === 'production'` only replaced the POST instance; DELETE still had the old value
- Fix: Explicit second edit targeting the DELETE handler
- Files modified: `app/api/auth/local/route.js`
- Commit: `3dcb43dc`

**2. [Rule 1 - Bug] `next.config.js` HSTS had unreachable code after early `return`**
- Found during: Task 2
- Issue: First edit placed `return [...]` before the `if (isTLS)` push, making HSTS conditional dead code
- Fix: Restructured to `const result = [...]` → conditional push → `return result`
- Files modified: `next.config.js`
- Commit: `3dcb43dc`

**3. [Rule 1 - Bug] `guard.route.test.js` tests broke after GET moved to repository**
- Found during: Task 3
- Issue: Existing GET tests mocked raw `sql.query` calls; after refactor to `listGuardDecisions` repository, the mock responses no longer reached the right path
- Fix: Added `vi.mock('@/lib/repositories/guard.repository.js')` and rewrote GET test assertions to use `mockListGuardDecisions`
- Files modified: `__tests__/unit/guard.route.test.js`
- Commit: `c74c3d0b`

**4. [Rule 2 - Missing critical functionality] contracts baseline needed updating**
- Found during: Task 3
- Issue: Adding `migrate-api-keys-compat.mjs` to `SETUP_MIGRATION_SCRIPTS` caused `npm run contracts:check` to warn about drift
- Fix: Updated `contracts/setup/runtime-prerequisites.json` to match
- Files modified: `contracts/setup/runtime-prerequisites.json`
- Commit: `467ada90`

### Scope Decisions

- `LocalPasswordForm.js` redirects to `/mission-control` (actual destination in the component) not `/dashboard` — plan said `/dashboard` but the code used `/mission-control`. Used the actual destination to avoid breaking the redirect.
- Elpolini's `db.js` MockSql, `dfcf560` env path overrides, `5c4d90a` bootstrap enrich, and `072350e` lockfile — NOT ported per plan's explicit exclusion list.

## Follow-ups

1. **FIX-02 live smoke test not yet run** — requires Wes to run against the hosted Vercel deployment. Steps are in `docs/smoke-tests/connect-api-key.md`. To close FIX-02 formally: run the 8 steps, paste curl output + elapsed time under a `### Run YYYY-MM-DD` section, and commit.

2. **GitNexus MCP tools not available** — `gitnexus_impact` and `gitnexus_detect_changes` were not available as MCP tools in this agent runtime. No impact analysis was run. Symbols modified: `verifyOrgExists` (middleware.js), `GET` (guard/route.js), `GET`/`POST`/`DELETE` (keys/route.js), `GET` (team/route.js), `GET` (usage/route.js). These are all route-level functions with known consumers (the Next.js router); blast radius is contained. Recommend running `gitnexus_impact` on `verifyOrgExists` in a follow-up session to confirm no unexpected callers.

3. **route-sql baseline** — The baseline count dropped from 90 to 87 (guard GET SQL moved to repository). The baseline should be regenerated to lock in the new lower count: `npm run route-sql:baseline:generate`.

## Known Stubs

None — all plan-created files contain real logic or real documentation. No hardcoded empty values flow to UI rendering.

## Self-Check: PASSED
