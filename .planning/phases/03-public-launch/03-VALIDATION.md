---
phase: 3
slug: public-launch
status: planning-complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-22
populated: 2026-04-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (JS/TS) |
| **Config file** | `vitest.config.js` at repo root |
| **Quick run command** | `npm test -- --run <pattern>` |
| **Full suite command** | `npm test -- --run` (1690+ tests + Phase 3 new scaffolds; CI-parity; NOT watch mode) |
| **Estimated runtime** | ~180 seconds full suite; ~5-10 seconds per focused file |

Per feedback memory `feedback_full_test_suite_in_plan_verification.md`: plan-level verification MUST run `npm test -- --run` (not a targeted pattern).

**Critical:** `"test": "vitest"` runs watch mode by default. All per-task and plan-level verify commands use `-- --run` explicitly to ensure non-watch execution.

---

## Sampling Rate

- **After every task commit:** `npm test -- --run <task-specific-file>` for fast feedback (≤10 sec)
- **After every plan wave:** `npm test -- --run` full suite (~180 sec)
- **Before `/gsd-verify-work`:** full suite + `npm run openapi:check` + `npm run api:inventory:check` + `npm run route-sql:check` + `npm run docs:check` + `node scripts/check-readme-lead.mjs` + `node scripts/check-screencast-backfilled.mjs` (new Plan 03-01) + `node scripts/check-launch-content.mjs` (new Plan 03-02)
- **Max feedback latency:** 10 seconds per-file, 180 seconds full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 03-01 | 1 | DOG-02, DOG-03 | T-03-01-01, T-03-01-04 | CSP frame-src added; VideoHero allowlist enforced | unit + script | `npm test -- --run __tests__/unit/video-hero.test.jsx` | ❌ W0 — created in task | Planned |
| 03-01-T2 | 03-01 | 1 | DOG-03 | T-03-01-03 | Rejected framings absent; single-page runbook; Claude-Code-first hero | unit RTL | `npm test -- --run __tests__/unit/homepage-hero __tests__/unit/homepage-rejected-framings __tests__/unit/connect-runbook && node scripts/check-readme-lead.mjs` | ❌ W0 — created in T1 | Planned |
| 03-01-T3 | 03-01 | 1 | DOG-02 | T-03-01-05 | Video recorded + published + incognito-verified | human-action | manual (Wes records + publishes + incognito-verifies) | n/a — human | Planned (checkpoint) |
| 03-01-T4 | 03-01 | 1 | DOG-02, CCI-05 | T-03-01-01, T-03-01-02, T-03-01-06 | 4 placeholders backfilled (both raw + HTML-entity forms); full suite green; manual incognito re-verify | script + full suite | `node scripts/check-screencast-backfilled.mjs && node scripts/check-readme-lead.mjs && npm test -- --run` | Script created in T1 | Planned |
| 03-03-T1 | 03-03 | 1 | MON-02 | T-03-03-01, T-03-03-04 | requireTier 403 COMING_SOON; no buy-CTA; default-deny on unknown plan | unit | `npm test -- --run __tests__/unit/require-tier.test.js` | ❌ W0 — created in task | Planned |
| 03-03-T2 | 03-03 | 1 | MON-01 | T-03-03-02, T-03-03-05 | Counter returns aggregate only (no per-org data); repository pattern held | unit + script | `npm test -- --run __tests__/unit/monetization-repository __tests__/unit/verified-integrations-count && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check` | ❌ W0 — created in task | Planned |
| 03-03-T3 | 03-03 | 1 | MON-01 | T-03-03-02, T-03-03-03 | /pricing commitment present; NO paywall language; PROJECT.md + README.md trigger committed; README lead preserved | unit + script + full suite | `npm test -- --run __tests__/unit/pricing-page __tests__/unit/project-md-content __tests__/unit/readme-monetization-trigger && node scripts/check-readme-lead.mjs && npm test -- --run` | ❌ W0 — created in task | Planned |
| 03-02-T1 | 03-02 | 2 | DOG-04 | T-03-02-01 | HN title ≤80 chars; first tweet is concrete problem; all 3 drafts have trigger commitment; no secret leak | unit + script | `npm test -- --run __tests__/unit/launch-content-assertions.test.js && node scripts/check-launch-content.mjs` | ❌ W0 — created in task | Planned |
| 03-02-T2 | 03-02 | 2 | DOG-04 | T-03-02-05 | Blog post live, VideoHero embed with real URL, ≥5 H2 sections, 600-1200 words, founder-voice | unit RTL + full suite | `npm test -- --run __tests__/unit/blog-post-claude-code-beachhead.test.jsx && npm test -- --run` | ❌ W0 — created in task | Planned |
| 03-02-T3 | 03-02 | 2 | DOG-04 | T-03-02-03, T-03-02-04 | Discord alert fires on first per-org action; payload contains no secrets; webhook failure doesn't break action creation | unit + route-sql | `npm test -- --run __tests__/unit/connect-complete-discord-alert.test.js && npm run route-sql:check && npm test -- --run` | ❌ W0 — created in task | Planned |
| 03-02-T4 | 03-02 | 2 | DOG-04 | T-03-02-02 | Launch blitz: HN + tweet + blog live within 2-hour window; pre-launch curl gates all 200 | human-action + curl | `curl -sI https://dashclaw.io && curl -sI https://dashclaw.io/blog/claude-code-beachhead && curl -sI https://dashclaw.io/pricing && curl -sI https://dashclaw.io/connect` (all return 200 before HN submission) | n/a — human | Planned (checkpoint) |

**Sampling continuity check:** 8 automated tasks + 2 human-action checkpoints = 10 tasks total. No 3 consecutive tasks without automated verify (the two checkpoints — 03-01-T3 and 03-02-T4 — are separated by 6 automated tasks). PASS.

---

## Wave 0 Requirements — Coverage

Per RESEARCH.md §Validation Architecture, the following scaffolding is needed. ✅ means assigned to a specific plan task. Every item is covered:

- [x] `__tests__/unit/homepage-hero.test.jsx` — Plan 03-01 Task 1 creates (DOG-03 hero presence)
- [x] `__tests__/unit/homepage-rejected-framings.test.jsx` — Plan 03-01 Task 1 creates (DOG-03 negative assertions)
- [x] `__tests__/unit/connect-runbook.test.jsx` — Plan 03-01 Task 1 creates (DOG-03 single-page runbook — renamed from connect-page.test.jsx per VALIDATION.md)
- [x] `__tests__/unit/video-hero.test.jsx` — Plan 03-01 Task 1 creates (VideoHero host allowlist)
- [x] `__tests__/unit/require-tier-middleware.test.js` — Plan 03-03 Task 1 creates as `require-tier.test.js` (consistent with keys.route.test.js naming)
- [x] `__tests__/unit/monetization-repository.test.js` — Plan 03-03 Task 2 creates (counter SQL cases)
- [x] `__tests__/unit/verified-integrations-count.route.test.js` — Plan 03-03 Task 2 creates (route shape + PII absence)
- [x] `__tests__/unit/pricing-page.test.jsx` — Plan 03-03 Task 3 creates (commitment text + counter + no paywall)
- [x] `__tests__/unit/project-md-content.test.js` — Plan 03-03 Task 3 creates (MON-01 location 3)
- [x] `__tests__/unit/readme-monetization-trigger.test.js` — Plan 03-03 Task 3 creates (MON-01 location 4; lead preserved)
- [x] `__tests__/unit/blog-post-claude-code-beachhead.test.jsx` — Plan 03-02 Task 2 creates (blog post structure + voice + embed)
- [x] `__tests__/unit/launch-content-assertions.test.js` — Plan 03-02 Task 1 creates (HN title + tweet shape + blog length)
- [x] `__tests__/unit/connect-complete-discord-alert.test.js` — Plan 03-02 Task 3 creates (webhook behavior + fire-and-forget)
- [x] `scripts/check-screencast-backfilled.mjs` — Plan 03-01 Task 1 creates (raw + HTML-entity forms)
- [x] `scripts/check-launch-content.mjs` — Plan 03-02 Task 1 creates (launch-day go/no-go gate)
- [x] `__tests__/fixtures/pro-gated-route-fixture.js` — Plan 03-03 Task 1 creates (requireTier callsite for regression coverage)

**Blog post (A1 resolved — monorepo):** blog-post-claude-code-beachhead.test.jsx test IS in this phase's coverage (blog-in-monorepo outcome, not manual-only fallback).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Owning Task |
|----------|-------------|------------|-------------------|-------------|
| DOG-02 ≤3:00 flagship demo video | DOG-02 | Video artifact + post-record frame scrub; Loom/YouTube publish verification | Record per Phase 2 02-01-SUMMARY §5 runbook; scrub for secrets; publish Loom "public" or YouTube Unlisted; verify URL loads in incognito without captcha | 03-01 Task 3 |
| Homepage + video + /pricing + /connect live on dashclaw.io | DOG-02, DOG-03, MON-01 | Requires production deployment + visual + mobile hotspot incognito | curl HTTP 200 smoke tests + Wes visual incognito verify | 03-01 Task 4 step 7 + 03-02 Task 4 PRE-LAUNCH GATE |
| DOG-04 HN post live + tweet thread | DOG-04 | Submitting to HN / X is human-gated (Tue-Thu 8-11am ET window) | Post Show HN with final homepage URL; confirm appears in New queue; post tweet thread; verify all 4 content pieces live within 2-hour window | 03-02 Task 4 |
| HN reply cadence (30 min in peak window) | DOG-04 D-19 | Requires real-time human replies | Wes replies to every top-level comment within 30 min first 2 hours | 03-02 Task 4 |
| Visual design check against .impeccable.md | DOG-03 | Visual judgment calls (hero weight, section rhythm, token compliance) | Founder review: hero feels terse-technical; no orange decoration except on /pricing counter number; CSS tokens only; WCAG AA contrast | 03-01 Task 4 + 03-03 Task 3 |
| MON-01 counter accuracy | MON-01 | Requires real dogfood data to verify counter SQL matches intent | Verify `N / 50` count on `/pricing` matches expected count given current `agents` + `action_records` data (A8 resolved: `agent_id ILIKE 'claude-code%'` excluding org_default + org_demo) | 03-03 Task 3 + verified at 03-02 Task 4 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (2 human-action checkpoints have explicit resume-signal criteria)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (2 human checkpoints separated by 6 automated tasks)
- [x] Wave 0 covers all MISSING references (16 items — all assigned to specific plan tasks)
- [x] No watch-mode flags (all verify commands use `-- --run`)
- [x] Feedback latency < 10s per-file, < 180s full suite
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (scaffolds created as part of Task 1 of each plan — RED first, GREEN by plan end)

**Approval:** populated and ready for execution (2026-04-22).
