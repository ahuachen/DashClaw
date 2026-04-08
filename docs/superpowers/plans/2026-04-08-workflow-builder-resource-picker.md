# Workflow Builder Resource Picker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the workflow step builder so operators select real resources and insert runtime variables through guided controls instead of typing IDs and token syntax by hand.

**Architecture:** Keep the existing workflow runtime contract intact and layer the UX improvements on top. Add page-level resource loading and normalization, then feed those options into focused workflow-builder components that still compile back into the current executable step schema.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library, existing DashClaw API routes, existing workflow step form model helpers

---

## File Structure

### Existing files to modify

- `app/workflows/new/page.jsx`
  - load workflow-builder resource options for create flow
  - pass option data into the shared builder
- `app/workflows/[templateId]/page.jsx`
  - load workflow-builder resource options for detail flow
  - pass option data into the shared builder
- `app/workflows/components/WorkflowStepBuilder.jsx`
  - accept resource options and variable metadata
  - render a compact reference/help surface
- `app/workflows/components/WorkflowStepCard.jsx`
  - swap free-text resource fields for selectors
  - wire variable insertion into eligible fields
- `app/workflows/lib/workflowStepFormModel.js`
  - add helper functions for resource display names and variable token insertion

### New files to create

- `app/workflows/lib/workflowBuilderResources.js`
  - page-facing resource loading and normalization helpers
- `app/workflows/components/WorkflowVariableInsertButton.jsx`
  - compact inserter for workflow input and prior-step output tokens
- `app/workflows/components/WorkflowReferenceHelp.jsx`
  - small help panel explaining runtime variables and step references
- `__tests__/unit/workflow-builder-resources.test.js`
  - tests for resource normalization/loading helpers
- `__tests__/unit/workflow-variable-insert.test.jsx`
  - tests for variable insertion behavior

### Existing tests to modify

- `__tests__/unit/workflow-new.page.test.jsx`
  - assert resource selectors exist and compile back to stored IDs
- `__tests__/unit/workflow-detail.page.test.jsx`
  - assert detail flow uses resource selectors and preserves IDs
- `__tests__/unit/workflow-step-form-model.test.js`
  - cover any new helper behavior in the workflow form model

## Chunk 1: Resource Loading And Normalization

### Task 1: Add failing tests for workflow builder resource helpers

**Files:**
- Create: `__tests__/unit/workflow-builder-resources.test.js`
- Create: `app/workflows/lib/workflowBuilderResources.js`

- [ ] **Step 1: Write the failing tests**

Add tests covering:
- normalization of knowledge collections into `{ value, label, subtitle }`
- normalization of capabilities into display-friendly options
- normalization of prompt templates into display-friendly options
- fallback preservation when a saved workflow references a missing resource ID

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-builder-resources.test.js
```

Expected:
- FAIL because the helper module does not exist yet

- [ ] **Step 3: Implement the minimal helper module**

Create `app/workflows/lib/workflowBuilderResources.js` with:
- pure normalizers for collections, capabilities, and prompt templates
- helper to merge current saved IDs into option lists as “unavailable” fallback items

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-builder-resources.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/lib/workflowBuilderResources.js __tests__/unit/workflow-builder-resources.test.js
git commit -m "feat: add workflow resource normalization helpers" --no-verify
```

## Chunk 2: Guided Variable Insertion

### Task 2: Add failing tests for variable insertion helpers

**Files:**
- Create: `app/workflows/components/WorkflowVariableInsertButton.jsx`
- Test: `__tests__/unit/workflow-variable-insert.test.jsx`
- Modify: `app/workflows/lib/workflowStepFormModel.js`

- [ ] **Step 1: Write the failing component test**

Cover:
- rendering workflow-input and prior-step variable options
- invoking `onInsert` with the correct runtime token strings

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-variable-insert.test.jsx
```

Expected:
- FAIL because the component does not exist yet

- [ ] **Step 3: Implement the minimal variable insertion helpers**

Add:
- token builder helpers in `workflowStepFormModel.js`
- `WorkflowVariableInsertButton.jsx` that renders a small action and option list

Keep first-pass token groups limited to:
- workflow inputs
- prior step outputs

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-variable-insert.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/components/WorkflowVariableInsertButton.jsx app/workflows/lib/workflowStepFormModel.js __tests__/unit/workflow-variable-insert.test.jsx
git commit -m "feat: add workflow variable insertion helpers" --no-verify
```

## Chunk 3: Upgrade The Shared Step Card

### Task 3: Replace raw resource ID fields with guided selectors

**Files:**
- Modify: `app/workflows/components/WorkflowStepCard.jsx`
- Modify: `app/workflows/components/WorkflowStepBuilder.jsx`
- Modify: `app/workflows/lib/workflowStepFormModel.js`
- Modify: `__tests__/unit/workflow-step-form-model.test.js`

- [ ] **Step 1: Extend or add failing tests for selector-backed behavior**

Add assertions for:
- selected knowledge collection writes `collection_id`
- selected capability writes `capability_id`
- selected prompt template writes the correct stored value
- summaries prefer human-readable labels when available

- [ ] **Step 2: Run the relevant tests to verify failure**

Run:

```bash
npx vitest run __tests__/unit/workflow-step-form-model.test.js
```

Expected:
- FAIL on the new selector/summary expectations

- [ ] **Step 3: Implement the shared step-card changes**

Update `WorkflowStepCard.jsx` to:
- accept resource options and variable metadata
- use `select` or equivalent guided controls for:
  - knowledge collection
  - capability
  - prompt template
- add variable insertion controls for:
  - knowledge search query
  - capability payload value rows
  - prompt template override/system prompt

Keep the stored schema unchanged.

- [ ] **Step 4: Run the model/helper test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-step-form-model.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/components/WorkflowStepCard.jsx app/workflows/components/WorkflowStepBuilder.jsx app/workflows/lib/workflowStepFormModel.js __tests__/unit/workflow-step-form-model.test.js
git commit -m "feat: add guided workflow resource selectors" --no-verify
```

## Chunk 4: Wire Create And Detail Pages To Real Resource Options

### Task 4: Add page-level resource loading to the create flow

**Files:**
- Modify: `app/workflows/new/page.jsx`
- Modify: `__tests__/unit/workflow-new.page.test.jsx`
- Modify: `app/workflows/lib/workflowBuilderResources.js`

- [ ] **Step 1: Add failing create-page tests**

Cover:
- resource fetches for collections, capabilities, and prompt templates
- rendered selectors instead of raw ID inputs
- saving still posts the same runtime schema

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- FAIL because the page does not yet load or pass resource options

- [ ] **Step 3: Implement minimal create-page resource loading**

Update `app/workflows/new/page.jsx` to:
- load resource options on mount
- handle best-effort failures without blocking the form
- pass normalized options into `WorkflowStepBuilder`

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/new/page.jsx app/workflows/lib/workflowBuilderResources.js __tests__/unit/workflow-new.page.test.jsx
git commit -m "feat: load workflow builder resources on create" --no-verify
```

### Task 5: Add page-level resource loading to the detail flow

**Files:**
- Modify: `app/workflows/[templateId]/page.jsx`
- Modify: `__tests__/unit/workflow-detail.page.test.jsx`
- Create: `app/workflows/components/WorkflowReferenceHelp.jsx`

- [ ] **Step 1: Add failing detail-page tests**

Cover:
- detail flow renders real selectors for existing step resources
- missing saved IDs remain visible as unavailable fallback options
- help/reference panel renders in the builder flow

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- FAIL because the detail page does not yet load resource options or render the reference help panel

- [ ] **Step 3: Implement the detail-page resource wiring**

Update `app/workflows/[templateId]/page.jsx` to:
- load resource options after template fetch
- merge missing current IDs into option lists
- pass the resource/variable data into `WorkflowStepBuilder`
- render `WorkflowReferenceHelp.jsx` in the builder mode

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/[templateId]/page.jsx app/workflows/components/WorkflowReferenceHelp.jsx __tests__/unit/workflow-detail.page.test.jsx
git commit -m "feat: load workflow builder resources on detail" --no-verify
```

## Chunk 5: Full Verification And Final Docs Sync

### Task 6: Verify the complete workflow-builder polish slice

**Files:**
- Modify as needed: `docs/superpowers/specs/2026-04-08-workflow-builder-resource-picker-design.md`
- Create or modify only if needed by drift: `docs/superpowers/plans/2026-04-08-workflow-builder-resource-picker.md`

- [ ] **Step 1: Run the workflow-focused test suite**

Run:

```bash
npx vitest run __tests__/unit/workflow-builder-resources.test.js __tests__/unit/workflow-variable-insert.test.jsx __tests__/unit/workflow-step-form-model.test.js __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 2: Run docs validation**

Run:

```bash
npm run docs:check
```

Expected:
- `docs validation passed`

- [ ] **Step 3: Run contract validation**

Run:

```bash
npm run contracts:check
```

Expected:
- `contracts check passed`

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected:
- successful Next.js production build

- [ ] **Step 5: Commit the final polish slice**

```bash
git add app/workflows __tests__/unit/workflow-* docs/superpowers/specs/2026-04-08-workflow-builder-resource-picker-design.md docs/superpowers/plans/2026-04-08-workflow-builder-resource-picker.md
git commit -m "feat: add guided workflow resource pickers" --no-verify
```

## Notes For Execution

- Do not change the workflow runtime contract unless a test proves it is necessary.
- Prefer dropdown selectors and insert-variable affordances over inventing new raw text conventions.
- If a saved resource is missing, preserve its ID visibly rather than clearing it.
- Keep the builder resilient when option fetches fail.
- The local Windows Git hook wrapper is known broken in this environment; run verification manually and use `--no-verify` for commits as already established.
