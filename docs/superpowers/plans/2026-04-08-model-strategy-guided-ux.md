# Model Strategy Guided UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw JSON-first model strategy authoring with a guided builder for create and detail flows, while preserving advanced task-mode and raw-config escape hatches.

**Architecture:** Keep the existing model strategy API and repository contract unchanged. Introduce a pure form-model layer that decompiles persisted `config` objects into structured builder state and compiles the builder state back into the same `config` shape on save. Use shared builder components across create and detail pages, with advanced task modes behind a collapsed section and raw JSON only as an explicit fallback.

**Tech Stack:** Next.js App Router, React client components, existing DashClaw model strategy APIs, Vitest + Testing Library, repo docs/contract checks

---

## File Structure

### Existing files to modify

- `app/model-strategies/new/page.js`
  Current create page. Replace the raw JSON textarea with a guided builder.
- `app/model-strategies/[strategyId]/page.js`
  Current detail/edit page. Replace the raw JSON editor with the same guided builder and summary.
- `__tests__/unit/model-strategies.repository.test.js`
  Keep the repository contract in view while the UI compiles back to the same config shape.

### New files to create

- `app/model-strategies/lib/modelStrategyFormModel.js`
  Pure helper layer for defaults, compile, decompile, summary generation, and advanced/raw fallback detection.
- `app/model-strategies/components/ModelStrategyBasicsSection.jsx`
  Name and description fields.
- `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
  Primary provider/model, fallback chain, and retries.
- `app/model-strategies/components/ModelStrategyConstraintsSection.jsx`
  Budget cap, latency, cost sensitivity, allow/block provider lists.
- `app/model-strategies/components/ModelStrategySummaryCard.jsx`
  Human-readable strategy summary.
- `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
  Collapsed advanced section for task-mode overrides and raw JSON fallback.
- `__tests__/unit/model-strategy-form-model.test.js`
  Pure helper coverage.
- `__tests__/unit/model-strategies-new.page.test.jsx`
  Create page guided-builder tests.
- `__tests__/unit/model-strategies-detail.page.test.jsx`
  Detail page guided-builder tests.

## Implementation Notes

- Do not change the backend route contract in this slice. The UI must still submit `config` in the existing shape expected by the repository and API routes.
- The main guided path should only cover the common default strategy behavior:
  - primary provider
  - primary model
  - fallback chain
  - retries
  - budget
  - latency
  - cost sensitivity
  - allowed and blocked providers
- Task-mode overrides belong in the advanced section in wave 1.
- Raw JSON should not be the default surface. It should be an explicit escape hatch for unsupported config shapes or expert edits.
- Reuse patterns from the capability form-model work where that keeps the code simpler and more consistent.

## Chunk 1: Pure Form Model Helpers

### Task 1: Add failing tests for model strategy form helpers

**Files:**
- Create: `__tests__/unit/model-strategy-form-model.test.js`
- Create: `app/model-strategies/lib/modelStrategyFormModel.js`

- [ ] **Step 1: Write the failing test**

Cover:
- default builder state is valid and human-readable
- compile converts structured state into the current persisted `config` object
- decompile converts persisted `config` into structured builder state
- summary generation produces readable strategy text
- helper detects when advanced/raw fallback is required because the config contains unsupported shapes

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/model-strategy-form-model.test.js`

Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `app/model-strategies/lib/modelStrategyFormModel.js` with focused pure helpers:
- `createDefaultModelStrategyFormState()`
- `compileModelStrategyConfig(formState)`
- `decompileModelStrategyConfig(config)`
- `buildModelStrategySummary(formState)`
- `requiresAdvancedStrategyConfig(config)`

Keep the implementation deterministic and focused on the current backend contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/model-strategy-form-model.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add __tests__/unit/model-strategy-form-model.test.js app/model-strategies/lib/modelStrategyFormModel.js
git commit -m "test: add model strategy form helpers"
```

## Chunk 2: Guided Create Page

### Task 2: Replace the create page JSON editor with a guided builder

**Files:**
- Create: `__tests__/unit/model-strategies-new.page.test.jsx`
- Modify: `app/model-strategies/new/page.js`
- Create: `app/model-strategies/components/ModelStrategyBasicsSection.jsx`
- Create: `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
- Create: `app/model-strategies/components/ModelStrategyConstraintsSection.jsx`
- Create: `app/model-strategies/components/ModelStrategySummaryCard.jsx`
- Create: `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- page renders structured builder controls instead of raw config JSON by default
- primary provider/model and fallback rows are editable
- budget and sensitivity controls are editable through form inputs
- submit sends `{ name, description, config }` with compiled `config`
- advanced section starts collapsed

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/model-strategies-new.page.test.jsx`

Expected: FAIL because the current page is JSON-first.

- [ ] **Step 3: Implement the guided create page**

Update `app/model-strategies/new/page.js` to:
- initialize form state with `createDefaultModelStrategyFormState()`
- render shared builder sections for basics, execution, constraints, summary, and advanced
- compile `config` with `compileModelStrategyConfig(...)` on submit
- keep advanced raw JSON hidden unless explicitly opened

Use small components instead of growing the page file further.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/model-strategies-new.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run related create-flow checks**

Run:
- `npx vitest run __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategy-form-model.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/model-strategies/new/page.js app/model-strategies/components __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategy-form-model.test.js
git commit -m "feat: add guided model strategy creation"
```

## Chunk 3: Guided Detail And Edit Page

### Task 3: Replace the detail page JSON editor with the shared guided builder

**Files:**
- Create: `__tests__/unit/model-strategies-detail.page.test.jsx`
- Modify: `app/model-strategies/[strategyId]/page.js`
- Modify: `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
- Modify: `app/model-strategies/components/ModelStrategySummaryCard.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- detail page loads persisted strategy config into the builder
- summary card renders from loaded state
- advanced section is collapsed by default
- save sends compiled `config` back to the PATCH route
- if config requires advanced/raw fallback, the page surfaces that state instead of silently dropping unsupported data

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/model-strategies-detail.page.test.jsx`

Expected: FAIL because the current page is still JSON-first.

- [ ] **Step 3: Implement the guided detail page**

Update `app/model-strategies/[strategyId]/page.js` to:
- fetch strategy as before
- decompile `strategy.config` into structured form state
- render the shared builder sections
- compile back to `config` on save
- preserve delete behavior
- surface advanced/raw fallback when needed

- [ ] **Step 4: Run detail-page tests**

Run: `npx vitest run __tests__/unit/model-strategies-detail.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Run focused model-strategy UI checks**

Run:
- `npx vitest run __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/model-strategies/[strategyId]/page.js app/model-strategies/components __tests__/unit/model-strategies-detail.page.test.jsx
git commit -m "feat: add guided model strategy editing"
```

## Chunk 4: Advanced Task Modes And Raw Fallback

### Task 4: Add the collapsed advanced section for task-mode overrides

**Files:**
- Modify: `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
- Modify: `app/model-strategies/lib/modelStrategyFormModel.js`
- Modify: `__tests__/unit/model-strategy-form-model.test.js`
- Modify: `__tests__/unit/model-strategies-new.page.test.jsx`
- Modify: `__tests__/unit/model-strategies-detail.page.test.jsx`

- [ ] **Step 1: Write the failing test**

Cover:
- advanced panel remains collapsed by default
- task-mode override rows can be added and edited
- compiled config includes `taskModes` when provided
- raw JSON fallback is only shown when the user explicitly opens it or the config requires unsupported-shape preservation

- [ ] **Step 2: Run tests to verify they fail**

Run:
- `npx vitest run __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`

Expected: FAIL on advanced override behavior.

- [ ] **Step 3: Implement advanced task modes**

Extend the shared advanced section to:
- manage task-mode rows with `taskMode`, `provider`, and `model`
- compile those rows into `config.taskModes`
- expose raw JSON only as a deliberate advanced escape hatch

Keep wave 1 intentionally narrow. Do not add a routing playground or complex per-mode fallback editor unless required by existing tests.

- [ ] **Step 4: Run tests to verify they pass**

Run:
- `npx vitest run __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/model-strategies/components/ModelStrategyAdvancedSection.jsx app/model-strategies/lib/modelStrategyFormModel.js __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx
git commit -m "feat: add advanced model strategy overrides"
```

## Chunk 5: Final Verification And Docs Sync

### Task 5: Verify the slice end-to-end and sync docs if needed

**Files:**
- Modify: `docs/superpowers/specs/2026-04-08-model-strategy-guided-ux-design.md` only if implementation meaningfully differs
- Optionally modify: `docs/sdk-parity.md` or `sdk-python/README.md` only if user-facing model strategy examples need updating

- [ ] **Step 1: Sync docs to shipped behavior**

Update only the docs that would otherwise overpromise or mismatch the actual wave-1 behavior.

- [ ] **Step 2: Run targeted model-strategy UI tests**

Run:
- `npx vitest run __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`

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

Expected: only model strategy UX, related tests, and any intentionally updated docs are changed.

- [ ] **Step 5: Commit**

```bash
git add app/model-strategies __tests__/unit docs/superpowers/specs/2026-04-08-model-strategy-guided-ux-design.md docs/sdk-parity.md sdk-python/README.md
git commit -m "feat: add guided model strategy UX"
```

## Follow-On Plans

After this plan ships:

1. Create a separate plan for Policies guided authoring and advanced-import cleanup.
2. Revisit the model strategy list page only if the create/detail guided-builder work reveals a strong summary-card reuse opportunity.
3. Consider a later runtime completion playground as a separate slice, not part of this plan.
