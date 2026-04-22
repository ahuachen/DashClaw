---
phase: 2
slug: claude-code-beachhead
status: draft
nyquist_compliant: true
wave_0_complete: true
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

*Populated during planning 2026-04-22 (revision iteration 1). One row per task across the 3 Phase-2 plans. Wave-0 test scaffolding creates the files that later rows import; those rows are marked `❌ W0` until the scaffolding lands in 02-02 Task 1 / 02-03 Task 1.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-02-T1 | 02-02 | 1 | CCI-03 | T-02-02-01, T-02-02-02, T-02-02-03, T-02-02-04 | RED-state tests assert Ed25519 verify rejects missing/invalid sig, replay-skew rejection, custom_id regex enforcement, user_id allowlist mismatch → 401. Also asserts `dashclaw_wait_for_approval` resolves within 2s of DB status flip (SPEC CCI-03 acceptance bullet 3). | unit (vitest, TDD RED) + existing-file edit | `npm test -- --run __tests__/unit/discord-interactions-route.test.js __tests__/unit/discord-approvals.test.js __tests__/unit/discord-embed-payload.test.js 2>&1 \| grep -E "FAIL\|Cannot find module" && echo "RED-STATE-CONFIRMED" && npm test -- --run __tests__/unit/mcp-tools.test.js -t "resolves within 2s"` | ✅ (this task creates 3 new files + edits mcp-tools.test.js) | ⬜ pending |
| 02-02-T2 | 02-02 | 1 | CCI-03 | T-02-02-01, T-02-02-02, T-02-02-03, T-02-02-04, T-02-02-05, T-02-02-07 | GREEN-state: route verifies signature pre-JSON.parse (Pitfall 1), timestamp-skew reject ≤300s, custom_id strict regex, user_id allowlist returns 401 (not 403), recordApproval atomic race-safe, no raw token/header log lines. sdk-parity.md no-op audit confirmed (webhook, not SDK method). | unit + integration (11 interactions tests + 7 approvals tests + 6 embed tests) | `npm test -- --run __tests__/unit/discord-interactions-route.test.js __tests__/unit/discord-approvals.test.js __tests__/unit/discord-embed-payload.test.js && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check && [ "$(grep -ic discord docs/sdk-parity.md)" = "0" ] && [ "$(grep -ic telegram docs/sdk-parity.md)" = "0" ] && echo "sdk-parity.md unchanged"` | ✅ (test files exist after T1; production files created here) | ⬜ pending |
| 02-02-T3 | 02-02 | 1 | CCI-03 | T-02-02-06 (accepted) | Full-suite regression gate + GitNexus change detection. Ensures the 02-02 diff does not regress `claude-code-starter-pack.test.js` (CCI-02) or `telegram-webhook-route.test.js` (parity bridge). | full-suite + static guardrails + gitnexus | `npm test && npm run lint && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check` | ✅ (tests exist; static gates exist) | ⬜ pending |
| 02-03-T1 | 02-03 | 1 | CCI-04 | T-02-03-03 (XSS scaffold) | RED-state tests declare expected day-grouping behavior (0/1/multi-day, counts, grammar, agent-filter invariance) and `/my-agent` render states (0-event, 1-event, 50+-event, filter propagation, denial pinning, realtime refresh). Tests MUST fail because `app/my-agent/page.js` + `groupEventsByDay` export don't exist yet. | unit + RTL (vitest, TDD RED) | `npm test -- --run __tests__/unit/activity-day-grouping.test.js __tests__/unit/my-agent-page.test.jsx 2>&1 \| grep -E "FAIL\|Cannot find module\|is not exported" && echo "RED-STATE-CONFIRMED"` | ✅ (this task creates both test files) | ⬜ pending |
| 02-03-T2 | 02-03 | 1 | CCI-04 | T-02-03-01 (cross-tenant inherit), T-02-03-03 (XSS via React default escaping), T-02-03-04 (accepted) | GREEN-state: `/activity` renders day-grouped headers via pure `useMemo`; `/my-agent` renders narrative hero + pinned denials + today/week toggle + install-prompt empty state; zero new API routes (D-13); no hardcoded hex (tiebreaker #4); no raw-HTML-injection React APIs used (T-02-03-03). | unit + RTL (14 test cases across 2 files) | `npm test -- --run __tests__/unit/activity-day-grouping.test.js __tests__/unit/my-agent-page.test.jsx` | ✅ (tests exist after T1; production files created here) | ⬜ pending |
| 02-03-T3 | 02-03 | 1 | CCI-05 | T-02-03-02 (docs secret-leak — placeholder only here; 02-01 T2 owns final scrub) | `/guides/claude-code` gains Discord 4-step Developer Portal section; README top-of-file leads with "Govern Claude Code in 5 minutes" + `/guides/claude-code` link + `<SCREENCAST_URL>` placeholder + D-17 GIF click-through wrapper (`<a href="<SCREENCAST_URL>"><img ...></a>`); `docs/homepage-draft-claude-code.md` ≥200 words; `scripts/check-readme-lead.mjs` asserts lead remains Claude-Code-forward. | static content checks (grep + wc + node script) | `node scripts/check-readme-lead.mjs && wc -w docs/homepage-draft-claude-code.md \| awk '{ if ($1 < 200) exit 1 }' && grep -q "Discord" app/guides/claude-code/page.js && grep -qE '<a href="<SCREENCAST_URL>">.*<img src="public/images/demo-gif2.gif"' README.md` | ✅ (check-readme-lead.mjs is created in this task) | ⬜ pending |
| 02-03-T4 | 02-03 | 1 | CCI-04, CCI-05 | — (regression gate only) | Full-suite regression gate + GitNexus detect. Verifies `/my-agent` + `/activity` + docs edits introduce no regression against the 1648-test baseline, including the 02-02 Discord tests (Wave 1 parallel). | full-suite + static guardrails + gitnexus | `npm test && npm run lint && npm run openapi:check && npm run api:inventory:check && npm run docs:check && node scripts/check-readme-lead.mjs` | ✅ (all upstream files exist) | ⬜ pending |
| 02-01-T1 | 02-01 | 2 | CCI-02 | — (regression gate) | Re-run full suite with the 02-02 + 02-03 diff landed. Asserts `claude-code-starter-pack.test.js` 9/9 still pass (CCI-02 gate), all 1648+ tests green, and the full static-guardrail set stays clean. Runs BEFORE the walkthrough so the walkthrough doesn't record a broken build. | full-suite + static guardrails + prerequisite SUMMARY existence checks | `ls .planning/phases/02-claude-code-beachhead/02-02-SUMMARY.md .planning/phases/02-claude-code-beachhead/02-03-SUMMARY.md && npm ci && npm test && npm run lint && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check && node scripts/check-readme-lead.mjs` | ✅ (all prerequisite files exist by Wave 1 close) | ⬜ pending |
| 02-01-T2 | 02-01 | 2 | CCI-01, CCI-03 (manual sub-criterion), CCI-05 (recording artifact) | T-02-01-01 (secret-in-recording), T-02-01-02 (phone lock-screen bystander), T-02-01-03 (public URL resolves), T-02-01-04, T-02-01-05 (accepted) | Human-gated checkpoint. Claude completes 6 pre-flight items (CI green check, env-var presence confirmation, throwaway workspace prep, walkthrough script draft, recording-tool readiness, last-mile `npm install && npm run dev` smoke). Operator records on Windows/WSL: ≤5:00 wall clock from `git clone` to first Discord approval; phone-to-resolution observed in-frame for CCI-03 manual ≤10s bullet; frame-by-frame secret scrub; recording artifact stored at `.mp4` path OR Loom/YouTube URL captured in SUMMARY. | checkpoint:human-action | `test -f .planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md && (grep -qE "walkthrough.*\.mp4\|loom\.com\|youtube\.com" .planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md \|\| grep -q "CCI-01 deferred" .planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md)` | ✅ (SUMMARY gets written as part of this checkpoint resume) | ⬜ pending |
| 02-01-T3 | 02-01 | 2 | CCI-05 | T-02-01-03 (public URL accessibility re-verified after backfill) | Backfill `<SCREENCAST_URL>` placeholder in both `README.md` and `app/guides/claude-code/page.js`. Assert: zero remaining placeholders, ≥1 Loom/YouTube match per file, URL resolves (HTTP 200 in incognito), README-lead gate still green, full suite still green after content edit. | content-check + curl + full suite | `! grep -rn "<SCREENCAST_URL>" README.md app/guides/claude-code/page.js && node scripts/check-readme-lead.mjs && npm test && npm run lint` | ✅ (upstream files exist; `<SCREENCAST_URL>` placeholder verified in place during 02-03 T3) | ⬜ pending |

*Legend — `❌ W0`: test file does not yet exist; depends on the same-plan Wave 0 task creating it. `✅`: prerequisite files exist at the point this task runs. `⬜ pending`: task hasn't been executed yet. Rows flip to `✅ passed` / `❌ failed` during `/gsd-execute-phase`.*

---

## Wave 0 Requirements

Per RESEARCH.md §Validation Architecture, the following scaffolding is needed before any plan tasks can verify:

- [x] `__tests__/unit/discord-interactions-route.test.js` — Vitest test scaffold for signature verification + interaction handler (mirrors `__tests__/unit/telegram-webhook-route.test.js` structure) → created in 02-02 Task 1
- [x] `__tests__/unit/discord-approvals.test.js` — outbound emitter fire-and-forget tests → created in 02-02 Task 1
- [x] `__tests__/unit/discord-embed-payload.test.js` — pure-function embed shape tests → created in 02-02 Task 1
- [x] `__tests__/unit/mcp-tools.test.js` — EXISTING file; gains one new `it("resolves within 2s...")` case inside the `dashclaw_wait_for_approval` describe block (SPEC CCI-03 acceptance bullet 3, added in 02-02 Task 1 per revision iteration 1)
- [x] `__tests__/unit/my-agent-page.test.jsx` — React Testing Library scaffold for `/my-agent` render states (0-event, 1-event, 50+-event) → created in 02-03 Task 1
- [x] `__tests__/unit/activity-day-grouping.test.js` — Pure-function test scaffold for `groupEventsByDay` + `summarizeDay` → created in 02-03 Task 1
- [x] `scripts/check-readme-lead.mjs` — CI script asserting README first 50 lines remain Claude-Code-forward → created in 02-03 Task 3

No manual walkthrough automation needed — CCI-01 is explicitly a human-gated checkpoint in 02-01 Task 2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CCI-01 ≤5:00 walkthrough | CCI-01 | Timed recorded walkthrough on fresh Windows/WSL — impossible to automate credibly without a full VM harness | Clean Claude Code workspace; record screen from `git clone` through first Discord approval; store as `.planning/phases/02-claude-code-beachhead/cci-01-walkthrough.mp4` (or Loom link). See 02-01 Task 2. |
| CCI-03 phone-to-resolution ≤10s median | CCI-03 | Real mobile Discord client round-trip; mocked tests cover the server side AND the MCP 2s poll boundary, but not the phone-tap latency | Wes taps Approve/Deny on phone; in-frame timestamp delta measured during the CCI-01 walkthrough; 1 sample (beachhead only), target ≤10s. See 02-01 Task 2. |
| CCI-05 screencast ≤3min | CCI-05 | Video artifact | Record ≤3-minute Claude Code integration walkthrough; publish as Loom unlisted or YouTube unlisted; link embedded in `/guides/claude-code` and `README.md` (GIF click-through wrapper per D-17). Backfill handled by 02-01 Task 3. |

*Note: CCI-03 acceptance bullet 3 (`dashclaw_wait_for_approval` resolves within 2s of status change) is AUTOMATED, not manual — the new test case in `__tests__/unit/mcp-tools.test.js` covers it. Only the phone-tap round-trip remains manual.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 2026-04-22
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (02-01 T2 is the sole human-action task; T1 and T3 flanking it are automated full-suite runs) — 2026-04-22
- [x] Wave 0 covers all MISSING references (3 new Discord test files, 2 new activity/my-agent test files, 1 edit to existing mcp-tools.test.js, 1 new check-readme-lead.mjs script) — 2026-04-22
- [x] No watch-mode flags (all commands use `npm test -- --run` or `npm test` non-watch) — 2026-04-22
- [x] Feedback latency < 10s per-file, < 180s full suite — 2026-04-22
- [x] `nyquist_compliant: true` set in frontmatter — 2026-04-22

**Approval:** populated 2026-04-22 during planning (revision iteration 1). All 10 tasks across 3 plans covered, Wave 0 scaffolding enumerated, CCI-03 ≤2s automated bullet mapped to `__tests__/unit/mcp-tools.test.js`.
