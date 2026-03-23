---
phase: 03-integration-guides
plan: 04
subsystem: ui
tags: [next.js, navigation, guides, connect, self-host, readme]

# Dependency graph
requires:
  - phase: 03-integration-guides
    provides: 4 framework guide pages at /guides/claude-code, /guides/openai-agents-sdk, /guides/langgraph, /guides/crewai
provides:
  - Framework Guides 4-card section on /connect page linking all 4 guide pages
  - Framework Integration Guides link section on /self-host page linking all 4 guide pages
  - /connect link in README Connect Your Agent section for framework guide selection
affects: [launch, show-hn, documentation]

# Tech tracking
tech-stack:
  added: []
  patterns: [next.js Link component for internal navigation, dark-themed card grid for framework discovery]

key-files:
  created: []
  modified:
    - app/connect/page.js
    - app/self-host/page.js
    - README.md

key-decisions:
  - "Framework Guides section inserted in server component (page.js) not ConnectGuideClient — no client interactivity needed for static navigation cards"
  - "README links to /connect (one link) not individual guides per D-11 — /connect cards handle framework selection"
  - "self-host uses 4-column grid (lg:grid-cols-4) for compact display vs 2-column grid on /connect"

patterns-established:
  - "Framework discovery: dark card with hover:border-brand/30 is the standard pattern for navigable feature cards"

requirements-completed: [GUIDE-06]

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 3 Plan 4: Navigation Wiring Summary

**Guide discovery wired across 3 surfaces: /connect gets 4-card Framework Guides section, /self-host gets 4-link compact grid, and README gets a single /connect link — GUIDE-06 fully satisfied**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-23T23:28:00Z
- **Completed:** 2026-03-23T23:30:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- /connect page now has a prominent "Framework Guides" section with 4 styled cards (2x2 grid on desktop, 1-col mobile) linking to all 4 guide pages per D-10
- /self-host page now has a "Connect your agent framework" section with a 4-column compact grid linking all 4 guides per D-12
- README "Connect Your Agent" section now includes a /connect link directing developers to framework guide selection per D-11
- All 4 guides (/guides/claude-code, /guides/openai-agents-sdk, /guides/langgraph, /guides/crewai) are navigable from at least 2 surfaces (satisfies GUIDE-06)
- `npm run build` and `npm run lint` pass, governance boundary check passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Framework Guides card section to /connect page** - `e85a3e2` (feat)
2. **Task 2: Add guide links to /self-host and README** - `ace112f` (feat)

**Plan metadata:** (pending — created with final commit)

## Files Created/Modified
- `app/connect/page.js` - Added 4-card Framework Guides section after ConnectGuideClient, before PublicFooter
- `app/self-host/page.js` - Added 4-link Framework Integration Guides section before PublicFooter
- `README.md` - Added /connect link at end of "Connect Your Agent" section (Option 3 block)

## Decisions Made
- Framework Guides cards go in the server component (page.js), not ConnectGuideClient — they use Next.js Link and need no client interactivity
- README gets a single /connect link per D-11 rather than links to individual guide pages — /connect cards handle framework selection
- /self-host uses a compact 4-column horizontal layout (lg:grid-cols-4) to fit all guides in one row on desktop; /connect uses 2x2 grid with longer descriptions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The pre-existing lint warning (`<img>` in app/page.js) is unrelated to this plan's changes.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. All 4 guide links point to real pages created in plans 01-03. Navigation is fully wired.

## Next Phase Readiness
- Phase 03 (integration-guides) is now complete — all 4 plans executed
- All 4 framework guide pages exist and are discoverable from /connect, /self-host, and README
- Ready for Phase 04 (launch content: Show HN, social)

---
*Phase: 03-integration-guides*
*Completed: 2026-03-23*
