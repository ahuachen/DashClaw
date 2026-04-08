# Policy Advanced Import UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move policy pack import and raw YAML import behind an explicit advanced surface on `/policies`, so the normal operator lane stays focused on guided authoring and generation.

**Architecture:** Keep the existing import state and API behavior intact, but extract the current inline import block into a dedicated advanced drawer or modal component controlled from the policy action bar. This is an information-architecture cleanup, not a backend rewrite.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library

---

## File Map

### Existing files to modify

- `app/policies/page.jsx`
  - current policy surface with inline import UI
  - will gain an `Advanced import` trigger and render the new advanced surface
- `__tests__/unit/policies.page.test.jsx`
  - extend with assertions for advanced import behavior
- `docs/superpowers/specs/2026-04-08-policy-advanced-import-ux-design.md`
  - update only if implementation drifts

### New files to create

- `app/policies/components/PolicyAdvancedImportPanel.jsx`
  - advanced import container with mode switch, warning text, pack/YAML inputs, and result display

### Existing backend/tests to keep unchanged

- `__tests__/unit/policies-import.route.test.js`
- `/api/policies/import` route behavior

---

## Chunk 1: Advanced Import Surface

### Task 1: Add failing page coverage for the IA change

**Files:**
- Modify: `__tests__/unit/policies.page.test.jsx`
- Modify later: `app/policies/page.jsx`
- Create later: `app/policies/components/PolicyAdvancedImportPanel.jsx`

- [ ] **Step 1: Add a failing page test for advanced import visibility**

Extend `__tests__/unit/policies.page.test.jsx` with one focused test that verifies:
- raw YAML import is not visible by default
- `Advanced import` trigger exists
- clicking it reveals the expert surface
- switching between `Policy pack` and `Raw YAML` works
- import result remains inside that advanced surface

Mock fetch additions if needed:
- `/api/policies/import`

- [ ] **Step 2: Run the focused policies page test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/policies.page.test.jsx
```

Expected:
- FAIL because the current page still renders import inline

- [ ] **Step 3: Create the advanced import panel component**

Create `app/policies/components/PolicyAdvancedImportPanel.jsx`.

Responsibilities:
- render only when open
- show title: `Advanced import`
- show expert warning copy
- switch between `Policy pack` and `Raw YAML`
- render existing pack picker / YAML textarea / import button / result summary
- keep pack preview and import feedback within the panel

Inputs should be passed down from `page.jsx` so current state behavior is preserved:
- `open`
- `onClose`
- `importMode`, `setImportMode`
- `importPack`, `setImportPack`
- `importYaml`, `setImportYaml`
- `importing`
- `importResult`
- `handleImport`

- [ ] **Step 4: Refactor `app/policies/page.jsx` to use the advanced panel**

Update the page to:
- add `showAdvancedImport` state
- add `Advanced import` button in the policy action bar
- remove the always-visible inline import card
- render `PolicyAdvancedImportPanel` when appropriate

Keep:
- current import API behavior
- current import result state
- current pack preview copy from `PACK_PREVIEWS`

- [ ] **Step 5: Run the focused page test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/policies.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 6: Commit the UI slice**

```bash
git add app/policies/page.jsx app/policies/components/PolicyAdvancedImportPanel.jsx __tests__/unit/policies.page.test.jsx
git commit -m "feat: move policy import behind advanced panel"
```

---

## Chunk 2: Final Verification

### Task 2: Run repo checks and align docs

**Files:**
- Modify only if checks fail or file names drift

- [ ] **Step 1: Run focused policy coverage**

Run:

```bash
npx vitest run __tests__/unit/policies.page.test.jsx __tests__/unit/policy-generate.page.test.jsx __tests__/unit/policy-form-model.test.js
```

Expected:
- PASS

- [ ] **Step 2: Run docs validation**

```bash
npm run docs:check
```

Expected:
- PASS

- [ ] **Step 3: Run contracts validation**

```bash
npm run contracts:check
```

Expected:
- PASS

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 5: Update spec/plan references if implementation naming drifted**

If the advanced surface ends up using a drawer, modal, or different component name than planned, update:
- `docs/superpowers/specs/2026-04-08-policy-advanced-import-ux-design.md`
- this plan file

- [ ] **Step 6: Create final checkpoint commit**

```bash
git add docs/superpowers/specs/2026-04-08-policy-advanced-import-ux-design.md docs/superpowers/plans/2026-04-08-policy-advanced-import-ux.md
git commit -m "docs: align policy advanced import ux"
```

---

## Notes For Execution

- Keep this slice UI-only unless blocked.
- Do not break the existing import API shape.
- Do not let raw YAML return to the default main page view.
- Preserve in-session import text while the panel is open/closed if practical by keeping state in `page.jsx`.
