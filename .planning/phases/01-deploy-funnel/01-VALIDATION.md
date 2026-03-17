---
phase: 1
slug: deploy-funnel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npx vitest run __tests__/unit/readiness.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run __tests__/unit/readiness.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DEPLOY-02 | manual | Manual JSON review | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | DEPLOY-01 | unit | `npx vitest run __tests__/unit/deploy-button.test.js` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | DEPLOY-03 | manual | Manual review | N/A | ⬜ pending |
| 01-03-01 | 03 | 1 | DEPLOY-04 | unit | `npx vitest run __tests__/unit/readiness.test.js` | ✅ | ⬜ pending |
| 01-03-02 | 03 | 1 | DEPLOY-04 | unit | `npx vitest run __tests__/unit/readiness.test.js` | ✅ | ⬜ pending |
| 01-03-03 | 03 | 1 | DEPLOY-04 | unit | `npx vitest run __tests__/unit/readiness.test.js` | ✅ | ⬜ pending |
| 01-03-04 | 03 | 1 | DEPLOY-04 | unit | `npx vitest run __tests__/unit/readiness.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/unit/deploy-button.test.js` — stubs for DEPLOY-01 URL parameter validation
- [ ] Extend `__tests__/unit/readiness.test.js` with DEPLOY-04a through DEPLOY-04e test cases (NEXTAUTH_URL mismatch, realtime backend, CRON_SECRET)

*DEPLOY-04f (schema status) already covered by existing tests. DEPLOY-02/03 are manual review.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| vercel.json contains framework, buildCommand, crons | DEPLOY-02 | Pure config file — no logic to test | Inspect `vercel.json` for required keys |
| README contains deploy badge above fold + 3-step checklist | DEPLOY-03 | Content/layout review | Read README.md, verify badge and checklist are present |
| Deploy button opens Vercel with correct env vars | DEPLOY-01 | End-to-end browser verification | Click deploy button URL, verify 7 env var fields shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
