# Policy Manual Authoring Guided UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual policy create/edit seam on the main Policies page with a guided, type-specific builder that compiles back into the existing policy API contract.

**Architecture:** Keep the current policy routes and overall page structure intact. Add a pure policy form-model layer plus small builder subcomponents so create and edit use the same parse, compile, and summary logic for the six supported policy types. The rest of the Policies page stays in place for this wave.

**Tech Stack:** Next.js App Router, React client components, existing DashClaw policy APIs, Vitest + Testing Library, repo docs/contract checks

---

## File Structure

### Existing files to modify

- `app/policies/page.jsx`
  Main Policies page. Keep overall structure, but replace the manual create/edit seam with the guided builder and shared summary logic.
- `__tests__/unit/policies.route.test.js`
  Keep the existing route contract in view while the UI compiles to the current payload shape.

### New files to create

- `app/policies/lib/policyFormModel.js`
  Pure helpers for default form state, parse/decompile, compile, and summary generation by policy type.
- `app/policies/components/PolicyBasicsSection.jsx`
  Policy name and policy type controls.
- `app/policies/components/PolicyRuleBuilderSection.jsx`
  Type-specific builder surface for the six supported policy types.
- `app/policies/components/PolicySummaryCard.jsx`
  Human-readable summary of the current policy.
- `app/policies/components/PolicyAuthoringPanel.jsx`
  Shared wrapper for create/edit authoring controls that composes basics, builder, summary, and scope.
- `__tests__/unit/policy-form-model.test.js`
  Pure helper tests for compile, decompile, and summaries.
- `__tests__/unit/policies.page.test.jsx`
  Main page tests for guided create/edit behavior.

## Implementation Notes

- Do not change the policy route contract in this slice. The UI must still submit the same fields the current route expects:
  - `name`
  - `policy_type`
  - `rules`
  - `agent_ids`
- Do not redesign the overall Policies page layout in wave 1.
- Do not touch AI generation, raw YAML import, template gallery, proof, or test-runner flows except where page wiring makes small compatibility changes unavoidable.
- The existing page already has some parse/build helpers mixed into it. Move those responsibilities into `policyFormModel.js` so create and edit use one source of truth.
- Prefer small subcomponents over adding more branching to the already-large page file.

## Chunk 1: Pure Policy Form Model Helpers

### Task 1: Add failing tests for policy form helpers

**Files:**
- Create: `__tests__/unit/policy-form-model.test.js`
- Create: `app/policies/lib/policyFormModel.js`

- [ ] **Step 1: Write the failing test**

Cover:
- default form state is valid for manual authoring
- compile produces the current payload shape for each policy type
- decompile parses persisted policy records back into type-specific form state
- summary generation is readable for:
  - risk threshold
  - require approval
  - block action type
  - rate limit
  - webhook check
  - semantic check

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/policy-form-model.test.js`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `app/policies/lib/policyFormModel.js` with focused pure helpers:
- `createDefaultPolicyFormState()`
- `compilePolicyPayload(formState)`
- `decompilePolicyForm(policy)`
- `buildPolicySummary(formState)`

Keep the implementation aligned to the current route payload shape and existing supported policy types.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/policy-form-model.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/unit/policy-form-model.test.js app/policies/lib/policyFormModel.js
git commit -m "test: add policy form model helpers"
```

## Chunk 2: Guided Create Authoring

### Task 2: Replace manual create authoring with the guided builder

**Files:**
- Create: `__tests__/unit/policies.page.test.jsx`
- Modify: `app/policies/page.jsx`
- Create: `app/policies/components/PolicyBasicsSection.jsx`
- Create: `app/policies/components/PolicyRuleBuilderSection.jsx`
- Create: `app/policies/components/PolicySummaryCard.jsx`
- Create: `app/policies/components/PolicyAuthoringPanel.jsx`

- [ ] **Step 1: Write the failing page test**

Cover:
- create panel renders structured fields instead of making the operator reason about rule JSON
- changing policy type swaps the rule builder inputs correctly
- summary updates as form values change
- create submits the compiled payload using the current route contract
- agent scope remains structured and serializes correctly

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/policies.page.test.jsx`

Expected: FAIL because the current create seam is not yet using the shared builder flow.

- [ ] **Step 3: Implement guided create authoring**

Update `app/policies/page.jsx` to:
- initialize create state from `createDefaultPolicyFormState()`
- replace ad hoc create helpers with the shared form-model layer
- render a shared authoring panel with basics, type-specific builder, scope, and summary
- submit the compiled create payload through the existing route

Keep unrelated page sections unchanged.

- [ ] **Step 4: Run page test to verify it passes**

Run: `npx vitest run __tests__/unit/policies.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run related create-flow checks**

Run:
- `npx vitest run __tests__/unit/policies.page.test.jsx __tests__/unit/policy-form-model.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/policies/page.jsx app/policies/components __tests__/unit/policies.page.test.jsx __tests__/unit/policy-form-model.test.js
git commit -m "feat: add guided policy creation"
```

## Chunk 3: Guided Edit Authoring

### Task 3: Move edit authoring to the same shared builder

**Files:**
- Modify: `app/policies/page.jsx`
- Modify: `app/policies/components/PolicyAuthoringPanel.jsx`
- Modify: `__tests__/unit/policies.page.test.jsx`

- [ ] **Step 1: Extend the failing page test for edit behavior**

Cover:
- opening edit mode loads persisted policy rules into the builder
- the same summary appears in edit mode
- editing and saving uses the compiled payload from the shared helper
- switching policy type during edit remains safe and predictable

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/policies.page.test.jsx`

Expected: FAIL on edit-specific assertions.

- [ ] **Step 3: Implement guided edit authoring**

Update the edit path in `app/policies/page.jsx` to:
- decompile selected policy into shared form state
- render the same authoring panel used by create
- save with `compilePolicyPayload(...)`
- remove duplicate parse/build logic from the page where possible

- [ ] **Step 4: Run page test to verify it passes**

Run: `npx vitest run __tests__/unit/policies.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run focused policy UI suite**

Run:
- `npx vitest run __tests__/unit/policy-form-model.test.js __tests__/unit/policies.page.test.jsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/policies/page.jsx app/policies/components __tests__/unit/policies.page.test.jsx
git commit -m "feat: add guided policy editing"
```

## Chunk 4: Final Verification And Docs Sync

### Task 4: Verify the slice and sync docs if needed

**Files:**
- Modify: `docs/superpowers/specs/2026-04-08-policy-manual-authoring-guided-ux-design.md` only if shipped behavior meaningfully differs

- [ ] **Step 1: Sync docs to shipped behavior**

Update only if the implementation meaningfully differs from the approved spec.

- [ ] **Step 2: Run focused policy UI tests**

Run:
- `npx vitest run __tests__/unit/policy-form-model.test.js __tests__/unit/policies.page.test.jsx`

Expected: PASS

- [ ] **Step 3: Run repository safety checks**

Run:
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

Expected: PASS

- [ ] **Step 4: Review changed scope**

Run:
- `git diff --stat`
- `git status --short`

Expected: only policy manual authoring UX, related tests, and intentionally updated docs are changed.

- [ ] **Step 5: Commit**

```bash
git add app/policies __tests__/unit docs/superpowers/specs/2026-04-08-policy-manual-authoring-guided-ux-design.md
git commit -m "feat: add guided policy authoring ux"
```

## Follow-On Plans

After this plan ships:

1. Create a separate plan for AI policy generator UX.
2. Create a separate plan for YAML import and policy-pack install cleanup.
3. Revisit overall Policies page information architecture only after the create/edit seam is stable.
