---
phase: 03-integration-guides
plan: 02
subsystem: ui
tags: [langgraph, langchain, python, dashclaw-sdk, next.js, governance]

# Dependency graph
requires:
  - phase: 03-integration-guides-01
    provides: GuideClient component and guideContent.js URL helper

provides:
  - examples/langgraph-governed/main.py: Single-file LangGraph + DashClaw governance example
  - examples/langgraph-governed/requirements.txt: Pinned Python dependencies
  - examples/langgraph-governed/README.md: Setup and run instructions
  - examples/langgraph-governed/.env.example: DASHCLAW_BASE_URL and DASHCLAW_API_KEY template
  - app/guides/langgraph/page.js: 7-step LangGraph integration guide page at /guides/langgraph

affects: [03-integration-guides-03, 03-integration-guides-04, show-hn-launch]

# Tech tracking
tech-stack:
  added: [langgraph==1.1.3, langchain-core==1.2.21, dashclaw==2.6.0 (Python)]
  patterns:
    - LangGraph StateGraph with governance_node as entry point before task node
    - Simulated LLM output pattern (no OPENAI_API_KEY) for zero-friction examples
    - Guard-then-create_action-then-update_outcome SDK call sequence in graph nodes

key-files:
  created:
    - examples/langgraph-governed/main.py
    - examples/langgraph-governed/requirements.txt
    - examples/langgraph-governed/README.md
    - examples/langgraph-governed/.env.example
    - app/guides/langgraph/page.js
  modified: []

key-decisions:
  - "LangGraph example uses simulated LLM output — no OPENAI_API_KEY required per D-07 (Pitfall 2)"
  - "governance_node set as graph entry_point — runs guard check before any task node executes"
  - "LangGraph-specific guardrails.yml shows approve_external_writes and allow_research policies"

patterns-established:
  - "Python SDK example pattern: guard → create_action → update_outcome in single StateGraph node"
  - "LangGraph StateGraph wiring: governance node as entry_point, add_edge to task node, task node to END"

requirements-completed: [GUIDE-03, GUIDE-05]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 03 Plan 02: LangGraph Integration Guide Summary

**LangGraph + DashClaw Python example with guard/create_action/update_outcome SDK calls, pinned langgraph==1.1.3 dependencies, and 7-step guide page at /guides/langgraph**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T23:22:12Z
- **Completed:** 2026-03-23T23:26:17Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `examples/langgraph-governed/` with 4 files: `main.py`, `requirements.txt`, `README.md`, `.env.example`
- `main.py` runs with no OPENAI_API_KEY — governance_node calls real DashClaw SDK, research_node simulates LLM output
- `app/guides/langgraph/page.js` renders at `/guides/langgraph` with 7 steps, governance code example, LangGraph-specific guardrails.yml policy, and /decisions proof moment

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LangGraph Python example** - `e1f5950` (feat)
2. **Task 2: Create LangGraph integration guide page** - `acc5fea` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `examples/langgraph-governed/main.py` - Single-file LangGraph StateGraph with governance_node + research_node using DashClaw Python SDK
- `examples/langgraph-governed/requirements.txt` - Pinned langgraph==1.1.3, langchain-core==1.2.21, dashclaw==2.6.0, python-dotenv
- `examples/langgraph-governed/README.md` - Setup instructions referencing Python 3.10+, venv, pip install, cp .env.example
- `examples/langgraph-governed/.env.example` - DASHCLAW_BASE_URL and DASHCLAW_API_KEY placeholder credentials
- `app/guides/langgraph/page.js` - 7-step guide using GuideClient, dark theme, baseUrl injection from headers(), breadcrumb Home > Connect > LangGraph

## Decisions Made

- LangGraph example uses simulated LLM output — no OPENAI_API_KEY required per D-07, making the example fully self-contained with only DashClaw credentials needed
- `governance_node` set as graph `entry_point` — ensures guard runs before any tool execution, consistent with DashClaw's "intercept before action" principle
- LangGraph-specific `guardrails.yml` includes `approve_external_writes` and `allow_research` policies to illustrate read-safe / write-guarded pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Build compiled successfully (`ƒ /guides/langgraph` in build output). Lint passed with 0 errors (1 pre-existing unrelated warning). Governance boundary check passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The guide page wires `baseUrl` from live headers and all code content is substantive (real SDK calls, real YAML policy). The Python example uses simulated LLM output intentionally (documented as "replace with real LLM call in production").

## Next Phase Readiness

- LangGraph guide complete, ready for Plan 03 (CrewAI or OpenAI Agents SDK guide)
- The `GuideClient` + `getGuideBaseUrl` pattern is proven for Python SDK guides with simulated LLM examples
- `examples/langgraph-governed/` follows the same structure as `examples/openai-agents-governed/` for consistency

## Self-Check: PASSED

- FOUND: examples/langgraph-governed/main.py
- FOUND: examples/langgraph-governed/requirements.txt
- FOUND: examples/langgraph-governed/README.md
- FOUND: examples/langgraph-governed/.env.example
- FOUND: app/guides/langgraph/page.js
- FOUND commit: e1f5950 (feat(03-02): add LangGraph governed example)
- FOUND commit: acc5fea (feat(03-02): add LangGraph integration guide page)

---
*Phase: 03-integration-guides*
*Completed: 2026-03-23*
