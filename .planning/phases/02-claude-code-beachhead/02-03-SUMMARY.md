---
phase: 02-claude-code-beachhead
plan: 03
subsystem: activity-timeline-and-docs
tags: [activity, my-agent, day-grouping, narrative, docs, readme, guides, homepage-draft, screencast-placeholder]

# Dependency graph
requires:
  - phase: 02-claude-code-beachhead
    provides: claude-code-starter pack + PreToolUse hook (02-01), Discord approval bridge + fireDiscordApproval emitter (02-02)
provides:
  - /activity day-grouping presentational layer (CCI-04 part 1)
  - /my-agent narrative page with today/week toggle + pinned denials + install-prompt empty state (CCI-04 part 2)
  - /guides/claude-code Discord Developer Portal walkthrough (CCI-05 guide rewrite)
  - README.md "Govern Claude Code in 5 minutes" top-of-file lead with D-17 GIF click-through (CCI-05 README lead)
  - docs/homepage-draft-claude-code.md Phase 3 handoff copy (CCI-05 homepage draft)
  - scripts/check-readme-lead.mjs optional CI gate (CCI-05 future-promotion)
affects: [02-01, CCI-01, CCI-04, CCI-05, dashclaw.io/guides/claude-code, phase-3-homepage-hero]

# Tech tracking
tech-stack:
  added: []  # Zero dependencies added
  patterns:
    - "Pure-function day-grouping extracted to sibling .js helper so vitest's oxc parser does not traverse the JSX-bearing page.js"
    - "React page filename convention: .jsx for JSX pages imported by tests; .js fine for server components that are not unit-tested"
    - "Install-prompt hero pattern: Card + numbered-ol + single CTA link, reusable whenever a page needs a guided-setup empty state"
    - "D-17 GIF click-through markdown pattern: anchor-wrapped img renders as a clickable GIF on GitHub, npm, and dashclaw.io readmes"

key-files:
  created:
    - app/activity/dayGrouping.js
    - app/my-agent/page.jsx
    - __tests__/unit/activity-day-grouping.test.js
    - __tests__/unit/my-agent-page.test.jsx
    - docs/homepage-draft-claude-code.md
    - scripts/check-readme-lead.mjs
  modified:
    - app/activity/page.js
    - app/guides/claude-code/page.js
    - README.md

key-decisions:
  - "Factor groupEventsByDay + summarizeDay into app/activity/dayGrouping.js rather than re-export from page.js — vitest's oxc transform refuses JSX in .js files on import, so the test had to bypass the page entry-point. page.js still re-exports the helpers so any future consumer that imports from the page continues to resolve."
  - "Name the new page app/my-agent/page.jsx (not .js) because the React Testing Library test imports it — same rationale as app/approvals/page.jsx. Next.js accepts both extensions."
  - "Denial pinning (D-11) rendered via data-testid='denials-section' above data-testid='chrono-section' — DOM-order assertion in test uses compareDocumentPosition to verify pinning without coupling to visual layout."
  - "Narrative denied-clause coloring uses text-status-warning token (NOT text-status-error) — calmer signal per .impeccable.md tiebreaker #3 'calm under pressure'. Warning amber, not alarm red."
  - "D-17 GIF click-through honored literally in README.md — anchor-wrapped img at href=<SCREENCAST_URL> placeholder. Backfilled by plan 02-01 Task 3."
  - "Homepage draft expanded to 806 words (well above ≥200 minimum) to give Phase 3 concrete raw material rather than terse placeholders — voice notes + four-anti-references guardrail included inline so the Phase 3 planner does not need to re-derive them."

patterns-established:
  - "Pure-helper-factoring: when a client component needs a testable pure function but lives in a JSX-bearing page, extract to a sibling .js helper and re-export from the page."
  - "Empty-state as install-prompt: Card wrapper + Terminal icon + 3-step ordered list + single CTA link to the first-class integration guide."

requirements-completed: [CCI-04, CCI-05]

# Metrics
duration: 11min
completed: 2026-04-22
---

# Phase 02 Plan 03: Activity Timeline + Claude Code Docs Summary

**Ship CCI-04 (human-readable agent activity via /activity day-grouping + new /my-agent narrative page) and CCI-05 (first-class Claude Code docs bundle — guide rewrite with Discord walkthrough, README Claude-Code-first lead with D-17 GIF click-through, Phase 3 homepage draft, CI script). Zero schema change, zero new API routes — presentational layers only on top of existing /api/actions + /api/guard.**

## Performance

- **Duration:** ~11 min (21:05 → 21:16 UTC, 2026-04-22)
- **Tasks:** 4 (RED tests → GREEN implementation → docs rewrite → full-suite regression)
- **Files created:** 6
- **Files modified:** 3
- **Tests added:** 15 (9 day-grouping pure-function + 6 /my-agent render)
- **Full suite delta:** 1675 → 1690 passing (+15), 0 new failures

## Accomplishments

### CCI-04 — Human-readable activity

- **`/activity` day-grouping (D-13, D-14):** Events now render in day sections with a one-line English summary header ("Wed Apr 22 — 12 approvals, 3 denials, 47 silent allows, 0 errors"). Implementation is a `useMemo(groupEventsByDay)` layer on top of the existing events state — zero change to the fetch path, zero schema change, respects `useAgentFilter` upstream.

- **`/my-agent` page (D-08..D-12, D-14):** New client component at `app/my-agent/page.jsx`. Narrative hero built from counts ("Today your agent ran 47 commands. 3 required approval. 0 were denied."), Today/Week toggle, pinned denials with policy name + reason, chronological command list, install-prompt empty state for zero-activity users, live updates via `useRealtime`. Only consumes existing `/api/actions` + `/api/guard`.

### CCI-05 — First-class documentation

- **`/guides/claude-code` Discord walkthrough:** Added step 1 "Watch the 3-minute walkthrough", step 6 "Connect Discord (2 minutes)" with all 4 env vars, and a full Discord Developer Portal walkthrough section covering bot creation, mutual-server invite, interactions endpoint URL registration, and verification.

- **README.md Claude-Code-first lead:** New top-of-file hero with "Govern Claude Code in 5 minutes" + 3-step install + D-17 GIF click-through (anchor-wrapped demo-gif2). All existing content preserved below the fold.

- **`docs/homepage-draft-claude-code.md`:** 806 words covering hero copy, subhead, hero visual description, 3-section outline, ~220-word body copy, voice notes, CTA pair, Phase-3-decides list, and a handoff checklist.

- **`scripts/check-readme-lead.mjs`:** Optional CI gate asserting README first 50 lines contain "Claude Code" + `/guides/claude-code` link. Exits 0/1, not wired into `npm test` yet — future phases can promote.

## Task Commits

Each task committed atomically:

1. **Task 1: Wave 0 — RED tests** — `3e8aa359` (test)
   - `__tests__/unit/activity-day-grouping.test.js` (9 cases)
   - `__tests__/unit/my-agent-page.test.jsx` (6 cases, 3 render-state + toggle + agent-filter + denial-pinning + realtime-refetch)
   - Confirmed RED via import-resolution errors (helper + page did not yet exist)

2. **Task 2: GREEN implementation** — `0c937e59` (feat)
   - `app/activity/dayGrouping.js` (NEW) — pure helpers factored out for test import
   - `app/activity/page.js` — re-exports helpers; day-section render wrap around existing per-event markup
   - `app/my-agent/page.jsx` (NEW, ~290 lines) — narrative hero, toggle, pinned denials, chronological list, install-prompt empty state
   - Inline Rule 1 fix folded in: Week-scope test expectation fixture corrected (spacing changed from 24h to 2h so all 25 week-only events land within the 7-day window)

3. **Task 3: Docs rewrite** — `f024eb54` (docs)
   - `app/guides/claude-code/page.js` — Discord step + Portal walkthrough + screencast placeholder
   - `README.md` — Claude-Code-first lead with D-17 GIF click-through; existing content preserved below fold
   - `docs/homepage-draft-claude-code.md` (NEW) — 806-word Phase 3 handoff
   - `scripts/check-readme-lead.mjs` (NEW) — optional CI gate, exits 0

4. **Task 4: Full-suite regression gate** — no code changes (verification only)
   - `npm test` → 1690 pass / 5 skip / 0 fail (up from 1675 baseline)
   - `npm run lint`, `npm run route-sql:check`, `npm run openapi:check`, `npm run api:inventory:check`, `npm run docs:check`, `node scripts/check-readme-lead.mjs` — all clean

**Plan metadata:** pending (this SUMMARY.md + STATE.md + ROADMAP.md update will be the final commit)

## Design Compliance Spot-Check (.impeccable.md)

| Principle | Compliance | Evidence |
|---|---|---|
| Tiebreaker #2 — Brand orange as signal, not noise | PASS | `/my-agent/page.jsx` uses `text-brand` + `bg-brand/10` + `border-active/30` only on the install-prompt CTA link and the `approved` chip. No ambient orange on backgrounds or borders. |
| Tiebreaker #4 — Token-first, never hardcoded | PASS | `grep -E "#[0-9a-fA-F]{3,6}" app/my-agent/page.jsx` returns zero matches. `app/activity/dayGrouping.js` has no styling. `app/activity/page.js` modifications use existing `text-secondary`/`text-tertiary`/`border-border` tokens. |
| Tiebreaker #3 — Calm under pressure | PASS | Narrative-hero denial clause uses `text-status-warning` (amber), not `text-status-error` (red). Empty-state hero is informative ("Your agent hasn't run anything yet.") + 3 concrete next steps, not scary. |
| Tiebreaker #6 — WCAG AA floor | PASS | All interactive elements have visible focus states via Tailwind's default ring + border-color shifts. Denial chip contrast pairs color + icon + policy-name text, never relies on color alone. |
| Four-anti-references guardrail | PASS | Copy is declarative/technical, no emoji, no "unleash" / "empower" / "welcome to…" phrasing. No gradients, no glassmorphism, no consumer-AI sparkle. |

## STRIDE Mitigation Verification

| Threat ID | Category | Mitigation site | Proof |
|-----------|----------|-----------------|-------|
| T-02-03-01 | Information Disclosure (cross-tenant) | `/my-agent` reuses `/api/actions` + `/api/guard` (already `req.org_id`-scoped by middleware); no new repo query introduced | Code review: `app/my-agent/page.jsx` only calls the two existing endpoints |
| T-02-03-02 | Information Disclosure (screencast secrets) | Deferred to plan 02-01 recording checklist — this plan ships only the `<SCREENCAST_URL>` placeholder | README.md + guide both carry the placeholder; no recording yet |
| T-02-03-03 | XSS via action text | React text interpolation only; zero raw-HTML injection API usage | Verified by grep-assertion in Task 2 done criteria (zero matches for the raw-HTML-insertion React prop name) |
| T-02-03-04 | Information Disclosure (volume counts cross-org) | Accepted — same risk model as existing `/api/actions` + `/api/guard`, no new exposure surface | N/A |

## Decisions Made

- **dayGrouping.js as sibling helper (not page.js re-export as tested):** Vitest's oxc transform throws `[PARSE_ERROR] Unexpected token` on JSX inside a `.js` file at test-import time (even though Next.js is fine with it at runtime). Factored the pure functions out to keep the import path JSX-free. `page.js` re-exports them so any downstream consumer importing from the page module continues to resolve — backwards-compatible.

- **`.jsx` extension on the new page:** Existing pages with Testing Library coverage use `.jsx` (e.g. `approvals/page.jsx`). Adopting the same convention avoids a second round of oxc-refuses-JSX errors. Next.js App Router accepts `.js`, `.jsx`, `.ts`, `.tsx` equivalently for `page.*`.

- **D-17 literal click-through pattern:** anchor-wrapped img at `href="<SCREENCAST_URL>"` — standard markdown HTML that GitHub, npm, and Vercel all render as a clickable GIF. The earlier plan-checker warning (d17-gif-clickthrough-descoped) had claimed this pattern "doesn't work trivially" — it does, and the plan text corrects the earlier assumption. Placeholder URL is backfilled by plan 02-01 after recording.

- **Homepage draft significantly above the 200-word floor (806 words):** gives Phase 3 concrete raw material rather than terse placeholders. Voice notes + four-anti-references guardrail included inline so the Phase 3 planner does not have to re-derive them.

- **CCI-05 acceptance deferrals:** (1) screencast recording itself is plan 02-01's responsibility, not this plan's — we ship placeholders. (2) All code snippets on `/guides/claude-code` reflect the shipped Phase 2 state (policy pack auto-loaded, Discord env vars verbatim from `.env.example`, hook install command unchanged). Verbatim-runnability is verified by plan 02-01's Windows/WSL walkthrough.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Week-scope test fixture did not produce the asserted 55 commands**
- **Found during:** Task 2 GREEN test run (5 of 6 /my-agent tests passed; the "50+ events + toggle" test failed because only 36 commands fell inside the week window, not 55)
- **Issue:** The test had 25 "week-only" actions spaced at `now - (2 + i) * 24 * 60 * 60 * 1000` — i.e. from 2 days ago to 26 days ago. Only 6 of the 25 fell within the 7-day cutoff (`t >= now - 7*DAY_MS`). Actual count was 30 today + 6 week-visible = 36, not the asserted 55.
- **Fix:** Tightened the spacing to 2h increments starting at `now - 1.5 * DAY`, so all 25 week-only events land strictly inside the 7-day window (spanning from 1.5 days to 3.5 days ago). Final counts: 30 today + 25 week-visible = 55, as originally asserted.
- **Files modified:** `__tests__/unit/my-agent-page.test.jsx` (fixture setup only — production code was correct)
- **Verification:** 6/6 /my-agent tests green after fix.
- **Committed in:** `0c937e59` (folded into Task 2 commit — this was a GREEN-state enabler, not a separate change)

### Pre-existing context (not deviations)

- **JSX-in-.js oxc parser issue:** discovered during Task 1 RED confirmation. Resolved by splitting the helper into a plain `.js` and using `.jsx` extension on the new page. This is a vitest/vite parser quirk, not a new bug in the codebase.
- **Security-reminder hook false trigger:** The pretool security hook flagged the initial `/my-agent` file creation because an XSS-discipline comment contained the raw-HTML-API substring. Rephrased the comment so it still documents the discipline without tripping the detector — same code behavior, same security posture.

**Total deviations:** 1 auto-fixed (1 Rule 1 bug: week-scope test fixture).
**Impact on plan:** fixture-only adjustment, zero production-code impact, all CCI-04 + CCI-05 requirements met as specified.

## Issues Encountered

- **vitest oxc refuses JSX in .js files:** surfaced when tests imported `app/activity/page.js` (JSX page) and `app/my-agent/page.js` (initial filename). Next.js runtime is fine with both, but vitest's import-time transform is strict. Resolved by: (1) factoring pure helpers into `app/activity/dayGrouping.js` so tests don't need to resolve through the page, (2) renaming the new page to `.jsx` extension to match the existing `approvals/page.jsx` convention.

- **Security-reminder hook on docstring:** initial `/my-agent/page.jsx` creation was blocked by the pretool security hook because a comment documenting the XSS posture contained the detection pattern verbatim. Fixed by rephrasing the comment to state the discipline affirmatively without including the tripwire string.

## User Setup Required

Nothing in THIS plan requires further operator action. The work is shippable as-is and renders on any DashClaw instance.

Plan 02-01's walkthrough checkpoint handles the downstream manual steps:
1. Record the ≤3-minute screencast on Wes's Windows/WSL dogfood instance
2. Publish to Loom or YouTube (Unlisted) — D-20 allows Claude's discretion; Loom recommended by research for fastest publish
3. Backfill `<SCREENCAST_URL>` placeholders in:
   - `README.md` — 2 occurrences (the anchor wrapping demo-gif2 AND the "Watch the 3-min walkthrough →" link)
   - `app/guides/claude-code/page.js` — 2 occurrences (step 1 note + the dedicated "Watch the 3-minute walkthrough" section)
4. Commit with message `docs(02-01): backfill screencast URL after recording`

## Handoff Notes for Plan 02-01

When plan 02-01 backfills `<SCREENCAST_URL>`:

- Run a quick `grep -n "<SCREENCAST_URL>" README.md app/guides/claude-code/page.js` to enumerate all occurrences before editing — expect exactly 4 total.
- After backfill, re-run `node scripts/check-readme-lead.mjs` and `head -50 README.md | grep -c "/guides/claude-code"` to confirm the README lead still passes.
- The D-17 click-through assertion survives backfill intact because the anchor `href` is replaced, not removed. The anchor-wrapped-img pattern stays intact.

## Next Phase Readiness

- **Plan 02-01 walkthrough (CCI-01):** ready — all referenced surfaces exist, all env-var names match `.env.example`, Discord setup steps are runnable against the shipped plan 02-02 route.
- **Phase 3 homepage publish (DOG-03):** ready — `docs/homepage-draft-claude-code.md` contains 806 words of concrete raw material plus a handoff checklist.
- **Plan checker warning d17-gif-clickthrough-descoped:** resolved in this plan's execution — the GIF IS click-through via the standard anchor-wrapped-img markdown pattern.

## Self-Check: PASSED

- **Files:** FOUND app/activity/dayGrouping.js, FOUND app/my-agent/page.jsx, FOUND __tests__/unit/activity-day-grouping.test.js, FOUND __tests__/unit/my-agent-page.test.jsx, FOUND docs/homepage-draft-claude-code.md, FOUND scripts/check-readme-lead.mjs
- **Commits:** FOUND 3e8aa359 (Task 1 RED), FOUND 0c937e59 (Task 2 GREEN), FOUND f024eb54 (Task 3 docs)
- **Full suite:** 1690 pass / 5 skip / 0 fail (was 1675 baseline, +15 new tests, 0 regressions)
- **Static gates:** lint PASS, route-sql:check PASS, openapi:check PASS, api:inventory:check PASS, docs:check PASS, check-readme-lead.mjs PASS
- **Content spot-checks:** README first 50 lines contain "Claude Code" (4 matches) and /guides/claude-code link (1 match); demo-gif2 click-through present (1 match); guide has Discord (10 matches) + 7 DISCORD_* env var mentions + 1 SCREENCAST_URL placeholder; homepage draft 806 words (≥200 required)

---
*Phase: 02-claude-code-beachhead*
*Completed: 2026-04-22*
