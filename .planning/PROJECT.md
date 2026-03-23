# DashClaw

## What This Is

DashClaw is an MIT-licensed, self-hosted governance runtime for AI agent fleets. It sits between agent intent and real-world action — enforcing guard policies before execution, recording decisions and assumptions at runtime, detecting behavioral drift, scanning for prompt injection, versioning prompt templates, scoring evaluations, and exporting compliance bundles mapped to SOC 2, NIST AI RMF, and the EU AI Act. Infrastructure is complete. The current milestone is adoption.

## Core Value

Get an agent builder from zero to a working DashClaw instance with at least one real agent connected and decisions flowing — as fast as possible, with as little friction as possible.

## Requirements

### Validated

<!-- Shipped and confirmed. The governance runtime is feature-complete. -->

- ✓ 7-route governance API (guard, actions, approvals, assumptions, signals, policies, health) — existing
- ✓ Multi-tenant org-scoped data model — existing
- ✓ Node.js SDK v2 with 5 core methods (guard, createAction, updateOutcome, recordAssumption, waitForApproval) — existing
- ✓ Python SDK — existing
- ✓ Platform intelligence skill (Claude Code, Codex, Gemini CLI, OpenCode) — existing
- ✓ guardrails.yml policy-as-code + guardrailgen CI integration — existing
- ✓ Compliance bundle exports (SOC 2, NIST AI RMF, EU AI Act) — existing
- ✓ Mission Control dashboard with real-time signal stream — existing
- ✓ Decisions ledger (visual causal chain) — existing
- ✓ Approvals queue (human-in-the-loop) — existing
- ✓ Drift detection and anomaly signals — existing
- ✓ Prompt injection scanning — existing
- ✓ Prompt template versioning — existing
- ✓ Evaluation scoring — existing
- ✓ Connect page (8-minute first-action onboarding path) — existing
- ✓ Setup page (readiness verification) — existing
- ✓ Integration health checks — existing
- ✓ Self-hosted Docker deployment — existing
- ✓ One-click Vercel deploy button with guided env var setup — Phase 1
- ✓ Security audit: OWASP Top 10, auth hardening, HSTS, SSRF, prompt injection guard, 51 regression tests — Phase 2
- ✓ Product validation: governance loop verified, 3-persona UX audit passed, $0 free-tier confirmed — Phase 2

### Active

<!-- Adoption milestone: reduce friction on the path to first governed action. -->

- [ ] Agent integration guides: LangChain/LangGraph, Claude Code agents, OpenAI Agents SDK, CrewAI/AutoGen
- [ ] Show HN launch post
- [ ] X/LinkedIn launch content (announcement thread + demo assets)

### Out of Scope

- Railway one-click deploy — Vercel-first; Railway can come after adoption traction proves demand
- New governance platform features — infrastructure is locked; this milestone is distribution only
- Mobile app — web-first, no mobile until after adoption milestone
- SaaS/hosted version — MIT self-hosted positioning is intentional and must be preserved

## Context

The governance runtime is architecturally complete. The problem is that the people who need DashClaw don't know it exists, and those who find it get stuck before seeing value. Two distinct friction points:

1. **Discovery gap**: Agent builders in the LangChain, OpenAI, and Claude ecosystems are not finding DashClaw. Community presence in the places they already gather (Discord, Hacker News, Reddit, X) is missing.

2. **Setup gap**: The biggest drop-off is the self-host deploy step. There is no one-click Vercel deploy button. Builders who find the repo have to manually provision a Neon database, configure 10+ env vars, and wire up auth before they can see the dashboard. This kills conversion.

The 8-minute connect path already exists in the app (`/connect`). The gap is getting people to that page.

**Success metric**: 10 active instances with at least one agent connected and decisions flowing.

## Constraints

- **Tech Stack**: Next.js 15 + Neon Postgres + Node.js 20 — non-negotiable, all adoption work must fit this stack
- **Governance Boundary**: Only 7 canonical routes allowed in `/api/`. Enforced by `npm run governance:boundary:check`. No new routes added during this milestone.
- **MIT License / Self-Hosted**: All content, guides, and tooling must reinforce the self-hosted, open-source positioning. No cloud lock-in messaging.
- **Docs Contract**: Any new API surface or env var must update the full docs checklist (app/docs, sdk/README.md, sdk-python/README.md, docs/sdk-parity.md, docs/api-inventory.md, PROJECT_DETAILS.md).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel as one-click deploy target | Already on Next.js 15 + Neon — natural fit, best DX for the stack | — Pending |
| All four agent frameworks for integration guides | LangChain/LangGraph, Claude Code, OpenAI Agents SDK, CrewAI/AutoGen cover the widest surface area of current agent builders | — Pending |
| Discord as community platform | Builders expect real-time community support; lower friction than Discourse or forums | — Pending |
| Show HN as primary launch vehicle | GitHub / Hacker News audience is the core DashClaw persona: technical, builds agents, cares about control | — Pending |

---
*Last updated: 2026-03-23 after Phase 2 (Security & Product Audit) completion*
