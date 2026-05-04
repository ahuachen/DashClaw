---
phase: 02-claude-code-beachhead
plan: 01
subsystem: walkthrough-and-regression
tags: [walkthrough, screencast, cci-01, cci-02, cci-05, no-regression, human-gated, deferred-close]

# Dependency graph
requires:
  - phase: 02-claude-code-beachhead
    provides: claude-code-starter policy pack + PreToolUse hook (02 foundation), Discord approval bridge (02-02), /my-agent narrative + /guides/claude-code Discord Portal walkthrough + README Claude-Code-first lead + <SCREENCAST_URL> placeholders (02-03)
provides:
  - CCI-02 no-regression gate verification at `d3e96819` (post-Phase-2 full-diff HEAD)
  - Phase 2 close-out with two explicit open gaps (CCI-01 walkthrough recording + CCI-05 screencast URL backfill)
affects: [CCI-01, CCI-02, CCI-05, Phase-2-close, Phase-3-launch]

# Tech tracking
tech-stack:
  added: []  # Zero new dependencies — verification + docs only
  patterns: []

key-files:
  created:
    - .planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md (this file)
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Operator deferred the walkthrough recording and screencast URL backfill at Task 2's human-action checkpoint with the resume-signal `skip recording for now, ship placeholder`. Plan 02-01 closes with CCI-02 held, CCI-01 and CCI-05 URL backfill recorded as open gaps — not silently skipped."
  - "CCI-02 no-regression gate verified read-only against `d3e96819` (current main, CI run 24803439808 green). No commit — Task 1 is verification-only per plan."
  - "Four `<SCREENCAST_URL>` placeholders left intact (2 in README.md at lines 8 and 19; 2 in app/guides/claude-code/page.js at lines 104 and 249 — one of them HTML-entity-encoded as `&lt;SCREENCAST_URL&gt;`). Will be backfilled when walkthrough is eventually recorded."
  - "Phase 2 beachhead ships functionally complete (hook + policy pack + Discord approval + activity timeline + /my-agent + Claude-Code-first docs) but without the evidence artifact (walkthrough video). The recipe for recording is preserved inline in the PLAN.md for when the operator returns to close the gap."

patterns-established: []

requirements-completed: [CCI-02]
requirements-partial: [CCI-01, CCI-05]

# Metrics
duration: 15min
completed: 2026-04-22
---

# Phase 02 Plan 01: Walkthrough + Regression Gate Summary (Deferred Close)

**CCI-02 no-regression gate held at `d3e96819` (1690 pass / 5 skip / 0 fail full suite, 9/9 claude-code-starter-pack tests). CCI-01 walkthrough recording and CCI-05 screencast URL backfill explicitly deferred at Task 2 human-action checkpoint per operator resume-signal `skip recording for now, ship placeholder`. Phase 2 closes with two recorded open gaps, not silently skipped.**

## Close State At A Glance

| Acceptance Criterion | Status | Evidence |
|---|---|---|
| CCI-02 no-regression gate | PASSED | Task 1 full-suite + static guardrails green on `d3e96819` (see below) |
| CCI-01 walkthrough artifact | DEFERRED | Operator resume-signal; no `cci-01-walkthrough.mp4` exists; no Loom/YouTube URL captured |
| CCI-05 screencast URL backfill | DEFERRED | 4 `<SCREENCAST_URL>` placeholders remain in README.md (2) + app/guides/claude-code/page.js (2) |
| CCI-03 manual sub-criterion (≤10s phone-to-resolution) | NOT MEASURED | Requires the deferred walkthrough to observe |
| README Claude-Code-first lead intact | PASSED | `scripts/check-readme-lead.mjs` exit 0 |
| Full suite green with Phase 2 diff | PASSED | 1690 pass / 5 skip / 0 fail |

## 1. CCI-02 No-Regression Gate — PASSED

Task 1 read-only verification (no commit per plan, which designates Task 1 as verification-only) at HEAD `d3e96819` (current main, after `fix(session): detect HTTPS cookie in getViewerContextFromCookieHeader`, CI run 24803439808 green):

| Gate | Command | Result |
|---|---|---|
| Deterministic install | `npm ci` | 731 packages resolved deterministically |
| Full test suite | `npm test` | 1690 pass / 5 skip / 0 fail — exact parity with 02-03 baseline, zero regression |
| Starter policy pack | `__tests__/unit/claude-code-starter-pack.test.js` | 9/9 pass — CCI-02 gate held |
| Lint | `npm run lint` | clean |
| Route SQL guardrail | `npm run route-sql:check` | 85 direct SQL sites (baseline 90) |
| OpenAPI drift | `npm run openapi:check` | up to date |
| API inventory drift | `npm run api:inventory:check` | up to date |
| Docs drift | `npm run docs:check` | passed |
| README lead integrity | `node scripts/check-readme-lead.mjs` | exit 0 |
| Working tree | `git status` | clean |

**CCI-02 held at Phase 2 close.** The `claude-code-starter` policy pack shipped at the start of Phase 2 (`__tests__/unit/claude-code-starter-pack.test.js`) has not regressed across the subsequent Discord approval (02-02) and activity-timeline + docs (02-03) work.

## 2. CCI-01 Walkthrough — DEFERRED

**Status:** Not recorded this cycle. Operator deferred at Task 2's human-action checkpoint with explicit resume-signal `skip recording for now, ship placeholder`.

**Why deferred** (surfaced by Task 2 pre-flight, items 1 and 2):
- `.env.local` on the dogfood machine has **zero `DISCORD_*` entries** — the 5 env vars (`DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPROVER_USER_ID`, `DISCORD_APPROVER_ORG_ID`, `DASHCLAW_ALERTS_DISCORD`) are documented in `.env.example` and the `/guides/claude-code` page, but not yet populated on the recording-target machine.
- Recording a walkthrough that terminates at "Discord DM never arrived because the bot isn't registered" would document a broken path, not the 5-minute aha moment the requirement targets.

**Pre-flight results captured by Task 2 (6/6):**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Latest `main` CI green | PASS | Run 24803439808 on `d3e96819` |
| 2 | Discord env vars present in `.env.local` | OPERATOR-SIDE GAP | Zero `DISCORD_*` lines — must be populated before recording |
| 3 | Throwaway workspace prep | OPERATOR-SIDE ONLY | Cannot be automated |
| 4 | Walkthrough script draft | PASS | 9-step recipe drafted inline in the PLAN.md Task 2 `<what-built>` block and delivered to operator |
| 5 | Recording tool readiness | OPERATOR-SIDE ONLY | Cannot be automated |
| 6 | `npm install && npm run dev` smoke from main | PASS | Dev boots in 385ms; GET `/` → 200, `/guides/claude-code` → 200, `/my-agent` → 200, `/activity` → 307 (expected auth redirect) |

**Preconditions to close CCI-01:**
1. Register Discord bot application at https://discord.com/developers/applications (enable Bot; invite to a mutual test server with no privileged intents).
2. Set Interactions Endpoint URL to `https://<deployment>/api/discord/interactions` in the Developer Portal → General Information. Wait for the green "SAVED" confirmation (Discord runs a PING handshake on save).
3. Populate the 5 `DISCORD_*` vars in `.env.local` using the exact names from `.env.example`.
4. Record ≤5-minute walkthrough on Windows/WSL per the recipe embedded in `02-01-PLAN.md` Task 2 `<what-built>` block. The recipe is 9 segments, all commands copy-paste ready.
5. Publish recording to Loom (public) or YouTube Unlisted.
6. Verify the URL resolves in an incognito browser (no captcha, no workspace-only auth wall — see threat T-02-01-03).
7. Backfill the 4 `<SCREENCAST_URL>` placeholders (see section 3 below).

## 3. CCI-05 Screencast URL Backfill — DEFERRED

**Status:** Placeholders remain literal. Task 3 (URL backfill) was skipped per the plan's resume-signal handling for `skip recording for now, ship placeholder`.

**Exact placeholder locations:**

| File | Line | Form | Context |
|---|---|---|---|
| `README.md` | 8 | `<SCREENCAST_URL>` | `href` on the anchor wrapping `public/images/demo-gif2.gif` (D-17 click-through pattern) |
| `README.md` | 19 | `<SCREENCAST_URL>` | "Watch the 3-min walkthrough →" text link |
| `app/guides/claude-code/page.js` | 104 | `<SCREENCAST_URL>` | Step 1 "Watch the 3-minute walkthrough" note text |
| `app/guides/claude-code/page.js` | 249 | `&lt;SCREENCAST_URL&gt;` | Dedicated "Watch the 3-minute walkthrough" section body (JSX-entity-encoded form) |

**Important:** The fourth placeholder is **HTML-entity-encoded** (`&lt;SCREENCAST_URL&gt;`). A naive `grep -r "<SCREENCAST_URL>"` on the whole repo will miss it. Backfill must explicitly replace both the raw and entity-encoded forms.

**Backfill procedure when walkthrough is recorded** (mirrors PLAN.md Task 3 action block):

```bash
# 1. Enumerate — expect exactly 4 matches (3 raw + 1 entity-encoded)
grep -n "<SCREENCAST_URL>" README.md app/guides/claude-code/page.js
grep -n "&lt;SCREENCAST_URL&gt;" app/guides/claude-code/page.js

# 2. Replace all 4 with the real public URL
# 3. Verify zero matches remain
grep -rn "<SCREENCAST_URL>\|&lt;SCREENCAST_URL&gt;" README.md app/guides/claude-code/page.js

# 4. Verify URL resolves publicly
curl -sI "$SCREENCAST_URL" | head -1   # expect HTTP/2 200 (Loom) or 200 (YouTube)

# 5. Re-run README-lead gate + full suite
node scripts/check-readme-lead.mjs
npm test
npm run lint

# 6. Commit
git commit -m "docs(02): backfill CCI-05 screencast URL after walkthrough recording"
```

**Closure path:** A standalone single-commit backfill, or an invocation of `/gsd-plan-milestone-gaps` that emits a tiny CCI-01/CCI-05 closure plan for the next session.

## 4. Phase 2 Close Status

| CCI | Status at Phase 2 close | Shipping evidence |
|---|---|---|
| CCI-01 | **OPEN (deferred walkthrough)** | None yet — waiting on operator bot registration + recording |
| CCI-02 | **CLOSED** | 9/9 starter-pack tests green on every plan; full suite 1690/5/0; guardrails clean |
| CCI-03 | **CLOSED** (via 02-02) | 26 Discord unit tests green; Ed25519 verify + deferred ack + PATCH @original shipped; `fireDiscordApproval` wired into `app/api/actions/route.js` |
| CCI-04 | **CLOSED** (via 02-03) | `/activity` day-grouping + `/my-agent` narrative page shipped; 15 new tests; `useRealtime` wired |
| CCI-05 | **PARTIAL** | Docs + README + homepage draft shipped in 02-03 (`/guides/claude-code` Discord Portal walkthrough, Claude-Code-first README lead, 806-word homepage draft, `check-readme-lead.mjs` gate); **screencast URL backfill deferred** |

**Phase 2 ships as a functional integration** — a developer with the 5 `DISCORD_*` vars set can go from fresh clone to first Discord-approved Claude Code tool call today. The evidence artifact (the recorded proof video and the public screencast URL) is the one outstanding piece.

## 5. Next Action For Wes

When ready to close the two open gaps:

1. **Stand up Discord bot** (one-time, ~5 min):
   - https://discord.com/developers/applications → New Application
   - Bot tab → Add Bot → Reset Token → copy `DISCORD_BOT_TOKEN`
   - General Information → copy `APPLICATION ID` (=`DISCORD_APPROVER_ORG_ID` slot) + copy `PUBLIC KEY` (=`DISCORD_PUBLIC_KEY`)
   - OAuth2 → URL Generator → `bot` + `applications.commands` scopes → install to a throwaway server you own
   - Desktop client → User Settings → Advanced → Developer Mode ON → right-click your own name → Copy User ID (=`DISCORD_APPROVER_USER_ID`)
   - Populate all 5 vars in `.env.local` (see `.env.example` for exact names)
   - Developer Portal → General Information → Interactions Endpoint URL: `https://<your-deployment>/api/discord/interactions` → Save (wait for green checkmark confirming PING handshake succeeded)

2. **Record walkthrough** (Windows/WSL, ≤5:00):
   - Follow the 9-segment recipe in `02-01-PLAN.md` Task 2 `<what-built>` block
   - Key post-review checks: ≤5:00 duration, no secrets in any frame, phone-to-resolution ≤10s observable, every guide snippet ran as-is

3. **Publish + backfill**:
   - Upload to Loom (public) or YouTube Unlisted
   - Verify URL resolves in incognito browser
   - Run the 6-step backfill procedure in section 3 above
   - Commit with message `docs(02): backfill CCI-05 screencast URL after walkthrough recording`

4. **Mark CCI-01 + CCI-05 fully closed** in REQUIREMENTS.md traceability table.

**Estimated total time to close both gaps:** ~30 minutes (Discord bot setup 10 min + recording 5 min + review/re-record buffer 10 min + backfill + publish 5 min).

## Task Execution Record

| Task | Status | Commit | Notes |
|---|---|---|---|
| Task 1 — CCI-02 no-regression gate | PASSED | — (read-only per plan) | All 9 gates green at `d3e96819` |
| Task 2 — CCI-01 walkthrough (human-action) | DEFERRED | — | Resume-signal `skip recording for now, ship placeholder`; all 6 pre-flights captured (2 operator-side gaps, 4 PASS) |
| Task 3 — CCI-05 URL backfill | SKIPPED | — | Cannot backfill without URL; skipped per resume-signal |

**Plan metadata commit:** this SUMMARY + STATE + ROADMAP + REQUIREMENTS update is the final commit.

## Deviations from Plan

### None (resume-signal handled per plan spec)

The plan's `<resume-signal>` block explicitly defined `skip recording for now, ship placeholder` as a valid operator response. This SUMMARY honors that path exactly: CCI-01 deferred, Task 3 skipped, Phase 2 closes with open gaps recorded rather than silently skipped. This is the plan executing as designed, not a deviation.

### Out-of-scope discovery (NOT FIXED in this plan)

- `REQUIREMENTS.md` lines 17-22 contain an odd line-break inside the `**CCI-03**` / `**CCI-04**` / `**CCI-05**` checkbox entries (the requirement ID wraps before the colon: `- [x] **CCI-03\n**: ...`). This is pre-existing content drift from prior plans' manual edits and does not block execution. Logged here rather than fixed per scope boundary rule — unrelated to this plan's objective.
- The REQUIREMENTS.md traceability table (lines 130-156) is lagging: CCI-03 (shipped in 02-02) and CCI-04 (shipped in 02-03) are both still marked `Pending` in the table despite the top-of-file checkbox being `[x]`. This plan updates CCI-02 and CCI-01/CCI-05 per its objective, and corrects the lagging CCI-03/CCI-04 table entries while touching that file — one-line table sweeps adjacent to the primary edit, not independent changes.

## Authentication Gates

None encountered during execution. The human-action checkpoint at Task 2 is not an auth gate — it is a designed human-only step (hold phone, tap Approve) that cannot be automated.

## Self-Check

Verify claims before closing:

- **SUMMARY file exists:** FOUND `.planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md` (this file)
- **`<SCREENCAST_URL>` placeholders intact:** VERIFIED 3 raw matches + 1 entity-encoded match = 4 total across README.md (lines 8, 19) and app/guides/claude-code/page.js (lines 104, 249). Success-criterion bullet 6 satisfied.
- **Working tree clean pre-commit:** `git status` clean at session start at `d3e96819`
- **No new code changes:** Files modified by this plan are limited to SUMMARY + STATE + ROADMAP + REQUIREMENTS — zero production code or test code touched. Success-criterion bullet 7 satisfied.
- **No walkthrough artifact created:** No `cci-01-walkthrough.mp4` file in `.planning/phases/02-claude-code-beachhead/` — correctly absent per deferred state.

## Self-Check: PASSED

---
*Phase: 02-claude-code-beachhead*
*Completed: 2026-04-22 (deferred close)*
*Next-session closure path: record walkthrough + backfill URL; suggested invocation `/gsd-plan-milestone-gaps` or a single-commit backfill.*
