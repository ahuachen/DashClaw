# /setup Instance Status Page — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-line redirect stub at `app/setup/page.js` with a server-rendered instance status page that shows DB readiness, auth readiness, and exact next actions.

**Architecture:** Async Server Component. Calls `getSetupStatus(process.env)` and `getAuthConfig(process.env)` directly. Extracts a pure `composeInstanceStatus(dbStatus, authConfig)` helper into `app/setup/composeInstanceStatus.js` — this is a deliberate deviation from the spec's single-file preference, justified by TDD: a pure function must be importable to be unit-testable, and the helper has no side effects or framework dependencies. The page remains a single render file with no client layer.

**Tech Stack:** Next.js 15 App Router, React Server Components, Tailwind CSS 3, Vitest (unit test for helper only)

**Spec:** `docs/superpowers/specs/2026-03-12-setup-page-design.md`

---

## Chunk 1: Status Composition Helper + Unit Tests

### Task 1: Write failing unit tests for `composeInstanceStatus`

**Files:**
- Create: `tests/unit/setup.composeInstanceStatus.test.js`

The helper takes the raw `getSetupStatus()` return shape and the `getAuthConfig()` return shape and produces a normalized `instanceStatus` object. Tests cover all five states from the spec state matrix.

- [ ] **Step 1: Create the test file**

```js
// tests/unit/setup.composeInstanceStatus.test.js
import { describe, it, expect } from 'vitest';
import { composeInstanceStatus } from '@/setup/composeInstanceStatus';

// Helpers to build raw inputs
function dbOk() {
  return { configured: true, message: 'Dashboard is configured' };
}
function dbNoUrl() {
  return { configured: false, reason: 'missing_database_url', message: 'DATABASE_URL is not set.' };
}
function dbConnErr() {
  return { configured: false, reason: 'connection_error', message: 'Unable to connect to database' };
}
function dbNoTables(missing = ['action_records', 'guard_decisions']) {
  return {
    configured: false,
    reason: 'no_tables',
    message: `Missing ${missing.length} core table(s). Run migrations.`,
    missing_tables: missing.length,
    missing,
  };
}
function authNone() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: false, hasLocalPassword: false,
    hasAnyOAuth: false, hasAnySignInMethod: false, oauthProviders: [],
  };
}
function authGitHub() {
  return {
    hasGitHub: true, hasGoogle: false, hasOIDC: false, hasLocalPassword: false,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'github', name: 'GitHub' }],
  };
}
function authLocalPassword() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: false, hasLocalPassword: true,
    hasAnyOAuth: false, hasAnySignInMethod: true, oauthProviders: [],
  };
}
function authOIDCCustomName() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: true, hasLocalPassword: false,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'oidc', name: 'Authentik' }],
  };
}
function authGitHubAndLocal() {
  return {
    hasGitHub: true, hasGoogle: false, hasOIDC: false, hasLocalPassword: true,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'github', name: 'GitHub' }],
  };
}

describe('composeInstanceStatus', () => {
  describe('db state', () => {
    it('maps configured:false + missing_database_url to db.ok:false + reason', () => {
      const s = composeInstanceStatus(dbNoUrl(), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('missing_database_url');
    });

    it('maps configured:false + connection_error to db.ok:false + reason', () => {
      const s = composeInstanceStatus(dbConnErr(), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('connection_error');
    });

    it('maps configured:false + no_tables, exposes missing array and length', () => {
      const s = composeInstanceStatus(dbNoTables(['action_records', 'guard_decisions']), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('no_tables');
      expect(s.db.missing).toEqual(['action_records', 'guard_decisions']);
      expect(s.db.missing.length).toBe(2);
    });

    it('maps configured:true to db.ok:true', () => {
      const s = composeInstanceStatus(dbOk(), authNone());
      expect(s.db.ok).toBe(true);
    });
  });

  describe('auth state', () => {
    it('no methods → auth.ok:false, auth.methods:[]', () => {
      const s = composeInstanceStatus(dbOk(), authNone());
      expect(s.auth.ok).toBe(false);
      expect(s.auth.methods).toEqual([]);
    });

    it('GitHub only → auth.ok:true, auth.methods:["GitHub"]', () => {
      const s = composeInstanceStatus(dbOk(), authGitHub());
      expect(s.auth.ok).toBe(true);
      expect(s.auth.methods).toEqual(['GitHub']);
    });

    it('local password only → auth.ok:true, auth.methods:["Local password"]', () => {
      const s = composeInstanceStatus(dbOk(), authLocalPassword());
      expect(s.auth.ok).toBe(true);
      expect(s.auth.methods).toEqual(['Local password']);
    });

    it('custom OIDC display name → auth.methods uses that name', () => {
      const s = composeInstanceStatus(dbOk(), authOIDCCustomName());
      expect(s.auth.methods).toContain('Authentik');
    });

    it('GitHub + local password → both appear in auth.methods', () => {
      const s = composeInstanceStatus(dbOk(), authGitHubAndLocal());
      expect(s.auth.methods).toContain('GitHub');
      expect(s.auth.methods).toContain('Local password');
    });
  });

  describe('overall', () => {
    it('missing_database_url → not_configured', () => {
      expect(composeInstanceStatus(dbNoUrl(), authNone()).overall).toBe('not_configured');
    });

    it('connection_error → not_configured', () => {
      expect(composeInstanceStatus(dbConnErr(), authNone()).overall).toBe('not_configured');
    });

    it('no_tables → not_configured', () => {
      expect(composeInstanceStatus(dbNoTables(), authNone()).overall).toBe('not_configured');
    });

    it('db ready + no auth → partial', () => {
      expect(composeInstanceStatus(dbOk(), authNone()).overall).toBe('partial');
    });

    it('db ready + auth configured → ready', () => {
      expect(composeInstanceStatus(dbOk(), authGitHub()).overall).toBe('ready');
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails (module not found)**

```bash
cd "C:\Projects\DashClaw" && npx vitest run tests/unit/setup.composeInstanceStatus.test.js
```

Expected: fail with `Cannot find module '@/setup/composeInstanceStatus'`

---

### Task 2: Implement `composeInstanceStatus` helper

**Files:**
- Create: `app/setup/composeInstanceStatus.js`

This is a pure function — no imports, no side effects, fully testable.

- [ ] **Step 3: Create the helper file**

```js
// app/setup/composeInstanceStatus.js

/**
 * Normalizes raw outputs from getSetupStatus() and getAuthConfig()
 * into a single instanceStatus object for the /setup page.
 *
 * @param {object} dbStatus  - return value of getSetupStatus()
 * @param {object} authConfig - return value of getAuthConfig()
 * @returns {{ db, auth, overall }}
 */
export function composeInstanceStatus(dbStatus, authConfig) {
  const db = {
    ok: Boolean(dbStatus.configured),
    reason: dbStatus.configured ? 'ready' : (dbStatus.reason || 'unknown'),
    message: dbStatus.message || '',
    missing: Array.isArray(dbStatus.missing) ? dbStatus.missing : [],
  };

  // Build method name list: OAuth provider display names + "Local password" if set
  const methods = [
    ...(authConfig.oauthProviders || []).map((p) => p.name),
    ...(authConfig.hasLocalPassword ? ['Local password'] : []),
  ];

  const auth = {
    ok: Boolean(authConfig.hasAnySignInMethod),
    methods,
    hasAny: Boolean(authConfig.hasAnySignInMethod),
  };

  let overall;
  if (!db.ok) {
    overall = 'not_configured';
  } else if (!auth.ok) {
    overall = 'partial';
  } else {
    overall = 'ready';
  }

  return { db, auth, overall };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd "C:\Projects\DashClaw" && npx vitest run tests/unit/setup.composeInstanceStatus.test.js
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\DashClaw" && git add app/setup/composeInstanceStatus.js tests/unit/setup.composeInstanceStatus.test.js && git commit -m "feat(setup): add composeInstanceStatus helper with unit tests"
```

---

## Chunk 2: Setup Page — Full Replacement

### Task 3: Replace `app/setup/page.js` with the server component

**Files:**
- Modify: `app/setup/page.js` (full replacement — was a 5-line redirect)

This is a Next.js async Server Component. It:
1. Calls both utilities
2. Calls `composeInstanceStatus` to get normalized state
3. Renders checklist, next-action block, footer

The entire page is one file. No `'use client'`.

- [ ] **Step 6: Write the new page**

```js
// app/setup/page.js
import Link from 'next/link';
import { headers } from 'next/headers';
import { getSetupStatus } from '../lib/setupStatus.mjs';
import { getAuthConfig } from '../lib/authConfig.mjs';
import { composeInstanceStatus } from './composeInstanceStatus';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Instance Status — DashClaw Setup',
};

export default async function SetupPage() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';

  const [dbStatus, authConfig] = await Promise.all([
    getSetupStatus(process.env),
    Promise.resolve(getAuthConfig(process.env)),
  ]);

  const status = composeInstanceStatus(dbStatus, authConfig);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">DashClaw</p>
          <h1 className="text-2xl font-bold tracking-tight">Instance Status</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {host}
          </p>
        </div>

        {/* Status Checklist */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] divide-y divide-[rgba(255,255,255,0.06)] mb-8">
          <StatusRow
            label="Database"
            ok={status.db.ok}
            message={dbRowMessage(status.db)}
          />
          <StatusRow
            label="Sign-in"
            ok={status.auth.ok}
            warn={!status.db.ok}
            message={authRowMessage(status.auth)}
          />
        </div>

        {/* Next Action */}
        <NextAction status={status} />

        {/* Footer Links */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/self-host" className="hover:text-zinc-300 transition-colors">
            Deployment guide →
          </Link>
          {status.auth.ok && (
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Sign in →
            </Link>
          )}
          {status.overall === 'ready' && (
            <Link href="/dashboard" className="hover:text-brand transition-colors font-medium">
              Go to dashboard →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components (server-only, defined in same file) ---

function StatusRow({ label, ok, warn = false, message }) {
  const icon = ok ? '✓' : warn ? '⚠' : '✗';
  const iconColor = ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <span className={`text-base font-bold mt-0.5 w-4 shrink-0 ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

function dbRowMessage(db) {
  switch (db.reason) {
    case 'missing_database_url':
      return 'DATABASE_URL is not set';
    case 'connection_error':
      return 'Cannot reach database';
    case 'no_tables':
      return `Connected — migrations not run (${db.missing.length} table${db.missing.length === 1 ? '' : 's'} missing)`;
    case 'ready':
      return 'Connected and migrated';
    default:
      return db.message || 'Unknown state';
  }
}

function authRowMessage(auth) {
  if (!auth.ok) return 'No sign-in method configured';
  return auth.methods.join(', ');
}

function NextAction({ status }) {
  const { db, auth, overall } = status;

  if (db.reason === 'missing_database_url') {
    return (
      <ActionBlock title="Set DATABASE_URL" variant="error">
        <p className="text-sm text-zinc-300 mb-3">
          No database connection string found. Add <code className="text-brand">DATABASE_URL</code> to your <code className="text-brand">.env</code> file and restart the server.
        </p>
        <CodeSnippet>{`DATABASE_URL=postgres://user:password@localhost:5432/dashclaw`}</CodeSnippet>
        <p className="text-xs text-zinc-500 mt-3">
          For Neon: use the connection string from your Neon project dashboard.
          For local Docker: use the connection string matching your <code>docker-compose.yml</code>.
        </p>
      </ActionBlock>
    );
  }

  if (db.reason === 'connection_error') {
    return (
      <ActionBlock title="Database unreachable" variant="error">
        <p className="text-sm text-zinc-300 mb-3">
          <code className="text-brand">DATABASE_URL</code> is set but the database is not responding.
          Check that your database is running and the connection string is correct.
        </p>
        <p className="text-xs text-zinc-500">Common fixes: start Docker, check hostname/port, verify credentials.</p>
        <CodeSnippet>{`# Check your DATABASE_URL
echo $DATABASE_URL

# Start local Postgres via Docker
docker compose up -d`}</CodeSnippet>
      </ActionBlock>
    );
  }

  if (db.reason === 'no_tables') {
    return (
      <ActionBlock title="Run migrations" variant="warn">
        <p className="text-sm text-zinc-300 mb-3">
          Database is reachable but core tables are missing ({db.missing.length} not found).
          Run the bootstrap migrations to create them.
        </p>
        <CodeSnippet>{`node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
node scripts/_run-with-env.mjs scripts/migrate-capabilities.mjs`}</CodeSnippet>
        <p className="text-xs text-zinc-500 mt-3">
          These are the core bootstrap migrations. Additional feature migrations may exist in <code>scripts/</code>.
          After running, reload this page.
        </p>
      </ActionBlock>
    );
  }

  if (overall === 'partial') {
    // DB is ready, auth is missing
    return (
      <ActionBlock title="Configure sign-in" variant="warn">
        <p className="text-sm text-zinc-300 mb-4">
          Database is ready. You need at least one sign-in method before the dashboard is accessible.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
            <p className="text-xs font-semibold text-zinc-200 mb-2">Solo / Local access</p>
            <p className="text-xs text-zinc-400 mb-3">Set a local admin password. No OAuth app required.</p>
            <CodeSnippet>{`DASHCLAW_LOCAL_ADMIN_PASSWORD=your-password`}</CodeSnippet>
          </div>
          <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
            <p className="text-xs font-semibold text-zinc-200 mb-2">OAuth (GitHub / Google / OIDC)</p>
            <p className="text-xs text-zinc-400 mb-3">Add credentials for your chosen provider.</p>
            <CodeSnippet>{`# GitHub
GITHUB_ID=your-client-id
GITHUB_SECRET=your-client-secret

# Google
GOOGLE_ID=your-client-id
GOOGLE_SECRET=your-client-secret`}</CodeSnippet>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-4">After updating your .env, restart the server and reload this page.</p>
      </ActionBlock>
    );
  }

  // overall === 'ready'
  return (
    <ActionBlock title="Instance ready" variant="ready">
      <p className="text-sm text-zinc-300 mb-4">
        Database is connected and migrated. Sign-in is configured ({auth.methods.join(', ')}).
        You can sign in now.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </ActionBlock>
  );
}

function ActionBlock({ title, variant, children }) {
  const borderColor = {
    error: 'border-red-900/50',
    warn: 'border-amber-900/50',
    ready: 'border-emerald-900/40',
  }[variant] || 'border-[rgba(255,255,255,0.08)]';

  const titleColor = {
    error: 'text-red-400',
    warn: 'text-amber-400',
    ready: 'text-emerald-400',
  }[variant] || 'text-zinc-200';

  return (
    <div className={`rounded-xl border bg-[#111] p-5 ${borderColor}`}>
      <p className={`text-sm font-semibold mb-3 ${titleColor}`}>{title}</p>
      {children}
    </div>
  );
}

function CodeSnippet({ children }) {
  return (
    <pre className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}
```

- [ ] **Step 7: Run lint to catch any syntax issues**

```bash
cd "C:\Projects\DashClaw" && npm run lint -- --quiet 2>&1 | head -30
```

Expected: no errors in `app/setup/` files

- [ ] **Step 8: Run full test suite to confirm nothing regressed**

```bash
cd "C:\Projects\DashClaw" && npx vitest run
```

Expected: all tests pass including the new `setup.composeInstanceStatus` tests

- [ ] **Step 9: Commit**

```bash
cd "C:\Projects\DashClaw" && git add app/setup/page.js && git commit -m "feat(setup): replace redirect stub with live instance status page"
```

---

## Chunk 3: Smoke Test Verification

### Task 4: Verify all states render correctly

This is a manual smoke test — visit `/setup` in a browser with different env configurations. Since the page is server-rendered from `process.env`, each state requires a server restart with different env values.

- [ ] **Step 10: Test state — no DATABASE_URL**

In `.env.local`, comment out `DATABASE_URL`. Start the server:

```bash
cd "C:\Projects\DashClaw" && npm run dev
```

Visit `http://localhost:3000/setup`.

Expected:
- Database row: ✗ red, "DATABASE_URL is not set"
- Sign-in row: ✗ red (or —), "No sign-in method configured" (or configured methods if set)
- Action block: "Set DATABASE_URL" with example snippet

- [ ] **Step 11: Test state — DB URL set, DB unreachable**

Set `DATABASE_URL` to an unreachable host (e.g. `postgres://localhost:9999/dashclaw`). Restart dev server.

Visit `http://localhost:3000/setup`.

Expected:
- Database row: ✗ red, "Cannot reach database"
- Action block: "Database unreachable" with Docker hint

- [ ] **Step 12: Test state — DB reachable, no tables**

Point `DATABASE_URL` at a real but empty Postgres database (create a fresh DB with no migrations). Restart.

Visit `http://localhost:3000/setup`.

Expected:
- Database row: ✗ red, "Connected — migrations not run (6 tables missing)"
- Action block: "Run migrations" with the four verbatim commands

- [ ] **Step 13: Test state — DB ready, no auth**

Set `DATABASE_URL` to working migrated DB. Remove all auth env vars (`GITHUB_ID`, `GOOGLE_ID`, `DASHCLAW_LOCAL_ADMIN_PASSWORD`). Restart.

Visit `http://localhost:3000/setup`.

Expected:
- Database row: ✓ green, "Connected and migrated"
- Sign-in row: ✗ red, "No sign-in method configured"
- Action block: "Configure sign-in" with two-column layout (solo vs OAuth)

- [ ] **Step 14: Test state — everything ready**

Set `DATABASE_URL` + at least one auth method (e.g. `DASHCLAW_LOCAL_ADMIN_PASSWORD=test`). Restart.

Visit `http://localhost:3000/setup`.

Expected:
- Both rows green
- Action block: "Instance ready" with Sign in + Dashboard buttons
- Footer links: deployment guide, sign in, go to dashboard all visible
- No auto-redirect

- [ ] **Step 15: Final commit (if any fixups needed)**

```bash
cd "C:\Projects\DashClaw" && git add -p && git commit -m "fix(setup): smoke test fixups"
```

---

## Files Changed Summary

| File | Action | Purpose |
|---|---|---|
| `app/setup/page.js` | Full replacement | Server component — reads state, renders truth page |
| `app/setup/composeInstanceStatus.js` | New | Pure helper: normalizes DB + auth status for rendering |
| `tests/unit/setup.composeInstanceStatus.test.js` | New | Unit tests for the helper (all 5 states) |

No other files are modified. `setupStatus.mjs`, `authConfig.mjs`, and the API route are unchanged.
