---
phase: 01-deploy-funnel
plan: 02
subsystem: infra
tags: [readiness, health-checks, vercel, nextauth, redis, cron, setup-page]

# Dependency graph
requires: []
provides:
  - Deploy readiness section in getReadinessReport with NEXTAUTH_URL mismatch detection and realtime backend checks
  - CRON_SECRET added to ADVISORY_ENV_VARS for advisory configuration reporting
  - buildDeploySection(env, host) function in app/lib/readiness/deployCheck.mjs
  - Overall status logic updated to treat deploy failures as blocked, deploy warnings as needs_attention
affects: [01-03, setup-page, mission-control]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deploy checks follow the same createSection/createCheck factory pattern as all other readiness sections"
    - "Deploy section placed between auth and sdk in sections array — auth-dependent, sdk-last convention maintained"

key-files:
  created:
    - app/lib/readiness/deployCheck.mjs
  modified:
    - app/lib/readiness/constants.mjs
    - app/lib/readiness.mjs
    - __tests__/unit/readiness.test.js

key-decisions:
  - "deploy.ok=false (NEXTAUTH_URL missing) causes overall=blocked; deploy.status=warn causes needs_attention — fail state is blocking because auth redirects break"
  - "Deploy section positioned after auth and before sdk in sections array for logical ordering"
  - "CRON_SECRET added as advisory (warn when absent) not required (fail) — missing it degrades security but does not block the runtime"

patterns-established:
  - "Pattern 1: New readiness section = new file at app/lib/readiness/XCheck.mjs, imported in readiness.mjs, added to sections array and report object"

requirements-completed: [DEPLOY-04]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 1 Plan 02: Deploy Readiness Health Checks Summary

**Deploy readiness section for /setup: NEXTAUTH_URL mismatch detection (fail/warn/pass), serverless Redis warning (Upstash), and CRON_SECRET advisory check wired into getReadinessReport**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T23:24:18Z
- **Completed:** 2026-03-17T23:27:10Z
- **Tasks:** 2
- **Files modified:** 4 (1 created)

## Accomplishments
- Created `deployCheck.mjs` with NEXTAUTH_URL (fail/warn/pass) and realtime backend (warn/pass/info) checks
- Added CRON_SECRET to ADVISORY_ENV_VARS — picked up automatically by `checkConfiguration()`
- Wired `buildDeploySection` into `getReadinessReport` — deploy section appears in both `report.deploy` and `report.sections`
- Updated overall status logic to account for deploy failures (blocked) and warnings (needs_attention)
- 9 new unit tests covering all DEPLOY-04 check states, all 23 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CRON_SECRET, create deployCheck.mjs, write tests** - `70ff4a3` (feat)
2. **Task 2: Wire buildDeploySection into getReadinessReport** - `dd034f3` (feat)

**Plan metadata:** (see below)

## Files Created/Modified
- `app/lib/readiness/deployCheck.mjs` - New module exporting buildDeploySection(env, host) with NEXTAUTH_URL and realtime backend checks
- `app/lib/readiness/constants.mjs` - Added CRON_SECRET entry to ADVISORY_ENV_VARS
- `app/lib/readiness.mjs` - Imported buildDeploySection, added deploy section to report and sections array, updated overall status logic
- `__tests__/unit/readiness.test.js` - Added 9 new test cases, fixed 2 pre-existing tests to include CRON_SECRET in "strong operator" envs

## Decisions Made
- `deploy.ok=false` (NEXTAUTH_URL missing → `fail`) causes `overall: 'blocked'` because broken auth redirects prevent users from signing in
- `deploy.status === 'warn'` (mismatch or Redis absent on Vercel) causes `overall: 'needs_attention'` — degraded but not fully blocked
- CRON_SECRET is advisory not required — missing cron protection is a security gap but not a runtime blocker

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing tests broken by CRON_SECRET addition**
- **Found during:** Task 1 (writing tests)
- **Issue:** Two existing tests ("marks strong operator-ready instances as ready_unverified/verified") provided envs without CRON_SECRET. After adding CRON_SECRET to ADVISORY_ENV_VARS, `missingAdvisory.length > 0` caused those tests to get `needs_attention` instead of `ready_unverified`/`verified`.
- **Fix:** Added `CRON_SECRET: 'cron_test_secret'` to the env objects in both pre-existing tests — they were testing "strong operator-ready instance" which should include all advisory vars.
- **Files modified:** `__tests__/unit/readiness.test.js`
- **Verification:** Both tests now pass as expected
- **Committed in:** `70ff4a3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary correctness fix. Pre-existing tests were testing a "complete" operator env that now includes CRON_SECRET. No scope creep.

## Issues Encountered
None — plan executed cleanly after the pre-existing test fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/setup` now shows deploy-specific diagnostics: NEXTAUTH_URL mismatch, Redis missing on Vercel, CRON_SECRET absent
- Ready for Plan 03 (UI wiring or deploy button work)
- Blockers from STATE.md still open: NEXTAUTH_URL post-deploy pattern requires live Vercel test to confirm

---
*Phase: 01-deploy-funnel*
*Completed: 2026-03-17*
