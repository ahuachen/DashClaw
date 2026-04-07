# Contract Validator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validator-first contract system that catches schema/setup drift, API/SDK contract drift, and missing SDK release-plan updates before deploy.

**Architecture:** Introduce a new `contracts/` source-of-truth layer plus a single `contracts:check` runner in `scripts/`. Start with the highest-value checks: `action_records` schema/setup convergence and SDK public-surface/release-plan enforcement, then wire the validator into local warning mode and CI hard-block mode.

**Tech Stack:** Node.js scripts, JSON contract manifests, existing Next.js repo structure, Vitest, Husky, GitHub Actions.

---

## File Structure

### New files

- `contracts/index.json`
  - top-level contract registry and validator config
- `contracts/schema/action-records.json`
  - canonical `action_records` runtime column/index requirements
- `contracts/setup/runtime-migration.json`
  - setup/migration expectations tied to `/api/setup/migrate`
- `contracts/sdk/public-surface.json`
  - canonical public Node/Python SDK domain ownership and required surfaces
- `contracts/sdk/release-plan.json`
  - explicit in-repo release bump intent for public SDK changes
- `scripts/check-contracts.mjs`
  - main validator runner and CLI entry point
- `scripts/lib/contracts/load-contracts.mjs`
  - contract discovery and parsing helpers
- `scripts/lib/contracts/check-schema-setup.mjs`
  - schema/setup drift validator, starting with `action_records`
- `scripts/lib/contracts/check-sdk-surface.mjs`
  - public SDK surface + release-plan validator
- `scripts/lib/contracts/check-api-surface.mjs`
  - placeholder/simple validator for route declaration drift in v1
- `__tests__/unit/contracts.load.test.js`
  - tests for contract loading and index resolution
- `__tests__/unit/contracts.schema-setup.test.js`
  - tests for `action_records` schema/setup drift detection
- `__tests__/unit/contracts.sdk-surface.test.js`
  - tests for SDK public surface + release-plan enforcement
- `__tests__/unit/contracts.runner.test.js`
  - tests for top-level runner aggregation and exit behavior
- `docs/contracts/README.md`
  - concise developer guide for the new contract system

### Modified files

- `package.json`
  - add `contracts:check` and optional warn-mode script
- `.husky/pre-commit`
  - append warn-only contract check
- `.github/workflows/ci.yml`
  - add hard-block `contracts:check`
- `app/api/setup/migrate/route.js`
  - export or isolate runtime migration reconciliation helpers so the validator can inspect them deterministically
- `sdk/dashclaw.js`
  - only if needed to normalize public-surface introspection
- `sdk-python/dashclaw/client.py`
  - only if needed to normalize public-surface introspection
- `README.md`
  - add short contributor note about contract validation

### Notes on boundaries

- Keep contract validation logic in `scripts/lib/contracts/` rather than scattering checks across unrelated scripts.
- Keep v1 narrow. Do not build autofix/generation in this plan.
- Do not expand contract coverage to every route or table immediately. `action_records` and SDK release planning are enough for the first shipping slice.

## Chunk 1: Contract Scaffolding

### Task 1: Add the contract directory and index

**Files:**
- Create: `contracts/index.json`
- Create: `contracts/schema/action-records.json`
- Create: `contracts/setup/runtime-migration.json`
- Create: `contracts/sdk/public-surface.json`
- Create: `contracts/sdk/release-plan.json`
- Test: `__tests__/unit/contracts.load.test.js`

- [ ] **Step 1: Write the failing contract loader test**

```js
import { describe, expect, it } from 'vitest';
import { loadContracts } from '../../scripts/lib/contracts/load-contracts.mjs';

describe('loadContracts', () => {
  it('loads the contract index and resolves domain manifests', async () => {
    const contracts = await loadContracts(process.cwd());

    expect(contracts.index.version).toBe(1);
    expect(contracts.schema['action-records'].table).toBe('action_records');
    expect(contracts.sdk.releasePlan.node.current_version).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.load.test.js`
Expected: FAIL because `load-contracts.mjs` and/or contract files do not exist yet.

- [ ] **Step 3: Create the initial contract manifests**

Create `contracts/index.json` with:

```json
{
  "version": 1,
  "validators": {
    "schema_setup": true,
    "sdk_surface": true,
    "api_surface": false
  },
  "schema": {
    "action-records": "contracts/schema/action-records.json"
  },
  "setup": {
    "runtime-migration": "contracts/setup/runtime-migration.json"
  },
  "sdk": {
    "public-surface": "contracts/sdk/public-surface.json",
    "release-plan": "contracts/sdk/release-plan.json"
  }
}
```

Create `contracts/schema/action-records.json` with the initial required fields:

```json
{
  "table": "action_records",
  "required_columns": [
    { "name": "action_id", "type": "text" },
    { "name": "trigger", "type": "text" },
    { "name": "output_summary", "type": "text" },
    { "name": "error_message", "type": "text" },
    { "name": "timestamp_start", "type": "text" },
    { "name": "timestamp_end", "type": "text" },
    { "name": "duration_ms", "type": "integer" }
  ],
  "required_indexes": [
    { "name": "action_records_action_id_idx", "columns": ["action_id"] },
    { "name": "action_records_org_timestamp_idx", "columns": ["org_id", "timestamp_start"] }
  ],
  "setup_owner": "app/api/setup/migrate/route.js"
}
```

Create `contracts/setup/runtime-migration.json` with:

```json
{
  "owner": "app/api/setup/migrate/route.js",
  "tables": {
    "action_records": {
      "reconciled_columns": [
        "action_id",
        "trigger",
        "output_summary",
        "error_message",
        "timestamp_start",
        "timestamp_end",
        "duration_ms"
      ],
      "reconciled_indexes": [
        "action_records_action_id_idx",
        "action_records_org_timestamp_idx"
      ]
    }
  }
}
```

Create `contracts/sdk/public-surface.json` with the minimal v1 declaration:

```json
{
  "node": {
    "canonical_root": "execution.capabilities",
    "required_methods": [
      "list",
      "create",
      "get",
      "update",
      "invoke",
      "test",
      "getHealth",
      "listHealth",
      "getHistory"
    ]
  },
  "python": {
    "required_methods": []
  },
  "legacy": {
    "compatibility_only": true
  }
}
```

Create `contracts/sdk/release-plan.json` with the current explicit plan:

```json
{
  "node": {
    "current_version": "2.8.0",
    "next_bump": "minor",
    "reason": "capability runtime and operator surface expansion",
    "domains": ["execution.capabilities"]
  },
  "python": {
    "current_version": "2.8.0",
    "next_bump": "none",
    "reason": "",
    "domains": []
  }
}
```

- [ ] **Step 4: Implement the contract loader**

Create `scripts/lib/contracts/load-contracts.mjs` with minimal logic:

```js
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJson(rootDir, relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

export async function loadContracts(rootDir) {
  const index = await readJson(rootDir, 'contracts/index.json');

  const schemaEntries = await Promise.all(
    Object.entries(index.schema || {}).map(async ([key, relPath]) => [key, await readJson(rootDir, relPath)]),
  );
  const setupEntries = await Promise.all(
    Object.entries(index.setup || {}).map(async ([key, relPath]) => [key, await readJson(rootDir, relPath)]),
  );
  const sdkEntries = await Promise.all(
    Object.entries(index.sdk || {}).map(async ([key, relPath]) => [key, await readJson(rootDir, relPath)]),
  );

  return {
    index,
    schema: Object.fromEntries(schemaEntries),
    setup: Object.fromEntries(setupEntries),
    sdk: Object.fromEntries(sdkEntries),
  };
}
```

- [ ] **Step 5: Run the loader test to verify it passes**

Run: `npx vitest run __tests__/unit/contracts.load.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add contracts/index.json contracts/schema/action-records.json contracts/setup/runtime-migration.json contracts/sdk/public-surface.json contracts/sdk/release-plan.json scripts/lib/contracts/load-contracts.mjs __tests__/unit/contracts.load.test.js
git commit -m "feat: add contract manifest scaffolding"
```

## Chunk 2: Schema and Setup Convergence Validator

### Task 2: Write the `action_records` schema/setup validator

**Files:**
- Create: `scripts/lib/contracts/check-schema-setup.mjs`
- Create: `__tests__/unit/contracts.schema-setup.test.js`
- Modify: `app/api/setup/migrate/route.js`

- [ ] **Step 1: Write the failing schema/setup validator test**

```js
import { describe, expect, it } from 'vitest';
import { checkSchemaSetup } from '../../scripts/lib/contracts/check-schema-setup.mjs';

describe('checkSchemaSetup', () => {
  it('fails when required action_records columns are not reconciled by setup migration', async () => {
    const result = await checkSchemaSetup({
      schema: {
        'action-records': {
          table: 'action_records',
          required_columns: [{ name: 'timestamp_start', type: 'text' }]
        }
      },
      setup: {
        'runtime-migration': {
          tables: {
            action_records: {
              reconciled_columns: []
            }
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].message).toMatch(/timestamp_start/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.schema-setup.test.js`
Expected: FAIL because the validator does not exist yet.

- [ ] **Step 3: Implement minimal schema/setup validator**

Create `scripts/lib/contracts/check-schema-setup.mjs`:

```js
export async function checkSchemaSetup(contracts) {
  const findings = [];
  const schema = contracts.schema['action-records'];
  const setup = contracts.setup['runtime-migration']?.tables?.action_records;

  for (const column of schema.required_columns || []) {
    if (!(setup?.reconciled_columns || []).includes(column.name)) {
      findings.push({
        code: 'missing_setup_column_reconciliation',
        message: `setup migration does not reconcile action_records.${column.name}`,
      });
    }
  }

  for (const index of schema.required_indexes || []) {
    if (!(setup?.reconciled_indexes || []).includes(index.name)) {
      findings.push({
        code: 'missing_setup_index_reconciliation',
        message: `setup migration does not reconcile ${index.name}`,
      });
    }
  }

  return { ok: findings.length === 0, findings };
}
```

- [ ] **Step 4: Refactor `/api/setup/migrate` so reconciliation is explicit and inspectable**

Modify `app/api/setup/migrate/route.js`:

- extract an `ACTION_RECORDS_RUNTIME_COLUMNS` constant that explicitly lists the runtime columns to reconcile
- extract an `ACTION_RECORDS_RUNTIME_INDEXES` constant that explicitly lists the index names to reconcile
- add reconciliation helpers that use these explicit lists rather than relying only on generic table parsing

The goal is not just implementation. The goal is inspectable intent that the validator can compare against.

Minimal shape:

```js
export const ACTION_RECORDS_RUNTIME_COLUMNS = [
  'action_id',
  'trigger',
  'output_summary',
  'error_message',
  'timestamp_start',
  'timestamp_end',
  'duration_ms',
];

export const ACTION_RECORDS_RUNTIME_INDEXES = [
  'action_records_action_id_idx',
  'action_records_org_timestamp_idx',
];
```

Add corresponding `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` and `CREATE INDEX IF NOT EXISTS ...` statements in the migration flow.

- [ ] **Step 5: Extend the test to verify the real migration constants stay aligned**

Update `__tests__/unit/contracts.schema-setup.test.js` so it imports the exported constants from `app/api/setup/migrate/route.js` and verifies the validator passes when those constants match the contract.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/contracts.schema-setup.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/contracts/check-schema-setup.mjs __tests__/unit/contracts.schema-setup.test.js app/api/setup/migrate/route.js
git commit -m "feat: add schema setup contract validation"
```

## Chunk 3: SDK Surface and Release Plan Validator

### Task 3: Validate public SDK surface against release plan

**Files:**
- Create: `scripts/lib/contracts/check-sdk-surface.mjs`
- Create: `__tests__/unit/contracts.sdk-surface.test.js`
- Modify: `sdk/dashclaw.js` only if introspection needs a stable export shape

- [ ] **Step 1: Write the failing SDK surface test**

```js
import { describe, expect, it } from 'vitest';
import { checkSdkSurface } from '../../scripts/lib/contracts/check-sdk-surface.mjs';

describe('checkSdkSurface', () => {
  it('fails when required Node public methods are missing', async () => {
    const result = await checkSdkSurface({
      sdk: {
        publicSurface: {
          node: { canonical_root: 'execution.capabilities', required_methods: ['invoke', 'test'] }
        },
        releasePlan: {
          node: { current_version: '2.8.0', next_bump: 'minor' }
        }
      }
    }, {
      nodeMethods: ['invoke']
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].message).toMatch(/test/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: FAIL because the validator does not exist yet.

- [ ] **Step 3: Implement minimal SDK surface introspection**

Create `scripts/lib/contracts/check-sdk-surface.mjs` with:

- a small helper that inspects `sdk/dashclaw.js` by importing it and walking `new DashClaw({ baseUrl: 'http://localhost', apiKey: 'test' }).execution.capabilities`
- method-name based comparison only for v1
- release-plan presence check whenever required methods differ from prior baseline or contract expectations

The validator should emit findings like:

- `missing_node_sdk_method`
- `missing_release_plan_update`

Do not attempt full semantic diffing in v1.

- [ ] **Step 4: Add a stable baseline comparison input**

For v1, the baseline can be simple:

- compare discovered methods to `contracts/sdk/public-surface.json`
- if discovered methods are missing, fail
- if discovered methods exceed the declared contract and `release-plan.json` was not updated in the same change, fail

Implement the test using fixture inputs first, then wire the real import-based discovery.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/contracts/check-sdk-surface.mjs __tests__/unit/contracts.sdk-surface.test.js contracts/sdk/public-surface.json contracts/sdk/release-plan.json
git commit -m "feat: add sdk surface contract validation"
```

## Chunk 4: Top-Level Runner and CLI

### Task 4: Add the `contracts:check` runner

**Files:**
- Create: `scripts/check-contracts.mjs`
- Create: `__tests__/unit/contracts.runner.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing runner test**

```js
import { describe, expect, it } from 'vitest';
import { runContractsCheck } from '../../scripts/check-contracts.mjs';

describe('runContractsCheck', () => {
  it('returns non-zero when a validator reports drift', async () => {
    const result = await runContractsCheck({
      mode: 'ci',
      validators: [
        async () => ({ ok: false, findings: [{ message: 'drift detected' }] })
      ]
    });

    expect(result.exitCode).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/contracts.runner.test.js`
Expected: FAIL because the runner does not exist yet.

- [ ] **Step 3: Implement the runner**

Create `scripts/check-contracts.mjs` with:

- CLI parsing for `--mode=warn` and default CI mode
- load contracts using `loadContracts()`
- run enabled validators from the contract index
- print grouped findings
- return exit code `0` in warn mode
- return exit code `1` in CI mode when findings exist

Minimal shape:

```js
export async function runContractsCheck({ mode = 'ci' } = {}) {
  // load contracts
  // run validators
  // print findings
  // return { exitCode, findings }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\\\/g, '/')}`) {
  const { exitCode } = await runContractsCheck(parseArgs(process.argv.slice(2)));
  process.exit(exitCode);
}
```

- [ ] **Step 4: Wire scripts into `package.json`**

Add:

```json
"contracts:check": "node scripts/check-contracts.mjs",
"contracts:check:warn": "node scripts/check-contracts.mjs --mode=warn"
```

- [ ] **Step 5: Run runner tests**

Run: `npx vitest run __tests__/unit/contracts.runner.test.js __tests__/unit/contracts.load.test.js __tests__/unit/contracts.schema-setup.test.js __tests__/unit/contracts.sdk-surface.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/check-contracts.mjs package.json __tests__/unit/contracts.runner.test.js
git commit -m "feat: add contracts check runner"
```

## Chunk 5: Local Warning and CI Enforcement

### Task 5: Wire the validator into pre-commit and CI

**Files:**
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/ci.yml`
- Test: `__tests__/unit/contracts.runner.test.js`

- [ ] **Step 1: Write a small runner behavior test for warn mode**

Add to `__tests__/unit/contracts.runner.test.js`:

```js
it('returns zero in warn mode when validators report findings', async () => {
  const result = await runContractsCheck({
    mode: 'warn',
    validators: [
      async () => ({ ok: false, findings: [{ message: 'drift detected' }] })
    ]
  });

  expect(result.exitCode).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails if warn mode is not implemented**

Run: `npx vitest run __tests__/unit/contracts.runner.test.js`
Expected: FAIL until warn-mode exit behavior exists.

- [ ] **Step 3: Modify `.husky/pre-commit`**

Append:

```sh
node scripts/check-contracts.mjs --mode=warn || true
```

Keep existing artifact regeneration intact.

- [ ] **Step 4: Modify `.github/workflows/ci.yml`**

Add a new step after current structural checks:

```yml
      - name: Contract validation
        run: npm run contracts:check
```

- [ ] **Step 5: Run tests and basic script verification**

Run:
- `npx vitest run __tests__/unit/contracts.runner.test.js`
- `node scripts/check-contracts.mjs --mode=warn`

Expected:
- tests PASS
- warn mode exits 0 even if contracts are incomplete during incremental rollout

- [ ] **Step 6: Commit**

```bash
git add .husky/pre-commit .github/workflows/ci.yml __tests__/unit/contracts.runner.test.js
git commit -m "chore: enforce contract validation in ci"
```

## Chunk 6: Developer Docs and Final Verification

### Task 6: Document the new contract workflow and run the full verification set

**Files:**
- Create: `docs/contracts/README.md`
- Modify: `README.md`

- [ ] **Step 1: Write the failing docs validation expectation**

No unit test needed here; use docs validation as the red/green loop.

- [ ] **Step 2: Add `docs/contracts/README.md`**

Document:

- what contracts are for
- where they live
- how to update them
- how `contracts:check` behaves locally vs CI
- why SDK public changes require a release-plan update

Keep this short and operational.

- [ ] **Step 3: Add a brief contributor note to `README.md`**

Add one small section pointing to:

- `docs/contracts/README.md`
- `npm run contracts:check`

Do not add a long explanation to the root README.

- [ ] **Step 4: Run the full verification set**

Run:

```bash
npx vitest run __tests__/unit/contracts.load.test.js __tests__/unit/contracts.schema-setup.test.js __tests__/unit/contracts.sdk-surface.test.js __tests__/unit/contracts.runner.test.js
npm run contracts:check
npm run docs:check
npm run route-sql:check
```

Expected:

- all contract validator tests PASS
- `contracts:check` exits 0 in repo-consistent state
- docs validation PASS
- route SQL guard PASS

- [ ] **Step 5: Commit**

```bash
git add docs/contracts/README.md README.md
git commit -m "docs: add contract validator workflow guide"
```

## Final Execution Notes

- Keep the v1 contract system intentionally narrow. Do not expand into autofix or full route generation while implementing this plan.
- If any validator becomes noisy, reduce scope rather than adding suppressions.
- Prefer explicit constants and declarative mappings in the setup/migration path over heuristic parsing.
- Preserve existing generated-artifact hooks; the contract validator is additive in v1.
- If a task reveals that `app/api/setup/migrate/route.js` is too opaque to inspect cleanly, extract small pure helpers rather than adding more string parsing to the validator.

## Suggested Commit Sequence

1. `feat: add contract manifest scaffolding`
2. `feat: add schema setup contract validation`
3. `feat: add sdk surface contract validation`
4. `feat: add contracts check runner`
5. `chore: enforce contract validation in ci`
6. `docs: add contract validator workflow guide`

## Ready-to-Execute Verification Commands

```bash
npx vitest run __tests__/unit/contracts.load.test.js
npx vitest run __tests__/unit/contracts.schema-setup.test.js
npx vitest run __tests__/unit/contracts.sdk-surface.test.js
npx vitest run __tests__/unit/contracts.runner.test.js
npm run contracts:check
npm run docs:check
npm run route-sql:check
```
