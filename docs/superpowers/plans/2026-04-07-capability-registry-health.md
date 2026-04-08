# Capability Registry Health Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the capability registry into an operator-facing health surface and add a compact capability-health summary card to Mission Control.

**Architecture:** Keep the current backend contract and derive the UI from existing routes. The registry page should fetch the base capability catalog from `/api/capabilities`, fetch runtime posture from `/api/capabilities/health`, merge them client-side by `capability_id`, and render operator-friendly summaries, filters, and quick test actions. Mission Control should consume the same health collection route for a lightweight summary card instead of introducing a new backend surface.

**Tech Stack:** Next.js App Router, React client components, existing DashClaw REST routes, Vitest, Testing Library.

---

## File Structure

- Modify: `app/capabilities/page.jsx`
  Registry page. Add health merge, summary row, richer filters, card-level runtime posture, and quick test action.
- Create: `app/capabilities/components/CapabilityRegistrySummary.jsx`
  Summary strip for total/unhealthy/stale/uncertified counts.
- Create: `app/capabilities/components/CapabilityRegistryFilters.jsx`
  Registry filter controls for health state and stale/uncertified toggles.
- Create: `app/capabilities/components/CapabilityRegistryCard.jsx`
  Card view that combines metadata with runtime health posture and a lightweight `Run Test` action.
- Create: `app/components/MissionControlCapabilityHealthCard.jsx`
  Compact Mission Control widget for capability-health posture.
- Modify: `app/mission-control/page.js`
  Fetch capability health, derive urgent rows, and render the new Mission Control widget.
- Modify: `__tests__/unit/capabilities.page.test.jsx`
  Add registry summary/filter/quick-test coverage.
- Create: `__tests__/unit/mission-control.page.test.jsx`
  Add coverage for the capability-health Mission Control widget and graceful fetch failure.
- Modify: `docs/superpowers/specs/2026-04-07-capability-registry-health-design.md`
  Keep the spec aligned if implementation details shift.

## Chunk 1: Registry Health Merge and Summary

### Task 1: Add the failing registry summary test

**Files:**
- Modify: `__tests__/unit/capabilities.page.test.jsx`
- Read: `app/capabilities/page.jsx`

- [ ] **Step 1: Write the failing test**

Add a test that mocks:

- `GET /api/capabilities`
- `GET /api/capabilities/health`

and asserts the registry renders summary labels/counts for:

- total capabilities
- unhealthy/degraded
- stale
- uncertified

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- FAIL because the current page does not render registry health summary UI.

- [ ] **Step 3: Write minimal implementation**

Implement the smallest viable version in:

- `app/capabilities/components/CapabilityRegistrySummary.jsx`
- `app/capabilities/page.jsx`

Requirements:

- fetch health collection
- merge by `capability_id`
- derive counts client-side
- render a small summary strip above the grid

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- PASS for the new summary assertions

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/page.jsx app/capabilities/components/CapabilityRegistrySummary.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: add capability registry health summary"
```

## Chunk 2: Registry Filters and Card Runtime Posture

### Task 2: Add failing filter and card posture tests

**Files:**
- Modify: `__tests__/unit/capabilities.page.test.jsx`
- Read: `app/capabilities/page.jsx`

- [ ] **Step 1: Write the failing tests**

Add tests for:

- health-state filter (`healthy`, `degraded`, `unhealthy`, `unknown`)
- stale-only toggle
- uncertified-only toggle
- card rendering of:
  - certification badge
  - stale/fresh indicator
  - last tested text
  - failure hint text

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- FAIL because the registry does not yet render those controls or health posture fields.

- [ ] **Step 3: Write minimal implementation**

Implement:

- `app/capabilities/components/CapabilityRegistryFilters.jsx`
- `app/capabilities/components/CapabilityRegistryCard.jsx`
- update `app/capabilities/page.jsx`

Requirements:

- preserve existing search + risk filter
- add health filter and two toggles
- apply filtering after capability/health merge
- keep card click-through to `/capabilities/[capabilityId]`

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- PASS for filter behavior and card runtime posture

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/page.jsx app/capabilities/components/CapabilityRegistryFilters.jsx app/capabilities/components/CapabilityRegistryCard.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: add capability registry health filters"
```

## Chunk 3: Lightweight Run Test Action in Registry

### Task 3: Add the failing quick-test test

**Files:**
- Modify: `__tests__/unit/capabilities.page.test.jsx`
- Read: `app/capabilities/[capabilityId]/page.jsx`

- [ ] **Step 1: Write the failing test**

Add a test that:

- renders a capability card
- clicks `Run Test`
- expects a `POST` to `/api/capabilities/:id/test`
- expects the registry to refresh health after success

Also add coverage for disabled in-flight state.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- FAIL because registry cards do not yet support testing

- [ ] **Step 3: Write minimal implementation**

Update:

- `app/capabilities/components/CapabilityRegistryCard.jsx`
- `app/capabilities/page.jsx`

Requirements:

- card-level `Run Test` button
- default empty-body test request
- per-card submitting state
- refresh registry health on completion
- surface success/error inline without opening the detail page

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx
```

Expected:

- PASS for quick-test behavior

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/page.jsx app/capabilities/components/CapabilityRegistryCard.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: add capability registry quick test"
```

## Chunk 4: Mission Control Capability Health Widget

### Task 4: Add the failing Mission Control widget tests

**Files:**
- Create: `__tests__/unit/mission-control.page.test.jsx`
- Read: `app/mission-control/page.js`

- [ ] **Step 1: Write the failing tests**

Add tests that mock:

- Mission Control’s existing fetches
- `GET /api/capabilities/health`

and assert:

- a compact “Capability Health” card renders
- unhealthy/stale/uncertified counts display
- urgent capabilities are ordered by severity
- widget degrades gracefully if capability-health fetch fails

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/mission-control.page.test.jsx
```

Expected:

- FAIL because Mission Control has no capability-health widget

- [ ] **Step 3: Write minimal implementation**

Implement:

- `app/components/MissionControlCapabilityHealthCard.jsx`
- update `app/mission-control/page.js`

Requirements:

- fetch capability health collection
- derive counts client-side
- show top urgent capabilities
- link through to `/capabilities`
- do not block the rest of Mission Control if the capability fetch fails

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/mission-control.page.test.jsx
```

Expected:

- PASS for widget render and graceful degradation

- [ ] **Step 5: Commit**

```bash
git add app/mission-control/page.js app/components/MissionControlCapabilityHealthCard.jsx __tests__/unit/mission-control.page.test.jsx
git commit -m "feat: add mission control capability health widget"
```

## Chunk 5: Final Verification and Doc Sync

### Task 5: Verify the full slice and sync docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-07-capability-registry-health-design.md`
- Read: `docs/superpowers/plans/2026-04-07-capability-registry-health.md`

- [ ] **Step 1: Update docs if implementation diverged**

Adjust the spec if any component names, data flow, or UI boundaries changed during implementation.

- [ ] **Step 2: Run focused UI tests**

Run:

```bash
npx vitest run __tests__/unit/capabilities.page.test.jsx __tests__/unit/mission-control.page.test.jsx
```

Expected:

- PASS

- [ ] **Step 3: Run repo safety checks**

Run:

```bash
npm run docs:check
npm run contracts:check
```

Expected:

- both PASS

- [ ] **Step 4: Commit final polish**

```bash
git add app/capabilities/page.jsx app/capabilities/components/CapabilityRegistrySummary.jsx app/capabilities/components/CapabilityRegistryFilters.jsx app/capabilities/components/CapabilityRegistryCard.jsx app/components/MissionControlCapabilityHealthCard.jsx app/mission-control/page.js __tests__/unit/capabilities.page.test.jsx __tests__/unit/mission-control.page.test.jsx docs/superpowers/specs/2026-04-07-capability-registry-health-design.md docs/superpowers/plans/2026-04-07-capability-registry-health.md
git commit -m "feat: surface capability health across operator views"
```

- [ ] **Step 5: Push**

```bash
git push origin main
```
