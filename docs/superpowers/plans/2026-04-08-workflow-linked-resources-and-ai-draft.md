# Workflow Linked Resources And AI Draft Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workflow-level linked resource pickers and a plain-English AI draft path that hydrates the same workflow editor without auto-saving.

**Architecture:** Extend the existing workflow create/detail editor with a workflow-level linked-resource model and UI, then add an AI-draft panel that normalizes generated output into the same editor state. Keep the persisted workflow schema unchanged wherever possible and treat the AI path as a draft generator rather than a separate authoring system.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library, existing DashClaw API routes, existing workflow builder helpers, existing workflow template CRUD routes

---

## File Structure

### Existing files to modify

- `app/workflows/new/page.jsx`
  - unify workflow basics, linked resources, steps, and AI draft hydration
- `app/workflows/[templateId]/page.jsx`
  - add workflow-level linked resource editing to the detail flow
- `app/lib/repositories/workflow-templates.repository.js`
  - only if needed to confirm or preserve linked workflow fields
- `app/api/workflows/templates/route.js`
  - only if create route needs clearer validation for linked fields
- `app/api/workflows/templates/[templateId]/route.js`
  - only if patch route needs clearer validation for linked fields
- existing workflow tests for create/detail

### New files to create

- `app/workflows/lib/workflowDraftFormModel.js`
  - canonical workflow-level draft shape for basics + linked resources + steps
- `app/workflows/lib/workflowAiDrafts.js`
  - normalize AI draft output into the canonical editor model
- `app/workflows/components/WorkflowLinkedResourcesSection.jsx`
  - workflow-level resource pickers
- `app/workflows/components/WorkflowAiDraftPanel.jsx`
  - plain-English prompt + API key panel
- `app/api/workflows/draft/route.js`
  - AI draft generation route if no suitable workflow draft route already exists
- `__tests__/unit/workflow-draft-form-model.test.js`
  - canonical draft model tests
- `__tests__/unit/workflow-ai-drafts.test.js`
  - AI draft normalization tests
- `__tests__/unit/workflow-ai-draft-panel.test.jsx`
  - AI panel interaction tests

### Existing tests to modify

- `__tests__/unit/workflow-new.page.test.jsx`
  - create flow now includes linked resource pickers and AI draft hydration
- `__tests__/unit/workflow-detail.page.test.jsx`
  - detail flow now includes linked resource pickers and save behavior

## Chunk 1: Canonical Workflow Draft Model

### Task 1: Add failing tests for the shared workflow draft model

**Files:**
- Create: `__tests__/unit/workflow-draft-form-model.test.js`
- Create: `app/workflows/lib/workflowDraftFormModel.js`

- [ ] **Step 1: Write the failing tests**

Cover:
- create default workflow draft state
- compile basics + linked resources + executable steps into the persisted workflow template payload
- decompile an existing workflow template into editor state
- preserve empty/default values without inventing invalid IDs

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-draft-form-model.test.js
```

Expected:
- FAIL because the model file does not exist yet

- [ ] **Step 3: Implement the minimal draft model**

Create `app/workflows/lib/workflowDraftFormModel.js` with:
- create/default draft helpers
- compile/decompile helpers
- linked resource field normalization

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-draft-form-model.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/lib/workflowDraftFormModel.js __tests__/unit/workflow-draft-form-model.test.js
git commit -m "feat: add workflow draft form model" --no-verify
```

## Chunk 2: Workflow-Level Linked Resource Editing

### Task 2: Add failing detail/create tests for linked resource pickers

**Files:**
- Modify: `__tests__/unit/workflow-new.page.test.jsx`
- Modify: `__tests__/unit/workflow-detail.page.test.jsx`
- Create: `app/workflows/components/WorkflowLinkedResourcesSection.jsx`

- [ ] **Step 1: Extend the page tests**

Add assertions for:
- model strategy single picker
- policies multi-select
- knowledge collections multi-select
- capabilities multi-select
- prompt templates multi-select
- capability tags input
- create/detail save paths still compile to current stored fields

- [ ] **Step 2: Run the page tests to verify failure**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- FAIL because the pages do not yet render or persist the new linked-resource section

- [ ] **Step 3: Implement the shared linked-resource section**

Create `WorkflowLinkedResourcesSection.jsx` and wire it into create/detail using real option lists from existing resource routes.

Keep the stored contract stable:
- `model_strategy_id`
- `linked_policy_ids`
- `linked_knowledge_collection_ids`
- `linked_capability_ids`
- `linked_prompt_template_ids`
- `linked_capability_tags`

- [ ] **Step 4: Run the page tests to verify they pass**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/components/WorkflowLinkedResourcesSection.jsx app/workflows/new/page.jsx app/workflows/[templateId]/page.jsx __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
git commit -m "feat: add workflow linked resource pickers" --no-verify
```

## Chunk 3: AI Draft Normalization

### Task 3: Add failing tests for AI draft normalization

**Files:**
- Create: `__tests__/unit/workflow-ai-drafts.test.js`
- Create: `app/workflows/lib/workflowAiDrafts.js`

- [ ] **Step 1: Write the failing tests**

Cover:
- normalize valid AI output into the canonical workflow editor model
- discard unsupported step types or convert them to supported ones when safe
- preserve suggested linked resources only when they map to real known options
- generate review notes for unsupported or unmapped content

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-ai-drafts.test.js
```

Expected:
- FAIL because the normalization module does not exist yet

- [ ] **Step 3: Implement the minimal AI draft normalizer**

Create `app/workflows/lib/workflowAiDrafts.js` with:
- draft normalization helpers
- linked resource mapping helpers
- supported step filtering/conversion helpers

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-ai-drafts.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/lib/workflowAiDrafts.js __tests__/unit/workflow-ai-drafts.test.js
git commit -m "feat: normalize ai workflow drafts" --no-verify
```

## Chunk 4: AI Draft Generation Panel

### Task 4: Add failing tests for the AI draft panel

**Files:**
- Create: `app/workflows/components/WorkflowAiDraftPanel.jsx`
- Create: `__tests__/unit/workflow-ai-draft-panel.test.jsx`

- [ ] **Step 1: Write the failing component test**

Cover:
- description textarea
- API key input
- optional “prefer existing linked resources” toggle
- disabled/loading state while generating
- submission callback payload

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-ai-draft-panel.test.jsx
```

Expected:
- FAIL because the panel component does not exist yet

- [ ] **Step 3: Implement the minimal panel**

Create the panel as a focused component that emits a generation request payload upward. Do not save anything directly from the component.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-ai-draft-panel.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/components/WorkflowAiDraftPanel.jsx __tests__/unit/workflow-ai-draft-panel.test.jsx
git commit -m "feat: add workflow ai draft panel" --no-verify
```

## Chunk 5: AI Draft Route And Editor Hydration

### Task 5: Add the AI draft route and wire it into the create flow

**Files:**
- Create: `app/api/workflows/draft/route.js`
- Modify: `app/workflows/new/page.jsx`
- Modify: `__tests__/unit/workflow-new.page.test.jsx`

- [ ] **Step 1: Extend the create-page test for AI hydration**

Add assertions for:
- opening the AI panel
- submitting description + API key
- route returning a draft
- draft hydrating the editor fields and linked resources
- user still needing to click `Create Template` to persist

- [ ] **Step 2: Run the create-page test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- FAIL because AI draft generation is not wired yet

- [ ] **Step 3: Implement the route and create-page hydration**

Add `app/api/workflows/draft/route.js` that:
- accepts description, API key, and generation options
- returns a normalized draft shape or raw generation result suitable for normalization

Then update `app/workflows/new/page.jsx` to:
- open the AI panel
- call the route
- normalize the returned draft
- hydrate the editor state

Do not auto-save.

- [ ] **Step 4: Run the create-page test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/workflow-new.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/workflows/draft/route.js app/workflows/new/page.jsx __tests__/unit/workflow-new.page.test.jsx
git commit -m "feat: generate workflow drafts with ai" --no-verify
```

## Chunk 6: Final Verification

### Task 6: Verify the complete workflow authoring slice

**Files:**
- Modify only if needed by drift:
  - `docs/superpowers/specs/2026-04-08-workflow-linked-resources-and-ai-draft-design.md`
  - `docs/superpowers/plans/2026-04-08-workflow-linked-resources-and-ai-draft.md`

- [ ] **Step 1: Run the workflow-focused test suite**

Run:

```bash
npx vitest run __tests__/unit/workflow-draft-form-model.test.js __tests__/unit/workflow-ai-drafts.test.js __tests__/unit/workflow-ai-draft-panel.test.jsx __tests__/unit/workflow-builder-resources.test.js __tests__/unit/workflow-variable-insert.test.jsx __tests__/unit/workflow-step-form-model.test.js __tests__/unit/workflow-new.page.test.jsx __tests__/unit/workflow-detail.page.test.jsx
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

- [ ] **Step 5: Commit the full authoring slice**

```bash
git add app/workflows app/api/workflows/draft __tests__/unit/workflow-* docs/superpowers/specs/2026-04-08-workflow-linked-resources-and-ai-draft-design.md docs/superpowers/plans/2026-04-08-workflow-linked-resources-and-ai-draft.md
git commit -m "feat: add ai-assisted workflow authoring" --no-verify
```

## Notes For Execution

- Keep one canonical editor model for manual and AI workflows.
- Do not silently persist the user’s API key.
- Do not auto-save generated workflows.
- Keep unsupported AI output visible as review feedback or normalization notes rather than inventing unsupported runtime data.
- Use the established Windows workflow in this repo:
  - run verification manually
  - commit with `--no-verify` because local hook shell wrappers are still broken
