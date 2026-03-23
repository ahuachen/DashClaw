---
phase: 02-security-product-audit
plan: 01
subsystem: security
tags: [security, headers, validation, ssrf, injection, cron, middleware]
dependency_graph:
  requires: []
  provides: [hardened-headers, ipv6-ssrf-blocking, array-item-validation, prompt-injection-enforcement, policy-error-codes, guard-logging, events-warning, dead-route-removal]
  affects: [middleware.js, app/lib/validate.js, app/api/guard/route.js, app/api/policies/route.js, app/lib/guard.js, app/lib/events.js]
tech_stack:
  added: []
  patterns: [timing-safe-compare, error-code-matching, fail-open-with-logging, production-environment-warning]
key_files:
  created: []
  modified:
    - middleware.js
    - app/lib/validate.js
    - app/api/guard/route.js
    - app/api/policies/route.js
    - app/lib/guard.js
    - app/lib/events.js
decisions:
  - "HSTS unified to 2-year max-age with preload in both middleware paths (addSecurityHeaders and admin branch)"
  - "Prompt injection only blocks on recommendation=block (critical severity) — warn/medium levels still allowed through to guard evaluation"
  - "Dead PUBLIC_ROUTES regex entry removed entirely — no replacement endpoint added (replay uses its own path)"
  - "All 7 cron routes confirmed already enforcing CRON_SECRET with timing-safe comparison — no changes needed"
  - "events.js production warning added at module initialization (not per-request) to avoid log spam"
metrics:
  duration: "~4 minutes"
  completed_date: "2026-03-23"
  tasks_completed: 3
  files_modified: 6
---

# Phase 02 Plan 01: Security Hardening Summary

Nine targeted in-place security fixes across middleware, validation, guard engine, policy routes, and cron endpoints — hardening DashClaw against OWASP Top 10 vectors before public launch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix security headers, SSRF blocklist, and validation gaps | bc843dc | middleware.js, app/lib/validate.js |
| 2 | Integrate prompt injection detection into guard route | 1c90c4d | app/api/guard/route.js |
| 3 | Fix policy/guard/events edge cases and harden cron auth | bd2a9fe | app/api/policies/route.js, app/lib/guard.js, app/lib/events.js, middleware.js |

## What Was Built

**HSTS header unification (Fix 1):** Updated both HSTS header instances in `middleware.js` from `max-age=31536000; includeSubDomains` (1-year) to `max-age=63072000; includeSubDomains; preload` (2-year with preload), matching the canonical value in `next.config.js`.

**IPv6 SSRF blocking (Fix 2):** Added 5 IPv6 patterns to `isValidWebhookUrl()` blocklist: `fc00::/7` unique local, `fe80::/10` link-local, `::ffff:127.x` IPv4-mapped loopback, `::ffff:0:127.x` IPv4-translated loopback, and full `::1` notation.

**Array item validation (Fix 3):** Added per-item string type and 500-character length validation in the `case 'array':` branch of `validateField()` — prevents unbounded string injection through array fields like `systems_touched`, `side_effects`, and `artifacts_created`.

**Prompt injection enforcement (Fix 4):** Imported `scanForPromptInjection` into `app/api/guard/route.js` and added blocking on `recommendation === 'block'` (critical-severity patterns only) before `evaluateGuard()` is called. Returns 400 with `risk_level` and `categories` in the response.

**Policy uniqueness error code (Fix 5):** Added `err.code === '23505'` check before the message string fallback in the POST handler — catches PostgreSQL `unique_violation` by its stable error code.

**Guard JSON parse logging (Fix 6):** Changed silent `catch { return true; }` to named catch with `console.error('[GUARD] Failed to parse agent_ids for policy:', p.id, parseErr.message)` — malformed `agent_ids` now logs and fails open with an explicit comment.

**Events production warning (Fix 7):** Added `console.warn` at module initialization when `NODE_ENV === 'production'` and the memory backend is selected — surfaces the serverless SSE limitation with actionable guidance (set `REDIS_URL`, Upstash free tier works).

**CRON_SECRET verification (Fix 8):** Confirmed all 7 cron routes already enforce `CRON_SECRET` with timing-safe comparison. `signals/route.js` uses `timingSafeCompare` from `app/lib/timing-safe.js`; `integration-health/route.js` uses `timingSafeEqual` from `crypto`. No changes needed.

**Dead PUBLIC_ROUTES entry removal (Fix 9):** Removed `'/api/actions/[^/]+'` from the `PUBLIC_ROUTES` array in `middleware.js`. The matching logic uses `pathname.startsWith(route)` which is not regex-aware — this entry never matched any real pathname and would have become a real auth bypass if the matching logic were changed to use regex.

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing test file failure in `.worktrees/feature-pack/__tests__/unit/setup.composeInstanceStatus.test.js` (module resolution error for `@/setup/composeInstanceStatus`) was present before this plan and is out of scope. All 1480 actual tests pass.

## Verification Results

```
npm run test -- --run    -> 1480 tests passed (1 pre-existing worktree failure)
npm run lint             -> 0 errors, 1 pre-existing img warning
npm run governance:boundary:check -> Boundary check passed. Runtime is clean.
```

All acceptance criteria confirmed by grep pattern matching after each fix.

## Known Stubs

None — all fixes are complete, functional code changes.

## Self-Check: PASSED

Files verified:
- middleware.js: contains `max-age=63072000; includeSubDomains; preload` (2 occurrences)
- middleware.js: does NOT contain `api/actions/[^/]+`
- app/lib/validate.js: contains `fc|fd` IPv6 pattern and `value[i].length > 500`
- app/api/guard/route.js: contains `scanForPromptInjection` import and `recommendation === 'block'`
- app/api/policies/route.js: contains `err.code === '23505'`
- app/lib/guard.js: contains `console.error('[GUARD] Failed to parse agent_ids`
- app/lib/events.js: contains `in-memory event backend in production`

Commits verified:
- bc843dc: fix(02-01): fix HSTS headers, IPv6 SSRF blocklist, and array item validation
- 1c90c4d: fix(02-01): enforce prompt injection blocking in guard route
- bd2a9fe: fix(02-01): harden policy error handling, guard logging, events warning, and middleware
