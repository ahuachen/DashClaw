---
source-of-truth: true
owner: DevEx Lead
last-verified: 2026-02-14
doc-type: governance
---

# Documentation Governance

## Purpose

Define a single, explicit documentation hierarchy and update protocol to prevent drift across architecture, decisions, and onboarding docs.

## Canonical Hierarchy

When documents disagree, use this precedence order:

1. `docs/decisions/*.md` (ADRs and decision records)
2. `docs/rfcs/*.md` with `Status: Approved` for active roadmap commitments
3. `PROJECT_DETAILS.md` for architecture and system behavior
4. `README.md` and `QUICK-START.md` for onboarding and quickstart only
5. `CLAUDE.md` for coding-agent handoff notes (non-canonical, but should be kept current)

## Architecture Docs In Scope

The following files are treated as architecture-governed docs and must include metadata headers:

- `PROJECT_DETAILS.md`
- `docs/decisions/0002-nextjs-versioning.md`
- `docs/decisions/2026-02-13-revert-draggable-dashboard.md`
- `docs/rfcs/platform-convergence.md`
- `docs/rfcs/platform-convergence-status.md`

## Handoff Docs In Scope

The following files are not architecture sources-of-truth, but are treated as operational handoff docs and should be updated whenever workflows change:

- `CLAUDE.md`
- `README.md`
- `QUICK-START.md`
- `docs/agent-bootstrap.md`
- `docs/client-setup-guide.md`

## Required Metadata Header

Every architecture-governed document must begin with this metadata block:

```yaml
---
source-of-truth: true|false
owner: <role-or-team>
last-verified: YYYY-MM-DD
doc-type: architecture|decision|rfc|status|governance
---
```

## Update Protocol

1. Update the canonical source first using hierarchy rules above.
2. If behavior changed, add or update a decision doc in `docs/decisions/`.
3. Synchronize dependent docs (`PROJECT_DETAILS.md`, `README.md`, or RFC status docs) in the same PR.
4. Set `last-verified` to the merge date of the change.
5. If this affects roadmap milestones, update `docs/rfcs/platform-convergence-status.md`.
