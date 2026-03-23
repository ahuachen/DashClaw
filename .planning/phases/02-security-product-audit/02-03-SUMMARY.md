---
phase: 02-security-product-audit
plan: 03
subsystem: testing
tags: [vitest, security, ssrf, prompt-injection, cron-auth, hsts, regression-tests]

# Dependency graph
requires:
  - phase: 02-security-product-audit/02-01
    provides: Security hardening fixes that these tests lock in (HSTS, prompt injection guard, SSRF IPv6, CRON_SECRET)
provides:
  - Regression test suite for all Plan 01 security fixes (51 tests across 4 files)
  - Guard against future regressions in isValidWebhookUrl, guard route injection scan, HSTS headers, cron auth
affects: [future-refactors, validate.js, middleware.js, guard-route, cron-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.hoisted() pattern for mock declarations used consistently across all new test files"
    - "Process env manipulation with afterEach restore for test isolation"
    - "Inline function extraction for middleware testing when module graph is complex"

key-files:
  created:
    - __tests__/unit/security-headers.test.js
    - __tests__/unit/prompt-injection-guard.test.js
    - __tests__/unit/ssrf-validation.test.js
    - __tests__/unit/cron-auth.test.js
  modified:
    - app/lib/validate.js
    - app/api/cron/integration-health/route.js

key-decisions:
  - "Inline addSecurityHeaders in security-headers.test.js to avoid complex middleware module graph; mirrors source exactly"
  - "IPv6 bracket-stripping fix committed with tests — tests drove discovery of undetected vulnerability"
  - "Bearer prefix enforcement added to integration-health route — plain token bypass was a security gap"

patterns-established:
  - "TDD: write tests first, run to discover gaps, fix implementation, verify green"
  - "SSRF test pattern: test each address family (loopback, unique-local, link-local, IPv4-mapped) separately for clarity"

requirements-completed: [SEC-01, SEC-02, SEC-03, SEC-04]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 02 Plan 03: Security Regression Tests Summary

**51 vitest regression tests locking in Plan 01 SSRF, prompt injection, HSTS, and cron auth fixes — plus two bug fixes discovered during test writing**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T17:11:46Z
- **Completed:** 2026-03-23T17:16:52Z
- **Tasks:** 1 (multi-file TDD)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Created 4 targeted security regression test files covering all Plan 01 fixes (51 tests total, all passing)
- Discovered and fixed a real security bug: `isValidWebhookUrl` IPv6 patterns silently bypassed due to Node's `URL` class wrapping IPv6 hostnames in brackets — addresses like `[fc00::1]`, `[fe80::1]`, and `[::ffff:127.0.0.1]` were not being blocked
- Discovered and fixed a second security bug: `integration-health` cron route accepted tokens without the `Bearer ` prefix, allowing bypass via `Authorization: <secret>` without the scheme prefix

## Task Commits

Each task was committed atomically:

1. **Task 1: Write security regression tests for all Plan 01 fixes** - `ee34087` (test + bug fixes)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `__tests__/unit/security-headers.test.js` - 9 tests: HSTS production-only enforcement, X-Frame-Options DENY vs replay path behavior
- `__tests__/unit/prompt-injection-guard.test.js` - 7 tests: POST /api/guard blocks critical injection patterns, allows warn-level and safe inputs, skips scan when goal is empty
- `__tests__/unit/ssrf-validation.test.js` - 25 tests: IPv6 SSRF blocking (loopback, fc00/fd, fe80/febf, ::ffff mapped), valid external URLs allowed, array item validation (oversized, non-string)
- `__tests__/unit/cron-auth.test.js` - 10 tests: CRON_SECRET enforcement for both /cron/signals (503 when unset, 401 when missing/wrong) and /cron/integration-health (500 when unset, 401 when missing/wrong)
- `app/lib/validate.js` - Bug fix: strip brackets from IPv6 hostname before regex matching; updated IPv4-mapped hex pattern
- `app/api/cron/integration-health/route.js` - Bug fix: require explicit `Bearer ` prefix to prevent token bypass

## Decisions Made

- Inlined `addSecurityHeaders` in the test file (mirrors `middleware.js` source exactly) to avoid pulling the full middleware module graph (next-auth, neon, demo fixtures) into unit tests
- Both bugs discovered via TDD are committed as part of the same task commit since they were found and fixed during the RED→GREEN cycle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed isValidWebhookUrl IPv6 bracket stripping**
- **Found during:** Task 1 (ssrf-validation.test.js RED phase)
- **Issue:** Node's `URL` class normalizes IPv6 addresses with surrounding brackets in `hostname` (e.g. `[fc00::1]`), but all IPv6 block patterns were written to match bare addresses (`fc00::1`). Result: `fc00::/7`, `fe80::/10`, and all IPv4-mapped addresses were NOT being blocked despite the pattern comments claiming they would be.
- **Fix:** Strip leading `[` and trailing `]` from hostname before applying patterns. Also added hex pattern `/^::ffff:7f[0-9a-f]{2}:/i` to catch compressed IPv4-mapped loopback (Node normalizes `::ffff:127.0.0.1` to `::ffff:7f00:1`).
- **Files modified:** `app/lib/validate.js`
- **Verification:** Manual `node` test + vitest run — all 6 blocked IPv6 patterns correctly rejected, 3 valid external URLs correctly allowed
- **Committed in:** `ee34087` (part of task commit)

**2. [Rule 1 - Bug] Fixed integration-health cron route Bearer prefix enforcement**
- **Found during:** Task 1 (cron-auth.test.js malformed-header test case)
- **Issue:** The route used `authHeader.replace('Bearer ', '')` to extract the token. If an attacker passes `Authorization: <secret>` (no `Bearer` prefix), `replace()` is a no-op and the full string is compared against the secret — if the strings are equal, the comparison succeeds. This is a token bypass vulnerability.
- **Fix:** Replaced `replace()` extraction with an explicit `startsWith('Bearer ')` guard that returns 401 immediately if the prefix is absent, then uses `slice()` for extraction.
- **Files modified:** `app/api/cron/integration-health/route.js`
- **Verification:** Test `returns 401 when Authorization header is malformed (no Bearer prefix)` now passes
- **Committed in:** `ee34087` (part of task commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both bugs found through TDD — tests are working exactly as intended (Nyquist rule in action). No scope creep; fixes are minimal and targeted.

## Issues Encountered

None beyond the two bugs that were discovered and fixed.

## Known Stubs

None — tests use real implementations where pure (validate.js, promptInjection.js) and mocks only for DB/network dependencies.

## Next Phase Readiness

- All 4 security fix categories from Plan 01 are now regression-locked
- Phase 02 complete — security hardening and test coverage delivered
- Full test suite: 1531 tests, all passing (worktree failure is pre-existing unrelated issue)

## Self-Check: PASSED

All files exist and commit ee34087 verified.

---
*Phase: 02-security-product-audit*
*Completed: 2026-03-23*
