---
phase: 02
slug: security-product-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.js |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SEC-02 | unit | `npm run test -- --run __tests__/unit/security-headers.test.js` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SEC-03 | unit | `npm run test -- --run __tests__/unit/ssrf-validation.test.js` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SEC-01, SEC-04 | unit | `npm run test -- --run __tests__/unit/prompt-injection-guard.test.js` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SEC-04 | unit | `npm run test -- --run __tests__/unit/cron-auth.test.js` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | PROD-01, PROD-02, PROD-03 | manual | Code path review + audit report | N/A | ⬜ pending |
| 02-03-01 | 03 | 2 | SEC-01-04 | unit | `npm run test -- --run __tests__/unit/security-*.test.js __tests__/unit/prompt-*.test.js __tests__/unit/ssrf-*.test.js __tests__/unit/cron-*.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/unit/security-headers.test.js` — HSTS header enforcement tests (SEC-02)
- [ ] `__tests__/unit/prompt-injection-guard.test.js` — Prompt injection guard integration tests (SEC-01)
- [ ] `__tests__/unit/cron-auth.test.js` — CRON_SECRET enforcement tests (SEC-04)
- [ ] `__tests__/unit/ssrf-validation.test.js` — IPv6 SSRF blocking tests (SEC-03)

*These files are created by Plan 02-03 (Wave 2).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UX narrative coherence across /connect → /mission-control → /decisions | PROD-02 | Requires human judgment on product story | Walk through as 3 personas, document in audit report |
| Free-tier viability ($0 deploy) | PROD-03 | Requires checking Vercel/Neon/Upstash pricing pages | Verify current free tier limits match documented values |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
