---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 01-deploy-funnel-02-PLAN.md
last_updated: "2026-03-17T23:28:16.733Z"
last_activity: 2026-03-17 — Roadmap created
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 2
  completed_plans: 1
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Get a developer from zero to a working DashClaw instance with at least one real agent connected and decisions flowing — as fast as possible.
**Current focus:** Phase 1 — Deploy Funnel

## Current Position

Phase: 1 of 4 (Deploy Funnel)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-17 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-deploy-funnel P02 | 3 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Vercel as one-click deploy target: natural fit with Next.js 15 + Neon; best DX for the stack
- All four frameworks (LangChain/LangGraph, Claude Code, OpenAI Agents SDK, CrewAI) for integration guides
- Discord as community platform; no bots, no in-app integration
- Show HN as primary launch vehicle; problem-first narrative required
- [Phase 01-deploy-funnel]: deploy.ok=false (NEXTAUTH_URL missing) causes overall=blocked; deploy.status=warn causes needs_attention — fail is blocking because auth redirects break
- [Phase 01-deploy-funnel]: CRON_SECRET is advisory not required — missing cron protection is a security gap but not a runtime blocker

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1**: Neon Vercel Marketplace `integration-ids` value (`oac_VqOgBHqhEoFTPzGkPd7L0iH6`) must be verified against live Vercel Marketplace before deploy button URL is finalized — MEDIUM confidence
- **Phase 1**: `NEXTAUTH_URL` post-deploy pattern (env substitution vs. manual update) requires live test to confirm least-friction path
- **Phase 1**: Verify `npm run db:push` (Drizzle push) is idempotent on existing schemas before adding to `buildCommand`
- **Phase 3**: Python package versions for LangGraph, langchain-core, CrewAI are LOW confidence — must verify against PyPI before writing `requirements.txt`

## Session Continuity

Last session: 2026-03-17T23:28:16.731Z
Stopped at: Completed 01-deploy-funnel-02-PLAN.md
Resume file: None
