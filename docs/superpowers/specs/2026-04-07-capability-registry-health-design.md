# Capability Registry Health Design

Date: 2026-04-07

## Summary

Upgrade the main capability registry from a metadata list into an operator-facing
health surface. Keep the dedicated capability detail page as the deep drill-down,
and add a compact Mission Control capability-health widget as a secondary summary
surface.

This is a registry-first slice, not a Mission-Control-first redesign.

## Problem

DashClaw now has meaningful capability runtime signals:

- derived capability health
- certification state
- stale checks
- test history
- recent failure data

But the main registry at `app/capabilities/page.jsx` still behaves mostly like a
catalog. Operators must click into each capability detail page to understand
runtime posture, and Mission Control does not yet surface capability health at all.

That leaves the product with a gap:

- backend and SDK capability runtime is strong
- detail page is useful
- primary list and control-plane summary surfaces are still thin

## Goals

1. Make `/capabilities` immediately useful for operators.
2. Surface capability health state without forcing drill-down.
3. Allow quick identification of:
   - unhealthy capabilities
   - degraded capabilities
   - stale certifications
   - uncertified capabilities
4. Add a lightweight “Run Test” action from the registry.
5. Add a compact capability-health card to Mission Control.

## Non-Goals

- No full capability editor redesign.
- No bulk certification workflow in v1.
- No scheduler-driven recurring recertification UI.
- No new backend routes unless the existing surfaces are insufficient.
- No deep Mission Control re-layout.

## Current Surface

### Existing operator depth

The dedicated capability detail page already provides:

- health summary
- certification status
- stale checks
- recent event history
- inline test runner

That page should remain the deep drill-down.

### Current registry weaknesses

The registry page currently shows:

- name
- slug
- description
- risk level
- approval/pricing/category/source tags
- a simple `health_status` dot

It does not expose the runtime health model clearly enough for operators.

### Current Mission Control gap

Mission Control has:

- interventions
- risk signals
- fleet status
- spend
- decision metrics

It does not yet surface capability posture even though capabilities are part of
the operating layer.

## Recommended Approach

### 1. Registry-first upgrade

Enhance `app/capabilities/page.jsx` into a genuine operator surface.

Add:

- summary chips or stat row
- health-state filtering
- stale / uncertified filtering
- richer card-level runtime posture
- quick test action

### 2. Mission Control summary card

Add a compact “Capability Health” widget to Mission Control.

This should:

- summarize unhealthy/degraded/stale counts
- show a short list of the most urgent capabilities
- link through to `/capabilities`

Mission Control should summarize. The registry should operate. The detail page
should diagnose.

## Information Architecture

### Registry page

#### Top summary row

Add a summary strip above the card grid with:

- total capabilities
- unhealthy/degraded count
- stale certification count
- uncertified count

This gives a fast operator scan before filters or drill-down.

#### Filters

Keep the existing risk filter.

Add:

- health filter: `all | healthy | degraded | unhealthy | unknown`
- stale-only toggle
- uncertified-only toggle

Filtering should be client-friendly and should use the existing
`/api/capabilities/health` collection route when possible, because that surface
already supports:

- `status`
- `certification_status`
- `stale_only`

#### Card design

Each card should show:

- existing name/slug/risk metadata
- health badge
- certification badge
- stale/fresh indicator
- last tested timestamp
- last success / last failure hint
- recent failure count or recent error hint when available

Cards should still be clickable into the dedicated detail page.

#### Quick action

Each card should offer a compact `Run Test` action.

Constraints:

- use the existing `POST /api/capabilities/:id/test` route
- keep the registry flow lightweight
- do not embed the full JSON payload editor from the detail page

Recommended v1 interaction:

- a simple button on the card
- use default/no-body test request
- show inline running/success/failure feedback
- refresh list health after completion

If a capability requires a custom test payload, the detail page remains the
place for that.

### Mission Control widget

Add a compact card to `app/mission-control/page.js` with:

- unhealthy/degraded count
- stale certification count
- uncertified count
- top 3 urgent capabilities
- link to `/capabilities`

Urgent ordering should prioritize:

1. unhealthy
2. degraded
3. stale certified
4. uncertified

The card should be compact and read-only except for navigation.

## Data Flow

### Registry

Preferred flow:

1. Fetch base capability list from `/api/capabilities`
2. Fetch health collection from `/api/capabilities/health`
3. Merge by `capability_id` client-side

This avoids adding a new UI-only backend shape in v1.

If performance becomes an issue later, a combined registry-health route can be
added, but it is not necessary for this slice.

### Mission Control

Use the existing capability health collection route:

- `GET /api/capabilities/health`

Then derive summary counts client-side.

## UX Rules

1. Health must be legible at a glance.
2. Certification and stale state must not be hidden behind hover or drill-down.
3. Quick test should feel operational, not configuration-heavy.
4. The registry should remain scannable even with more metadata.
5. Mission Control should summarize, not duplicate the registry page.

## Visual Direction

### Registry cards

Cards should feel more operational than catalog-like.

Use:

- stronger status badges
- compact metric rows
- small runtime timestamp text
- restrained color coding tied to health/certification urgency

Avoid:

- turning each card into a mini dashboard
- large blocks of explanation text

### Mission Control widget

Keep the widget aligned with current Mission Control cards:

- compact title row
- one primary number
- 2-3 subordinate status lines
- short list of urgent items

## Error Handling

### Registry

- If health collection fails, still render base capability cards.
- Show a top-level non-fatal warning that runtime health is unavailable.
- Disable quick test while the test request is in flight for a given card.

### Mission Control

- If capability health fails, render the rest of Mission Control normally.
- The capability widget can show an unavailable state without affecting the page.

## Testing

Add coverage for:

### Registry

- summary counts render correctly
- health filters work
- stale/uncertified toggles work
- cards merge base capability + health data correctly
- quick test action calls the existing route and refreshes state
- base registry still renders when health fetch fails

### Mission Control

- capability health widget renders counts
- urgent ordering is correct
- widget degrades gracefully on fetch failure

## Success Criteria

This slice is successful when:

1. `/capabilities` clearly surfaces runtime posture without drill-down.
2. operators can identify stale/unhealthy/uncertified capabilities quickly.
3. operators can run a lightweight test from the registry.
4. Mission Control includes capability posture as part of the control-plane story.
5. no new backend UI-only endpoints are required for v1.

## Follow-On Work

After this slice, the next likely capability-ops upgrades are:

- bulk test actions
- recurring certification scheduling
- certification trend/history mini charts
- workflow usage links from capability cards
- richer failure clustering in Mission Control
