# Python SDK Capability Runtime Convergence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Python SDK up to capability-runtime parity for the governed capability surface and make `contracts:check` fail when Python public-surface or release-plan updates lag the repo.

**Architecture:** Extend the existing SDK contract validator so it discovers Python public capability methods alongside the Node surface. Then add the missing Python client methods for the capability runtime routes already shipping in the API (`invoke`, `test`, `get_health`, `list_health`, `get_history`) and update parity docs plus the release plan in the same change.

**Tech Stack:** Node.js scripts, Vitest, Python stdlib client, JSON contracts, Markdown docs

---

## Chunk 1: Contract and Test Scaffolding

### Task 1: Expand the SDK contract to declare Python capability-runtime methods

**Files:**
- Modify: `contracts/sdk/public-surface.json`
- Modify: `contracts/sdk/release-plan.json`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add a test case that declares Python required methods such as `list_capabilities`, `invoke_capability`, and `get_capability_history`, then passes a discovered Python method list that is missing one of them.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because `checkSdkSurface` does not yet validate Python methods.

- [ ] **Step 3: Update the contracts**

Set `contracts/sdk/public-surface.json` to declare the Python capability-runtime methods:
- `list_capabilities`
- `create_capability`
- `get_capability`
- `update_capability`
- `invoke_capability`
- `test_capability`
- `get_capability_health`
- `list_capability_health`
- `get_capability_history`

Update `contracts/sdk/release-plan.json` so Python changes from `none` to `minor` with capability-runtime convergence as the reason.

- [ ] **Step 4: Run the test again**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: still FAIL because the validator still ignores Python methods.

- [ ] **Step 5: Commit**

```bash
git add contracts/sdk/public-surface.json contracts/sdk/release-plan.json __tests__/unit/contracts.sdk-surface.test.js
git commit -m "test: declare python sdk capability runtime contract"
```

### Task 2: Make the SDK validator discover and enforce Python methods

**Files:**
- Modify: `scripts/lib/contracts/check-sdk-surface.mjs`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add test coverage for:
- missing required Python methods
- undeclared discovered Python methods
- success when Python methods and versions align

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because the validator only reports on Node methods today.

- [ ] **Step 3: Write minimal implementation**

In `check-sdk-surface.mjs`:
- discover Python methods from `sdk-python/dashclaw/client.py`
- compare discovered Python methods to `contracts/sdk/public-surface.json`
- emit `missing_python_sdk_method` and `undeclared_python_sdk_method`
- keep existing version checks intact

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/contracts/check-sdk-surface.mjs __tests__/unit/contracts.sdk-surface.test.js
git commit -m "feat: enforce python sdk public surface contracts"
```

## Chunk 2: Python SDK Runtime Methods

### Task 3: Add the missing Python capability-runtime methods

**Files:**
- Modify: `sdk-python/dashclaw/client.py`
- Test: `sdk-python/tests/test_sdk_v2_surface.py` or `sdk-python/tests/test_python_capabilities_runtime.py`

- [ ] **Step 1: Write the failing test**

Add Python tests that verify the client issues the expected HTTP calls for:
- `invoke_capability(capability_id, payload=None, actor=None, reason=None)`
- `test_capability(capability_id, payload=None)`
- `get_capability_health(capability_id)`
- `list_capability_health(status=None, certification_status=None, stale_only=None, limit=50, offset=0)`
- `get_capability_history(capability_id, action_type=None, status=None, limit=20, offset=0)`

Use an existing recording/fake client pattern if one already exists in `sdk-python/tests`.

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 -m unittest discover -s sdk-python/tests -p "test_*python*capab*.py"`
Expected: FAIL because the methods do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add the methods near the existing capability registry methods in `sdk-python/dashclaw/client.py`, using `_request(...)` and matching the current route contracts:
- `POST /api/capabilities/{id}/invoke`
- `POST /api/capabilities/{id}/test`
- `GET /api/capabilities/{id}/health`
- `GET /api/capabilities/health`
- `GET /api/capabilities/{id}/history`

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 -m unittest discover -s sdk-python/tests -p "test_*python*capab*.py"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-python/dashclaw/client.py sdk-python/tests
git commit -m "feat(sdk-python): add capability runtime methods"
```

## Chunk 3: Docs and Final Verification

### Task 4: Sync SDK docs to the shipped Python capability-runtime surface

**Files:**
- Modify: `sdk-python/README.md`
- Modify: `docs/sdk-parity.md`
- Modify: `docs/planning/2026-04-07-sdk-migration-matrix.md`

- [ ] **Step 1: Write the failing doc expectation**

Identify the sections that still describe Python as broader-but-unaligned without calling out the newly-shipped capability-runtime parity.

- [ ] **Step 2: Update docs**

Document the new Python capability-runtime methods and update parity language to say this domain is now aligned at the route-contract level.

- [ ] **Step 3: Run docs verification**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add sdk-python/README.md docs/sdk-parity.md docs/planning/2026-04-07-sdk-migration-matrix.md
git commit -m "docs: sync python capability runtime parity"
```

### Task 5: Run the full verification set

**Files:**
- Modify: `__tests__/unit/contracts.sdk-surface.test.js` if follow-up cleanup is needed

- [ ] **Step 1: Run contract tests**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js`
Expected: PASS

- [ ] **Step 2: Run Python SDK tests**

Run: `py -3 -m unittest discover -s sdk-python/tests -p "test_*python*capab*.py"`
Expected: PASS

- [ ] **Step 3: Run repo contract/docs checks**

Run: `npm run contracts:check`
Expected: PASS

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: converge python sdk capability runtime contracts"
```
