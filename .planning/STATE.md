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

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Vercel as one-click deploy target: natural fit with Next.js 15 + Neon; best DX for the stack
- All four frameworks (LangChain/LangGraph, Claude Code, OpenAI Agents SDK, CrewAI) for integration guides
- Discord as community platform; no bots, no in-app integration
- Show HN as primary launch vehicle; problem-first narrative required

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 1**: Neon Vercel Marketplace `integration-ids` value (`oac_VqOgBHqhEoFTPzGkPd7L0iH6`) must be verified against live Vercel Marketplace before deploy button URL is finalized — MEDIUM confidence
- **Phase 1**: `NEXTAUTH_URL` post-deploy pattern (env substitution vs. manual update) requires live test to confirm least-friction path
- **Phase 1**: Verify `npm run db:push` (Drizzle push) is idempotent on existing schemas before adding to `buildCommand`
- **Phase 3**: Python package versions for LangGraph, langchain-core, CrewAI are LOW confidence — must verify against PyPI before writing `requirements.txt`

## Session Continuity

Last session: 2026-03-17
Stopped at: Roadmap created; Phase 1 ready to plan
Resume file: None
