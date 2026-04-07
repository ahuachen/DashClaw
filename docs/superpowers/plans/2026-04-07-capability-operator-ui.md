# Capability Operator UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an operator-first capability detail page at `/capabilities/[capabilityId]` that shows health, certification, recent history, and an inline test runner, then link the capability registry into it.

**Architecture:** Add a dedicated client page under `app/capabilities/[capabilityId]` with a small set of local UI components focused on operator workflows. Reuse the existing capability detail, health, history, and test API routes rather than adding UI-only backend surfaces. Keep the first cut read-heavy and action-light: health summary, recent events, and a compact `Run Test` panel.

**Tech Stack:** Next.js App Router, React 18 client components, existing DashClaw UI primitives (`PageLayout`, `Card`, `Badge`, `EmptyState`), `lucide-react`, Vitest, `@testing-library/react`, existing capability APIs.

---

## File Map

### New files

- `app/capabilities/[capabilityId]/page.jsx`
  Capability detail page container. Owns page-level loading, refresh, test submission, and error state.

- `app/capabilities/[capabilityId]/components/CapabilityStatusHero.jsx`
  Header/hero with name, slug, badges, and primary actions.

- `app/capabilities/[capabilityId]/components/CapabilityHealthCards.jsx`
  Health metric cards for certification, stale checks, success rates, latency, and timestamps.

- `app/capabilities/[capabilityId]/components/CapabilityHistoryTable.jsx`
  Compact event table with type/status filters and links into `/decisions/[actionId]`.

- `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
  JSON payload editor and submit flow for `POST /api/capabilities/:id/test`.

- `app/capabilities/[capabilityId]/components/CapabilityFactsCard.jsx`
  Right-rail metadata and governance facts.

- `__tests__/unit/capability-detail.page.test.jsx`
  Page-level UI tests with mocked fetch responses.

### Modified files

- `app/capabilities/page.jsx`
  Make registry cards link into the new detail page and preserve current card affordances.

### Existing backend routes consumed

- `app/api/capabilities/[capabilityId]/route.js`
- `app/api/capabilities/[capabilityId]/health/route.js`
- `app/api/capabilities/[capabilityId]/history/route.js`
- `app/api/capabilities/[capabilityId]/test/route.js`

No new backend routes are needed for this UI slice.

---

## Chunk 1: Page Shell And Data Loading

### Task 1: Add the failing page test for initial render

**Files:**
- Create: `__tests__/unit/capability-detail.page.test.jsx`
- Read: `app/capabilities/page.jsx`
- Read: `app/components/PageLayout.js`

- [ ] **Step 1: Write the failing test**

Add a test that renders the detail page with mocked fetch responses and expects:

- title with capability name,
- health/certification badges,
- at least one history row,
- facts card content.

Use a real render path with mocked `global.fetch`.

```jsx
it('renders capability metadata, health, and history on load', async () => {
  global.fetch = vi.fn()
    .mockResolvedValueOnce(okJson({ capability: { capability_id: 'cap_1', name: 'Research Agent', slug: 'research-agent', risk_level: 'medium', source_type: 'http_api' } }))
    .mockResolvedValueOnce(okJson({ capability_id: 'cap_1', status: 'healthy', certification_status: 'certified', stale_check: false }))
    .mockResolvedValueOnce(okJson({ capability_id: 'cap_1', events: [{ action_id: 'act_1', action_type: 'capability_test', status: 'completed' }] }));

  render(<CapabilityDetailPage params={{ capabilityId: 'cap_1' }} />);

  expect(await screen.findByText('Research Agent')).toBeInTheDocument();
  expect(await screen.findByText(/certified/i)).toBeInTheDocument();
  expect(await screen.findByText(/capability_test/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because `app/capabilities/[capabilityId]/page.jsx` does not exist yet.

- [ ] **Step 3: Create the minimal page shell**

Create `app/capabilities/[capabilityId]/page.jsx` as a client component that:

- reads `params.capabilityId`,
- fetches metadata, health, and history with `Promise.all`,
- renders the name and a temporary serialized view of data,
- returns a loading state before data arrives.

Keep the first implementation minimal. No local child components yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS with the temporary shell.

- [ ] **Step 5: Commit**

```bash
git add __tests__/unit/capability-detail.page.test.jsx app/capabilities/[capabilityId]/page.jsx
git commit -m "feat: add capability detail page shell"
```

### Task 2: Extract the page into focused operator components

**Files:**
- Modify: `app/capabilities/[capabilityId]/page.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityStatusHero.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityHealthCards.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityFactsCard.jsx`

- [ ] **Step 1: Write failing assertions for the extracted sections**

Extend `__tests__/unit/capability-detail.page.test.jsx` to assert:

- hero actions render,
- health cards show success-rate and latency values,
- facts card shows `auth_type` and `requires_approval`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because those sections do not exist yet.

- [ ] **Step 3: Implement the extracted components**

Create:

- `CapabilityStatusHero.jsx`
- `CapabilityHealthCards.jsx`
- `CapabilityFactsCard.jsx`

Use existing `Card`, `CardContent`, and `Badge` primitives.

Suggested render contract:

```jsx
<CapabilityStatusHero capability={capability} health={health} onRefresh={refreshData} onOpenTest={() => setTestPanelOpen(true)} />
<CapabilityHealthCards health={health} />
<CapabilityFactsCard capability={capability} />
```

Keep them presentational. Page-level fetch and submit logic stays in `page.jsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/[capabilityId]/page.jsx app/capabilities/[capabilityId]/components/CapabilityStatusHero.jsx app/capabilities/[capabilityId]/components/CapabilityHealthCards.jsx app/capabilities/[capabilityId]/components/CapabilityFactsCard.jsx __tests__/unit/capability-detail.page.test.jsx
git commit -m "feat: add capability operator summary sections"
```

---

## Chunk 2: History Table And Test Runner

### Task 3: Add recent history table with filters

**Files:**
- Modify: `app/capabilities/[capabilityId]/page.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityHistoryTable.jsx`
- Modify: `__tests__/unit/capability-detail.page.test.jsx`

- [ ] **Step 1: Write the failing test**

Add tests for:

- history rows render,
- changing action type/status filters triggers a refetch of `/api/capabilities/:id/history`,
- clicking a row with an `action_id` links to `/decisions/[actionId]`.

Use mocked `fetch` and assert the final history request URL.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because the filter UI and history table do not exist yet.

- [ ] **Step 3: Implement the history table**

Create `CapabilityHistoryTable.jsx` with:

- event rows,
- action type filter,
- status filter,
- lightweight empty state,
- row links using `next/link` when `action_id` exists.

In `page.jsx`, store:

- `historyFilters`
- `historyLoading`
- `historyError`

Refetch history when filters change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/[capabilityId]/page.jsx app/capabilities/[capabilityId]/components/CapabilityHistoryTable.jsx __tests__/unit/capability-detail.page.test.jsx
git commit -m "feat: add capability history table"
```

### Task 4: Add the inline test runner

**Files:**
- Modify: `app/capabilities/[capabilityId]/page.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
- Modify: `__tests__/unit/capability-detail.page.test.jsx`

- [ ] **Step 1: Write the failing test**

Add tests for:

- invalid JSON payload is blocked client-side,
- submitting valid JSON calls `POST /api/capabilities/:id/test`,
- page refreshes health and history after the test response,
- returned `certification_status` is rendered in the UI.

Use a payload such as:

```json
{"query":"What is x402?"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because the test panel and submit behavior do not exist yet.

- [ ] **Step 3: Implement the test panel**

Create `CapabilityTestPanel.jsx` with:

- JSON payload textarea,
- optional declared goal input,
- submit button,
- inline result/error panel.

In `page.jsx`:

- parse JSON client-side before submit,
- POST to `/api/capabilities/${capabilityId}/test`,
- store returned `testResult`,
- refetch health and history after the response resolves,
- leave the operator on the page.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/[capabilityId]/page.jsx app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx __tests__/unit/capability-detail.page.test.jsx
git commit -m "feat: add capability test runner panel"
```

---

## Chunk 3: Registry Linking, States, And Final Verification

### Task 5: Link the registry into the detail page

**Files:**
- Modify: `app/capabilities/page.jsx`
- Create: `__tests__/unit/capabilities.page.test.jsx`

- [ ] **Step 1: Add the failing test**

Add a small interaction test or assertion that the registry card includes a link to `/capabilities/[capabilityId]`.

If adding a second dedicated test file is cleaner, create:

- `__tests__/unit/capabilities.page.test.jsx`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capabilities.page.test.jsx`

Expected: FAIL because the registry cards are not linked.

- [ ] **Step 3: Implement the registry link**

Wrap each capability card in a `Link` to `/capabilities/${cap.capability_id}` while preserving:

- refresh behavior,
- current visual styling,
- card hover behavior.

Do not redesign the registry page in this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/page.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: link capability registry to detail page"
```

### Task 6: Final polish, empty states, and verification

**Files:**
- Modify: `app/capabilities/[capabilityId]/page.jsx`
- Modify: `app/capabilities/[capabilityId]/components/CapabilityHistoryTable.jsx`
- Modify: `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
- Modify: `app/capabilities/[capabilityId]/components/CapabilityStatusHero.jsx`

- [ ] **Step 1: Add failing tests for edge states**

Extend tests for:

- capability 404 state,
- history fetch error while metadata succeeds,
- empty history state,
- disabled submit on invalid JSON or while test is in flight.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because those guardrails are not fully rendered yet.

- [ ] **Step 3: Implement the minimal polish**

Add:

- not-found fallback with link back to `/capabilities`,
- section-level retry affordances for health/history failures,
- empty history state copy,
- button disabled/loading states for test submission,
- refresh button loading affordance.

Do not add new feature scope here.

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx __tests__/unit/sdk-v2.test.js __tests__/unit/capability-health.route.test.js __tests__/unit/capability-history.route.test.js __tests__/unit/capability-test.route.test.js`

Expected: PASS.

- [ ] **Step 5: Run docs and route guard checks**

Run: `npm run docs:check`

Expected: `docs validation passed`

Run: `npm run route-sql:check`

Expected: `Route SQL guard passed`

- [ ] **Step 6: Run manual verification**

1. Start app: `npm run dev`
2. Open `/capabilities`
3. Open a capability detail page
4. Verify hero badges and health cards render
5. Change history filters and confirm rows update
6. Run a passing test and confirm health/history refresh
7. Run a failing test and confirm certification/history update

- [ ] **Step 7: Commit**

```bash
git add app/capabilities/page.jsx app/capabilities/[capabilityId]/page.jsx app/capabilities/[capabilityId]/components/CapabilityStatusHero.jsx app/capabilities/[capabilityId]/components/CapabilityHealthCards.jsx app/capabilities/[capabilityId]/components/CapabilityHistoryTable.jsx app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx app/capabilities/[capabilityId]/components/CapabilityFactsCard.jsx __tests__/unit/capability-detail.page.test.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: add capability operator detail page"
```

---

## Notes For The Implementer

- Keep the page operator-first. Do not drift into contract editing.
- Prefer local collocated components under `app/capabilities/[capabilityId]/components/`.
- Reuse existing badges and card primitives instead of inventing a new visual system.
- Keep fetch orchestration simple with `Promise.all` and explicit refresh helpers.
- Do not add new backend routes for this UI slice.
- If a file starts getting too large, extract a focused local component rather than growing the page container.

## Ready Check

- Spec reference: `docs/superpowers/specs/2026-04-07-capability-operator-ui-design.md`
- Existing backend APIs are already available
- Existing SDK and route tests already cover the capability control surface

Plan complete and saved to `docs/superpowers/plans/2026-04-07-capability-operator-ui.md`. Ready to execute?
