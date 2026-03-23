---
phase: 01-deploy-funnel
verified: 2026-03-17T23:55:00Z
status: human_needed
score: 11/12 must-haves verified
re_verification: false
human_verification:
  - test: "Open the deploy button URL in a browser and attempt a full Vercel clone+deploy"
    expected: "Vercel shows 7 env var fields, Neon integration panel is present and skippable, deploy completes without db:push hanging, /setup page shows Deploy Readiness section with green checks after NEXTAUTH_URL is set"
    why_human: "End-to-end deploy flow requires a live Vercel account, a real Neon database, and a running deployed instance. Cannot verify programmatically."
  - test: "Visit /setup on a deployed instance where NEXTAUTH_URL is set to the wrong host"
    expected: "Deploy Readiness section shows 'NEXTAUTH_URL does not match deployment host' as a warn check with a nextAction instruction to set NEXTAUTH_URL to the correct host"
    why_human: "Requires a live deployed instance with a mismatched NEXTAUTH_URL env var."
  - test: "Visit /setup on a deployed Vercel instance with no UPSTASH_REDIS_REST_URL set"
    expected: "Deploy Readiness section shows 'Live stream requires Redis on serverless' as a warn check"
    why_human: "Requires a live Vercel deployment with VERCEL env var set by the platform."
---

# Phase 1: Deploy Funnel Verification Report

**Phase Goal:** A developer can go from the DashClaw GitHub README to a fully functional self-hosted instance in under 10 minutes without consulting external docs
**Verified:** 2026-03-17T23:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | vercel.json has framework preset nextjs | VERIFIED | `"framework": "nextjs"` in vercel.json |
| 2  | vercel.json buildCommand is `next build` (db:push removed per human-verified gate) | VERIFIED | `"buildCommand": "next build"` — DEPLOY-02 requirement text updated to match |
| 3  | vercel.json registers /api/cron/signals every 5 min and /api/cron/integration-health every 6 hours | VERIFIED | Both cron entries present, schedules correct, both routes exist in codebase |
| 4  | README has Vercel deploy button above the fold, before "## What is DashClaw?" | VERIFIED | Deploy section at char 2005, What is DashClaw? at char 3650; badge uses official vercel.com/button image |
| 5  | Deploy button URL encodes exactly 7 env vars | VERIFIED | DATABASE_URL, DASHCLAW_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET, DASHCLAW_LOCAL_ADMIN_PASSWORD |
| 6  | Deploy button URL contains Neon products slug and skippable-integrations=1 | VERIFIED | `products=%5B%7B%22type%22%3A%22integration%22...%22neon%22...%7D%5D&skippable-integrations=1` present |
| 7  | README post-deploy checklist covers NEXTAUTH_URL, Redis (Upstash), and /setup verification | VERIFIED | 4-step checklist: db:push (step 1), NEXTAUTH_URL (step 2), Upstash Redis (step 3), /setup (step 4) |
| 8  | deploy-without-oauth.md exists and is linked from README | VERIFIED | File exists at `docs/deploy-without-oauth.md`, linked at README line 47 |
| 9  | NEXTAUTH_URL mismatch detected as warn on /setup | VERIFIED | `checkNextAuthUrl` returns `status: 'warn'` when configured.host !== host; test passes |
| 10 | Missing NEXTAUTH_URL detected as fail on /setup | VERIFIED | `checkNextAuthUrl` returns `status: 'fail'` when NEXTAUTH_URL is absent; test passes |
| 11 | Vercel + no Redis detected as warn on /setup | VERIFIED | `checkRealtimeBackend` returns `status: 'warn'` when VERCEL=1 and no Redis vars; test passes |
| 12 | CRON_SECRET advisory check present on /setup | VERIFIED | CRON_SECRET in ADVISORY_ENV_VARS; checkConfiguration produces warn when absent, pass when present; tests pass |

**Score:** 12/12 truths verified (automated)

Note: The plan's must_have truth "vercel.json contains framework preset, buildCommand with db:push, and two cron routes" was intentionally superseded. Task 3 human-verify gate confirmed db:push hangs in non-TTY. The REQUIREMENTS.md text for DEPLOY-02 was updated to reflect `next build` as buildCommand. This is not a failure — it is a correctly executed plan deviation with a blocking human checkpoint.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vercel.json` | Framework preset, buildCommand, 2 cron routes | VERIFIED | Valid JSON, framework=nextjs, buildCommand="next build", 2 crons with correct paths and schedules |
| `README.md` | Deploy button + post-deploy instructions | VERIFIED | Badge + 4-step checklist above fold, deploy-without-oauth.md linked |
| `app/lib/readiness/deployCheck.mjs` | Exports buildDeploySection with NEXTAUTH_URL and realtime checks | VERIFIED | 103 lines, full implementation, not a stub — exports buildDeploySection |
| `app/lib/readiness/constants.mjs` | CRON_SECRET in ADVISORY_ENV_VARS | VERIFIED | Third entry in ADVISORY_ENV_VARS with key: 'CRON_SECRET' |
| `app/lib/readiness.mjs` | buildDeploySection imported and wired | VERIFIED | Imported line 15, called line 34, in sections array line 64, in report object line 80 |
| `__tests__/unit/readiness.test.js` | Unit tests for DEPLOY-04 checks | VERIFIED | 9 new test cases covering all check states; 23/23 tests pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `README.md` | `https://vercel.com/new/clone` | deploy button badge URL | VERIFIED | Line 36 contains full URL with `vercel.com/new/clone?repository-url=` |
| `vercel.json` | `/api/cron/signals` | cron schedule registration | VERIFIED | path `/api/cron/signals` in crons array; route file exists at `app/api/cron/signals/route.js` |
| `vercel.json` | `/api/cron/integration-health` | cron schedule registration | VERIFIED | path `/api/cron/integration-health` in crons array; route file exists at `app/api/cron/integration-health/route.js` |
| `app/lib/readiness.mjs` | `app/lib/readiness/deployCheck.mjs` | import and call buildDeploySection(env, host) | VERIFIED | `import { buildDeploySection } from './readiness/deployCheck.mjs'` line 15; called as `buildDeploySection(env, host)` line 34 |
| `app/lib/readiness/deployCheck.mjs` | `app/lib/readiness/factories.mjs` | import createSection, createCheck | VERIFIED | `import { createSection, createCheck } from './factories.mjs'` line 1 |
| `app/lib/readiness/constants.mjs` | `app/lib/readiness/configurationCheck.mjs` | ADVISORY_ENV_VARS consumed by checkConfiguration() | VERIFIED | CRON_SECRET in ADVISORY_ENV_VARS; checkConfiguration test confirms `id: 'cron_secret'` check produced |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DEPLOY-01 | 01-01-PLAN.md | One-click Vercel deploy button in README above the fold, 7 env vars | SATISFIED | Button at README line 36, 7 env vars confirmed by parse, above fold (char 2005 vs "What is DashClaw?" char 3650) |
| DEPLOY-02 | 01-01-PLAN.md | vercel.json registers cron routes, buildCommand runs next build | SATISFIED | vercel.json has both cron entries with correct schedules, buildCommand="next build"; REQUIREMENTS.md text updated after human-verified gate confirmed db:push non-TTY hang |
| DEPLOY-03 | 01-01-PLAN.md | Post-deploy setup instructions cover NEXTAUTH_URL, Upstash Redis, /setup | SATISFIED | 4-step checklist (expanded from 3 to add manual db:push step): NEXTAUTH_URL step 2, Upstash Redis step 3, /setup step 4 |
| DEPLOY-04 | 01-02-PLAN.md | /setup health checks: NEXTAUTH_URL config, realtime backend, schema status, CRON_SECRET | SATISFIED | deployCheck.mjs implements NEXTAUTH_URL (fail/warn/pass) and realtime backend (warn/pass/info); CRON_SECRET in ADVISORY_ENV_VARS; schema migration covered by existing db section; all 23 tests pass |

No orphaned requirements. REQUIREMENTS.md traceability table marks DEPLOY-01 through DEPLOY-04 as complete for Phase 1. No Phase 1 requirements appear in REQUIREMENTS.md that are not covered by 01-01-PLAN.md or 01-02-PLAN.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/page.js` | 105 | `<img>` element (eslint warning, @next/next/no-img-element) | Info | Pre-existing warning, unrelated to Phase 1 changes; 0 errors from lint |

No TODO/FIXME/placeholder/stub patterns found in any Phase 1 modified files. No empty implementations. No `return null` or `return {}` stubs. All implementations are substantive.

### Human Verification Required

### 1. Full end-to-end Vercel deploy flow

**Test:** Click the deploy button badge in README.md (or use the URL directly). Complete the Vercel clone + deploy flow with a Neon database. After deploy: set NEXTAUTH_URL in Vercel settings, redeploy, visit /setup.
**Expected:** /setup shows the Deploy Readiness section with NEXTAUTH_URL pass and realtime backend info/warn depending on whether Upstash Redis was added. The entire flow from README click to working /setup should complete under 10 minutes.
**Why human:** Requires a live Vercel account, a real Neon database, and a deployed running instance. Cannot simulate VERCEL platform env var or real HTTP host header matching in a unit test.

### 2. NEXTAUTH_URL mismatch warning on live /setup

**Test:** Deploy to Vercel without setting NEXTAUTH_URL, then visit /setup.
**Expected:** Deploy Readiness section shows "NEXTAUTH_URL is not configured" as a fail check with nextAction instruction. After setting a wrong URL (e.g. old domain), shows "NEXTAUTH_URL does not match deployment host" as warn.
**Why human:** Unit tests cover the logic, but visual rendering of the VerificationSection component on the actual /setup page requires a live instance.

### 3. Redis warning on Vercel without Upstash

**Test:** On a Vercel deployment with no UPSTASH_REDIS_REST_URL set, visit /setup.
**Expected:** "Live stream requires Redis on serverless" appears as a warn check in the Deploy Readiness section.
**Why human:** VERCEL=1 env var is only set by Vercel's runtime, cannot be replicated locally.

### Gaps Summary

No gaps found. All automated checks pass. All 12 observable truths are verified against the actual codebase. All 4 requirements (DEPLOY-01 through DEPLOY-04) are satisfied.

The phase goal "A developer can go from the DashClaw GitHub README to a fully functional self-hosted instance in under 10 minutes without consulting external docs" is supported by:

1. A working one-click deploy button with all required env vars pre-populated and Neon integration offered
2. A 4-step post-deploy checklist that is entirely self-contained (no external doc links required)
3. A /setup page that actively surfaces deploy-specific configuration problems (NEXTAUTH_URL, Redis, CRON_SECRET) so the developer knows exactly what to fix
4. deploy-without-oauth.md exists for the manual path

The 3 human verification items are confirmations of live behavior, not suspected failures. Automated unit coverage is complete (23/23 tests pass). The phase is ready for human sign-off on the end-to-end flow.

---

_Verified: 2026-03-17T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
