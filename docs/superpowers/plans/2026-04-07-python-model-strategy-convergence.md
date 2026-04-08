# Python Model Strategy Convergence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Python SDK contract enforcement for the model-strategy domain and verify `complete_with_strategy(...)` against the live route shape.

**Architecture:** Extend the grouped Python SDK contract to include `model_strategies`, teach the SDK validator to recognize that domain, and add one focused Python runtime test for `complete_with_strategy(...)`. Keep the change contract-first and avoid altering runtime behavior unless the test proves a mismatch.

**Tech Stack:** Node.js contract validator, Vitest, Python stdlib client + unittest, JSON contracts, Markdown docs

---

## Chunk 1: Contract Model and JS Validator Coverage

### Task 1: Extend the Python SDK contract to include model strategies

**Files:**
- Modify: `contracts/sdk/public-surface.json`
- Modify: `contracts/sdk/release-plan.json`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add a failing JS contract test that declares the Python `model_strategies` domain with:

```json
[
  "list_model_strategies",
  "create_model_strategy",
  "get_model_strategy",
  "update_model_strategy",
  "delete_model_strategy",
  "complete_with_strategy"
]
```

and passes discovered Python methods that are missing `complete_with_strategy`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL with `missing_python_sdk_method` for `complete_with_strategy`.

- [ ] **Step 3: Update the contract files**

Update `contracts/sdk/public-surface.json` so Python `domains` now includes:

- `capabilities`
- `workflows`
- `model_strategies`

Update `contracts/sdk/release-plan.json` so Python `domains` includes `model_strategies` and the reason mentions model-strategy convergence.

- [ ] **Step 4: Run test again**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: still FAIL until validator discovery understands the new domain.

- [ ] **Step 5: Commit**

```bash
git add contracts/sdk/public-surface.json contracts/sdk/release-plan.json __tests__/unit/contracts.sdk-surface.test.js
git commit -m "test: declare python model strategy sdk contract"
```

### Task 2: Extend the SDK validator for the Python model-strategy domain

**Files:**
- Modify: `scripts/lib/contracts/check-sdk-surface.mjs`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add coverage for:

- missing Python model-strategy method
- undeclared discovered Python model-strategy method
- passing case with `capabilities`, `workflows`, and `model_strategies` all aligned

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because the validator selector does not yet recognize the model-strategy domain.

- [ ] **Step 3: Write minimal implementation**

Update `check-sdk-surface.mjs` so the Python domain selector recognizes `model_strategies` and selects methods conservatively using `model_strategy`-based names.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/contracts/check-sdk-surface.mjs __tests__/unit/contracts.sdk-surface.test.js
git commit -m "feat: enforce python model strategy sdk contracts"
```

## Chunk 2: Python Route-Shape Confidence Test

### Task 3: Verify `complete_with_strategy(...)` matches the route contract

**Files:**
- Create: `sdk-python/tests/test_python_model_strategies_runtime.py`
- Modify: `sdk-python/dashclaw/client.py` only if the test proves a mismatch

- [ ] **Step 1: Write the failing or diagnostic test**

Create a focused Python test that verifies:

```python
client.complete_with_strategy(
    "mst_1",
    messages=[{"role": "user", "content": "Summarize this"}],
    max_tokens=256,
    temperature=0.7,
    task_mode="reasoning",
)
```

produces:

- method: `POST`
- path: `/api/model-strategies/mst_1/complete`
- body:

```python
{
    "messages": [{"role": "user", "content": "Summarize this"}],
    "max_tokens": 256,
    "temperature": 0.7,
    "task_mode": "reasoning",
}
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `py -3 -m unittest sdk-python.tests.test_python_model_strategies_runtime`
Expected: PASS if the wrapper already matches the route shape; otherwise FAIL with a payload mismatch.

- [ ] **Step 3: Write minimal implementation only if needed**

If the test failed, make the smallest change in `sdk-python/dashclaw/client.py` needed to match the route contract.

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 -m unittest sdk-python.tests.test_python_model_strategies_runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-python/tests/test_python_model_strategies_runtime.py sdk-python/dashclaw/client.py
git commit -m "test(sdk-python): verify model strategy runtime contract"
```

## Chunk 3: Docs and Final Verification

### Task 4: Sync docs and parity narrative

**Files:**
- Modify: `sdk-python/README.md`
- Modify: `docs/sdk-parity.md`
- Modify: `docs/planning/2026-04-07-sdk-migration-matrix.md`

- [ ] **Step 1: Update Python SDK README**

Ensure the model-strategy section clearly shows `complete_with_strategy(...)` as the runtime execution path and leaves the route-shape example aligned with the test.

- [ ] **Step 2: Update parity docs**

Update parity docs to say Python model strategies are now contract-enforced as part of the converged execution surface.

- [ ] **Step 3: Run docs verification**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add sdk-python/README.md docs/sdk-parity.md docs/planning/2026-04-07-sdk-migration-matrix.md
git commit -m "docs: sync python model strategy parity"
```

### Task 5: Final verification

**Files:**
- Modify: any touched file only if verification reveals an issue

- [ ] **Step 1: Run JS contract tests**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js`
Expected: PASS

- [ ] **Step 2: Run Python tests**

Run: `py -3 -m unittest sdk-python.tests.test_python_model_strategies_runtime sdk-python.tests.test_python_workflows_runtime sdk-python.tests.test_python_capabilities_runtime`
Expected: PASS

- [ ] **Step 3: Run repo guards**

Run: `npm run contracts:check`
Expected: PASS

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: converge python model strategy contracts"
```
