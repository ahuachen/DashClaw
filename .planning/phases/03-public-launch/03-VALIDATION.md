---
phase: 3
slug: public-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
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
| **Full suite command** | `npm test` (1690+ tests; CI-parity) |
| **Estimated runtime** | ~180 seconds full suite; ~5-10 seconds per focused file |

Per feedback memory `feedback_full_test_suite_in_plan_verification.md`: plan-level verification MUST run `npm test` (not a targeted pattern).

---

## Sampling Rate

- **After every task commit:** `npm test -- --run <task-specific-file>` for fast feedback
- **After every plan wave:** `npm test` full suite
- **Before `/gsd-verify-work`:** full suite + `npm run openapi:check` + `npm run api:inventory:check` + `npm run route-sql:check` + `npm run docs:check`
- **Max feedback latency:** 10 seconds per-file, 180 seconds full suite

---

## Per-Task Verification Map

*Populated during planning. One row per task across the 3 Phase-3 plans. Wave-0 test scaffolding rows marked `❌ W0` until scaffolding lands.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD during planning* | | | | | | | | | |

---

## Wave 0 Requirements

Per RESEARCH.md §Validation Architecture, the following scaffolding is needed before any plan tasks can verify:

- [ ] `__tests__/unit/homepage-hero.test.jsx` — RTL scaffold: hero headline pattern match; rejected framings absent (negative assertions on "homelab", "enterprise", "compliance", "any agent framework"); CTA order verification
- [ ] `__tests__/unit/connect-runbook.test.jsx` — RTL scaffold: single-page runbook structure; no multi-step wizard state machine; workspace token auto-gen present
- [ ] `__tests__/unit/pricing-page.test.jsx` — RTL scaffold: monetization trigger text present; free-forever semantic-guard callout; Pro tier features listed
- [ ] `__tests__/unit/require-tier-middleware.test.js` — Vitest scaffold: tier-check returns 403 with "coming soon" messaging (not buy-CTA); admin-gate still works alongside
- [ ] `__tests__/unit/readme-content.test.js` — static content assertion: `<SCREENCAST_URL>` placeholders replaced; monetization trigger paragraph present
- [ ] `__tests__/unit/project-md-content.test.js` — static content assertion: MON-01 trigger commitment present in canonical location

*If project blog lives in this monorepo (A1 resolution pending): blog post content assertion test. If in a sibling repo: excluded from this phase's test coverage, validated manually.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DOG-02 ≤3:00 flagship demo video | DOG-02 | Video artifact + post-record frame scrub; Loom/YouTube publish verification | Record per Phase 2 02-01-SUMMARY §5 runbook; scrub for secrets; publish Loom "public" or YouTube Unlisted; verify URL loads in incognito without captcha |
| DOG-04 HN post live + tweet thread | DOG-04 | Submitting to HN / X is human-gated (Tue-Thu 8-11am ET window) | Post Show HN with final homepage URL; confirm appears in New queue; post tweet thread; verify all 4 content pieces live within 2-hour window |
| Visual design check against .impeccable.md | DOG-03 | Visual judgment calls (hero weight, section rhythm, token compliance) | Designer/founder review: hero feels terse-technical; no orange decoration; CSS tokens only; WCAG AA contrast |
| MON-01 counter accuracy | MON-01 | Requires real dogfood data to verify counter SQL matches intent | Verify `N / 50` count on `/pricing` matches expected count given current `agents` + `action_records` data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (must be `--run` / non-watch)
- [ ] Feedback latency < 10s per-file, < 180s full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (populated during planning when per-task map is filled)
