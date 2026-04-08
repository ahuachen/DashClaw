# Python Workflow Execute Convergence Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Python SDK support for workflow template execution and make `contracts:check` fail when the Python workflow public surface drifts from the repo.

**Architecture:** Extend the existing SDK contract system from Python `capabilities` into Python `workflows`, keeping the change domain-scoped. Add one missing Python client method, `execute_workflow_template(...)`, against the existing workflow execute API route, then update release-plan and parity docs in the same slice.

**Tech Stack:** Node.js contract validator, Vitest, Python stdlib client + unittest, JSON contracts, Markdown docs

---

## Chunk 1: Contract Model and JS Validator Coverage

### Task 1: Extend the Python SDK contract to include workflows

**Files:**
- Modify: `contracts/sdk/public-surface.json`
- Modify: `contracts/sdk/release-plan.json`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add a failing contract test that declares a Python workflow domain with:

```json
[
  "list_workflow_templates",
  "create_workflow_template",
  "get_workflow_template",
  "update_workflow_template",
  "duplicate_workflow_template",
  "launch_workflow_template",
  "execute_workflow_template"
]
```

and passes discovered Python workflow methods that are missing `execute_workflow_template`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL with a missing Python workflow method finding.

- [ ] **Step 3: Update the contract files**

Update `contracts/sdk/public-surface.json` to represent Python domains explicitly, with:

- `capabilities`
- `workflows`

Update `contracts/sdk/release-plan.json` so Python `domains` includes `workflows` and the reason mentions workflow execute convergence.

- [ ] **Step 4: Run test again**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: still FAIL until validator discovery logic understands the workflow domain.

- [ ] **Step 5: Commit**

```bash
git add contracts/sdk/public-surface.json contracts/sdk/release-plan.json __tests__/unit/contracts.sdk-surface.test.js
git commit -m "test: declare python workflow sdk contract"
```

### Task 2: Teach the SDK validator to enforce Python workflow surface

**Files:**
- Modify: `scripts/lib/contracts/check-sdk-surface.mjs`
- Test: `__tests__/unit/contracts.sdk-surface.test.js`

- [ ] **Step 1: Write the failing test**

Add explicit coverage for:

- missing required Python workflow methods
- undeclared discovered Python workflow methods
- a passing case where both Python `capabilities` and `workflows` domains align

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because the validator only knows the current Python contract shape.

- [ ] **Step 3: Write minimal implementation**

In `check-sdk-surface.mjs`:

- discover Python methods from `sdk-python/dashclaw/client.py`
- support Python domain groups from `contracts/sdk/public-surface.json`
- validate each enforced domain independently
- reuse the existing finding codes:
  - `missing_python_sdk_method`
  - `undeclared_python_sdk_method`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/contracts/check-sdk-surface.mjs __tests__/unit/contracts.sdk-surface.test.js
git commit -m "feat: enforce python workflow sdk contracts"
```

## Chunk 2: Python Client Runtime Method

### Task 3: Add `execute_workflow_template(...)` to the Python SDK

**Files:**
- Modify: `sdk-python/dashclaw/client.py`
- Create: `sdk-python/tests/test_python_workflows_runtime.py`

- [ ] **Step 1: Write the failing test**

Create `sdk-python/tests/test_python_workflows_runtime.py` with a `RecordingDashClaw` test that verifies:

```python
client.execute_workflow_template(
    "wf_1",
    variables={"env": "prod"},
    agent_id="forge",
    declared_goal="Run release flow",
)
```

produces:

- method: `POST`
- path: `/api/workflows/templates/wf_1/execute`
- body:

```python
{
    "variables": {"env": "prod"},
    "agent_id": "forge",
    "declared_goal": "Run release flow",
}
```

Also add a test that unset optional fields are omitted from the JSON body.

- [ ] **Step 2: Run test to verify it fails**

Run: `py -3 -m unittest sdk-python.tests.test_python_workflows_runtime`
Expected: FAIL with `AttributeError` because `execute_workflow_template` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add this method near the existing workflow methods in `sdk-python/dashclaw/client.py`:

```python
def execute_workflow_template(self, template_id, variables=None, agent_id=None, declared_goal=None):
    body = {}
    if variables is not None:
        body["variables"] = variables
    if agent_id is not None:
        body["agent_id"] = agent_id
    if declared_goal is not None:
        body["declared_goal"] = declared_goal
    return self._request(f"/api/workflows/templates/{template_id}/execute", "POST", json=body)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `py -3 -m unittest sdk-python.tests.test_python_workflows_runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk-python/dashclaw/client.py sdk-python/tests/test_python_workflows_runtime.py
git commit -m "feat(sdk-python): add workflow execute helper"
```

## Chunk 3: Docs and Verification

### Task 4: Sync docs to the shipped workflow execute surface

**Files:**
- Modify: `sdk-python/README.md`
- Modify: `docs/sdk-parity.md`
- Modify: `docs/planning/2026-04-07-sdk-migration-matrix.md`

- [ ] **Step 1: Update the Python SDK README**

Add a workflow example showing `execute_workflow_template(...)` and describe it as the governed runtime execution path, distinct from `launch_workflow_template(...)`.

- [ ] **Step 2: Update parity docs**

In `docs/sdk-parity.md` and `docs/planning/2026-04-07-sdk-migration-matrix.md`, note that the Python workflow domain now includes the execute path and is route-contract aligned for this slice.

- [ ] **Step 3: Run docs verification**

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add sdk-python/README.md docs/sdk-parity.md docs/planning/2026-04-07-sdk-migration-matrix.md
git commit -m "docs: sync python workflow execute parity"
```

### Task 5: Final verification

**Files:**
- Modify: `__tests__/unit/contracts.sdk-surface.test.js` only if cleanup is needed

- [ ] **Step 1: Run JS contract tests**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js`
Expected: PASS

- [ ] **Step 2: Run Python tests**

Run: `py -3 -m unittest sdk-python.tests.test_python_workflows_runtime sdk-python.tests.test_python_capabilities_runtime`
Expected: PASS

- [ ] **Step 3: Run repo guards**

Run: `npm run contracts:check`
Expected: PASS

Run: `npm run docs:check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: converge python workflow execute contracts"
```
