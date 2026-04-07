---
source-of-truth: false
owner: Product
last-verified: 2026-04-07
doc-type: spec
status: proposed
---

# Capability Operator UI Design

## Purpose

Define the first operator-facing capability detail experience for DashClaw.

This spec turns the new capability runtime control surface into a human-usable operator page by combining:

- capability metadata,
- derived health and certification signals,
- recent invoke and test history,
- an inline `Run Test` action,
- and links back to the existing action replay surface.

## Why This Is Next

The backend capability runtime is now materially useful:

- capability invoke is governed,
- capability test creates recorded test actions,
- health exposes certification, recency, and recent failure signals,
- history exposes recent `capability_test` and `capability_invoke` events.

What is still missing is a clear operator surface where a human can answer:

- Is this capability healthy?
- Has it been tested recently?
- Is certification stale or failing?
- What broke last?
- Can I validate it again right now?

Without that page, the runtime remains infrastructure-first and harder to operate.

## Product Decision

The first operator UI for capabilities should be a dedicated detail page.

Route:

- `/capabilities/[capabilityId]`

This is intentionally not a drawer-first design.

Why:

- the capability detail surface already has enough depth to justify its own page,
- it benefits from deep linking,
- it will likely expand to contract, auth, workflow usage, and artifact detail later,
- and it avoids overloading the registry page with too much operational state.

## Goals

1. Make capability runtime health legible to operators.
2. Make certification and stale status obvious at a glance.
3. Surface recent invoke and test history without requiring raw API inspection.
4. Let operators run a test directly from the detail page.
5. Reuse existing APIs rather than inventing new UI-only routes.

## Non-Goals

1. Do not build a drawer variant in this phase.
2. Do not build a full contract or auth editor.
3. Do not add workflow usage graphs yet.
4. Do not add artifact browsing yet.
5. Do not redesign the capability registry page beyond linking into detail.

## Route Structure

### New Page

- `app/capabilities/[capabilityId]/page.jsx`

### Existing APIs Used

- `GET /api/capabilities/:capabilityId`
- `GET /api/capabilities/:capabilityId/health`
- `GET /api/capabilities/:capabilityId/history`
- `POST /api/capabilities/:capabilityId/test`

### Existing Navigation Change

- make registry cards on `/capabilities` link into `/capabilities/[capabilityId]`

## UX Structure

## Top Summary

The page header should show:

- capability name,
- slug,
- category,
- source type,
- risk badge,
- health badge,
- certification badge,
- stale-check badge.

Primary actions:

- `Run Test`
- `Refresh`
- `Edit Capability`
- optional link to external docs when `docs_url` exists

The top section should be optimized for scanning and confidence, not editing.

## Main Layout

Two-column layout on desktop:

- main content column for operational state,
- right rail for static facts and governance metadata.

Single column on smaller screens, with the right rail content stacked below the main content.

## Section 1: Health Overview

This section should present operator-facing runtime signals as summary cards.

Fields:

- current health status,
- certification status,
- stale check,
- last tested at,
- last success at,
- last failure at,
- success rate 1d,
- success rate 7d,
- p95 latency,
- recent error count or top error snippet.

Design intent:

- health should feel operational,
- certification should feel trust-related,
- stale check should feel urgency-related.

## Section 2: Recent Events

This section is backed by `GET /api/capabilities/:capabilityId/history`.

It should show a compact event table with:

- time,
- action type,
- status,
- duration,
- agent,
- error or summary.

Filters:

- action type: all / test / invoke
- status: all / completed / failed / pending approval

Behavior:

- clicking a row opens the existing action replay page at `/decisions/[actionId]`
- if an event lacks an actionable replay target, the row remains non-clickable

The history table should prioritize recent failures and recent tests as the highest-signal operator context.

## Section 3: Run Test

The page should include a compact test runner panel or modal.

Minimum inputs:

- JSON payload textarea
- optional declared goal field

Behavior:

1. operator submits test payload,
2. page calls `POST /api/capabilities/:capabilityId/test`,
3. page shows loading state,
4. on success or failure, page refreshes health and history,
5. returned certification and health state are surfaced inline.

The goal is not to build a full workflow runner.

The goal is to give operators a fast validation loop.

## Section 4: Capability Facts

The right rail should show stable capability metadata:

- description,
- tags,
- requires approval,
- auth type,
- source type,
- docs URL,
- health status from registry metadata.

This section is intentionally read-heavy and edit-light.

The page should not become a full form editor in v1.

## Data Flow

Page load:

1. fetch capability metadata,
2. fetch health summary,
3. fetch recent history,
4. render all sections once resolved.

Refresh action:

1. refetch metadata,
2. refetch health,
3. refetch history.

Run test:

1. submit test payload,
2. await result,
3. surface returned status,
4. refetch health and history,
5. keep operator on the same page.

## Error Handling

### Capability Not Found

- render a clear not-found state
- include a link back to `/capabilities`

### Health Or History Fetch Failure

- page should still render metadata if available
- failed sections should show local error cards with retry affordance

### Test Failure

- failed test should be shown as a valid outcome, not a page error
- surface returned `error`, `message`, `health_status`, and `certification_status`
- refresh history so the failed test appears immediately

### Invalid JSON Payload

- catch parse errors client-side before sending
- show a local validation message in the test panel

## Visual Direction

This page should feel more like an operator console than a generic CRUD detail page.

That means:

- strong status hierarchy at the top,
- meaningful use of color for health and certification,
- compact but readable metric cards,
- a clean event table rather than oversized cards for history,
- and restrained use of UI chrome so signal stays dense.

The page should preserve the repo's existing visual language rather than inventing a separate style system.

## Implementation Notes

### Suggested Components

- `CapabilityStatusHero`
- `CapabilityHealthCards`
- `CapabilityHistoryTable`
- `CapabilityTestPanel`
- `CapabilityFactsCard`

This can start in a single page file with small local components if that is faster, but the final structure should keep responsibilities reasonably separated.

### Suggested State Shape

- `capability`
- `health`
- `history`
- `loading`
- `refreshing`
- `testPayload`
- `testSubmitting`
- `testResult`
- `sectionErrors`

### Suggested Query Strategy

Keep it simple:

- fetch with `Promise.all`
- refetch the same three endpoints after a successful or failed test
- do not introduce a new client-side data framework for this slice

## Testing Plan

### UI Tests

- detail page loads capability + health + history
- not-found state renders when metadata route returns 404
- history filters update the history fetch
- test action posts payload and refreshes health/history
- invalid JSON payload is blocked client-side

### Route Reuse Verification

- no new backend routes are required for page load beyond the existing capability detail, health, history, and test routes

### Manual Verification

1. open a healthy capability from the registry
2. verify health badges and summary cards render
3. run a passing test
4. confirm certification and history update
5. run a failing test
6. confirm failure appears in history and health changes accordingly

## Rollout Plan

### Phase 1

- dedicated capability detail page
- registry cards link to detail page
- health overview
- recent history table
- run test panel

### Phase 2

- quick-glance drawer from registry
- contract details section
- workflow usage references
- richer result previews and artifact links

## Recommendation

Build the dedicated operator page now.

It is the smallest UI slice that makes the recent capability-runtime backend work feel like a real product surface instead of just a growing API collection.
