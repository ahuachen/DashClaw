# Workflow Executable Step Builder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the misleading workflow step canvas with a guided executable step builder that matches DashClaw's real sequential workflow runtime.

**Architecture:** Introduce a canonical UI-side executable step schema with compile/decompile helpers, then swap both workflow create and detail pages to a list-based step builder. Preserve an advanced source view and add explicit fallback handling for older graph-shaped step data instead of pretending it is executable.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library

---

## File Map

### Existing files to modify

- `app/workflows/new/page.jsx`
  - currently uses the visual canvas on create
  - will switch to the guided executable step builder
- `app/workflows/[templateId]/page.jsx`
  - currently defaults to visual canvas + source
  - will default to guided builder + advanced source fallback
- `__tests__/unit/workflow-new.page.test.jsx`
  - extend or create focused create-page coverage
- `__tests__/unit/workflow-detail.page.test.jsx`
  - extend or create focused detail-page coverage
- `docs/superpowers/specs/2026-04-08-workflow-executable-step-builder-design.md`
  - update only if implementation naming or boundaries drift

### New files to create

- `app/workflows/lib/workflowStepFormModel.js`
  - canonical executable-step helpers
  - create default step shapes
  - compile/decompile runtime step data
  - detect old graph-shaped data
  - generate step summaries
- `app/workflows/components/WorkflowStepBuilder.jsx`
  - main ordered step builder
- `app/workflows/components/WorkflowStepCard.jsx`
  - one editable step row
- `app/workflows/components/WorkflowStepTypePicker.jsx`
  - add-step entry point
- `app/workflows/components/WorkflowStepLegacyNotice.jsx`
  - warning/fallback for old graph-shaped step data
- `__tests__/unit/workflow-step-form-model.test.js`
  - helper coverage

### Existing files to leave alone

- `app/lib/workflow-executor.js`
- `app/lib/step-handlers.js`
- `/api/workflows/templates/*`

This slice is UI-model alignment, not runtime expansion.

---

## Chunk 1: Canonical Step Schema

### Task 1: Add the executable step helper layer first

**Files:**
- Create: `app/workflows/lib/workflowStepFormModel.js`
- Create: `__tests__/unit/workflow-step-form-model.test.js`

- [ ] **Step 1: Write failing helper tests for the canonical step schema**

Cover:
- create default step by type
- summarize each supported step type
- compile/decompile runtime step arrays
- detect graph-shaped legacy step data
- return a readable fallback state for unsupported legacy graphs

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-step-form-model.test.js
```

Expected:
- FAIL because the helper module does not exist yet

- [ ] **Step 3: Implement `workflowStepFormModel.js`**

Add:
- supported step type constants:
  - `knowledge_search`
  - `capability_invoke`
  - `prompt`
- `createDefaultExecutableStep(type)`
- `buildWorkflowStepSummary(step)`
- `normalizeExecutableSteps(input)`
- `isLegacyWorkflowGraph(input)`
- `buildLegacyWorkflowFallback(input)`

The output model should align to:

```js
{
  id: 'step_1',
  type: 'knowledge_search',
  name: 'Find policy context',
  config: {
    collection_id: '',
    query: '',
    top_k: 5
  }
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-step-form-model.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit the schema helper slice**

```bash
git add app/workflows/lib/workflowStepFormModel.js __tests__/unit/workflow-step-form-model.test.js
git commit -m "feat: add workflow executable step schema helpers"
```

---

## Chunk 2: Create Page Builder

### Task 2: Replace the new-workflow canvas with the guided builder

**Files:**
- Create: `app/workflows/components/WorkflowStepBuilder.jsx`
- Create: `app/workflows/components/WorkflowStepCard.jsx`
- Create: `app/workflows/components/WorkflowStepTypePicker.jsx`
- Modify: `app/workflows/new/page.jsx`
- Modify or Create: `__tests__/unit/workflow-new.page.test.jsx`

- [ ] **Step 1: Write failing create-page coverage**

Cover:
- empty state explains steps run in order
- user can add a supported step type
- step fields appear for the selected type
- create page submits the compiled executable step array
- no React Flow / graph-only controls are rendered

- [ ] **Step 2: Run the create-page test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- FAIL because the old canvas is still present

- [ ] **Step 3: Implement the shared builder components**

`WorkflowStepBuilder.jsx` should:
- render ordered steps
- support add / move up / move down / duplicate / delete
- call `onChange` with the canonical executable step array

`WorkflowStepCard.jsx` should:
- render type-specific fields
- show a human-readable summary
- allow collapse/expand

`WorkflowStepTypePicker.jsx` should:
- offer only the three supported runtime step types

- [ ] **Step 4: Replace the create-page steps section**

Update `app/workflows/new/page.jsx` to:
- remove `WorkflowEditor`
- use `WorkflowStepBuilder`
- initialize with `[]` instead of `null`
- submit executable steps directly
- explain that workflows currently execute steps in order

- [ ] **Step 5: Run the create-page test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 6: Commit the create-page builder slice**

```bash
git add app/workflows/new/page.jsx app/workflows/components/WorkflowStepBuilder.jsx app/workflows/components/WorkflowStepCard.jsx app/workflows/components/WorkflowStepTypePicker.jsx __tests__/unit/workflow-new.page.test.jsx
git commit -m "feat: replace workflow create canvas with step builder"
```

---

## Chunk 3: Detail Page Migration And Fallbacks

### Task 3: Replace the detail-page default editor and support old graph data honestly

**Files:**
- Create: `app/workflows/components/WorkflowStepLegacyNotice.jsx`
- Modify: `app/workflows/[templateId]/page.jsx`
- Modify or Create: `__tests__/unit/workflow-detail.page.test.jsx`

- [ ] **Step 1: Write failing detail-page coverage**

Cover:
- detail page defaults to guided builder
- source remains available as advanced fallback
- old graph-shaped step data shows a warning instead of pretending it is executable
- save uses executable step arrays from the builder

- [ ] **Step 2: Run the detail-page test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- FAIL because the old visual editor is still the default

- [ ] **Step 3: Implement legacy fallback notice**

`WorkflowStepLegacyNotice.jsx` should explain:
- this template contains older graph-shaped step data
- DashClaw cannot safely interpret it as executable ordered steps
- use source mode or rebuild the steps in the new builder

- [ ] **Step 4: Replace the detail-page default editor**

Update `app/workflows/[templateId]/page.jsx` to:
- replace default visual mode with builder mode
- rename tabs if needed to:
  - `Builder`
  - `Source`
- use helper detection for legacy graph-shaped data
- render `WorkflowStepLegacyNotice` when needed
- only offer builder editing for real executable step arrays

- [ ] **Step 5: Run the detail-page test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 6: Commit the detail/fallback slice**

```bash
git add app/workflows/[templateId]/page.jsx app/workflows/components/WorkflowStepLegacyNotice.jsx __tests__/unit/workflow-detail.page.test.jsx
git commit -m "feat: align workflow detail editor with executable steps"
```

---

## Chunk 4: Final Verification

### Task 4: Run repo checks and align docs

**Files:**
- Modify only if implementation naming or file boundaries drifted

- [ ] **Step 1: Run focused workflow UI/helper coverage**

Run:

```bash
npx vitest run __tests__/unit/workflow-step-form-model.test.js __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 2: Run docs validation**

Run:

```bash
npm run docs:check
```

Expected:
- PASS

- [ ] **Step 3: Run contracts validation**

Run:

```bash
npm run contracts:check
```

Expected:
- PASS

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 5: Update spec/plan references if naming drifted**

If the final component/helper names differ, update:
- `docs/superpowers/specs/2026-04-08-workflow-executable-step-builder-design.md`
- this plan file

- [ ] **Step 6: Create final checkpoint commit**

```bash
git add docs/superpowers/specs/2026-04-08-workflow-executable-step-builder-design.md docs/superpowers/plans/2026-04-08-workflow-executable-step-builder.md
git commit -m "docs: align workflow executable step builder plan"
```

---

## Notes For Execution

- Keep this slice aligned to the current runtime only.
- Do not introduce fake branching or canvas semantics.
- Do not extend the backend executor in this plan.
- Be explicit when old graph-shaped step data cannot be safely converted.
- Prefer guided fields and summaries over raw JSON on the create/detail pages.
