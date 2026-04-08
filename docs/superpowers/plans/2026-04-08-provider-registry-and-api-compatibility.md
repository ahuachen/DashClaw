# Provider Registry And API Compatibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize provider/model metadata and API compatibility rules so workflow drafting, model strategies, and internal AI helpers use one current, validated source of truth.

**Architecture:** Introduce a canonical provider registry module that owns curated provider/model definitions, use-case defaults, and compatibility metadata. Migrate workflow drafting first, then model strategies and internal AI helpers, while adding targeted tests and route validation so stale or invalid provider/model combinations cannot silently re-enter the codebase.

**Tech Stack:** Next.js app router, React, Vitest, Node route handlers, existing contract checks

---

## File Map

### New files

- Create: `app/lib/providers/providerRegistry.js`
  - Canonical provider/model registry
  - Use-case defaults
  - Compatibility metadata helpers
  - Validation helpers
- Create: `__tests__/unit/provider-registry.test.js`
  - Registry helper coverage
- Create: `docs/providers/provider-doc-audit.md`
  - Human-reviewed provider audit ledger with official sources and audit date

### Files to modify in wave 1

- Modify: `app/workflows/lib/workflowAiModelCatalog.js`
  - Replace local catalog with registry re-export or adapter
- Modify: `app/workflows/components/WorkflowAiDraftPanel.jsx`
  - Read provider/model options from canonical registry
- Modify: `app/api/workflows/draft/route.js`
  - Read defaults and validation from registry
- Modify: `__tests__/unit/workflow-ai-draft-panel.test.jsx`
  - Expect registry-backed defaults
- Modify: `__tests__/unit/workflow-draft.route.test.js`
  - Validate unsupported model/provider handling through registry

### Files to modify in wave 2

- Modify: `app/model-strategies/lib/modelStrategyFormModel.js`
  - Replace handwritten provider/model labels and defaults
- Modify: `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
  - Use provider/model pickers backed by registry
- Modify: `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
  - Use registry-backed provider/model selectors for task-mode overrides
- Modify: `__tests__/unit/model-strategy-form-model.test.js`
- Modify: `__tests__/unit/model-strategies-new.page.test.jsx`
- Modify: `__tests__/unit/model-strategies-detail.page.test.jsx`

### Files to modify in wave 3

- Modify: `app/lib/llm.js`
  - Replace stale hardcoded defaults with registry-driven defaults/compatibility
- Modify: `app/lib/policy-generator.js`
  - Use registry defaults for provider/model selection
- Modify: `app/lib/predictive-risk.js`
  - Use registry defaults for provider/model selection
- Modify: `app/lib/integration-health.js`
  - Use registry-compatible ping models where relevant
- Modify: `app/api/settings/test/route.js`
  - Align testable providers/models with registry where appropriate

---

## Chunk 1: Canonical Registry Core

### Task 1: Add the canonical provider registry module

**Files:**
- Create: `app/lib/providers/providerRegistry.js`
- Test: `__tests__/unit/provider-registry.test.js`

- [ ] **Step 1: Write the failing registry helper tests**

```js
import { describe, expect, it } from 'vitest';
import {
  getProviderOptions,
  getProviderModelOptions,
  getDefaultProviderModel,
  isSupportedProviderModel,
} from '@/lib/providers/providerRegistry.js';

describe('providerRegistry', () => {
  it('returns current provider options', () => {
    expect(getProviderOptions().map((p) => p.value)).toContain('openai');
    expect(getProviderOptions().map((p) => p.value)).toContain('anthropic');
  });

  it('returns model options for a provider in declared order', () => {
    expect(getProviderModelOptions('anthropic')[0].value).toBe('claude-sonnet-4-6');
  });

  it('returns the default model for a provider', () => {
    expect(getDefaultProviderModel('openai')).toBe('gpt-5.4');
  });

  it('validates provider/model membership', () => {
    expect(isSupportedProviderModel('anthropic', 'claude-opus-4-6')).toBe(true);
    expect(isSupportedProviderModel('anthropic', 'gpt-5.4')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/provider-registry.test.js`
Expected: FAIL with module not found or missing exports

- [ ] **Step 3: Implement the minimal registry**

Create `app/lib/providers/providerRegistry.js` with:

- provider metadata object
- provider option helper
- model option helper
- default model helper
- provider/model validation helper
- optional use-case default helper stubs for later waves

Keep it simple and export plain functions over a frozen data structure.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/provider-registry.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/providers/providerRegistry.js __tests__/unit/provider-registry.test.js
git commit -m "feat: add canonical provider registry"
```

---

## Chunk 2: Workflow Drafting Migration

### Task 2: Move workflow drafting UI to the registry

**Files:**
- Modify: `app/workflows/lib/workflowAiModelCatalog.js`
- Modify: `app/workflows/components/WorkflowAiDraftPanel.jsx`
- Modify: `__tests__/unit/workflow-ai-draft-panel.test.jsx`

- [ ] **Step 1: Write or extend the failing panel test**

Add expectations that:

- provider options are still visible
- Anthropic defaults to `claude-sonnet-4-6`
- the selected model list is provider-specific

- [ ] **Step 2: Run the focused UI test**

Run: `npx vitest run __tests__/unit/workflow-ai-draft-panel.test.jsx`
Expected: FAIL if the panel still depends on local constants

- [ ] **Step 3: Replace the local workflow AI catalog with registry-backed helpers**

Implementation shape:

- either delete `workflowAiModelCatalog.js` and re-export from the registry
- or reduce it to a thin compatibility wrapper that forwards to `providerRegistry`

Then update `WorkflowAiDraftPanel.jsx` to use the registry-backed helpers.

- [ ] **Step 4: Run the panel and page tests**

Run: `npx vitest run __tests__/unit/workflow-ai-draft-panel.test.jsx __tests__/unit/workflow-new.page.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/workflows/lib/workflowAiModelCatalog.js app/workflows/components/WorkflowAiDraftPanel.jsx __tests__/unit/workflow-ai-draft-panel.test.jsx
git commit -m "refactor: source workflow ai picker from provider registry"
```

### Task 3: Move workflow draft route validation/defaults to the registry

**Files:**
- Modify: `app/api/workflows/draft/route.js`
- Modify: `__tests__/unit/workflow-draft.route.test.js`

- [ ] **Step 1: Extend the route test to prove registry-backed validation**

Add tests for:

- unsupported provider rejected
- unsupported model for provider rejected
- omitted model falls back to provider default

- [ ] **Step 2: Run the route test**

Run: `npx vitest run __tests__/unit/workflow-draft.route.test.js`
Expected: FAIL if route still carries local assumptions

- [ ] **Step 3: Remove local provider/model constants from the route**

Use the canonical registry helpers for:

- provider validation
- model validation
- default model resolution

Keep the rest of the route behavior unchanged.

- [ ] **Step 4: Re-run workflow route and page tests**

Run: `npx vitest run __tests__/unit/workflow-draft.route.test.js __tests__/unit/workflow-new.page.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/workflows/draft/route.js __tests__/unit/workflow-draft.route.test.js
git commit -m "fix: validate workflow draft providers from registry"
```

---

## Chunk 3: Model Strategies Migration

### Task 4: Replace handwritten model labels and defaults in the form model

**Files:**
- Modify: `app/model-strategies/lib/modelStrategyFormModel.js`
- Test: `__tests__/unit/model-strategy-form-model.test.js`

- [ ] **Step 1: Add failing expectations for registry-backed humanization/defaults**

Examples:

- `humanizeModel('claude-sonnet-4-6')` should produce `Claude Sonnet 4.6`
- default primary model should come from the registry rather than a hardcoded local alias

- [ ] **Step 2: Run the form model test**

Run: `npx vitest run __tests__/unit/model-strategy-form-model.test.js`
Expected: FAIL

- [ ] **Step 3: Refactor the form model to consume the registry**

Use the registry for:

- default provider/model
- label rendering
- optional provider/model option helpers for UI sections

- [ ] **Step 4: Re-run form model test**

Run: `npx vitest run __tests__/unit/model-strategy-form-model.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/model-strategies/lib/modelStrategyFormModel.js __tests__/unit/model-strategy-form-model.test.js
git commit -m "refactor: move model strategy defaults to provider registry"
```

### Task 5: Replace freeform model inputs in model strategy screens with registry-backed selectors

**Files:**
- Modify: `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
- Modify: `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
- Test: `__tests__/unit/model-strategies-new.page.test.jsx`
- Test: `__tests__/unit/model-strategies-detail.page.test.jsx`

- [ ] **Step 1: Extend page tests for provider-aware model selector behavior**

Add expectations that changing provider updates the model options.

- [ ] **Step 2: Run the page tests**

Run: `npx vitest run __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement registry-backed selects**

Use registry helpers for:

- primary model select
- fallback model select rows
- task-mode override model select rows

Do not redesign the whole page; keep this scoped to provider/model correctness.

- [ ] **Step 4: Re-run the page tests**

Run: `npx vitest run __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/model-strategies/components/ModelStrategyExecutionSection.jsx app/model-strategies/components/ModelStrategyAdvancedSection.jsx __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx
git commit -m "feat: use provider registry in model strategy editors"
```

---

## Chunk 4: Internal AI Feature Migration

### Task 6: Move internal LLM defaults to the registry

**Files:**
- Modify: `app/lib/llm.js`
- Modify: `app/lib/policy-generator.js`
- Modify: `app/lib/predictive-risk.js`
- Optional Test: add focused unit coverage if existing tests don’t cover the defaults

- [ ] **Step 1: Identify current default provider/model assumptions in internal AI helpers**

Read:

- `app/lib/llm.js`
- `app/lib/policy-generator.js`
- `app/lib/predictive-risk.js`

Document which defaults should be mapped to registry use cases such as:

- `semantic_guard`
- `policy_generation`
- `predictive_risk`

- [ ] **Step 2: Add failing tests if coverage is missing**

Prefer small helper-level tests that prove the selected default model comes from the registry.

- [ ] **Step 3: Replace handwritten defaults with registry lookups**

Do not rewrite provider dispatch yet; only replace stale, duplicated defaults and labels.

- [ ] **Step 4: Run the affected tests**

Run: targeted Vitest command covering touched files
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/llm.js app/lib/policy-generator.js app/lib/predictive-risk.js
git commit -m "refactor: move internal ai defaults to provider registry"
```

### Task 7: Align provider test/integration helpers with registry assumptions

**Files:**
- Modify: `app/lib/integration-health.js`
- Modify: `app/api/settings/test/route.js`

- [ ] **Step 1: Add or extend targeted tests for provider smoke requests**

Ensure provider-specific ping models remain valid and route-compatible.

- [ ] **Step 2: Run the failing tests**

Run: targeted Vitest command for settings/integration tests
Expected: FAIL if stale model constants remain

- [ ] **Step 3: Replace stale ping models and provider checks with registry-compatible values**

Keep the route behavior intact; only centralize or align model identifiers and compatibility assumptions.

- [ ] **Step 4: Re-run the affected tests**

Run: targeted Vitest command for settings/integration tests
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/integration-health.js app/api/settings/test/route.js
git commit -m "fix: align provider checks with canonical registry"
```

---

## Chunk 5: Provider Docs Audit And Final Verification

### Task 8: Add a checked-in provider docs audit artifact

**Files:**
- Create: `docs/providers/provider-doc-audit.md`

- [ ] **Step 1: Write the audit document**

Include:

- audit date
- official source URLs
- current curated model ids used by DashClaw
- notes about endpoint compatibility
- any intentional exclusions

- [ ] **Step 2: Run docs validation**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add docs/providers/provider-doc-audit.md
git commit -m "docs: add provider registry audit ledger"
```

### Task 9: Converge backend provider execution behind registry (Completed 2026-04-08)

**Files:**
- Modify: `app/lib/providers/providerRegistry.js`
- Modify: `app/lib/providers.js`
- Modify: `__tests__/unit/provider-registry.test.js`

- [x] **Step 1: Add `credentialKey` to every provider registry entry**
- [x] **Step 2: Add `getProviderBaseUrl()` and `getProviderCredentialKey()` helpers**
- [x] **Step 3: Replace `PROVIDER_KEY_MAP` in providers.js with registry lookup**
- [x] **Step 4: Replace 5 per-provider handlers with 2 protocol handlers dispatched by `apiStyle`**
- [x] **Step 5: Pass all 47 tests across 9 test files, docs:check, contracts:check, and build**

---

### Task 10: Final repo verification

**Files:**
- Verify all touched files from this plan

- [ ] **Step 1: Run targeted workflow and model strategy tests**

Run:

```bash
npx vitest run __tests__/unit/provider-registry.test.js __tests__/unit/workflow-draft.route.test.js __tests__/unit/workflow-ai-draft-panel.test.jsx __tests__/unit/workflow-new.page.test.jsx __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx
```

Expected: PASS

- [ ] **Step 2: Run repo consistency checks**

Run:

```bash
npm run docs:check
npm run contracts:check
npm run build
```

Expected: PASS

- [ ] **Step 3: Review staged scope**

Run:

```bash
git diff --stat
git status --short
```

Expected: only intended provider-registry changes

- [ ] **Step 4: Final commit if needed**

```bash
git add <touched files>
git commit -m "feat: centralize provider registry and ai compatibility"
```

