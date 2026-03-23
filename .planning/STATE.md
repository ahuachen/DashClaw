---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
stopped_at: Completed 02-01-PLAN.md (security hardening)
last_updated: "2026-03-23T21:10:23.980Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 5
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Get a developer from zero to a working DashClaw instance with at least one real agent connected and decisions flowing — as fast as possible.
**Current focus:** Phase 02 — security-product-audit

## Current Position

Phase: 02 (security-product-audit) — EXECUTING
Plan: 2 of 3

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~10 min
- Total execution time: ~20 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-deploy-funnel | 2/3 | ~20 min | ~10 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~10min), 01-02 (~10min)
- Trend: On track

*Updated after each plan completion*

| Plan | Tasks | Files |
|------|-------|-------|
| Phase 01-deploy-funnel P01 | 4 tasks | 2 files |
| Phase 01-deploy-funnel P02 | 3 tasks | 4 files |
| Phase 02-security-product-audit P01 | 4 | 3 tasks | 6 files |

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
- [Phase 01-deploy-funnel P01]: db:push removed from buildCommand — hangs in non-TTY (Vercel build); manual migration step added to README post-deploy checklist
- [Phase 01-deploy-funnel P01]: skippable-integrations=1 confirmed working — Neon panel skippable, DATABASE_URL field still appears for manual entry
- [Phase 01-deploy-funnel P01]: NEXTAUTH_URL has no envDefault — developer sets after deploy URL is known (correct per design)
- [Phase 02-security-product-audit]: HSTS unified to 2-year max-age with preload in both middleware paths, matching next.config.js
- [Phase 02-security-product-audit]: Prompt injection blocks only on critical severity (recommendation=block), not warn/medium
- [Phase 02-security-product-audit]: Dead PUBLIC_ROUTES regex entry removed from middleware.js — no replacement endpoint added
- [Phase 02-security-product-audit]: All 7 cron routes already had CRON_SECRET timing-safe enforcement — confirmed, no changes needed

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 3**: Python package versions for LangGraph, langchain-core, CrewAI are LOW confidence — must verify against PyPI before writing `requirements.txt`

**Resolved:**

- ~~Phase 1: Neon integration slug must be verified~~ — RESOLVED: verified live, Neon panel appears correctly
- ~~Phase 1: NEXTAUTH_URL post-deploy pattern requires live test~~ — RESOLVED: manual update in step 1 is the correct pattern
- ~~Phase 1: Verify db:push idempotency in non-TTY~~ — RESOLVED: NOT idempotent in non-TTY; removed from buildCommand, manual step added

## Session Continuity

Last session: 2026-03-23T21:10:23.977Z
Stopped at: Completed 02-01-PLAN.md (security hardening)
Resume file: None
