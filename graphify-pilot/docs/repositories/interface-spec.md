---
source-of-truth: true
owner: Backend Platform Lead
last-verified: 2026-02-13
doc-type: architecture
---

# Repository Interface Specification

This document defines repository interfaces for WS1 domain migration targets:

- `actions`
- `orgs/team`
- `messages/context`

## Goals

- Move SQL usage out of route handlers into repository modules.
- Keep tenant boundaries explicit in every repository method.
- Make method contracts testable and reusable across API routes.

## Shared Rules

All repository methods must:

1. Accept `orgId` explicitly (no hidden global tenant context).
2. Return plain JSON-serializable objects.
3. Throw typed errors for not-found and validation violations.
4. Avoid HTTP response objects (`NextResponse`) inside repository code.

## Actions Repository

File target: `app/lib/repositories/actions.repository.js` (implementation phase)

Required methods:

- `listActions(input)`
- `getActionById(input)`
- `createAction(input)`
- `updateActionOutcome(input)`
- `deleteActions(input)`
- `listActionAssumptions(input)`
- `upsertActionAssumption(input)`
- `listOpenLoops(input)`
- `upsertOpenLoop(input)`

## Orgs/Team Repository

File target: `app/lib/repositories/orgsTeam.repository.js` (implementation phase)

Required methods:

- `listOrganizationsForUser(input)`
- `getOrganizationById(input)`
- `updateOrganization(input)`
- `listOrgApiKeys(input)`
- `createOrgApiKey(input)`
- `revokeOrgApiKey(input)`
- `listTeamMembers(input)`
- `updateTeamMemberRole(input)`
- `removeTeamMember(input)`
- `createTeamInvite(input)`
- `listTeamInvites(input)`
- `revokeTeamInvite(input)`

## Messages/Context Repository

File target: `app/lib/repositories/messagesContext.repository.js` (implementation phase)

Required methods:

- `listMessages(input)`
- `createMessage(input)`
- `markMessagesRead(input)`
- `archiveMessages(input)`
- `listMessageThreads(input)`
- `createMessageThread(input)`
- `updateMessageThread(input)`
- `listContextPoints(input)`
- `createContextPoint(input)`
- `listContextThreads(input)`
- `createContextThread(input)`
- `updateContextThread(input)`
- `createContextThreadEntry(input)`
- `listHandoffs(input)`
- `createHandoff(input)`

## Migration Boundary

- WS1 M1: interface spec only.
- WS1 M2: migrate top routes to these repositories.
- WS1 M3: add contract tests against interfaces.
- WS1 M4: enforce no new route-level SQL in CI.
