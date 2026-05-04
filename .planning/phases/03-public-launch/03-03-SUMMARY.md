---
phase: 03-public-launch
plan: 03
subsystem: pricing-tier-monetization
tags: [mon-01, mon-02, pricing, tier-gate, require-tier, monetization-trigger]
requirements: [MON-01, MON-02]
status: complete
dependency_graph:
  requires:
    - "schema/schema.js:23 organizations.plan column (pre-existing)"
    - "app/lib/usage.js:81 getOrgPlan() (pre-existing)"
    - "app/lib/usage.js:38-47 PLAN_LIMITS.pro (pre-existing)"
  provides:
    - "app/lib/org.js requireTier(request, minTier) — dormant Pro tier gate"
    - "app/lib/repositories/monetization.repository.js countVerifiedIntegrations"
    - "GET /api/monetization/verified-integrations-count — public aggregate counter"
    - ".planning/PROJECT.md locked monetization trigger (D-03 location 3)"
    - "README.md public commitment paragraph (D-03 location 4)"
    - "app/pricing/page.jsx live N/50 counter page (D-03 location 1)"
  affects:
    - "middleware.js PUBLIC_ROUTES allowlist"
    - "docs/api-inventory.{json,md} (227 → 228 routes)"
tech_stack:
  added: []
  patterns:
    - "Repository pattern: monetization SQL encapsulated in monetization.repository.js — route file contains zero raw SQL (route-SQL guardrail held at 85, below baseline 90)"
    - "Tier gate via composition: requireTier builds on getOrgPlan() + organizations.plan — no new schema, no new auth infrastructure"
    - "Default-deny posture: unknown/null plan values fall back to tier rank 0 (T-03-03-01 mitigation)"
    - "Aggregate-only counter: route response is {count, target: 50} with explicit absence of org_id/agent_id/per-org keys (T-03-03-02 mitigation)"
    - "Fail-graceful public endpoints: DB failure returns 200 with count=null instead of 5xx — counter is a commitment signal, not critical infra"
key_files:
  created:
    - "app/lib/repositories/monetization.repository.js"
    - "app/api/monetization/verified-integrations-count/route.js"
    - "app/pricing/page.jsx"
    - "__tests__/fixtures/pro-gated-route-fixture.js"
    - "__tests__/unit/require-tier.test.js"
    - "__tests__/unit/monetization-repository.test.js"
    - "__tests__/unit/verified-integrations-count.route.test.js"
    - "__tests__/unit/pricing-page.test.jsx"
    - "__tests__/unit/project-md-content.test.js"
    - "__tests__/unit/readme-monetization-trigger.test.js"
  modified:
    - "app/lib/org.js (added requireTier helper alongside getOrgId/getOrgRole/getUserId)"
    - "middleware.js (PUBLIC_ROUTES += /api/monetization/verified-integrations-count)"
    - ".planning/PROJECT.md (inline trigger paragraph + Key Decisions row locked)"
    - "README.md (new ## Free while we grow section after Deploy block, line 69+)"
    - "docs/api-inventory.json (227 → 228 routes)"
    - "docs/api-inventory.md (227 → 228 routes)"
    - "public/downloads/dashclaw-platform-intelligence.zip + .manifest (livingcode auto-regen)"
    - "public/livingcode/* (livingcode auto-regen)"
decisions:
  - "MON-01 trigger locked: 50 verified Claude Code integrations in the wild, 90-day recency, org_default + org_demo excluded. Committed in 3 of 4 D-03 locations this plan (location 2, launch content, ships in Plan 03-02)."
  - "D-07 honored: requireTier returns 403 COMING_SOON with commitment text, NOT a buy-CTA. No /pro/* route tree created, no separate @dashclaw/pro npm package, no paywall UI."
  - "D-05/D-06 honored: /pricing renders all 5 Free bullets and all 4 Pro bullets, asserted by test (.toBe(5) / .toBe(4), not .toBeGreaterThanOrEqual)."
  - "A8 resolved: agent_id ILIKE 'claude-code%' grounded in hooks/dashclaw_pretool.py:75 default. Catches the default plus common overrides like 'claude-code-wes-laptop'."
  - "app/pricing/page uses .jsx extension (matches approvals/my-agent tested-page pattern) because vitest oxc parser refuses JSX in .js files on direct import (lesson from Plan 02-03, captured in MEMORY.md)."
  - "Counter number and '/ 50' rendered in a single span text-run so the rendered HTML contains the literal '/\\d+\\s*\\/\\s*50/' pattern the plan mandated. Brand orange applied only to the number via nested span — slash and target stay in ambient color."
metrics:
  duration_seconds: 600
  duration_human: "~10 minutes"
  tasks_completed: 3
  files_created: 10
  files_modified: 7
  tests_added: 22
  test_suite_result: "1727 passing, 5 skipped, 0 failed"
  completed_date: "2026-04-23"
---

# Phase 3 Plan 03: Pricing/Tier Monetization Summary

**One-liner:** Shipped MON-01 (public commitment to 50 verified Claude Code integrations in 3 of 4 D-03 locations — PROJECT.md, README.md, /pricing) + MON-02 (dormant `requireTier('pro')` Pro tier gate) with zero schema migration and zero paywall UI.

## Objective Achieved

Plan 03-03 delivers the monetization trigger commitment and the Pro-tier boundary architecture without shipping a paywall. The `organizations.plan` column already existed at `schema/schema.js:23` (default 'free'); `getOrgPlan()` already queried it; `PLAN_LIMITS.pro` already had values. This plan composed those three pre-existing pieces into a 15-line `requireTier` helper and a public live counter, then anchored the commitment in four public surfaces (three of four landed this plan; the fourth — launch content — is Plan 03-02).

## Tasks Executed

### Task 1: requireTier helper + Wave-0 test scaffolds (TDD)

- **Commit:** `1eb88c21` — `feat(03-03): add requireTier middleware helper + pro-gated fixture (MON-02)`
- Extended `app/lib/org.js` with `requireTier(request, minTier)` — returns null for pro orgs, 403 `COMING_SOON` for free orgs.
- Created `__tests__/fixtures/pro-gated-route-fixture.js` as a test-only callsite (NO Pro feature ships).
- Created `__tests__/unit/require-tier.test.js` — 7/7 tests passing covering:
  - Pro org → null
  - Free org → 403 with `code: 'COMING_SOON'`, reason contains `'50 verified'` + `'/pricing'`, `current_tier: 'free'`, `required_tier: 'pro'`
  - Null plan → default-deny (T-03-03-01 mitigation)
  - 'mystery-tier' → default-deny, raw value surfaced in current_tier
  - Negative regex: body contains NO buy/upgrade/subscribe/pay language (D-07)
  - Fixture non-regression: pro reaches handler body, free blocked with no body leak

### Task 2: Verified-integrations counter repository + public API route + PUBLIC_ROUTES

- **Commit:** `062d2d53` — `feat(03-03): verified-integrations counter API + repository (MON-01)`
- New `app/lib/repositories/monetization.repository.js` — `countVerifiedIntegrations(sql, options)` using `agent_id ILIKE 'claude-code%'`, `org_id <> ALL(excludeOrgIds)`, 90-day recency interval.
- New public `GET /api/monetization/verified-integrations-count` — returns `{ count, target: 50 }`. Fail-graceful: DB failure returns 200 with `{ count: null, target: 50, error: 'unavailable' }`.
- `middleware.js` PUBLIC_ROUTES extended with the new path (alphabetically between `/api/prompts` and `/practical-systems`). Still rate-limited by middleware.js:1092.
- Route file contains ZERO raw SQL — route-SQL guardrail held at 85 (below baseline 90).
- `docs/api-inventory.{json,md}` regenerated via `npm run api:inventory:generate` (227 → 228 routes). `openapi:generate` also re-ran but produced no diff (counter is not in critical-stable scope).
- 13/13 tests passing (8 repository + 5 route), with explicit negative assertions that response body contains no `org_id`, `agent_id`, or per-org keys (T-03-03-02).

### Task 3: /pricing page + PROJECT.md + README.md (D-03 four-location lock)

- **Commit:** `29717b1e` — `feat(03-03): /pricing commitment page + MON-01 trigger in PROJECT.md + README.md (MON-01)`
- New `app/pricing/page.jsx` — SSR page. Calls `countVerifiedIntegrations` server-side (no HTTP hop). Structure:
  - Hero: "DashClaw is free while we grow." + "There is nothing to buy on this page today."
  - Trigger commitment block: "Pro tier launches when DashClaw hits 50 verified Claude Code integrations in the wild." + the SQL measurement method inline.
  - Live counter: `<N> / 50` with brand orange on the number only.
  - Free-forever tier: all 5 D-05 bullets (Claude Code integration, Discord/Telegram approvals, /decisions ledger, semantic guard, /activity + /my-agent).
  - Pro tier: all 4 D-06 bullets (multi-user + SSO, custom policy pack, audit export + SOC 2, non-Claude-Code integrations).
  - Closing transparency paragraph linking to PROJECT.md + README.
- `.planning/PROJECT.md`: inline line 42 replaced `[ ] Define a monetization trigger` placeholder with `[x]` locked entry containing the full trigger text + SQL + flip path. Key Decisions row 81 flipped from `⚠️ Trigger pending` to `✓ Locked (2026-04-23, Plan 03-03)`.
- `README.md`: new `## Free while we grow` section inserted after the Deploy block (line 69), well past the first-50-line lead gate and outside lines 8/19 which Plan 03-01 Task 4 will edit for screencast URLs. Zero intra-wave merge collision.
- `scripts/check-readme-lead.mjs` still exits 0.
- 17/17 tests passing (9 pricing-page + 3 project-md + 5 readme).

## D-03 Four-Location Commitment Ledger

| # | Location | Status | Delivered by |
|---|----------|--------|--------------|
| 1 | `/pricing` page (rendered HTML) | ✓ Landed | Plan 03-03 Task 3 |
| 2 | Launch tweet + HN post | Pending | **Plan 03-02** (not this plan) |
| 3 | `.planning/PROJECT.md` | ✓ Landed | Plan 03-03 Task 3 |
| 4 | `README.md` (GitHub repo landing) | ✓ Landed | Plan 03-03 Task 3 |

## D-07 Flip-to-Paid Path (for the day MON-01 fires)

```sql
UPDATE organizations SET plan='pro' WHERE id='org_<customer>';
```

Zero code deploy. `requireTier('pro')` picks up the new tier on the next request because `getOrgPlan()` is not cached at the org-row level.

## Threat Mitigations Verified

| Threat | Mitigation | Verified by |
|--------|------------|-------------|
| T-03-03-01 (fail-open on unknown plan) | `TIER_RANK[currentTier] ?? 0` — unknown values never rank > 0 | `require-tier.test.js` Case 3 + 3b |
| T-03-03-02 (counter leaks per-org data) | Repository returns integer; route response shape asserted aggregate-only | `verified-integrations-count.route.test.js` Case 3 + 5 |
| T-03-03-03 (403 reads like buy-CTA) | Reason text contains `'Coming soon'` + `'50 verified'` + `'/pricing'`; explicit negative regex `/buy\|upgrade\|subscribe\|pay/i` | `require-tier.test.js` Case 4 |
| T-03-03-04 (x-org-id header injection) | Pre-existing middleware.js:1076 strip (inherited mitigation) | Inherited test coverage |
| T-03-03-05 (route-SQL bypass) | Route file contains ZERO raw SQL | `npm run route-sql:check` passes at 85 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] /pricing/page.js → page.jsx extension change**
- **Found during:** Task 3 GREEN phase
- **Issue:** Vitest's oxc parser (`Plugin: vite:oxc`) rejects JSX in `.js` files on direct import. The pricing-page test failed to transform the page file.
- **Fix:** Renamed `app/pricing/page.js` → `app/pricing/page.jsx`. Updated the test import accordingly. Matches the pattern used by other tested pages (`app/approvals/page.jsx`, `app/my-agent/page.jsx`).
- **Files modified:** `app/pricing/page.jsx` (new; nothing shipped with `.js`), `__tests__/unit/pricing-page.test.jsx`
- **Rationale:** Known project lesson from Plan 02-03 (recorded in `MEMORY.md` — "Factor pure helpers into sibling .js when page file bears JSX — vitest oxc parser refuses JSX in .js files on import"). Next.js App Router accepts both extensions; route resolution is unaffected.

**2. [Rule 3 — Blocking] Mock `PublicNavbar` + `PublicFooter` in pricing-page test**
- **Found during:** Task 3 GREEN phase
- **Issue:** `app/components/PublicNavbar.js` and `PublicFooter.js` contain JSX in `.js` files; the same oxc parser issue blocks transitive imports from the pricing test.
- **Fix:** Added `vi.mock('@/components/PublicNavbar')` and `vi.mock('@/components/PublicFooter')` stubs returning `() => null` in the pricing-page test — exact pattern from `__tests__/unit/approvals.page.test.jsx`.
- **Files modified:** `__tests__/unit/pricing-page.test.jsx`
- **Rationale:** The navbar/footer are UI chrome; the monetization surface under test is not affected by mocking them. This is idiomatic in the repo.

**3. [Rule 3 — Blocking] Counter rendering restructured for regex assertion**
- **Found during:** Task 3 GREEN phase
- **Issue:** The original page rendered the counter number and `/ 50` in two separate sibling `<span>` elements. The plan-mandated regex `/\d+\s*\/\s*50/` couldn't match because the sibling span boundary (`</span><span class="...">`) inserted non-whitespace characters between the number and the slash.
- **Fix:** Restructured so the number and `/ 50` are inside a single text run within one parent span, with the brand-orange nested span wrapping only the number itself. Rendered HTML now contains the literal `"<num> / 50"` text sequence.
- **Files modified:** `app/pricing/page.jsx`
- **Rationale:** Preserves the .impeccable.md "brand orange = signal, not wallpaper" principle (orange applies only to the number) while making the counter-format contract testable.

### Architectural Changes

None — no Rule 4 triggers. The plan was executable exactly as specified.

## Self-Check: PASSED

**Files created:**
- FOUND: app/lib/repositories/monetization.repository.js
- FOUND: app/api/monetization/verified-integrations-count/route.js
- FOUND: app/pricing/page.jsx
- FOUND: __tests__/fixtures/pro-gated-route-fixture.js
- FOUND: __tests__/unit/require-tier.test.js
- FOUND: __tests__/unit/monetization-repository.test.js
- FOUND: __tests__/unit/verified-integrations-count.route.test.js
- FOUND: __tests__/unit/pricing-page.test.jsx
- FOUND: __tests__/unit/project-md-content.test.js
- FOUND: __tests__/unit/readme-monetization-trigger.test.js

**Commits:**
- FOUND: 1eb88c21 (Task 1)
- FOUND: 062d2d53 (Task 2)
- FOUND: 29717b1e (Task 3)

**Guardrails verified:**
- `npm run route-sql:check` — total 85, baseline 90 — HELD
- `npm run openapi:check` — up to date
- `npm run api:inventory:check` — up to date (regenerated in Task 2)
- `npm run docs:check` — passed
- `node scripts/check-readme-lead.mjs` — OK (first 50 lines preserved)
- `npm test -- --run` — 1727 passing, 5 skipped, 0 failed

## TDD Gate Compliance

This plan did not declare `type: tdd` at the plan level, but each task ran TDD:
- Task 1: RED (failing requireTier test) → GREEN (helper added) — compliant
- Task 2: RED (failing repository + route tests) → GREEN (files created) — compliant
- Task 3: RED (failing page/PROJECT/README tests) → GREEN (surfaces written) — compliant

No combined `test(...)` commit was used; feat commits landed with their tests together (matches MON-01/MON-02 atomic deliverable shape). No warning required.
