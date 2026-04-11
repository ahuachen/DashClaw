# Connect → API Key Smoke Test

## Scope

Validates FIX-02 — `/docs` loads without 502, and the `/connect` → first API key path completes in ≤ 2 minutes on a fresh session. Evidence for ROADMAP Phase 1 success criterion #2.

## Environment

Hosted Vercel deployment at `$DASHCLAW_LIVE_URL` (the live URL Wes points at in his dogfood setup — see `docs/dogfood-setup.md` if it exists).

## Steps

1. Open a fresh browser / incognito window (no existing DashClaw cookies).
2. Navigate to `$DASHCLAW_LIVE_URL/docs`. Expect: the docs page renders within 5 seconds, status 200. FAIL if: 502, 504, or blank page.
3. Open DevTools Network tab. Reload `/docs` once. Expect: all requests return 2xx or 304. FAIL if: any 5xx response.
4. Navigate to `$DASHCLAW_LIVE_URL/connect`. Expect: the onboarding page renders, shows a "Get API key" or equivalent CTA.
5. Follow the onboarding flow as a first-time user. Sign in (or bootstrap the admin) as needed.
6. Reach the step where the API key is revealed / copyable. Click to copy. FAIL if: 502, 401, or the key is masked with no reveal affordance.
7. Paste the copied key into a terminal and run a verification request (use the existing health/guard endpoint, e.g. `curl -H "Authorization: Bearer <key>" $DASHCLAW_LIVE_URL/api/health` — expect 200).
8. Stop the timer. Expect: total elapsed time from step 4 to step 7 is ≤ 2 minutes.

## Pass criteria

All 8 steps green. Total elapsed ≤ 2 minutes. No 5xx anywhere in the Network tab.

## If /docs still 502s

Likely a Vercel cold-start timeout on the 1999-line `app/docs/page.js` server component (see RESEARCH.md section B). Do NOT split the file in this phase — log the timing in this doc and open a follow-up plan in a later phase. The API key path must still pass independently.

## Evidence

Paste the curl output and the elapsed time into this document under a `### Run YYYY-MM-DD` section when the smoke test is executed. Commit the result to close FIX-02.
