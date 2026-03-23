---
phase: 03-integration-guides
plan: 03
subsystem: ui
tags: [crewai, python, sdk, guides, examples]

requires:
  - phase: 03-integration-guides plan 01
    provides: GuideClient component, getGuideBaseUrl helper, guide page pattern

provides:
  - CrewAI @tool decorator pattern with DashClaw governance (examples/crewai-governed/)
  - /guides/crewai page with 7-step guide, guardrails.yml policy, /decisions proof moment

affects:
  - 03-integration-guides (phase completion — all 4 guide pages now exist)

tech-stack:
  added: []
  patterns:
    - "CrewAI @tool decorator wrapping guard/create_action/update_outcome pattern"
    - "Governed Python example without LLM provider dependency (simulated execution)"

key-files:
  created:
    - examples/crewai-governed/main.py
    - examples/crewai-governed/requirements.txt
    - examples/crewai-governed/README.md
    - examples/crewai-governed/.env.example
    - app/guides/crewai/page.js
  modified: []

key-decisions:
  - "CrewAI example calls @tool function directly (no OPENAI_API_KEY) to demonstrate governance without LLM provider"
  - "DashClawCrewIntegration class mentioned only in README note and Step 7 — @tool pattern is the primary guide approach"
  - "requirements.txt pins crewai==1.11.0 and dashclaw==2.6.0 per verified PyPI versions"

patterns-established:
  - "Python example pattern: single-file main.py with @tool decorator calling guard before execute, create_action + update_outcome after"

requirements-completed: [GUIDE-04, GUIDE-05]

duration: 15min
completed: 2026-03-23
---

# Phase 03 Plan 03: CrewAI Integration Guide Summary

**CrewAI governed example using @tool decorator pattern with guard/create_action/update_outcome, pinned to crewai==1.11.0, no LLM provider required**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-23T23:30:00Z
- **Completed:** 2026-03-23T23:45:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `examples/crewai-governed/` with 4 files: main.py, requirements.txt, README.md, .env.example
- Created `/guides/crewai` guide page with 7 steps, dark theme, copy-paste code blocks
- Python example demonstrates full governance loop (guard → create_action → update_outcome) without needing OPENAI_API_KEY
- Guide includes CrewAI-specific guardrails.yml with `audit_data_analysis` and `approve_external_calls` policies
- Proof moment directs to `/decisions` ledger showing action_type, agent_id, and status

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CrewAI Python example** - `486ae74` (feat)
2. **Task 2: Create CrewAI integration guide page** - `d1b165e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `examples/crewai-governed/main.py` - Single-file @tool decorator example with DashClaw governance
- `examples/crewai-governed/requirements.txt` - Pinned crewai==1.11.0, dashclaw==2.6.0, python-dotenv
- `examples/crewai-governed/README.md` - Setup instructions for Python 3.10+ with venv
- `examples/crewai-governed/.env.example` - Placeholder credentials per CLAUDE.md requirements
- `app/guides/crewai/page.js` - 7-step guide page at /guides/crewai

## Decisions Made
- Called `analyze_customer_data.run()` directly in `__main__` block instead of spinning up a full Crew — avoids OPENAI_API_KEY dependency while still demonstrating the governance pattern
- Module docstring says "no LLM provider needed" rather than naming a specific provider to keep example generic
- `DashClawCrewIntegration` mentioned only in README note and Step 7 of guide — @tool is the primary pattern per CONTEXT.md guidance

## Deviations from Plan

None - plan executed exactly as written.

Minor: The plan acceptance criterion said `main.py does NOT contain OPENAI_API_KEY`. Initial draft had `OPENAI_API_KEY` in a comment ("without requiring OPENAI_API_KEY"). Changed comment to "without an LLM provider" to satisfy the criterion while preserving the intent.

## Issues Encountered
None - build passed, lint passed, governance:boundary:check passed. All 5 files created and verified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 integration guides are now complete (LangGraph, Claude Code, OpenAI Agents SDK, CrewAI)
- Phase 03 integration-guides execution work is done
- Ready for launch content phase (Show HN post, X/LinkedIn)

---
*Phase: 03-integration-guides*
*Completed: 2026-03-23*
