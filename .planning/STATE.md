---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase complete — ready for verification
stopped_at: Completed 03-integration-guides-04-PLAN.md
last_updated: "2026-03-23T23:32:18.443Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Get a developer from zero to a working DashClaw instance with at least one real agent connected and decisions flowing — as fast as possible.
**Current focus:** Phase 03 — integration-guides

## Current Position

Phase: 03 (integration-guides) — EXECUTING
Plan: 4 of 4

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
| Phase 02-security-product-audit P02 | 8 | 2 tasks | 1 files |
| Phase 02-security-product-audit P03 | 5 | 1 tasks | 6 files |
| Phase 03-integration-guides P01 | 7min | 3 tasks | 4 files |
| Phase 03-integration-guides P02 | 4min | 2 tasks | 5 files |
| Phase 03-integration-guides P03 | 15 | 2 tasks | 5 files |
| Phase 03-integration-guides P04 | 5 | 2 tasks | 3 files |

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
- [Phase 02-security-product-audit]: Extension routes (compliance/exports, drift/alerts) use delegation pattern for org scoping — functionally correct, documented as acceptable pattern
- [Phase 02-security-product-audit]: Free-tier stack handles up to ~1,000 actions/day at $0 cost; all optional services degrade gracefully with logged warnings
- [Phase 02-security-product-audit]: Enterprise SOC 2 certification requires encryption key rotation (D-01) — deferred post-adoption
- [Phase 02-security-product-audit]: IPv6 SSRF patterns required bracket-stripping fix: Node URL wraps IPv6 hostnames in brackets, breaking all fc00/fe80/loopback patterns
- [Phase 02-security-product-audit]: integration-health cron route required Bearer prefix enforcement: replace() bypass allowed token without scheme prefix
- [Phase 02-security-product-audit]: Security test strategy: inline addSecurityHeaders in test file to avoid complex middleware module graph
- [Phase 03-integration-guides]: GuideClient accepts steps array with optional codeTitle/codeBody/note — flexible for all 4 framework guides
- [Phase 03-integration-guides]: getGuideBaseUrl() duplicates connectGuide.js logic rather than importing — avoids coupling guide infra to connect-specific code
- [Phase 03-integration-guides]: LangGraph example uses simulated LLM output — no OPENAI_API_KEY required per D-07, making example fully self-contained with only DashClaw credentials needed
- [Phase 03-integration-guides]: governance_node set as graph entry_point — ensures guard runs before any tool execution, consistent with DashClaw's intercept-before-action principle
- [Phase 03-integration-guides]: LangGraph-specific guardrails.yml shows approve_external_writes and allow_research policies to illustrate read-safe / write-guarded pattern
- [Phase 03-integration-guides]: CrewAI example calls tool directly (no OPENAI_API_KEY) to demonstrate governance without LLM provider
- [Phase 03-integration-guides]: DashClawCrewIntegration class mentioned in README only; @tool decorator is the primary guide pattern per CONTEXT.md
- [Phase 03-integration-guides]: Framework Guides cards in server component not ConnectGuideClient — static navigation needs no client interactivity
- [Phase 03-integration-guides]: README links to /connect (one link) not individual guides per D-11 — /connect cards handle framework selection

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 3**: Python package versions for LangGraph, langchain-core, CrewAI are LOW confidence — must verify against PyPI before writing `requirements.txt`

**Resolved:**

- ~~Phase 1: Neon integration slug must be verified~~ — RESOLVED: verified live, Neon panel appears correctly
- ~~Phase 1: NEXTAUTH_URL post-deploy pattern requires live test~~ — RESOLVED: manual update in step 1 is the correct pattern
- ~~Phase 1: Verify db:push idempotency in non-TTY~~ — RESOLVED: NOT idempotent in non-TTY; removed from buildCommand, manual step added

## Session Continuity

Last session: 2026-03-23T23:32:18.440Z
Stopped at: Completed 03-integration-guides-04-PLAN.md
Resume file: None
