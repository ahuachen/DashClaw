# DashClaw Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `dashclaw doctor` diagnostic and auto-fix tool that checks DashClaw instance health and repairs common issues, available as both `npm run doctor` (local) and `dashclaw doctor` (CLI/remote).

**Architecture:** A shared doctor engine (`app/lib/doctor/`) runs checks against the existing readiness infrastructure and exposes fixes. Two thin entry points consume it: `scripts/doctor.mjs` (imports engine directly for local mode) and `GET/POST /api/doctor` routes (for remote CLI consumption). The CLI subcommand in `@dashclaw/cli` calls the API and renders results.

**Tech Stack:** Node.js 20+, vitest, Next.js App Router, existing readiness modules, existing CLI ANSI rendering.

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `app/lib/doctor/engine.mjs` | Orchestrator — `runDoctor()`, `applyFix()` re-export |
| `app/lib/doctor/checks/database.mjs` | DB connection, tables, migrations |
| `app/lib/doctor/checks/config.mjs` | Required + advisory env vars |
| `app/lib/doctor/checks/auth.mjs` | API key, OAuth providers |
| `app/lib/doctor/checks/deployment.mjs` | NEXTAUTH_URL, CORS |
| `app/lib/doctor/checks/sdk.mjs` | Reachability, auth ping |
| `app/lib/doctor/checks/governance.mjs` | Policies exist, actions recorded, staleness |
| `app/lib/doctor/fixes/index.mjs` | Fix registry — maps action keys to handlers |
| `app/lib/doctor/fixes/migrate.mjs` | Run DDL migrations |
| `app/lib/doctor/fixes/generate-secrets.mjs` | Generate NEXTAUTH_SECRET, ENCRYPTION_KEY, API key |
| `app/lib/doctor/fixes/fix-cors.mjs` | Set ALLOWED_ORIGIN |
| `app/lib/doctor/fixes/create-default-policy.mjs` | Insert starter governance policy |
| `app/lib/doctor/fixes/env-writer.mjs` | Shared .env read/write/backup utility |
| `app/lib/doctor/format.mjs` | Terminal renderer — rich + JSON modes |
| `app/api/doctor/route.js` | `GET /api/doctor` — run checks |
| `app/api/doctor/fix/route.js` | `POST /api/doctor/fix` — apply a fix |
| `scripts/doctor.mjs` | Local mode entry point (`npm run doctor`) |
| `cli/lib/doctor.js` | Remote doctor logic for CLI |
| `__tests__/unit/doctor-engine.test.js` | Engine unit tests |
| `__tests__/unit/doctor-format.test.js` | Formatter unit tests |
| `__tests__/unit/doctor-checks.test.js` | Check module unit tests |
| `__tests__/unit/doctor.route.test.js` | API route tests |

### Modified Files

| File | Change |
|------|--------|
| `cli/bin/dashclaw.js` | Add `doctor` subcommand routing |
| `cli/package.json` | Bump version to `0.3.0` |
| `package.json` | Add `"doctor": "node scripts/doctor.mjs"` script |

---

## Task 1: Doctor Engine Skeleton

**Files:**
- Create: `app/lib/doctor/engine.mjs`
- Create: `app/lib/doctor/checks/*.mjs` (stub modules)
- Test: `__tests__/unit/doctor-engine.test.js`

- [ ] **Step 1: Write the engine test file**

```js
// __tests__/unit/doctor-engine.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDatabaseChecks = vi.fn(async () => []);
const mockConfigChecks = vi.fn(async () => []);
const mockAuthChecks = vi.fn(async () => []);
const mockDeploymentChecks = vi.fn(async () => []);
const mockSdkChecks = vi.fn(async () => []);
const mockGovernanceChecks = vi.fn(async () => []);

vi.mock('@/lib/doctor/checks/database.mjs', () => ({ runChecks: mockDatabaseChecks }));
vi.mock('@/lib/doctor/checks/config.mjs', () => ({ runChecks: mockConfigChecks }));
vi.mock('@/lib/doctor/checks/auth.mjs', () => ({ runChecks: mockAuthChecks }));
vi.mock('@/lib/doctor/checks/deployment.mjs', () => ({ runChecks: mockDeploymentChecks }));
vi.mock('@/lib/doctor/checks/sdk.mjs', () => ({ runChecks: mockSdkChecks }));
vi.mock('@/lib/doctor/checks/governance.mjs', () => ({ runChecks: mockGovernanceChecks }));

import { runDoctor, computeSummary } from '@/lib/doctor/engine.mjs';

beforeEach(() => vi.clearAllMocks());

describe('runDoctor', () => {
  it('returns healthy when all checks pass', async () => {
    mockDatabaseChecks.mockResolvedValue([
      { id: 'db_connection', category: 'database', status: 'pass', title: 'DB', message: 'OK', fix: null },
    ]);
    mockConfigChecks.mockResolvedValue([
      { id: 'env_DATABASE_URL', category: 'config', status: 'pass', title: 'DATABASE_URL', message: 'Present', fix: null },
    ]);

    const result = await runDoctor();

    expect(result.status).toBe('healthy');
    expect(result.checks).toHaveLength(2);
    expect(result.summary).toEqual({ pass: 2, warn: 0, fail: 0 });
    expect(result.timestamp).toBeDefined();
  });

  it('returns unhealthy when any check fails', async () => {
    mockDatabaseChecks.mockResolvedValue([
      { id: 'db_connection', category: 'database', status: 'fail', title: 'DB', message: 'Refused', fix: null },
    ]);

    const result = await runDoctor();

    expect(result.status).toBe('unhealthy');
    expect(result.summary.fail).toBe(1);
  });

  it('returns needs_attention when checks warn but none fail', async () => {
    mockConfigChecks.mockResolvedValue([
      { id: 'env_NEXTAUTH_URL', category: 'config', status: 'warn', title: 'URL', message: 'Not set', fix: null },
    ]);

    const result = await runDoctor();

    expect(result.status).toBe('needs_attention');
    expect(result.summary.warn).toBe(1);
  });

  it('filters by category when specified', async () => {
    mockDatabaseChecks.mockResolvedValue([
      { id: 'db_connection', category: 'database', status: 'pass', title: 'DB', message: 'OK', fix: null },
    ]);
    mockConfigChecks.mockResolvedValue([
      { id: 'env_x', category: 'config', status: 'pass', title: 'ENV', message: 'OK', fix: null },
    ]);

    const result = await runDoctor({ categories: ['database'] });

    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].category).toBe('database');
  });

  it('strips fix metadata when includeFixes is false', async () => {
    mockDatabaseChecks.mockResolvedValue([
      { id: 'db_tables', category: 'database', status: 'fail', title: 'Tables', message: 'Missing',
        fix: { type: 'auto', description: 'Run migrations', action: 'migrate' } },
    ]);

    const result = await runDoctor({ includeFixes: false });

    expect(result.checks[0].fix).toBeNull();
  });
});

describe('computeSummary', () => {
  it('counts pass/warn/fail correctly', () => {
    const checks = [
      { status: 'pass' }, { status: 'pass' }, { status: 'warn' }, { status: 'fail' },
    ];
    expect(computeSummary(checks)).toEqual({ pass: 2, warn: 1, fail: 1 });
  });

  it('returns zeros for empty array', () => {
    expect(computeSummary([])).toEqual({ pass: 0, warn: 0, fail: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/doctor-engine.test.js`
Expected: FAIL — `@/lib/doctor/engine.mjs` does not exist.

- [ ] **Step 3: Create stub check modules**

Create each of these files with identical stub content:

```js
// app/lib/doctor/checks/database.mjs
export async function runChecks() { return []; }
```

```js
// app/lib/doctor/checks/config.mjs
export async function runChecks() { return []; }
```

```js
// app/lib/doctor/checks/auth.mjs
export async function runChecks() { return []; }
```

```js
// app/lib/doctor/checks/deployment.mjs
export async function runChecks() { return []; }
```

```js
// app/lib/doctor/checks/sdk.mjs
export async function runChecks() { return []; }
```

```js
// app/lib/doctor/checks/governance.mjs
export async function runChecks() { return []; }
```

- [ ] **Step 4: Write the engine**

```js
// app/lib/doctor/engine.mjs
import { runChecks as databaseChecks } from './checks/database.mjs';
import { runChecks as configChecks } from './checks/config.mjs';
import { runChecks as authChecks } from './checks/auth.mjs';
import { runChecks as deploymentChecks } from './checks/deployment.mjs';
import { runChecks as sdkChecks } from './checks/sdk.mjs';
import { runChecks as governanceChecks } from './checks/governance.mjs';

const CHECK_RUNNERS = {
  database: databaseChecks,
  config: configChecks,
  auth: authChecks,
  deployment: deploymentChecks,
  sdk: sdkChecks,
  governance: governanceChecks,
};

const CATEGORY_ORDER = ['database', 'config', 'auth', 'deployment', 'sdk', 'governance'];

/**
 * @param {Object} [options]
 * @param {string[]} [options.categories] - Filter to specific categories
 * @param {boolean} [options.includeFixes=true] - Include fix metadata
 * @param {Object} [options.env=process.env] - Environment to check
 * @param {string} [options.host=''] - Host for deploy/SDK checks
 */
export async function runDoctor(options = {}) {
  const {
    categories = null,
    includeFixes = true,
    env = process.env,
    host = '',
  } = options;

  const activeCategories = categories
    ? CATEGORY_ORDER.filter((c) => categories.includes(c))
    : CATEGORY_ORDER;

  const checkArrays = await Promise.all(
    activeCategories.map((cat) => CHECK_RUNNERS[cat]({ env, host })),
  );

  let checks = checkArrays.flat();

  if (!includeFixes) {
    checks = checks.map((c) => ({ ...c, fix: null }));
  }

  const summary = computeSummary(checks);
  const status = summary.fail > 0 ? 'unhealthy' : summary.warn > 0 ? 'needs_attention' : 'healthy';

  return {
    status,
    summary,
    checks,
    timestamp: new Date().toISOString(),
  };
}

/**
 * @param {Array<{status: string}>} checks
 */
export function computeSummary(checks) {
  const summary = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) {
    if (check.status in summary) summary[check.status]++;
  }
  return summary;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/doctor-engine.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/doctor/engine.mjs app/lib/doctor/checks/*.mjs __tests__/unit/doctor-engine.test.js
git commit -m "feat(doctor): add engine skeleton with runDoctor and computeSummary"
```

---

## Task 2: Database + Config Check Modules

**Files:**
- Modify: `app/lib/doctor/checks/database.mjs`
- Modify: `app/lib/doctor/checks/config.mjs`
- Test: `__tests__/unit/doctor-checks.test.js`

- [ ] **Step 1: Write the check tests**

```js
// __tests__/unit/doctor-checks.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSetupStatus = vi.fn();
vi.mock('@/lib/setupStatus.mjs', () => ({ getSetupStatus: mockGetSetupStatus }));

const mockCheckConfiguration = vi.fn();
vi.mock('@/lib/readiness/configurationCheck.mjs', () => ({
  checkConfiguration: mockCheckConfiguration,
  buildConfigurationSection: vi.fn(),
}));

import { runChecks as databaseChecks } from '@/lib/doctor/checks/database.mjs';
import { runChecks as configChecks } from '@/lib/doctor/checks/config.mjs';

beforeEach(() => vi.clearAllMocks());

describe('doctor/checks/database', () => {
  it('returns pass checks when DB is configured', async () => {
    mockGetSetupStatus.mockResolvedValue({ configured: true, message: 'OK' });

    const checks = await databaseChecks({ env: { DATABASE_URL: 'postgres://test' } });

    expect(checks.length).toBeGreaterThanOrEqual(2);
    expect(checks.every((c) => c.category === 'database')).toBe(true);
    const conn = checks.find((c) => c.id === 'db_connection');
    expect(conn.status).toBe('pass');
  });

  it('returns fail with null fix when DATABASE_URL is missing', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'missing_database_url',
      message: 'DATABASE_URL is not set.',
    });

    const checks = await databaseChecks({ env: {} });

    const conn = checks.find((c) => c.id === 'db_connection');
    expect(conn.status).toBe('fail');
    expect(conn.fix).toBeNull();
  });

  it('returns fail with migrate fix when tables are missing', async () => {
    mockGetSetupStatus.mockResolvedValue({
      configured: false,
      reason: 'no_tables',
      message: 'Missing 3 tables.',
      missing: ['guard_policies', 'guard_decisions', 'action_records'],
    });

    const checks = await databaseChecks({ env: { DATABASE_URL: 'postgres://test' } });

    const schema = checks.find((c) => c.id === 'db_schema');
    expect(schema.status).toBe('fail');
    expect(schema.fix).toEqual({
      type: 'auto',
      description: 'Run database migrations to create missing tables',
      action: 'migrate',
    });
  });
});

describe('doctor/checks/config', () => {
  it('returns pass for present required vars', async () => {
    mockCheckConfiguration.mockReturnValue({
      ok: true,
      status: 'pass',
      checks: [
        { id: 'DATABASE_URL', label: 'DATABASE_URL', status: 'pass', detail: 'Present' },
        { id: 'NEXTAUTH_SECRET', label: 'NEXTAUTH_SECRET', status: 'pass', detail: 'Present' },
      ],
      missingRequired: [],
      missingAdvisory: [],
    });

    const checks = await configChecks({ env: { DATABASE_URL: 'x', NEXTAUTH_SECRET: 'y' } });

    expect(checks.every((c) => c.status === 'pass')).toBe(true);
    expect(checks.every((c) => c.category === 'config')).toBe(true);
  });

  it('returns fail with generate_secret fix for missing NEXTAUTH_SECRET', async () => {
    mockCheckConfiguration.mockReturnValue({
      ok: false,
      status: 'fail',
      checks: [
        { id: 'DATABASE_URL', label: 'DATABASE_URL', status: 'pass', detail: 'Present' },
        { id: 'NEXTAUTH_SECRET', label: 'NEXTAUTH_SECRET', status: 'fail', detail: 'Missing' },
      ],
      missingRequired: [{ key: 'NEXTAUTH_SECRET' }],
      missingAdvisory: [],
    });

    const checks = await configChecks({ env: { DATABASE_URL: 'x' } });

    const secret = checks.find((c) => c.id === 'env_NEXTAUTH_SECRET');
    expect(secret.status).toBe('fail');
    expect(secret.fix.action).toBe('generate_secret');
  });

  it('returns warn for missing advisory vars', async () => {
    mockCheckConfiguration.mockReturnValue({
      ok: true,
      status: 'warn',
      checks: [
        { id: 'NEXTAUTH_URL', label: 'NEXTAUTH_URL', status: 'warn', detail: 'Not set' },
      ],
      missingRequired: [],
      missingAdvisory: [{ key: 'NEXTAUTH_URL' }],
    });

    const checks = await configChecks({ env: {} });

    const url = checks.find((c) => c.id === 'env_NEXTAUTH_URL');
    expect(url.status).toBe('warn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/doctor-checks.test.js`
Expected: FAIL — stubs return empty arrays.

- [ ] **Step 3: Implement database checks**

```js
// app/lib/doctor/checks/database.mjs
import { getSetupStatus } from '../../setupStatus.mjs';

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const dbStatus = await getSetupStatus(env);
  const checks = [];

  if (dbStatus.configured) {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'pass',
      title: 'Database Connection',
      message: 'Connected to Postgres',
      fix: null,
    });
    checks.push({
      id: 'db_schema',
      category: 'database',
      status: 'pass',
      title: 'Core Tables',
      message: 'All core tables present',
      fix: null,
    });
  } else if (dbStatus.reason === 'missing_database_url') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'fail',
      title: 'Database Connection',
      message: 'DATABASE_URL is not set',
      fix: null,
    });
  } else if (dbStatus.reason === 'connection_error') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'fail',
      title: 'Database Connection',
      message: 'Unable to connect to database — check DATABASE_URL and ensure Postgres is running',
      fix: null,
    });
  } else if (dbStatus.reason === 'no_tables') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'pass',
      title: 'Database Connection',
      message: 'Connected to Postgres',
      fix: null,
    });
    const missing = dbStatus.missing || [];
    checks.push({
      id: 'db_schema',
      category: 'database',
      status: 'fail',
      title: 'Core Tables',
      message: `Missing ${missing.length} core table(s): ${missing.join(', ')}`,
      fix: {
        type: 'auto',
        description: 'Run database migrations to create missing tables',
        action: 'migrate',
      },
    });
  }

  return checks;
}
```

- [ ] **Step 4: Implement config checks**

```js
// app/lib/doctor/checks/config.mjs
import { checkConfiguration } from '../../readiness/configurationCheck.mjs';

const GENERATE_FIXES = {
  NEXTAUTH_SECRET: { action: 'generate_secret', description: 'Generate a random NEXTAUTH_SECRET' },
  ENCRYPTION_KEY: { action: 'generate_encryption_key', description: 'Generate a random ENCRYPTION_KEY' },
  DASHCLAW_API_KEY: { action: 'generate_api_key', description: 'Generate a new API key' },
};

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const config = checkConfiguration(env);
  const checks = [];

  for (const check of config.checks) {
    const fixInfo = GENERATE_FIXES[check.id];
    checks.push({
      id: `env_${check.id}`,
      category: 'config',
      status: check.status === 'info' ? 'pass' : check.status,
      title: check.label || check.id,
      message: check.detail,
      fix:
        check.status === 'fail' && fixInfo
          ? { type: 'auto', description: fixInfo.description, action: fixInfo.action }
          : null,
    });
  }

  return checks;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/doctor-checks.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/doctor/checks/database.mjs app/lib/doctor/checks/config.mjs __tests__/unit/doctor-checks.test.js
git commit -m "feat(doctor): implement database and config check modules"
```

---

## Task 3: Auth, Deployment, SDK Check Modules

**Files:**
- Modify: `app/lib/doctor/checks/auth.mjs`
- Modify: `app/lib/doctor/checks/deployment.mjs`
- Modify: `app/lib/doctor/checks/sdk.mjs`

- [ ] **Step 1: Implement auth checks**

```js
// app/lib/doctor/checks/auth.mjs
import { getAuthConfig } from '../../authConfig.mjs';

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const authConfig = getAuthConfig(env);
  const checks = [];

  // API key
  checks.push({
    id: 'auth_api_key',
    category: 'auth',
    status: env.DASHCLAW_API_KEY ? 'pass' : 'fail',
    title: 'API Key',
    message: env.DASHCLAW_API_KEY
      ? 'DASHCLAW_API_KEY is set'
      : 'DASHCLAW_API_KEY is missing — agents cannot authenticate',
    fix: env.DASHCLAW_API_KEY
      ? null
      : { type: 'auto', description: 'Generate a new API key', action: 'generate_api_key' },
  });

  // Sign-in methods
  const availableMethods = [
    ...authConfig.oauthProviders.map((p) => p.name),
    ...(authConfig.hasLocalPassword ? ['Local password'] : []),
  ];
  checks.push({
    id: 'auth_signin',
    category: 'auth',
    status: authConfig.hasAnySignInMethod ? 'pass' : 'warn',
    title: 'Sign-In Methods',
    message: authConfig.hasAnySignInMethod
      ? `Sign-in available via: ${availableMethods.join(', ')}`
      : 'No sign-in method configured — operators cannot access the dashboard',
    fix: null,
  });

  // Partial provider warnings
  for (const provider of authConfig.providerChecks || []) {
    if (provider.partiallyConfigured) {
      checks.push({
        id: `auth_${provider.id}_partial`,
        category: 'auth',
        status: 'warn',
        title: `${provider.name} OAuth (Partial)`,
        message: `Missing: ${provider.missingKeys.join(', ')}`,
        fix: null,
      });
    }
  }

  return checks;
}
```

- [ ] **Step 2: Implement deployment checks**

```js
// app/lib/doctor/checks/deployment.mjs

/**
 * @param {{ env?: object, host?: string }} options
 */
export async function runChecks({ env = process.env, host = '' } = {}) {
  const checks = [];

  // NEXTAUTH_URL
  const nextauthUrl = env.NEXTAUTH_URL;
  if (!nextauthUrl) {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'warn',
      title: 'NEXTAUTH_URL',
      message: 'Not set — OAuth callbacks may fail in production',
      fix: null,
    });
  } else if (host && !nextauthUrl.includes(host)) {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'warn',
      title: 'NEXTAUTH_URL',
      message: `Set to ${nextauthUrl} but current host is ${host} — possible mismatch`,
      fix: null,
    });
  } else {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'pass',
      title: 'NEXTAUTH_URL',
      message: `Set to ${nextauthUrl}`,
      fix: null,
    });
  }

  // CORS
  const allowedOrigin = env.ALLOWED_ORIGIN;
  if (!allowedOrigin) {
    checks.push({
      id: 'deploy_cors',
      category: 'deployment',
      status: 'warn',
      title: 'CORS (ALLOWED_ORIGIN)',
      message: 'Not set — cross-origin agent requests may be blocked',
      fix: null,
    });
  } else {
    checks.push({
      id: 'deploy_cors',
      category: 'deployment',
      status: 'pass',
      title: 'CORS (ALLOWED_ORIGIN)',
      message: `Set to ${allowedOrigin}`,
      fix: null,
    });
  }

  return checks;
}
```

- [ ] **Step 3: Implement SDK checks**

```js
// app/lib/doctor/checks/sdk.mjs

/**
 * @param {{ env?: object, host?: string }} options
 */
export async function runChecks({ env = process.env, host = '' } = {}) {
  const checks = [];

  const baseUrl = env.NEXTAUTH_URL || (host ? `https://${host}` : 'http://localhost:3000');
  let reachable = false;

  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    reachable = res.ok || res.status === 503; // 503 = degraded but reachable
  } catch {
    // Not reachable
  }

  checks.push({
    id: 'sdk_reachable',
    category: 'sdk',
    status: reachable ? 'pass' : 'warn',
    title: 'Instance Reachable',
    message: reachable
      ? `${baseUrl}/api/health responded`
      : `Cannot reach ${baseUrl}/api/health — instance may not be running`,
    fix: null,
  });

  // Only test auth if reachable and key is present
  if (reachable && env.DASHCLAW_API_KEY) {
    try {
      const res = await fetch(`${baseUrl}/api/setup/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.DASHCLAW_API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      checks.push({
        id: 'sdk_auth',
        category: 'sdk',
        status: data.ok ? 'pass' : 'fail',
        title: 'API Key Authentication',
        message: data.ok ? 'API key accepted' : `API key rejected: ${data.message || 'unknown error'}`,
        fix: null,
      });
    } catch {
      checks.push({
        id: 'sdk_auth',
        category: 'sdk',
        status: 'warn',
        title: 'API Key Authentication',
        message: 'Could not verify API key — ping request failed',
        fix: null,
      });
    }
  }

  return checks;
}
```

- [ ] **Step 4: Run engine tests to verify no regressions**

Run: `npx vitest run __tests__/unit/doctor-engine.test.js __tests__/unit/doctor-checks.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/doctor/checks/auth.mjs app/lib/doctor/checks/deployment.mjs app/lib/doctor/checks/sdk.mjs
git commit -m "feat(doctor): implement auth, deployment, and SDK check modules"
```

---

## Task 4: Governance Check Module

**Files:**
- Modify: `app/lib/doctor/checks/governance.mjs`

- [ ] **Step 1: Implement governance checks**

```js
// app/lib/doctor/checks/governance.mjs
import { getSql } from '../../db.js';
import { getSetupStatus } from '../../setupStatus.mjs';

const STALENESS_DAYS = 7;

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const checks = [];

  // Only run governance checks if DB is configured
  const dbStatus = await getSetupStatus(env);
  if (!dbStatus.configured) return checks;

  let sql;
  try {
    sql = getSql();
  } catch {
    return checks;
  }

  // Policies exist?
  try {
    const policies = await sql`SELECT COUNT(*)::int AS count FROM guard_policies WHERE org_id = 'org_default'`;
    const policyCount = policies[0]?.count ?? 0;

    checks.push({
      id: 'gov_policies',
      category: 'governance',
      status: policyCount > 0 ? 'pass' : 'warn',
      title: 'Governance Policies',
      message:
        policyCount > 0
          ? `${policyCount} active polic${policyCount === 1 ? 'y' : 'ies'}`
          : 'No governance policies configured — all actions will be allowed by default',
      fix:
        policyCount > 0
          ? null
          : {
              type: 'auto',
              description: 'Create a default log-all governance policy',
              action: 'create_default_policy',
            },
    });
  } catch {
    // Table may not exist — covered by database checks
  }

  // Actions recorded?
  try {
    const actions = await sql`SELECT COUNT(*)::int AS count FROM action_records WHERE org_id = 'org_default'`;
    const actionCount = actions[0]?.count ?? 0;

    checks.push({
      id: 'gov_actions',
      category: 'governance',
      status: actionCount > 0 ? 'pass' : 'warn',
      title: 'Recorded Actions',
      message:
        actionCount > 0
          ? `${actionCount} action${actionCount === 1 ? '' : 's'} recorded`
          : 'No actions recorded yet — agents have not sent any governed actions',
      fix: null,
    });

    // Staleness check (only meaningful if some actions exist)
    if (actionCount > 0) {
      const recent = await sql`
        SELECT COUNT(*)::int AS count FROM action_records
        WHERE org_id = 'org_default'
          AND created_at > NOW() - INTERVAL '7 days'
      `;
      const recentCount = recent[0]?.count ?? 0;

      if (recentCount === 0) {
        checks.push({
          id: 'gov_stale',
          category: 'governance',
          status: 'warn',
          title: 'Governance Activity',
          message: `No actions recorded in the last ${STALENESS_DAYS} days — agents may have stopped reporting`,
          fix: null,
        });
      }
    }
  } catch {
    // Table may not exist
  }

  return checks;
}
```

- [ ] **Step 2: Run engine test to verify no regressions**

Run: `npx vitest run __tests__/unit/doctor-engine.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/doctor/checks/governance.mjs
git commit -m "feat(doctor): implement governance check module"
```

---

## Task 5: Fix Handlers

**Files:**
- Create: `app/lib/doctor/fixes/env-writer.mjs`
- Create: `app/lib/doctor/fixes/migrate.mjs`
- Create: `app/lib/doctor/fixes/generate-secrets.mjs`
- Create: `app/lib/doctor/fixes/fix-cors.mjs`
- Create: `app/lib/doctor/fixes/create-default-policy.mjs`
- Create: `app/lib/doctor/fixes/index.mjs`
- Modify: `app/lib/doctor/engine.mjs` — re-export `applyFix`

- [ ] **Step 1: Implement env-writer utility**

```js
// app/lib/doctor/fixes/env-writer.mjs
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');
const BACKUP_PATH = resolve(process.cwd(), '.env.backup');

/**
 * Parse .env into a key-value object.
 * @param {string} text
 */
export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Read current .env file. Returns empty object if missing.
 */
export function readEnvFile() {
  if (!existsSync(ENV_PATH)) return {};
  return parseEnv(readFileSync(ENV_PATH, 'utf8'));
}

/**
 * Back up .env, then write updated values.
 * Only adds or updates keys — never removes existing ones.
 * @param {Record<string, string>} updates
 */
export function writeEnvUpdates(updates) {
  const backedUp = existsSync(ENV_PATH);
  if (backedUp) copyFileSync(ENV_PATH, BACKUP_PATH);

  const current = readEnvFile();
  const merged = { ...current, ...updates };

  const lines = Object.entries(merged).map(([k, v]) => {
    const needsQuotes = v.includes(' ') || v.includes('#') || v.includes("'");
    return `${k}=${needsQuotes ? `"${v}"` : v}`;
  });

  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');

  return { backedUp, keysWritten: Object.keys(updates) };
}
```

- [ ] **Step 2: Implement migrate fix**

```js
// app/lib/doctor/fixes/migrate.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Run DDL migrations — same logic as POST /api/setup/migrate.
 * @param {{ env?: object }} options
 */
export async function apply({ env = process.env } = {}) {
  const { default: postgres } = await import('postgres');

  const url = env.DATABASE_URL;
  if (!url) return { applied: false, description: 'DATABASE_URL not set — cannot run migrations' };

  const sql = postgres(url, { max: 1, connect_timeout: 30, idle_timeout: 5 });

  try {
    const drizzleDir = resolve(process.cwd(), 'drizzle');
    const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
    const ddl = sqlFiles
      .map((f) => readFileSync(resolve(drizzleDir, f), 'utf8'))
      .join('\n--> statement-breakpoint\n');

    const statements = ddl
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    const SAFE_CODES = new Set(['42P07', '42P16', '42701', '42710', '42P10', '23505']);

    let created = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        if (stmt.includes('vector(') && !stmt.startsWith('CREATE EXTENSION')) {
          await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
        }
        await sql.unsafe(stmt);
        created++;
      } catch (err) {
        if (SAFE_CODES.has(err.code)) skipped++;
        // Other errors are silently skipped — same as /api/setup/migrate
      }
    }

    // Seed org_default
    await sql`
      INSERT INTO organizations (id, name, slug, plan)
      VALUES ('org_default', 'Default Organization', 'default', 'pro')
      ON CONFLICT (id) DO NOTHING
    `;

    return {
      applied: true,
      description: `Ran migrations: ${created} applied, ${skipped} skipped (already exist)`,
    };
  } catch (err) {
    return { applied: false, description: `Migration failed: ${err.message}` };
  } finally {
    await sql.end({ timeout: 2 });
  }
}
```

- [ ] **Step 3: Implement secret-generation fixes**

```js
// app/lib/doctor/fixes/generate-secrets.mjs
import { randomBytes } from 'node:crypto';
import { writeEnvUpdates } from './env-writer.mjs';

function b64url(n) {
  return randomBytes(n)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function applyGenerateSecret() {
  const value = b64url(32);
  const { backedUp } = writeEnvUpdates({ NEXTAUTH_SECRET: value });
  return {
    applied: true,
    description: `Generated NEXTAUTH_SECRET${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}

export async function applyGenerateEncryptionKey() {
  const value = b64url(32).slice(0, 32);
  const { backedUp } = writeEnvUpdates({ ENCRYPTION_KEY: value });
  return {
    applied: true,
    description: `Generated ENCRYPTION_KEY${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}

export async function applyGenerateApiKey() {
  const value = `oc_live_${randomBytes(24).toString('hex')}`;
  const { backedUp } = writeEnvUpdates({ DASHCLAW_API_KEY: value });
  return {
    applied: true,
    description: `Generated DASHCLAW_API_KEY${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}
```

- [ ] **Step 4: Implement CORS fix**

```js
// app/lib/doctor/fixes/fix-cors.mjs
import { writeEnvUpdates } from './env-writer.mjs';

/**
 * @param {{ origin?: string }} params
 */
export async function apply({ origin } = {}) {
  if (!origin) return { applied: false, description: 'No origin provided — cannot auto-fix CORS' };
  writeEnvUpdates({ ALLOWED_ORIGIN: origin });
  return { applied: true, description: `Set ALLOWED_ORIGIN to ${origin}` };
}
```

- [ ] **Step 5: Implement default policy fix**

```js
// app/lib/doctor/fixes/create-default-policy.mjs
import { getSql } from '../../db.js';

export async function apply() {
  try {
    const sql = getSql();
    const id = `pol_doctor_${Date.now()}`;
    await sql`
      INSERT INTO guard_policies (id, org_id, name, policy_type, rules, enabled)
      VALUES (
        ${id},
        'org_default',
        'Doctor: Log All Actions',
        'risk_threshold',
        ${JSON.stringify({ threshold: 100, action: 'warn' })}::jsonb,
        true
      )
      ON CONFLICT DO NOTHING
    `;
    return {
      applied: true,
      description: 'Created default governance policy (warn at risk 100)',
    };
  } catch (err) {
    return { applied: false, description: `Failed to create policy: ${err.message}` };
  }
}
```

- [ ] **Step 6: Implement fix registry**

```js
// app/lib/doctor/fixes/index.mjs
import { apply as migrate } from './migrate.mjs';
import {
  applyGenerateSecret,
  applyGenerateEncryptionKey,
  applyGenerateApiKey,
} from './generate-secrets.mjs';
import { apply as fixCors } from './fix-cors.mjs';
import { apply as createDefaultPolicy } from './create-default-policy.mjs';

/**
 * Registry of fix action keys → handlers.
 * scope: 'local' = requires filesystem (env writes). 'remote' = DB-only (safe via API).
 */
export const FIX_REGISTRY = {
  migrate:                  { handler: migrate, scope: 'remote' },
  generate_secret:          { handler: applyGenerateSecret, scope: 'local' },
  generate_encryption_key:  { handler: applyGenerateEncryptionKey, scope: 'local' },
  generate_api_key:         { handler: applyGenerateApiKey, scope: 'local' },
  fix_cors:                 { handler: fixCors, scope: 'local' },
  create_default_policy:    { handler: createDefaultPolicy, scope: 'remote' },
};

/**
 * Apply a fix by action key.
 * @param {string} action
 * @param {Object} [params]
 * @param {{ allowLocal?: boolean }} [options]
 */
export async function applyFix(action, params = {}, options = {}) {
  const { allowLocal = false } = options;
  const entry = FIX_REGISTRY[action];

  if (!entry) {
    return { applied: false, action, description: `Unknown fix action: ${action}` };
  }

  if (entry.scope === 'local' && !allowLocal) {
    return {
      applied: false,
      action,
      description: `Fix "${action}" requires local filesystem access — run npm run doctor instead`,
    };
  }

  const result = await entry.handler(params);
  return { ...result, action };
}
```

- [ ] **Step 7: Re-export applyFix from engine**

Append to `app/lib/doctor/engine.mjs`:

```js
export { applyFix } from './fixes/index.mjs';
```

- [ ] **Step 8: Run test suite to verify no regressions**

Run: `npx vitest run __tests__/unit/doctor-engine.test.js __tests__/unit/doctor-checks.test.js`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add app/lib/doctor/fixes/ app/lib/doctor/engine.mjs
git commit -m "feat(doctor): implement fix engine with migrate, secret gen, CORS, and default policy"
```

---

## Task 6: Terminal Formatter

**Files:**
- Create: `app/lib/doctor/format.mjs`
- Test: `__tests__/unit/doctor-format.test.js`

- [ ] **Step 1: Write formatter tests**

```js
// __tests__/unit/doctor-format.test.js
import { describe, expect, it } from 'vitest';
import { formatDoctorResult, formatFixResult, formatManualSummary } from '@/lib/doctor/format.mjs';

const sample = {
  status: 'healthy',
  summary: { pass: 3, warn: 0, fail: 0 },
  checks: [
    { id: 'db_conn', category: 'database', status: 'pass', title: 'Database', message: 'OK', fix: null },
    { id: 'env_url', category: 'config', status: 'pass', title: 'DATABASE_URL', message: 'Set', fix: null },
    { id: 'auth_key', category: 'auth', status: 'pass', title: 'API Key', message: 'Present', fix: null },
  ],
  timestamp: '2026-04-12T00:00:00Z',
};

describe('formatDoctorResult', () => {
  it('returns JSON string in json mode', () => {
    const output = formatDoctorResult(sample, { json: true });
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe('healthy');
    expect(parsed.checks).toHaveLength(3);
  });

  it('includes category headers in rich mode', () => {
    const output = formatDoctorResult(sample, { json: false });
    expect(output).toContain('Database');
    expect(output).toContain('Configuration');
    expect(output).toContain('Auth');
  });

  it('includes summary line', () => {
    const output = formatDoctorResult(sample, { json: false });
    expect(output).toContain('3 passed');
  });
});

describe('formatFixResult', () => {
  it('returns JSON in json mode', () => {
    const result = { applied: true, action: 'migrate', description: 'Ran migrations' };
    expect(JSON.parse(formatFixResult(result, { json: true })).applied).toBe(true);
  });

  it('returns human-readable string in rich mode', () => {
    const result = { applied: true, action: 'migrate', description: 'Ran migrations' };
    expect(formatFixResult(result, { json: false })).toContain('Ran migrations');
  });
});

describe('formatManualSummary', () => {
  it('returns empty string when no manual checks', () => {
    expect(formatManualSummary([])).toBe('');
  });

  it('lists manual checks', () => {
    const output = formatManualSummary([
      { id: 'x', message: 'Configure OAuth provider', status: 'warn' },
    ]);
    expect(output).toContain('Manual action needed');
    expect(output).toContain('Configure OAuth provider');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/doctor-format.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement formatter**

```js
// app/lib/doctor/format.mjs

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = (s) => `${ESC}1m${s}${RESET}`;
const DIM = (s) => `${ESC}2m${s}${RESET}`;
const GREEN = (s) => `${ESC}32m${s}${RESET}`;
const YELLOW = (s) => `${ESC}33m${s}${RESET}`;
const RED = (s) => `${ESC}31m${s}${RESET}`;

const ICONS = { pass: GREEN('✓'), warn: YELLOW('⚠'), fail: RED('✗') };

const CATEGORY_LABELS = {
  database: 'Database',
  config: 'Configuration',
  auth: 'Auth',
  deployment: 'Deployment',
  sdk: 'SDK',
  governance: 'Governance',
};

const CATEGORY_ORDER = ['database', 'config', 'auth', 'deployment', 'sdk', 'governance'];

/**
 * Format the full doctor result for terminal or JSON output.
 * @param {object} result
 * @param {{ json?: boolean }} options
 */
export function formatDoctorResult(result, { json = false } = {}) {
  if (json) return JSON.stringify(result, null, 2);

  const lines = ['', ` ${BOLD('DashClaw Doctor')}`, ''];

  const grouped = {};
  for (const check of result.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const cat of CATEGORY_ORDER) {
    const checks = grouped[cat];
    if (!checks || checks.length === 0) continue;

    lines.push(` ${BOLD(CATEGORY_LABELS[cat] || cat)}`);
    for (const check of checks) {
      const icon = ICONS[check.status] || '?';
      lines.push(`  ${icon} ${check.title}`);
      if (check.status !== 'pass') {
        lines.push(`    ${DIM(check.message)}`);
      }
    }
    lines.push('');
  }

  const { pass, warn, fail } = result.summary;
  const parts = [];
  if (pass > 0) parts.push(GREEN(`${pass} passed`));
  if (warn > 0) parts.push(YELLOW(`${warn} warning${warn !== 1 ? 's' : ''}`));
  if (fail > 0) parts.push(RED(`${fail} failed`));
  lines.push(` ${BOLD('Summary:')} ${parts.join(', ')}`);

  lines.push('');
  return lines.join('\n');
}

/**
 * Format a fix result for terminal or JSON output.
 * @param {{ applied: boolean, action: string, description: string }} result
 * @param {{ json?: boolean }} options
 */
export function formatFixResult(result, { json = false } = {}) {
  if (json) return JSON.stringify(result, null, 2);
  const icon = result.applied ? GREEN('→') : RED('✗');
  return `  ${icon} ${result.description}`;
}

/**
 * Format the manual-action summary.
 * @param {Array<{ status: string, message: string }>} manualChecks
 */
export function formatManualSummary(manualChecks) {
  if (manualChecks.length === 0) return '';
  const lines = ['', ` ${BOLD('Manual action needed:')}`];
  for (const check of manualChecks) {
    lines.push(`  ${YELLOW('•')} ${check.message}`);
  }
  lines.push('');
  return lines.join('\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/doctor-format.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/lib/doctor/format.mjs __tests__/unit/doctor-format.test.js
git commit -m "feat(doctor): implement terminal formatter with rich and JSON modes"
```

---

## Task 7: API Endpoints

**Files:**
- Create: `app/api/doctor/route.js`
- Create: `app/api/doctor/fix/route.js`
- Test: `__tests__/unit/doctor.route.test.js`

- [ ] **Step 1: Write route tests**

```js
// __tests__/unit/doctor.route.test.js
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const mockRunDoctor = vi.fn();
const mockApplyFix = vi.fn();
const mockEmpty = vi.fn(async () => []);

vi.mock('@/lib/doctor/engine.mjs', () => ({
  runDoctor: mockRunDoctor,
  applyFix: mockApplyFix,
}));

// Ensure check-module imports don't fail when engine.mjs is loaded by route handlers
vi.mock('@/lib/doctor/checks/database.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/config.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/auth.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/deployment.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/sdk.mjs', () => ({ runChecks: mockEmpty }));
vi.mock('@/lib/doctor/checks/governance.mjs', () => ({ runChecks: mockEmpty }));

import { GET } from '@/api/doctor/route.js';
import { POST } from '@/api/doctor/fix/route.js';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/doctor', () => {
  it('returns doctor result as JSON', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'healthy',
      summary: { pass: 3, warn: 0, fail: 0 },
      checks: [],
      timestamp: '2026-04-12T00:00:00Z',
    });

    const req = makeRequest('http://localhost/api/doctor', { headers: { 'x-api-key': 'test' } });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('healthy');
  });

  it('returns 503 when status is unhealthy', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'unhealthy', summary: { pass: 0, warn: 0, fail: 1 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor', { headers: { 'x-api-key': 'test' } });
    const res = await GET(req);

    expect(res.status).toBe(503);
  });

  it('passes category filter from query params', async () => {
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 1, warn: 0, fail: 0 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor?category=database,config', {
      headers: { 'x-api-key': 'test' },
    });
    await GET(req);

    expect(mockRunDoctor).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['database', 'config'] }),
    );
  });
});

describe('POST /api/doctor/fix', () => {
  it('applies a fix and returns result with recheck', async () => {
    mockApplyFix.mockResolvedValue({
      applied: true, action: 'migrate', description: 'Ran migrations',
    });
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 1, warn: 0, fail: 0 },
      checks: [{ id: 'db_schema', category: 'database', status: 'pass', title: 'Tables', message: 'OK', fix: null }],
      timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: { action: 'migrate' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.applied).toBe(true);
    expect(body.recheck).toBeDefined();
  });

  it('returns 400 for missing action', async () => {
    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('passes allowLocal: false to applyFix', async () => {
    mockApplyFix.mockResolvedValue({ applied: false, action: 'generate_secret', description: 'requires local' });
    mockRunDoctor.mockResolvedValue({
      status: 'healthy', summary: { pass: 0, warn: 0, fail: 0 }, checks: [], timestamp: '',
    });

    const req = makeRequest('http://localhost/api/doctor/fix', {
      headers: { 'x-api-key': 'test' },
      body: { action: 'generate_secret' },
    });
    await POST(req);

    expect(mockApplyFix).toHaveBeenCalledWith('generate_secret', {}, { allowLocal: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/unit/doctor.route.test.js`
Expected: FAIL — route files don't exist.

- [ ] **Step 3: Implement GET /api/doctor**

```js
// app/api/doctor/route.js
import { NextResponse } from 'next/server';
import { runDoctor } from '@/lib/doctor/engine.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = request.nextUrl || new URL(request.url);
    const categoryParam = url.searchParams.get('category');
    const includeFixes = url.searchParams.get('include_fixes') !== 'false';
    const host = url.searchParams.get('host') || request.headers.get('host') || '';

    const categories = categoryParam
      ? categoryParam.split(',').map((c) => c.trim()).filter(Boolean)
      : null;

    const result = await runDoctor({ categories, includeFixes, host });

    return NextResponse.json(result, {
      status: result.status === 'unhealthy' ? 503 : 200,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Implement POST /api/doctor/fix**

```js
// app/api/doctor/fix/route.js
import { NextResponse } from 'next/server';
import { applyFix, runDoctor } from '@/lib/doctor/engine.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 },
      );
    }

    // API endpoint never allows local-only fixes (env file writes)
    const result = await applyFix(action, params, { allowLocal: false });
    const recheck = await runDoctor({ includeFixes: true });

    return NextResponse.json({ ...result, recheck });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/doctor.route.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/doctor/ __tests__/unit/doctor.route.test.js
git commit -m "feat(doctor): add GET /api/doctor and POST /api/doctor/fix endpoints"
```

---

## Task 8: Local Mode Script (`npm run doctor`)

**Files:**
- Create: `scripts/doctor.mjs`
- Modify: `package.json` — add `"doctor"` script

- [ ] **Step 1: Implement the local mode script**

```js
// scripts/doctor.mjs
/**
 * DashClaw Doctor — local mode.
 * Imports the doctor engine directly for full filesystem + DB access.
 *
 * Usage:
 *   npm run doctor
 *   npm run doctor -- --json
 *   npm run doctor -- --no-fix
 *   npm run doctor -- --category database,config
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import readline from 'node:readline';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Load .env into process.env for local mode
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  const { parseEnv } = await import('../app/lib/doctor/fixes/env-writer.mjs');
  const envVars = parseEnv(readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(envVars)) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

const { runDoctor } = await import('../app/lib/doctor/engine.mjs');
const { applyFix } = await import('../app/lib/doctor/fixes/index.mjs');
const { formatDoctorResult, formatFixResult, formatManualSummary } = await import(
  '../app/lib/doctor/format.mjs'
);

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const noFix = args.includes('--no-fix');
const categoryIdx = args.indexOf('--category');
const categories =
  categoryIdx !== -1 && args[categoryIdx + 1]
    ? args[categoryIdx + 1].split(',').map((c) => c.trim())
    : null;

// --- Local-only checks ---
const localChecks = [];

if (!existsSync(envPath)) {
  localChecks.push({
    id: 'local_env_exists',
    category: 'config',
    status: 'fail',
    title: '.env File',
    message: '.env file does not exist — create one or run npm run setup',
    fix: null,
  });
}

const gitignorePath = resolve(process.cwd(), '.gitignore');
if (existsSync(gitignorePath)) {
  const gitignore = readFileSync(gitignorePath, 'utf8');
  if (!gitignore.split(/\r?\n/).some((line) => line.trim() === '.env')) {
    localChecks.push({
      id: 'local_env_gitignore',
      category: 'config',
      status: 'fail',
      title: '.env in .gitignore',
      message: '.env is not listed in .gitignore — secrets may be committed',
      fix: null,
    });
  }
}

if (!existsSync(resolve(process.cwd(), 'node_modules'))) {
  localChecks.push({
    id: 'local_deps',
    category: 'config',
    status: 'fail',
    title: 'Dependencies',
    message: 'node_modules/ not found — run npm install',
    fix: null,
  });
}

// --- Run doctor engine ---
const result = await runDoctor({ categories, includeFixes: !noFix });

// Merge local checks into result
result.checks = [...localChecks, ...result.checks];
for (const c of localChecks) {
  if (c.status === 'fail') result.summary.fail++;
  else if (c.status === 'warn') result.summary.warn++;
  else result.summary.pass++;
}
if (result.summary.fail > 0) result.status = 'unhealthy';
else if (result.summary.warn > 0 && result.status === 'healthy') result.status = 'needs_attention';

// --- JSON mode ---
if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'healthy' ? 0 : 1);
}

// --- Rich mode + auto-fix ---
console.log(formatDoctorResult(result));

if (!noFix) {
  const fixable = result.checks.filter((c) => c.status === 'fail' && c.fix?.type === 'auto');
  const manual = result.checks.filter(
    (c) => (c.status === 'fail' || c.status === 'warn') && (!c.fix || c.fix.type === 'manual'),
  );

  let fixCount = 0;

  for (const check of fixable) {
    const fixResult = await applyFix(check.fix.action, {}, { allowLocal: true });
    console.log(formatFixResult(fixResult));
    if (fixResult.applied) fixCount++;
  }

  if (fixCount > 0) {
    console.log(`\n ${fixCount} issue${fixCount !== 1 ? 's' : ''} auto-fixed this run\n`);
    // Re-run to show updated state
    const updated = await runDoctor({ categories });
    console.log(formatDoctorResult(updated));
  }

  console.log(formatManualSummary(manual));
}

process.exit(result.status === 'healthy' ? 0 : 1);
```

- [ ] **Step 2: Add npm script to package.json**

Edit `package.json`. In the `"scripts"` object, add:

```json
"doctor": "node scripts/doctor.mjs"
```

Place it alphabetically or after `"docs:check"`. The line should look like:

```json
    "docs:check": "node scripts/validate-docs.mjs",
    "doctor": "node scripts/doctor.mjs",
```

- [ ] **Step 3: Smoke-test locally**

Run: `npm run doctor -- --json`
Expected: JSON output with checks from all categories. Some may fail if DB isn't running — that's expected for the smoke test.

- [ ] **Step 4: Commit**

```bash
git add scripts/doctor.mjs package.json
git commit -m "feat(doctor): add local mode script (npm run doctor)"
```

---

## Task 9: CLI Doctor Subcommand

**Files:**
- Create: `cli/lib/doctor.js`
- Modify: `cli/bin/dashclaw.js`
- Modify: `cli/package.json`

- [ ] **Step 1: Implement CLI doctor module**

```js
// cli/lib/doctor.js
import { bold, dim, green, yellow, red } from './render.js';

const ICONS = { pass: green('✓'), warn: yellow('⚠'), fail: red('✗') };

const CATEGORY_LABELS = {
  database: 'Database',
  config: 'Configuration',
  auth: 'Auth',
  deployment: 'Deployment',
  sdk: 'SDK',
  governance: 'Governance',
};

const CATEGORY_ORDER = ['database', 'config', 'auth', 'deployment', 'sdk', 'governance'];

/**
 * Run doctor via the API and render results.
 * @param {{ baseUrl: string, apiKey: string, json?: boolean, noFix?: boolean, category?: string }} options
 */
export async function runDoctor({ baseUrl, apiKey, json, noFix, category }) {
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

  let url = `${baseUrl}/api/doctor?include_fixes=true`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  const res = await fetch(url, { headers });
  if (!res.ok && res.status !== 503) {
    const errText = await res.text();
    console.error(red(`Doctor check failed (${res.status}): ${errText}`));
    process.exit(1);
  }

  const result = await res.json();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'healthy' ? 0 : 1);
  }

  // Rich output
  console.log();
  console.log(` ${bold('DashClaw Doctor')}  ${dim(`(${baseUrl})`)}`);
  console.log();

  const grouped = {};
  for (const check of result.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const cat of CATEGORY_ORDER) {
    const checks = grouped[cat];
    if (!checks || checks.length === 0) continue;
    console.log(` ${bold(CATEGORY_LABELS[cat] || cat)}`);
    for (const check of checks) {
      console.log(`  ${ICONS[check.status] || '?'} ${check.title}`);
      if (check.status !== 'pass') {
        console.log(`    ${dim(check.message)}`);
      }
    }
    console.log();
  }

  // Auto-fix (remote-only fixes via API)
  let fixCount = 0;
  if (!noFix) {
    const fixable = result.checks.filter((c) => c.status === 'fail' && c.fix?.type === 'auto');
    for (const check of fixable) {
      const fixRes = await fetch(`${baseUrl}/api/doctor/fix`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: check.fix.action }),
      });
      const fixResult = await fixRes.json();
      if (fixResult.applied) {
        console.log(`  ${green('→')} Fixed: ${fixResult.description}`);
        fixCount++;
      } else {
        console.log(`  ${dim('→')} ${fixResult.description}`);
      }
    }
  }

  // Summary
  const { pass, warn, fail } = result.summary;
  const parts = [];
  if (pass > 0) parts.push(green(`${pass} passed`));
  if (warn > 0) parts.push(yellow(`${warn} warning${warn !== 1 ? 's' : ''}`));
  if (fail > 0) parts.push(red(`${fail} failed`));
  console.log(` ${bold('Summary:')} ${parts.join(', ')}`);

  if (fixCount > 0) {
    console.log(` ${green(`${fixCount} issue${fixCount !== 1 ? 's' : ''} auto-fixed this run`)}`);
  }

  // Manual action summary
  const manual = result.checks.filter(
    (c) => (c.status === 'fail' || c.status === 'warn') && (!c.fix || c.fix.type === 'manual'),
  );
  if (manual.length > 0) {
    console.log();
    console.log(` ${bold('Manual action needed:')}`);
    for (const check of manual) {
      console.log(`  ${yellow('•')} ${check.message}`);
    }
  }

  console.log();
  process.exit(result.status === 'healthy' ? 0 : 1);
}
```

- [ ] **Step 2: Add doctor subcommand routing to CLI**

Open `cli/bin/dashclaw.js`. At the top, add this import alongside the existing imports:

```js
import { runDoctor as runDoctorCommand } from '../lib/doctor.js';
```

Find the command router (the `if/else if` chain on the `command` variable). Add this branch BEFORE the `help` / default fallback branch:

```js
} else if (command === 'doctor') {
  requireEnv();
  const jsonFlag = args.includes('--json');
  const noFixFlag = args.includes('--no-fix');
  const catIdx = args.indexOf('--category');
  const catValue = catIdx !== -1 ? args[catIdx + 1] : undefined;
  await runDoctorCommand({
    baseUrl,
    apiKey,
    json: jsonFlag,
    noFix: noFixFlag,
    category: catValue,
  });
```

- [ ] **Step 3: Update help text**

In the `help` branch of `cli/bin/dashclaw.js`, add these lines to the help output (preserve the existing help formatting):

```
  dashclaw doctor                    Diagnose and auto-fix your DashClaw instance
    --json                           Output as JSON (for CI/scripts)
    --no-fix                         Diagnose only, skip auto-fixes
    --category <list>                Filter checks (e.g., database,config)
```

- [ ] **Step 4: Bump CLI version**

In `cli/package.json`, change:

```json
"version": "0.2.0",
```

to:

```json
"version": "0.3.0",
```

- [ ] **Step 5: Commit**

```bash
git add cli/lib/doctor.js cli/bin/dashclaw.js cli/package.json
git commit -m "feat(doctor): add dashclaw doctor CLI subcommand"
```

---

## Task 10: Integration Wiring + Full Test Run

**Files:**
- Verify: all previous files exist and are wired correctly
- Run: full test suite

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All existing tests PASS, all new doctor tests PASS. No regressions.

If any existing test fails, investigate — the doctor code should not touch any existing modules except via imports from `app/lib/readiness/` and `app/lib/setupStatus.mjs`, which are side-effect-free.

- [ ] **Step 2: Run `npm run doctor` locally**

Run: `npm run doctor`
Expected: Rich terminal output showing checks from all 6 categories. Depending on your local state, some may fail. Verify:
- Database checks appear
- Config checks appear
- Output is colored and grouped by category
- A summary line appears at the bottom

- [ ] **Step 3: Run JSON mode**

Run: `npm run doctor -- --json`
Expected: Valid JSON output. Pipe to `jq .` to confirm structure:
- `status`: "healthy" | "needs_attention" | "unhealthy"
- `summary`: `{ pass, warn, fail }`
- `checks`: array with `{ id, category, status, title, message, fix }`
- `timestamp`: ISO string

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: No new lint errors from doctor files.

- [ ] **Step 5: Final commit (if any stragglers)**

```bash
git status
# If any uncommitted files remain:
git add -A
git commit -m "chore(doctor): finalize integration wiring"
```

---

## Post-Implementation Notes

### What's NOT in this plan (and why)

- **Prompt-type fixes for `prompt_database_url` / `prompt_nextauth_url`**: The design mentioned these, but the local script's readline prompts handle them directly when needed. They can be added as formal fix handlers later if we need them exposed as first-class actions. For now, if DATABASE_URL is missing, the doctor surfaces a clear manual message.
- **SDK version check**: Requires agents to send their SDK version in a header. Follow-up.
- **Schema drift detection (column-level)**: The current migration check (tables exist/missing) covers 90% of drift. Full column drift is a follow-up.

### Key patterns to preserve

- Fix handlers always return `{ applied: boolean, description: string }` — never throw.
- Check modules always return arrays of check objects — never throw (catch internally).
- The API fix endpoint only allows `scope: 'remote'` fixes. Env writes are local-only.
- The formatter never exposes env var values — only "present" or "missing" states.
- Every env write backs up the existing `.env` to `.env.backup` first.
