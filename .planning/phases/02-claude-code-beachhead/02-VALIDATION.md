---
phase: 2
slug: claude-code-beachhead
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x (JS/TS) + existing Python unittest for `hooks/tests/` |
| **Config file** | `vitest.config.js` at repo root |
| **Quick run command** | `npm test -- --run <pattern>` (per-file) |
| **Full suite command** | `npm test` (1648+ tests; runs CI-parity) |
| **Estimated runtime** | ~180 seconds full suite; ~5-10 seconds per focused file |

Per feedback memory `feedback_full_test_suite_in_plan_verification.md`: plan-level verification MUST run `npm test` (not a targeted pattern). Targeted runs miss regressions in unrelated files.

---

## Sampling Rate

- **After every task commit:** Run focused `npm test -- --run <task-specific-file>` for fast feedback
- **After every plan wave:** Run full `npm test` suite
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run openapi:check` + `npm run api:inventory:check` + `npm run route-sql:check`
- **Max feedback latency:** 10 seconds per-file, 180 seconds full suite

---

## Per-Task Verification Map

*Populated during planning. Each plan task gets a row. Wave 0 (test scaffolding) rows are flagged with ❌ W0 until the scaffolding lands.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *TBD during planning* | | | | | | | | | |

---

## Wave 0 Requirements

Per RESEARCH.md §Validation Architecture, the following scaffolding is needed before any plan tasks can verify:

- [ ] `__tests__/unit/discord-interactions-route.test.js` — Vitest test scaffold for signature verification + interaction handler (mirrors `__tests__/unit/telegram-webhook-route.test.js` structure)
- [ ] `__tests__/unit/my-agent-page.test.jsx` — React Testing Library scaffold for `/my-agent` render states (0-event, 1-event, 50+-event)
- [ ] `__tests__/unit/activity-day-grouping.test.js` — Pure-function test scaffold for `groupEventsByDay` + `summarizeDay`
- [ ] Optional: `hooks/tests/test_claude_code_walkthrough.py` — only if the walkthrough is automated; likely manual per SPEC

*If all test files already exist (per RESEARCH §Validation Architecture): "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CCI-01 ≤5:00 walkthrough | CCI-01 | Timed recorded walkthrough on fresh Windows/WSL — impossible to automate credibly without a full VM harness | Clean Claude Code workspace; record screen from `git clone` through first Discord approval; store as `.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4` (or Loom link) |
| CCI-03 phone-to-resolution ≤10s median | CCI-03 | Real mobile Discord client round-trip; mocked tests cover the server side, not the phone-tap latency | Wes taps Approve/Deny on phone; instrumented DB timestamp comparison vs. interaction receipt; 10 samples, median ≤10s |
| CCI-05 screencast ≤3min | CCI-05 | Video artifact | Record ≤3-minute Claude Code integration walkthrough; publish as Loom unlisted or YouTube unlisted; link embedded in `/guides/claude-code` and `README.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (must be `--run` / non-watch)
- [ ] Feedback latency < 10s per-file, < 180s full suite
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (populated during planning when per-task map is filled)
