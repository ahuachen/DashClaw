# Python Knowledge Convergence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring knowledge collections under explicit API and Python SDK contract enforcement and verify the existing Python knowledge runtime methods against current route shapes.

**Architecture:** Add a new API contract manifest for knowledge collections, extend the grouped Python SDK contract with a `knowledge` domain, teach the SDK validator to recognize that domain, and add focused Python route-shape tests for add/sync/search. Keep the change convergence-only unless a test proves a route-shape mismatch.

**Tech Stack:** Node.js contract validator, API contract JSON, Vitest, Python stdlib client + unittest, Markdown docs

---

## Chunk 1: API Contract and SDK Contract Scaffolding

### Task 1: Add API contract coverage for knowledge collections

**Files:**
- Create: `contracts/api/knowledge-collections.json`
- Modify: `contracts/index.json`
- Test: `__tests__/unit/contracts.api-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add a failing API-surface test that expects a `knowledge-collections` contract entry covering:

- `/api/knowledge/collections`
- `/api/knowledge/collections/[collectionId]`
- `/api/knowledge/collections/[collectionId]/items`
- `/api/knowledge/collections/[collectionId]/sync`
- `/api/knowledge/collections/[collectionId]/search`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.api-surface.test.js`
Expected: FAIL because there is no knowledge-collections contract file yet.

- [ ] **Step 3: Add the contract file and index entry**

Create `contracts/api/knowledge-collections.json` with the exact route inventory and register it in `contracts/index.json`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.api-surface.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add contracts/api/knowledge-collections.json contracts/index.json __tests__/unit/contracts.api-surface.test.js
git commit -m "feat: add knowledge collections api contract"
```

### Task 2: Extend the Python SDK contract with the knowledge domain

**Files:**
- Modify: `contracts/sdk/public-surface.json`
- Modify: `contracts/sdk/release-plan.json`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add JS contract tests for:

- missing required Python knowledge methods
- undeclared discovered Python knowledge methods
- passing case with `capabilities`, `workflows`, `model_strategies`, and `knowledge` all aligned

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because the Python contract and selector do not yet include knowledge.

- [ ] **Step 3: Update the SDK contract files**

Add Python `knowledge` with required methods:

- `list_knowledge_collections`
- `create_knowledge_collection`
- `get_knowledge_collection`
- `update_knowledge_collection`
- `list_knowledge_collection_items`
- `add_knowledge_collection_item`
- `sync_knowledge_collection`
- `search_knowledge_collection`

Update `contracts/sdk/release-plan.json` to add `knowledge` to Python `domains` and update the reason string.

- [ ] **Step 4: Run test again**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: still FAIL until the validator selector understands `knowledge`.

- [ ] **Step 5: Commit**

```bash
git add contracts/sdk/public-surface.json contracts/sdk/release-plan.json __tests__/unit/contracts.sdk-surface.test.js
git commit -m "test: declare python knowledge sdk contract"
```

## Chunk 2: Validator Support and Python Runtime Confidence Tests

### Task 3: Extend the SDK validator for Python knowledge methods

**Files:**
- Modify: `scripts/lib/contracts/check-sdk-surface.mjs`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

If needed, add or tighten tests so the selector must correctly identify:

- `list_knowledge_collections`
- `create_knowledge_collection`
- `get_knowledge_collection`
- `update_knowledge_collection`
- `list_knowledge_collection_items`
- `add_knowledge_collection_item`
- `sync_knowledge_collection`
- `search_knowledge_collection`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL until the selector recognizes `knowledge`.

- [ ] **Step 3: Write minimal implementation**

Update `check-sdk-surface.mjs` so the Python selector recognizes the `knowledge` domain conservatively.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/contracts/check-sdk-surface.mjs __tests__/unit/contracts.sdk-surface.test.js
git commit -m "feat: enforce python knowledge sdk contracts"
```

### Task 4: Add focused Python knowledge route-shape tests

**Files:**
- Create: `sdk-python/tests/test_python_knowledge_runtime.py`
- Modify: `sdk-python/dashclaw/client.py` only if a test proves a mismatch

- [ ] **Step 1: Write the failing or diagnostic tests**

Create tests that verify:

1. `add_knowledge_collection_item("kc_1", source_uri="https://docs.example.com", title="Runbook")`
2. `sync_knowledge_collection("kc_1")`
3. `search_knowledge_collection("kc_1", "rollback steps", limit=3)`

Expected calls:

- `POST /api/knowledge/collections/kc_1/items`
- `POST /api/knowledge/collections/kc_1/sync`
- `POST /api/knowledge/collections/kc_1/search`

with the correct JSON bodies.

- [ ] **Step 2: Run test to verify current behavior**

Run: `py -3 -m unittest sdk-python.tests.test_python_knowledge_runtime`
Expected: PASS if Python already matches the route shape; otherwise FAIL with a payload mismatch.

- [ ] **Step 3: Write minimal implementation only if needed**

If the test fails, make the smallest possible fix in `sdk-python/dashclaw/client.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 -m unittest sdk-python.tests.test_python_knowledge_runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-python/tests/test_python_knowledge_runtime.py sdk-python/dashclaw/client.py
git commit -m "test(sdk-python): verify knowledge runtime contracts"
```

## Chunk 3: Docs and Final Verification

### Task 5: Sync docs and parity narrative

**Files:**
- Modify: `sdk-python/README.md`
- Modify: `docs/sdk-parity.md`
- Modify: `docs/planning/2026-04-07-sdk-migration-matrix.md`
- Modify: `docs/contracts/README.md` if needed

- [ ] **Step 1: Update README/parity language**

Make it explicit that Python knowledge is now contract-enforced and that the route surface is explicitly declared in the API contract layer.

- [ ] **Step 2: Run docs verification**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add sdk-python/README.md docs/sdk-parity.md docs/planning/2026-04-07-sdk-migration-matrix.md docs/contracts/README.md
git commit -m "docs: sync python knowledge parity"
```

### Task 6: Final verification

**Files:**
- Modify: any touched file only if verification reveals an issue

- [ ] **Step 1: Run JS tests**

Run: `npx vitest run __tests__/unit/contracts.api-surface.test.js __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js`
Expected: PASS

- [ ] **Step 2: Run Python tests**

Run: `py -3 -m unittest sdk-python.tests.test_python_knowledge_runtime sdk-python.tests.test_python_model_strategies_runtime sdk-python.tests.test_python_workflows_runtime sdk-python.tests.test_python_capabilities_runtime`
Expected: PASS

- [ ] **Step 3: Run repo guards**

Run: `npm run contracts:check`
Expected: PASS

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: converge python knowledge contracts"
```
