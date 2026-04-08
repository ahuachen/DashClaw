# Capability Guided Runtime UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current confusing capability creation and testing flow with a guided operator experience that distinguishes registry-only entries from runnable HTTP capabilities and removes raw JSON as the default path.

**Architecture:** Keep the existing capability runtime contracts and routes, but add a guided UI layer that compiles structured form state into the existing `invocation_schema` shape. Split creation into capability mode selection, a runnable HTTP builder, and a generated test-input experience on the detail page, while preserving advanced/raw editing as an explicit fallback.

**Tech Stack:** Next.js App Router, React client components, existing DashClaw capability APIs, Vitest + Testing Library, repo docs/contract checks

---

## File Structure

### Existing files to modify

- `app/capabilities/new/page.jsx`
  Current capability registration page. Will become the guided entry point instead of a metadata-only form.
- `app/capabilities/[capabilityId]/page.jsx`
  Current capability detail page. Will use structured test state and clearer runtime-vs-registry gating.
- `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
  Currently raw JSON-first. Will become the guided test form with advanced fallback.
- `app/capabilities/components/CapabilityRegistryCard.jsx`
  Registry cards should surface registry-only vs runnable state correctly.
- `app/lib/repositories/capabilities.repository.js`
  Existing repository already supports `invocation_schema`; may need small normalization support if the UI stores structured helper data before compiling.
- `__tests__/unit/capabilities.page.test.jsx`
  Update expectations around registry card state and test button visibility.
- `__tests__/unit/capability-detail.page.test.jsx`
  Extend for guided test inputs, gating, and advanced mode.

### New files to create

- `app/capabilities/lib/capabilityFormModel.js`
  Pure helpers for:
  - capability mode classification
  - compile structured HTTP builder state into `invocation_schema`
  - derive test form fields from stored schema
  - build human-readable runtime state
- `app/capabilities/new/components/CapabilityModeSelector.jsx`
  Mode selector for `registry_only` vs `runnable_http`.
- `app/capabilities/new/components/CapabilityBasicsSection.jsx`
  Shared metadata fields.
- `app/capabilities/new/components/CapabilityHttpRuntimeSection.jsx`
  Endpoint, method, timeout, auth, and input field builder.
- `app/capabilities/new/components/CapabilitySummaryCard.jsx`
  Human-readable preview of what the capability will do.
- `app/capabilities/[capabilityId]/components/CapabilityGeneratedTestForm.jsx`
  Structured test form built from runtime input fields.
- `__tests__/unit/capability-form-model.test.js`
  Pure function coverage for compile/derive logic.
- `__tests__/unit/capability-new.page.test.jsx`
  Guided create-flow tests.

## Implementation Notes

- Do not change the capability runtime route contract in this slice unless a small compatibility field is unavoidable.
- Guided UI should compile to the current repository/API contract so existing SDK/runtime work remains valid.
- The capability runtime still only executes `http_api` capabilities. The UI must make that explicit instead of pretending all source types are runnable.
- Raw JSON should remain available only behind an advanced disclosure, and only where it is still helpful.
- Registry-only capabilities must not present test/invoke affordances as if they were runnable.

## Chunk 1: Pure Form Model And Runtime Classification

### Task 1: Add failing tests for capability form model helpers

**Files:**
- Create: `__tests__/unit/capability-form-model.test.js`
- Create: `app/capabilities/lib/capabilityFormModel.js`

- [ ] **Step 1: Write the failing test**

Cover:
- registry-only mode compiles without `invocation_schema`
- runnable HTTP mode compiles structured endpoint/auth/input state into current `invocation_schema`
- stored `invocation_schema.input_schema` derives operator test fields
- helper detects when a capability is runnable vs metadata-only

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-form-model.test.js`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `app/capabilities/lib/capabilityFormModel.js` with focused pure helpers:
- `compileCapabilityPayload(formState)`
- `deriveCapabilityMode(capability)`
- `deriveGeneratedInputFields(capability)`
- `isRunnableHttpCapability(capability)`

Keep the implementation small and deterministic.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-form-model.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/lib/capabilityFormModel.js __tests__/unit/capability-form-model.test.js
git commit -m "test: add capability form model helpers"
```

## Chunk 2: Guided Capability Creation Page

### Task 2: Add failing page tests for the new create flow

**Files:**
- Create: `__tests__/unit/capability-new.page.test.jsx`
- Modify: `app/capabilities/new/page.jsx`
- Create: `app/capabilities/new/components/CapabilityModeSelector.jsx`
- Create: `app/capabilities/new/components/CapabilityBasicsSection.jsx`
- Create: `app/capabilities/new/components/CapabilityHttpRuntimeSection.jsx`
- Create: `app/capabilities/new/components/CapabilitySummaryCard.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- mode selector defaults to registry-only
- switching to runnable HTTP reveals endpoint/auth/input builder controls
- registry-only submit omits runtime schema
- runnable HTTP submit includes compiled `invocation_schema`
- page explains that only HTTP capabilities are runnable in this version

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-new.page.test.jsx`

Expected: FAIL because the current page does not have mode-based behavior or runtime builder sections.

- [ ] **Step 3: Implement the guided page**

Update `app/capabilities/new/page.jsx` to:
- split creation into mode selection
- use structured shared metadata inputs
- compile runnable HTTP state through `compileCapabilityPayload(...)`
- present a summary card
- position advanced/raw editing as optional, not default

Add small focused components rather than growing the page further.

- [ ] **Step 4: Run page test to verify it passes**

Run: `npx vitest run __tests__/unit/capability-new.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run related create-flow checks**

Run:
- `npx vitest run __tests__/unit/capability-new.page.test.jsx __tests__/unit/capabilities.repository.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/capabilities/new/page.js app/capabilities/new/components app/capabilities/lib/capabilityFormModel.js __tests__/unit/capability-new.page.test.jsx __tests__/unit/capabilities.repository.test.js
git commit -m "feat: add guided capability creation flow"
```

## Chunk 3: Structured Capability Test Flow

### Task 3: Add failing tests for generated test inputs and runtime gating

**Files:**
- Modify: `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
- Create: `app/capabilities/[capabilityId]/components/CapabilityGeneratedTestForm.jsx`
- Modify: `app/capabilities/[capabilityId]/page.jsx`
- Modify: `__tests__/unit/capability-detail.page.test.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- registry-only capability hides or disables test actions with explanatory copy
- runnable HTTP capability with input schema renders generated fields instead of only raw JSON
- advanced payload editor can still be opened manually
- structured submit still posts the compiled JSON body to `/api/capabilities/:id/test`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: FAIL because the current page always renders the raw JSON-first test panel when opened.

- [ ] **Step 3: Implement generated test form and gating**

Use the form-model helpers to:
- decide whether the capability is runnable
- derive structured input controls from stored schema
- only show advanced raw payload editing behind a disclosure
- show clearer runtime state when a capability is registry-only or incomplete

Keep the request contract unchanged: the detail page should still POST normal JSON to the existing test route.

- [ ] **Step 4: Run detail-page tests**

Run: `npx vitest run __tests__/unit/capability-detail.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run runtime-adjacent tests**

Run:
- `npx vitest run __tests__/unit/capability-detail.page.test.jsx __tests__/unit/capability-test.route.test.js __tests__/unit/capability-runtime.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/capabilities/[capabilityId]/page.jsx app/capabilities/[capabilityId]/components __tests__/unit/capability-detail.page.test.jsx __tests__/unit/capability-test.route.test.js __tests__/unit/capability-runtime.test.js
git commit -m "feat: add guided capability testing UX"
```

## Chunk 4: Registry Surface Cleanup

### Task 4: Align registry cards with runnable-vs-registry-only state

**Files:**
- Modify: `app/capabilities/page.jsx`
- Modify: `app/capabilities/components/CapabilityRegistryCard.jsx`
- Modify: `__tests__/unit/capabilities.page.test.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- registry-only cards show metadata-only or not-runnable state
- quick `Run Test` is not shown for non-runnable capabilities
- runnable HTTP cards keep quick-test support

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/capabilities.page.test.jsx`

Expected: FAIL because the current cards treat runtime actions too generically.

- [ ] **Step 3: Implement registry card cleanup**

Update the registry merge/render path to classify capabilities consistently and render:
- runnable HTTP
- registry-only
- misconfigured runnable

Use copy that matches the new create/detail flow.

- [ ] **Step 4: Run page test to verify it passes**

Run: `npx vitest run __tests__/unit/capabilities.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/capabilities/page.jsx app/capabilities/components/CapabilityRegistryCard.jsx __tests__/unit/capabilities.page.test.jsx
git commit -m "feat: clarify capability registry runtime state"
```

## Chunk 5: Docs, Final Verification, And Handoff

### Task 5: Update docs and verify the slice end-to-end

**Files:**
- Modify: `docs/superpowers/specs/2026-04-07-operator-config-ux-design.md` if implementation details differ
- Optionally modify: `sdk/README.md` only if user-facing capability creation/testing examples materially change

- [ ] **Step 1: Sync docs to shipped behavior**

Update any implementation-specific docs that would otherwise overpromise or mismatch the new guided capability flow.

- [ ] **Step 2: Run targeted UI/runtime tests**

Run:
- `npx vitest run __tests__/unit/capability-form-model.test.js __tests__/unit/capability-new.page.test.jsx __tests__/unit/capability-detail.page.test.jsx __tests__/unit/capabilities.page.test.jsx`

Expected: PASS

- [ ] **Step 3: Run safety checks**

Run:
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

Expected: PASS

- [ ] **Step 4: Review changed scope**

Run:
- `git diff --stat`
- `git status --short`

Expected: only capability UX, related tests, and any intentionally updated docs are changed.

- [ ] **Step 5: Commit**

```bash
git add app/capabilities app/capabilities/lib __tests__/unit docs/superpowers/specs/2026-04-07-operator-config-ux-design.md sdk/README.md
git commit -m "feat: add guided capability runtime UX"
```

## Follow-On Plans

After this plan ships:

1. Create a separate plan for Model Strategies guided builder UX
2. Create a separate plan for Policies guided authoring + advanced import cleanup

Do not mix those into this execution cycle unless the capability work reveals a reusable shared component worth extracting immediately.
