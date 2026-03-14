---
source-of-truth: false
owner: maintainers
last-verified: 2026-03-14
doc-type: handoff
---

# DashClaw (v2 Governance Runtime)

DashClaw is AI agent decision infrastructure. It provides a focused control plane for policy enforcement, decision recording, assumption tracking, and risk signals.

## Governance Boundary (CRITICAL)

DashClaw is a **minimal governance runtime**, not an agent platform. We do not provide tools for agents to achieve goals (Calendar, Messaging, CRM). We provide the infrastructure to **govern** those goals.

- **Core Runtime**: `app/api/` (Only 7 canonical routes allowed).
- **Extensions**: `app/(extensions)/` (Modular operational intelligence).
- **Archived**: `app/api/_archive/` (Legacy platform features).

**CI Check**: `npm run governance:boundary:check` enforces this boundary. Never add non-governance routes to the root `/api` directory.

## Essential Surfaces

- `/mission-control` - Strategic posture, interventions, and live decision stream.
- `/decisions` - Visual causal chain ledger of all governed actions.
- `/setup` - Readiness verification and instance health.
- `/connect` - The 8-minute path to first governed action.

## Tech Stack

- Runtime: Node.js 20+
- Framework: Next.js 15 (App Router)
- Database: Postgres (Neon recommended)
- SDK: v2 (5-method core surface)

## Essential Commands

```bash
npm run dev
npm run lint
npm run governance:boundary:check  # Enforce runtime boundary
npm run openapi:check              # Detect API contract drift
```

## Where To Look First

- `PROJECT_DETAILS.md` - Canonical system map and boundary rules.
- `QUICK-START.md` - The 8-minute "Aha! Moment" path.
- `docs/architecture/runtime-api.md` - The 4-step Governance Loop.
- `sdk/README.md` - v2 SDK implementation and error handling.
