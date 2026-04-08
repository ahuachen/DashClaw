# Policy Generator Draft UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the AI policy generator into a structured draft flow that fills the guided policy editor instead of making operators review raw JSON as the primary output.

**Architecture:** Keep the existing `/api/policies/generate` backend contract as the generation source, add a small adapter layer that normalizes generated policies into the shared policy form model, and rebuild the generator page around candidate cards plus a selected draft editor. Use the existing `compilePolicyPayload(...)` path so manual and AI-assisted authoring persist through the same policy contract.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library, existing policy form helpers in `app/policies/lib/policyFormModel.js`

---

## File Map

### Existing files to modify

- `app/policies/generate/page.jsx`
  - Current raw preview/create screen for AI-generated policies.
  - Will become the draft candidate + guided editor page.
- `app/policies/lib/policyFormModel.js`
  - Shared policy form model already used by manual create/edit.
  - May need one or two helper exports if the generator adapter benefits from them, but avoid bloating it.
- `docs/superpowers/specs/2026-04-08-policy-generator-draft-ux-design.md`
  - Keep aligned only if implementation meaningfully diverges.

### New files to create

- `app/policies/generate/lib/policyGeneratorDrafts.js`
  - Adapter layer that converts generated policy payloads into guided draft state.
  - Responsible for:
    - normalized form state
    - human-readable draft summary
    - advanced-detail detection
    - preserved raw payload for disclosure mode
- `app/policies/generate/components/PolicyDraftCandidateList.jsx`
  - Renders selectable AI draft candidates.
- `app/policies/generate/components/PolicyDraftCandidateCard.jsx`
  - Renders one candidate card with name, type, confidence, summary, and warning state.
- `app/policies/generate/components/PolicyGeneratedDraftEditor.jsx`
  - Wraps the shared `PolicyAuthoringPanel` with generator-specific warning and save affordances.
- `app/policies/generate/components/PolicyGeneratedAdvancedDetails.jsx`
  - Collapsed advanced/raw details view for unsupported shapes and raw generated payload.
- `__tests__/unit/policy-generator-drafts.test.js`
  - Focused adapter tests.
- `__tests__/unit/policy-generate.page.test.jsx`
  - Focused UI tests for generate → select draft → edit → save.

### Existing tests to keep green

- `__tests__/unit/policy-generate.route.test.js`
- `__tests__/unit/policies.page.test.jsx`
- `__tests__/unit/policy-form-model.test.js`

---

## Chunk 1: Draft Adapter Layer

### Task 1: Add failing draft adapter tests

**Files:**
- Create: `__tests__/unit/policy-generator-drafts.test.js`
- Reference: `app/policies/lib/policyFormModel.js`
- Create later: `app/policies/generate/lib/policyGeneratorDrafts.js`

- [ ] **Step 1: Write the failing test file for generated draft normalization**

Cover at least:
- a supported generated risk-threshold policy normalizes into form state
- a supported generated require-approval policy normalizes into form state
- advanced/unsupported details are flagged instead of dropped silently
- the adapter returns a readable summary

Use fixture shapes that match the current generator route output, for example:

```js
const generatedPolicy = {
  name: 'Require deploy approval',
  policy_type: 'require_approval',
  rules: {
    action_types: ['deploy'],
    action: 'require_approval',
  },
  confidence: 0.92,
};
```

- [ ] **Step 2: Run the adapter tests to verify they fail**

Run:

```bash
npx vitest run __tests__/unit/policy-generator-drafts.test.js
```

Expected:
- FAIL because `app/policies/generate/lib/policyGeneratorDrafts.js` does not exist yet

- [ ] **Step 3: Implement the minimal draft adapter**

Create `app/policies/generate/lib/policyGeneratorDrafts.js` with small focused exports:

- `normalizeGeneratedPolicyDraft(generatedPolicy)`
- `normalizeGeneratedPolicyDrafts(generatedPolicies)`

Recommended output shape per draft:

```js
{
  id: 'generated-0',
  name: 'Require deploy approval',
  confidence: 0.92,
  formState: {
    name: 'Require deploy approval',
    type: 'require_approval',
    actionTypes: ['deploy'],
    ...
  },
  summary: 'Require approval for deploy actions.',
  hasAdvancedDetails: false,
  advancedDetails: null,
  rawPolicy: generatedPolicy,
}
```

For unsupported fields:
- preserve them under `advancedDetails`
- set `hasAdvancedDetails: true`
- still return the best possible `formState`

- [ ] **Step 4: Run the adapter tests to verify they pass**

Run:

```bash
npx vitest run __tests__/unit/policy-generator-drafts.test.js
```

Expected:
- PASS

- [ ] **Step 5: Commit the adapter slice**

```bash
git add __tests__/unit/policy-generator-drafts.test.js app/policies/generate/lib/policyGeneratorDrafts.js
git commit -m "feat: normalize generated policy drafts"
```

---

## Chunk 2: Generator Page Draft UX

### Task 2: Add failing page tests for the new draft flow

**Files:**
- Create: `__tests__/unit/policy-generate.page.test.jsx`
- Modify later: `app/policies/generate/page.jsx`

- [ ] **Step 1: Write the failing page test**

Cover at least:
- page no longer uses raw JSON as the primary review surface
- generate request shows selectable candidate cards
- selecting a candidate loads guided fields
- editing the guided fields updates the summary
- save posts to `/api/policies` using `compilePolicyPayload(...)` semantics
- advanced details stay behind a disclosure

Mock fetch for:
- `POST /api/policies/generate` (dry run)
- `POST /api/policies`

Recommended UI assertions:
- candidate card text: generated name + type + summary
- editor contains `Policy Name`, `Policy Type`, shared rule controls, `Policy summary`
- no visible raw `<pre>` block as the primary review state

- [ ] **Step 2: Run the page test to verify it fails**

Run:

```bash
npx vitest run __tests__/unit/policy-generate.page.test.jsx
```

Expected:
- FAIL because the current page still shows raw preview JSON and direct create behavior

- [ ] **Step 3: Build the draft candidate components**

Create:
- `app/policies/generate/components/PolicyDraftCandidateList.jsx`
- `app/policies/generate/components/PolicyDraftCandidateCard.jsx`

Responsibilities:
- list candidate drafts
- highlight selected draft
- show confidence if present
- show advanced-review warning badge if needed
- show summary text from the draft adapter

Keep the cards simple and focused.

- [ ] **Step 4: Build the structured generated draft editor**

Create:
- `app/policies/generate/components/PolicyGeneratedDraftEditor.jsx`
- `app/policies/generate/components/PolicyGeneratedAdvancedDetails.jsx`

The editor should:
- reuse `PolicyAuthoringPanel`
- take `form`, `setForm`, `agents`, `policyTypes`, `actionOptions`
- render a generator-specific heading like `Generated Draft`
- show a warning if `hasAdvancedDetails`
- keep raw JSON/details hidden behind an `Advanced details` toggle

- [ ] **Step 5: Refactor `app/policies/generate/page.jsx` to the new draft flow**

Update the page to:
- keep prompt input and `Generate Drafts`
- replace `preview` with normalized `drafts`
- default-select the first candidate after generation
- remove primary checkbox/bulk-create preview behavior
- load the selected draft into editable form state
- save a single reviewed draft by calling `/api/policies` with `compilePolicyPayload(formState)`
- preserve success/error messaging

Recommended state shape:

```js
const [drafts, setDrafts] = useState([]);
const [selectedDraftId, setSelectedDraftId] = useState(null);
const [draftForm, setDraftForm] = useState(null);
```

When switching candidates:
- load the selected candidate’s normalized `formState` into `draftForm`

- [ ] **Step 6: Run the page test to verify it passes**

Run:

```bash
npx vitest run __tests__/unit/policy-generate.page.test.jsx
```

Expected:
- PASS

- [ ] **Step 7: Run the focused policy suite**

Run:

```bash
npx vitest run __tests__/unit/policy-generator-drafts.test.js __tests__/unit/policy-generate.page.test.jsx __tests__/unit/policy-generate.route.test.js __tests__/unit/policies.page.test.jsx __tests__/unit/policy-form-model.test.js
```

Expected:
- PASS

- [ ] **Step 8: Commit the UI slice**

```bash
git add app/policies/generate app/policies/lib __tests__/unit/policy-generator-drafts.test.js __tests__/unit/policy-generate.page.test.jsx __tests__/unit/policy-generate.route.test.js
git commit -m "feat: convert policy generator to guided drafts"
```

---

## Chunk 3: Final Verification And Alignment

### Task 3: Run repo verification and fix any drift

**Files:**
- Modify only if checks fail

- [ ] **Step 1: Run docs validation**

```bash
npm run docs:check
```

Expected:
- PASS

- [ ] **Step 2: Run contracts validation**

```bash
npm run contracts:check
```

Expected:
- PASS

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 4: Update spec/plan references if file paths or naming drifted**

If the implementation required:
- `page.jsx` rename
- alternate component names
- adjusted command examples

then update:
- `docs/superpowers/specs/2026-04-08-policy-generator-draft-ux-design.md`
- this plan file

- [ ] **Step 5: Create the final checkpoint commit**

```bash
git add docs/superpowers/specs/2026-04-08-policy-generator-draft-ux-design.md docs/superpowers/plans/2026-04-08-policy-generator-draft-ux.md
git commit -m "docs: align policy generator draft flow"
```

---

## Notes For Execution

- Keep the backend route behavior as-is unless the UI is blocked without a narrow route change.
- Do not reintroduce raw JSON as the primary operator review surface.
- Reuse `PolicyAuthoringPanel` and `compilePolicyPayload(...)` instead of duplicating policy logic inside the generator page.
- If generated data cannot be fully modeled, degrade gracefully with `Advanced details` rather than failing or silently discarding fields.
