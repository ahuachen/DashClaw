# Hosted Deployment Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship everything-in-the-repo needed to turn Plans 1+2 from "code that could run hosted" into "a deployable service" — cleanup cron (two options), pre-deploy readiness checker, post-deploy smoke test, and a step-by-step deployment runbook for Neon + Vercel + DNS + Cloudflare Turnstile.

**Architecture:** Small code additions (one vercel.json entry, one GH Actions workflow, two scripts, one auth extension) plus a comprehensive runbook in `docs/ops/hosted-deployment.md`. Everything the operator actually *runs* in Vercel/Neon/Cloudflare dashboards is documented as a manual checklist — not coded — because those steps require account access the repo can't have.

**Tech Stack:** Vercel (Next.js hosting + optional crons), Neon Postgres, Cloudflare Turnstile, GitHub Actions (free-tier cron alternative), Node scripts for readiness + smoke tests.

**Scope boundary:**
- IN: cron wiring (Vercel + GH Actions options), `/api/hosted/cleanup` auth extension so Vercel crons work natively, `scripts/check-hosted-ready.mjs`, `scripts/smoke-hosted.mjs`, `docs/ops/hosted-deployment.md`, updates to `PROJECT_DETAILS.md` and `.env.example`.
- OUT: creating Vercel/Neon/Cloudflare accounts, DNS changes, deploying the actual instance, monitoring dashboards, error-tracking setup (Sentry, etc.). These are manual steps in the runbook.

**Non-negotiables (from project memory):**
- `DASHCLAW_HOSTED` flag defaults OFF; self-host deploys must remain unaffected after every commit.
- SDK Documentation Checklist: any new env var goes in `.env.example`.
- No secrets committed — the runbook tells the operator what to set, it never includes sample values for real secrets.
- Cron cleanup is appropriate on the operator's paid infra; does not apply to the "Vercel free tier only" rule (which was about self-deploy).

---

## File Structure

**Create:**
- `.github/workflows/hosted-cleanup.yml` — optional GH Actions cron that pings `/api/hosted/cleanup` daily. Free-tier-friendly alternative to Vercel crons.
- `scripts/check-hosted-ready.mjs` — node script that validates env vars, DB connectivity, migration status, and turnstile config. Exits 0/1 for CI integration.
- `scripts/smoke-hosted.mjs` — node script that provisions a trial workspace, hits `/api/health` with the returned key, then deletes the workspace. Takes `--base-url` arg.
- `docs/ops/hosted-deployment.md` — the deployment runbook. Comprehensive step-by-step.
- `__tests__/unit/hosted/check-hosted-ready.test.mjs` — tests for the readiness script (isolated module that exports pure functions).

**Modify:**
- `vercel.json` — add `/api/hosted/cleanup` to the crons array (optional; disabled unless operator opts in).
- `app/api/hosted/cleanup/route.js` — extend `requireAdminOrCronSecret` to also accept `Authorization: Bearer <CRON_SECRET>` so Vercel crons (which use that header by convention) work without special config.
- `__tests__/unit/hosted/workspace-admin.test.js` — add 2 tests covering the new `Authorization: Bearer` auth path.
- `.env.example` — add `CRON_SECRET` (Vercel cron auth) and `HOSTED_SMOKE_BASE_URL` (smoke-test target).
- `PROJECT_DETAILS.md` — link to the new runbook from the deployment section.
- `package.json` — add two scripts: `hosted:check-ready` and `hosted:smoke`.

**Never touch:** `app/lib/doctor/generated/**`, `graphify-pilot/**`, `public/downloads/dashclaw-platform-intelligence*`.

---

### Task 1: Extend cleanup route auth to accept `Authorization: Bearer <CRON_SECRET>`

**Files:**
- Modify: `app/api/hosted/cleanup/route.js`
- Modify: `__tests__/unit/hosted/workspace-admin.test.js` (append 2 tests to the cleanup describe block)

**Why:** Vercel's built-in cron machinery sets `Authorization: Bearer $CRON_SECRET` automatically on each cron invocation. Without this extension, operators using Vercel crons would need custom headers, which Vercel doesn't support. Accepting both `Authorization: Bearer` AND the existing `x-cleanup-secret` keeps backward compatibility (GH Actions workflow, manual curl calls) while enabling native Vercel cron support.

- [ ] **Step 1: Write the failing tests**

Append to the `describe('POST /api/hosted/cleanup', ...)` block in `__tests__/unit/hosted/workspace-admin.test.js`:

```javascript
  it('accepts Authorization: Bearer <CRON_SECRET> (Vercel cron convention)', async () => {
    process.env.CRON_SECRET = 'vercel-cron-secret';
    sqlMock.mockResolvedValueOnce([]); // findExpired returns empty
    const r = new Request('http://localhost:3000/api/hosted/cleanup', {
      method: 'POST',
      headers: { authorization: 'Bearer vercel-cron-secret' },
    });
    const res = await cleanupPOST(r);
    expect(res.status).toBe(200);
  });

  it('rejects a wrong Authorization: Bearer value (403)', async () => {
    process.env.CRON_SECRET = 'vercel-cron-secret';
    const r = new Request('http://localhost:3000/api/hosted/cleanup', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await cleanupPOST(r);
    expect(res.status).toBe(403);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run __tests__/unit/hosted/workspace-admin.test.js`
Expected: 13 pass, 2 fail (new Authorization tests fail because the route doesn't accept that header yet).

- [ ] **Step 3: Extend `requireAdminOrCronSecret` in `app/api/hosted/cleanup/route.js`**

Replace the existing function with:

```javascript
function requireAdminOrCronSecret(request) {
  const role = request.headers.get('x-org-role');
  if (role === 'owner' || role === 'admin') return true;

  // Path 1: explicit x-cleanup-secret header (used by GH Actions + manual curl)
  const xSecret = request.headers.get('x-cleanup-secret');
  if (xSecret && process.env.HOSTED_CLEANUP_SECRET && xSecret === process.env.HOSTED_CLEANUP_SECRET) {
    return true;
  }

  // Path 2: Authorization: Bearer <CRON_SECRET> (Vercel cron convention)
  const auth = request.headers.get('authorization');
  if (auth && process.env.CRON_SECRET) {
    const prefix = 'Bearer ';
    if (auth.startsWith(prefix) && auth.slice(prefix.length) === process.env.CRON_SECRET) {
      return true;
    }
  }

  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run __tests__/unit/hosted/workspace-admin.test.js`
Expected: 15/15 pass.

Also run the full hosted suite: `npm run test -- --run __tests__/unit/hosted/`
Expected: all pass (previous count + 2 = 48 total).

- [ ] **Step 5: Commit**

```bash
git add app/api/hosted/cleanup/route.js __tests__/unit/hosted/workspace-admin.test.js
git commit -m "feat(hosted): accept Vercel-cron Authorization header on cleanup route"
```

---

### Task 2: Add `/api/hosted/cleanup` to `vercel.json` crons

**Files:**
- Modify: `vercel.json`

**Why:** Operators on a Vercel plan that supports ≥ 2 crons can get daily cleanup automatically.

- [ ] **Step 1: Read current vercel.json**

Run: `cat vercel.json`
Expected: a JSON object with `"crons": [{ "path": "/api/cron/reset-meters", "schedule": "0 0 1 * *" }]` (one entry).

- [ ] **Step 2: Add the cleanup cron entry**

Modify `vercel.json` to:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "node scripts/auto-migrate.mjs && next build",
  "crons": [
    { "path": "/api/cron/reset-meters", "schedule": "0 0 1 * *" },
    { "path": "/api/hosted/cleanup", "schedule": "0 3 * * *" }
  ]
}
```

Daily at 03:00 UTC is a low-traffic window. `CRON_SECRET` (set on Vercel) gates the endpoint via Task 1's extension.

- [ ] **Step 3: Verify schema / syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json'))"`
Expected: exit 0 (no parse error).

Run any existing tests in case vercel.json is consumed by anything else:
`npm run test -- --run`
Expected: all pass (not expected to break — this file is Vercel-only).

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat(hosted): schedule daily /api/hosted/cleanup on Vercel crons"
```

---

### Task 3: GitHub Actions cron fallback (free-tier-friendly)

**Files:**
- Create: `.github/workflows/hosted-cleanup.yml`

**Why:** For operators on Vercel Hobby (single-cron limit) or preferring GitHub Actions, this gives a free scheduled call to `/api/hosted/cleanup`. Mirrors the existing `.github/workflows/integration-health.yml` pattern.

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/hosted-cleanup.yml`:

```yaml
name: Hosted cleanup

# Optional scheduler for `/api/hosted/cleanup`. Enable this workflow
# if you want automated daily trial cleanup without a Vercel Pro cron.
#
# Setup:
#   1. In repo Settings → Secrets and variables → Actions, add:
#        - DASHCLAW_BASE_URL  (e.g. https://hosted.example.com)
#        - HOSTED_CLEANUP_SECRET  (same value as the env on Vercel)
#   2. Enable the workflow (it's disabled for forks by default).
#
# Manual trigger: Actions tab → "Hosted cleanup" → "Run workflow".

on:
  schedule:
    # Daily at 03:00 UTC.
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  sweep:
    runs-on: ubuntu-latest
    if: ${{ vars.DASHCLAW_BASE_URL != '' || secrets.DASHCLAW_BASE_URL != '' }}
    steps:
      - name: POST /api/hosted/cleanup
        env:
          BASE_URL: ${{ secrets.DASHCLAW_BASE_URL }}
          CLEANUP_SECRET: ${{ secrets.HOSTED_CLEANUP_SECRET }}
        run: |
          if [ -z "$BASE_URL" ] || [ -z "$CLEANUP_SECRET" ]; then
            echo "DASHCLAW_BASE_URL or HOSTED_CLEANUP_SECRET not set — skipping."
            exit 0
          fi
          status=$(curl -sS -o /tmp/resp.json -w '%{http_code}' \
            -X POST \
            -H "X-Cleanup-Secret: $CLEANUP_SECRET" \
            "$BASE_URL/api/hosted/cleanup")
          echo "HTTP $status"
          cat /tmp/resp.json
          if [ "$status" != "200" ]; then
            exit 1
          fi
```

- [ ] **Step 2: Verify yaml syntax**

Run: `node -e "const yaml = require('js-yaml'); yaml.load(require('fs').readFileSync('.github/workflows/hosted-cleanup.yml', 'utf8')); console.log('OK')"`
If `js-yaml` isn't installed locally, alternatively check visually that the file matches the template above (which is known-good — it's a verbatim adaptation of the existing `integration-health.yml`).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/hosted-cleanup.yml
git commit -m "feat(hosted): add GitHub Actions cron for /api/hosted/cleanup"
```

---

### Task 4: Pre-deployment readiness checker

**Files:**
- Create: `scripts/check-hosted-ready.mjs`
- Create test: `__tests__/unit/hosted/check-hosted-ready.test.mjs`
- Modify: `package.json` (add `hosted:check-ready` script)

**Why:** Operators should validate their hosted-mode config before deploying. This script is the pre-deploy equivalent of the Plan 1 doctor check — strict, CI-callable, failing loudly on misconfiguration.

- [ ] **Step 1: Write the failing test**

Create `__tests__/unit/hosted/check-hosted-ready.test.mjs`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assessHostedReadiness } from '../../../scripts/check-hosted-ready.mjs';

describe('assessHostedReadiness', () => {
  const original = { ...process.env };
  beforeEach(() => { process.env = { ...original }; });
  afterEach(() => { process.env = { ...original }; });

  it('returns skipped when DASHCLAW_HOSTED is unset', () => {
    delete process.env.DASHCLAW_HOSTED;
    const r = assessHostedReadiness();
    expect(r.status).toBe('skipped');
    expect(r.failures).toEqual([]);
  });

  it('passes when all required vars are set', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://user:pw@host/db';
    process.env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    const r = assessHostedReadiness();
    expect(r.status).toBe('ok');
    expect(r.failures).toEqual([]);
  });

  it('fails loudly when TURNSTILE_SECRET_KEY is missing in hosted mode', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('TURNSTILE_SECRET_KEY missing');
  });

  it('warns when HOSTED_CLEANUP_SECRET and CRON_SECRET are both unset', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.TURNSTILE_SECRET_KEY = 'x';
    process.env.DASHCLAW_API_KEY = 'oc_live_admin_key_1234567890abcdef1234567890abcdef';
    delete process.env.HOSTED_CLEANUP_SECRET;
    delete process.env.CRON_SECRET;
    const r = assessHostedReadiness();
    expect(r.warnings).toContain('no cleanup secret configured (HOSTED_CLEANUP_SECRET or CRON_SECRET) — cleanup route is admin-only');
  });

  it('fails on DATABASE_URL missing', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    delete process.env.DATABASE_URL;
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('DATABASE_URL missing');
  });

  it('fails when DASHCLAW_API_KEY is missing or malformed', () => {
    process.env.DASHCLAW_HOSTED = 'true';
    process.env.DATABASE_URL = 'postgres://fake';
    process.env.TURNSTILE_SECRET_KEY = 'x';
    delete process.env.DASHCLAW_API_KEY;
    const r = assessHostedReadiness();
    expect(r.status).toBe('fail');
    expect(r.failures).toContain('DASHCLAW_API_KEY missing');
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL (module not found)**

Run: `npm run test -- --run __tests__/unit/hosted/check-hosted-ready.test.mjs`

- [ ] **Step 3: Implement `scripts/check-hosted-ready.mjs`**

```javascript
#!/usr/bin/env node
// Pre-deploy readiness checker for DASHCLAW_HOSTED=true deployments.
// Exits 0 on ok or skipped, 1 on fail. Prints a readable report either way.

const API_KEY_PATTERN = /^oc_live_[0-9a-f]{32}$/;

export function assessHostedReadiness(env = process.env) {
  if (env.DASHCLAW_HOSTED !== 'true') {
    return { status: 'skipped', failures: [], warnings: [], info: 'hosted mode not enabled' };
  }

  const failures = [];
  const warnings = [];

  if (!env.DATABASE_URL) failures.push('DATABASE_URL missing');
  if (!env.TURNSTILE_SECRET_KEY) failures.push('TURNSTILE_SECRET_KEY missing');
  if (!env.DASHCLAW_API_KEY) {
    failures.push('DASHCLAW_API_KEY missing');
  } else if (!API_KEY_PATTERN.test(env.DASHCLAW_API_KEY)) {
    failures.push('DASHCLAW_API_KEY format invalid (expect oc_live_<32hex>)');
  }

  if (!env.HOSTED_CLEANUP_SECRET && !env.CRON_SECRET) {
    warnings.push('no cleanup secret configured (HOSTED_CLEANUP_SECRET or CRON_SECRET) — cleanup route is admin-only');
  }
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    warnings.push('NEXT_PUBLIC_TURNSTILE_SITE_KEY unset — Turnstile widget will not render (server still gates provisioning)');
  }

  return {
    status: failures.length > 0 ? 'fail' : 'ok',
    failures,
    warnings,
  };
}

// CLI entrypoint
const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);
if (isMain) {
  const result = assessHostedReadiness();
  const lines = [`[hosted:check-ready] status=${result.status}`];
  for (const f of result.failures) lines.push(`  FAIL: ${f}`);
  for (const w of result.warnings) lines.push(`  WARN: ${w}`);
  if (result.info) lines.push(`  INFO: ${result.info}`);
  console.log(lines.join('\n'));
  process.exit(result.status === 'fail' ? 1 : 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run __tests__/unit/hosted/check-hosted-ready.test.mjs`
Expected: 6/6 pass.

- [ ] **Step 5: Register the script in `package.json`**

Open `package.json`. Find the `scripts` object (search for `"scripts": {`). Add:

```json
"hosted:check-ready": "node scripts/check-hosted-ready.mjs",
```

Place it near other `hosted:*` or health-check scripts (`doctor`, `db-check`, etc.). Match the existing indentation.

- [ ] **Step 6: Exercise the script**

Run: `DASHCLAW_HOSTED=true DATABASE_URL=postgres://fake TURNSTILE_SECRET_KEY=x DASHCLAW_API_KEY=oc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npm run hosted:check-ready`
Expected: `status=ok`, exit 0, warnings about cleanup secret and NEXT_PUBLIC_TURNSTILE_SITE_KEY (both missing in this invocation).

Run: `npm run hosted:check-ready`
Expected: `status=skipped`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-hosted-ready.mjs __tests__/unit/hosted/check-hosted-ready.test.mjs package.json
git commit -m "feat(hosted): add hosted:check-ready pre-deploy validator"
```

---

### Task 5: Post-deploy smoke test script

**Files:**
- Create: `scripts/smoke-hosted.mjs`
- Modify: `package.json` (add `hosted:smoke` script)

**Why:** Operators should run this immediately after deploy to confirm the provisioning flow works end-to-end without needing to open a browser.

- [ ] **Step 1: Create `scripts/smoke-hosted.mjs`**

```javascript
#!/usr/bin/env node
// Post-deploy smoke test for hosted provisioning.
// Usage: node scripts/smoke-hosted.mjs --base-url https://hosted.example.com
//
// What it does:
//   1. POST /api/hosted/workspaces → expect 200 + api_key
//   2. GET  /api/health with the api_key → expect 200
//   3. Clean up by nothing — trial workspaces auto-expire (sweeper handles them)
//      OR (if admin DASHCLAW_API_KEY provided) DELETE /api/hosted/workspaces/:id
//
// Exits 0 on success, 1 on failure.

function parseArgs(argv) {
  const args = { baseUrl: null, adminKey: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--admin-key') args.adminKey = argv[++i];
    else if (a.startsWith('--base-url=')) args.baseUrl = a.slice('--base-url='.length);
    else if (a.startsWith('--admin-key=')) args.adminKey = a.slice('--admin-key='.length);
  }
  args.baseUrl = args.baseUrl || process.env.HOSTED_SMOKE_BASE_URL || '';
  args.adminKey = args.adminKey || process.env.DASHCLAW_API_KEY || '';
  return args;
}

async function main() {
  const { baseUrl, adminKey } = parseArgs(process.argv);
  if (!baseUrl) {
    console.error('FAIL: --base-url or HOSTED_SMOKE_BASE_URL required');
    process.exit(1);
  }
  const base = baseUrl.replace(/\/$/, '');

  // Step 1: provision
  console.log(`[smoke] POST ${base}/api/hosted/workspaces`);
  const provisionRes = await fetch(`${base}/api/hosted/workspaces`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (provisionRes.status !== 200) {
    const body = await provisionRes.text();
    console.error(`FAIL: provision returned ${provisionRes.status}\n${body}`);
    process.exit(1);
  }
  const provisioned = await provisionRes.json();
  console.log(`[smoke] provisioned workspace=${provisioned.workspace_id}, api_key prefix=${provisioned.key_prefix}`);

  // Step 2: use the key
  console.log(`[smoke] GET ${base}/api/health with provisioned key`);
  const healthRes = await fetch(`${base}/api/health`, {
    headers: { 'x-api-key': provisioned.api_key },
  });
  if (healthRes.status !== 200) {
    console.error(`FAIL: /api/health returned ${healthRes.status}`);
    process.exit(1);
  }
  console.log('[smoke] /api/health OK');

  // Step 3: cleanup (best-effort, admin only)
  if (adminKey) {
    console.log(`[smoke] DELETE ${base}/api/hosted/workspaces/${provisioned.workspace_id}`);
    const delRes = await fetch(`${base}/api/hosted/workspaces/${provisioned.workspace_id}`, {
      method: 'DELETE',
      headers: { 'x-api-key': adminKey },
    });
    if (delRes.status !== 200) {
      console.warn(`WARN: cleanup returned ${delRes.status} — trial will auto-expire`);
    } else {
      console.log('[smoke] cleanup OK');
    }
  } else {
    console.log('[smoke] no admin key provided; trial will auto-expire');
  }

  console.log('[smoke] PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: Register script in `package.json`**

Add:

```json
"hosted:smoke": "node scripts/smoke-hosted.mjs",
```

Place near `hosted:check-ready`.

- [ ] **Step 3: Syntax check the script**

Run: `node --check scripts/smoke-hosted.mjs`
Expected: no output, exit 0.

Run with missing base URL (should fail loudly):
`npm run hosted:smoke`
Expected: `FAIL: --base-url or HOSTED_SMOKE_BASE_URL required`, exit 1.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-hosted.mjs package.json
git commit -m "feat(hosted): add hosted:smoke post-deploy sanity-test script"
```

---

### Task 6: Deployment runbook (`docs/ops/hosted-deployment.md`)

**Files:**
- Create: `docs/ops/hosted-deployment.md`

**Why:** The operator needs a step-by-step that covers Neon setup, Vercel setup, Cloudflare Turnstile keys, DNS, and post-deploy validation. Every step includes exact copy-paste values where possible and explicit manual-step markers where not.

- [ ] **Step 1: Create the directory**

Run: `mkdir -p docs/ops`
Expected: directory created (or "already exists" — both fine).

- [ ] **Step 2: Create the runbook**

Create `docs/ops/hosted-deployment.md`:

```markdown
---
owner: Ops
last-verified: 2026-04-18
doc-type: runbook
---

# Hosted DashClaw deployment runbook

This runbook deploys DashClaw as a hosted service (e.g. `hosted.dashclaw.io`) where visitors can mint trial workspaces via `/connect`. It is the ops companion to the code shipped in Plans 1, 2, and 4.

**Who this is for:** the operator standing up the hosted instance. Self-host users do not need this — they follow `QUICK-START.md`.

**Estimated time:** ~45 minutes first time, ~10 minutes thereafter.

---

## Prerequisites

- [ ] GitHub repo access with push rights to `main`
- [ ] Vercel account (Hobby or Pro — see cron note below)
- [ ] Neon account (free tier is sufficient for trial volume)
- [ ] Cloudflare account (free Turnstile tier)
- [ ] Optional: a registered domain (e.g. `dashclaw.io`) if you want a branded URL

---

## 1. Provision Neon Postgres

1. Go to https://console.neon.tech and click "New Project".
2. Name: `dashclaw-hosted` (or similar).
3. Region: choose the region closest to your Vercel deployment.
4. Copy the `DATABASE_URL` (the "pooled" connection string). Keep it safe — you'll paste it into Vercel.

---

## 2. Create Cloudflare Turnstile keys

1. Go to https://dash.cloudflare.com → Turnstile → Add Site.
2. Name: `DashClaw Hosted`. Domain: your future Vercel domain (or `*.vercel.app` for initial testing).
3. Widget mode: `Managed` (invisible unless suspicious).
4. Copy the **Site Key** (public, prefix `0x4...`) and **Secret Key** (private, prefix `0x4...`).

---

## 3. Generate cron + cleanup secrets

Run locally to generate two random hex strings:

\`\`\`bash
node -e "console.log('CRON_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('HOSTED_CLEANUP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

Save both values — you'll paste them into Vercel, and if you use the GitHub Actions cron, into repo secrets too.

---

## 4. Generate an admin API key

The hosted instance needs an admin key so you can inspect/delete trial workspaces via `/api/hosted/workspaces/:id`:

\`\`\`bash
node -e "console.log('DASHCLAW_API_KEY=oc_live_' + require('crypto').randomBytes(16).toString('hex'))"
\`\`\`

This matches the key format the code expects. Save it.

---

## 5. Create the Vercel project

1. Go to https://vercel.com/new → Import the `DashClaw` repo.
2. Framework preset: Next.js (auto-detected).
3. Build command: leave default (`vercel.json` defines it).
4. Under **Environment Variables**, set the following on the `Production` environment:

| Name | Value | Source |
|:---|:---|:---|
| `DASHCLAW_HOSTED` | `true` | this enables all Plan 1 routes |
| `DATABASE_URL` | from Neon (step 1) | |
| `DASHCLAW_API_KEY` | generated above (step 4) | admin key; do not leak |
| `TURNSTILE_SECRET_KEY` | from Cloudflare (step 2) | |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare (step 2) | public-safe; renders widget |
| `HOSTED_CLEANUP_SECRET` | generated above (step 3) | used by GH Actions cron |
| `CRON_SECRET` | generated above (step 3) | used by Vercel cron (Task 1 path) |
| `HOSTED_TRIAL_DAYS` | `30` | optional — default is 30 |
| `HOSTED_TRIAL_ACTION_CAP` | `10000` | optional — default is 10000 |
| `HOSTED_PROVISION_MAX_PER_IP_PER_DAY` | `5` | optional — default is 5 |
| `NEXTAUTH_URL` | your final domain (see step 7) | required by NextAuth |
| `NEXTAUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | required by NextAuth |

5. Click **Deploy**. The build runs `node scripts/auto-migrate.mjs && next build`, which applies the Plan 1 schema migrations automatically on first deploy.

---

## 6. Validate the deployment

Once Vercel reports `Ready`:

\`\`\`bash
# Locally, from the repo root, run the smoke test against the deployed URL:
HOSTED_SMOKE_BASE_URL=https://your-deploy.vercel.app DASHCLAW_API_KEY=<admin-key> npm run hosted:smoke
\`\`\`

Expected: `[smoke] PASS`.

Also run the readiness checker (locally, with the same env vars you set on Vercel) to confirm nothing is missing:

\`\`\`bash
DASHCLAW_HOSTED=true DATABASE_URL=<neon-url> TURNSTILE_SECRET_KEY=<turnstile-secret> \\
  DASHCLAW_API_KEY=<admin-key> NEXT_PUBLIC_TURNSTILE_SITE_KEY=<turnstile-site> \\
  HOSTED_CLEANUP_SECRET=<cleanup> npm run hosted:check-ready
\`\`\`

Expected: `status=ok`.

Manually verify in a browser:
- Open `https://your-deploy.vercel.app/connect`
- Confirm the "Try it hosted" section appears at the top
- Click "Mint trial workspace for Claude Code"
- Confirm the workspace ID + api_key + pre-filled config block appear
- Open `https://your-deploy.vercel.app/setup` and confirm status is green

---

## 7. Configure your custom domain (optional)

1. In the Vercel project → Settings → Domains, add `hosted.dashclaw.io` (or your preferred subdomain).
2. Vercel shows the required DNS record (usually a CNAME to `cname.vercel-dns.com`).
3. Add that record at your domain registrar. Propagation typically takes under an hour.
4. **Update Cloudflare Turnstile**: Step 2 used a placeholder domain; add your real domain to the Turnstile site's allowed list and redeploy so the widget loads correctly.
5. **Update `NEXTAUTH_URL`** in Vercel env vars to the new domain and redeploy.

---

## 8. Schedule trial cleanup

Pick ONE of:

### Option A — Vercel cron (requires a plan that supports ≥ 2 crons)

Already configured in `vercel.json`. Vercel automatically schedules `POST /api/hosted/cleanup` daily at 03:00 UTC using the `Authorization: Bearer $CRON_SECRET` header (gated by Task 1's auth extension).

No additional setup — if your plan supports it, it's already active after deploy.

### Option B — GitHub Actions cron (free-tier-friendly)

1. In the GitHub repo Settings → Secrets and variables → Actions, add:
    - `DASHCLAW_BASE_URL` = your Vercel URL
    - `HOSTED_CLEANUP_SECRET` = the value from step 3
2. In Actions tab, enable the **Hosted cleanup** workflow.
3. First run: Actions → "Hosted cleanup" → "Run workflow" → confirm HTTP 200 in the log.

If you use Option B, you can safely remove the `{ "path": "/api/hosted/cleanup", ... }` entry from `vercel.json` (but it's harmless to leave it).

---

## 9. Monitoring

Minimal recommended setup:
- [ ] Vercel deployment log tail — check for `[HOSTED]` error lines after each release
- [ ] Neon query console — inspect `organizations WHERE hosted_mode = true` weekly to spot anomalies
- [ ] GitHub Actions → Hosted cleanup log — verify daily green runs

Beyond minimal (future):
- Sentry for error aggregation
- Datadog / Grafana for request rate + 4xx/5xx ratios
- Slack webhook on `/api/integrations/health` state flips

---

## 10. Rollback

If a release breaks hosted provisioning:

1. Vercel dashboard → Deployments → pick the last known-good deploy → **Promote to Production**.
2. If the schema migrated destructively, restore Neon from the most recent branch (Neon creates automatic branches on DDL). Step-by-step: Neon → Branches → "Reset to snapshot".
3. File an issue describing the break and investigate locally with `DASHCLAW_HOSTED=true npm run dev`.

---

_Runbook last verified: 2026-04-18 against Plans 1, 2, 4._
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/hosted-deployment.md
git commit -m "docs(hosted): add deployment runbook for hosted-mode instance"
```

---

### Task 7: Env var + PROJECT_DETAILS updates

**Files:**
- Modify: `.env.example`
- Modify: `PROJECT_DETAILS.md`

**Why:** New env vars (`CRON_SECRET`, `HOSTED_SMOKE_BASE_URL`) need documentation. PROJECT_DETAILS should point at the new runbook.

- [ ] **Step 1: Extend `.env.example`**

Find the existing hosted provisioning section (added in Plan 1). Add two entries:

```bash
# CRON_SECRET=                                # Vercel cron auth (Authorization: Bearer); pairs with /api/hosted/cleanup
# HOSTED_SMOKE_BASE_URL=                      # Default URL for `npm run hosted:smoke`
```

Place `CRON_SECRET` right after `HOSTED_CLEANUP_SECRET` (they're related).
Place `HOSTED_SMOKE_BASE_URL` at the end of the hosted block.

- [ ] **Step 2: Update `PROJECT_DETAILS.md`**

Find the section that lists essential docs or operational references (look for `QUICK-START.md` or `docs/architecture/`). Add a one-line entry:

```markdown
- `docs/ops/hosted-deployment.md` — Deployment runbook for hosted-mode instances (operator).
```

If there's no obvious list, add it under an existing "Where To Look First" or "Operational Maturity" section.

- [ ] **Step 3: Doc validators**

Run: `npm run docs:check`
Expected: exit 0.

Run: `npm run openapi:check && npm run api:inventory:check`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add .env.example PROJECT_DETAILS.md
git commit -m "docs(hosted): document CRON_SECRET + HOSTED_SMOKE_BASE_URL + runbook link"
```

---

### Task 8: Final verification

**Files:** no changes — gate before declaring the plan complete.

- [ ] **Step 1: Full test suite**

Run: `npm run test -- --run`
Expected: all tests pass (previous 1615 + 2 new cleanup-auth tests + 6 new readiness tests = ~1623). **Do not proceed if any test fails.**

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 3: Contract + SQL guardrail**

Run: `npm run openapi:check && npm run route-sql:check`
Expected: both exit 0.

- [ ] **Step 4: Readiness script local check (skipped path)**

Run: `npm run hosted:check-ready`
Expected: `status=skipped`, exit 0 (DASHCLAW_HOSTED unset in local env).

- [ ] **Step 5: Readiness script local check (fail path)**

Run: `DASHCLAW_HOSTED=true npm run hosted:check-ready`
Expected: `status=fail`, exit 1, failures include `DATABASE_URL missing`, `TURNSTILE_SECRET_KEY missing`, `DASHCLAW_API_KEY missing`.

- [ ] **Step 6: Smoke script local check (usage error)**

Run: `npm run hosted:smoke`
Expected: `FAIL: --base-url or HOSTED_SMOKE_BASE_URL required`, exit 1.

- [ ] **Step 7: Final commit if any cleanup is needed**

```bash
git status
# If clean, nothing to commit.
```

---

## Self-Review

**Spec coverage:**
- Vercel cron wiring ✓ (Tasks 1, 2)
- GH Actions cron alternative ✓ (Task 3)
- Auth extension so Vercel cron works ✓ (Task 1)
- Pre-deploy readiness checker ✓ (Task 4)
- Post-deploy smoke test ✓ (Task 5)
- Deployment runbook ✓ (Task 6)
- Env + docs ✓ (Task 7)
- Full-suite verification ✓ (Task 8)

**Placeholder scan:** None. Every task includes complete code and exact commands. The runbook uses explicit placeholder URLs (`https://your-deploy.vercel.app`) which the operator substitutes — this is correct because we don't know the real URL.

**Type consistency:** `assessHostedReadiness(env)` returns `{status, failures, warnings, info?}` — used consistently in tests and CLI wrapper. `requireAdminOrCronSecret(request)` preserves its existing signature and return contract. Script names match across package.json, runbook, and tests (`hosted:check-ready`, `hosted:smoke`).

**Memory constraints honored:**
- No PRs — each task commits to main ✓
- SDK Documentation Checklist honored for new env vars ✓
- No secrets committed — runbook tells operator to generate + paste, never provides sample values for real secrets ✓
- `DASHCLAW_HOSTED=false` behavior untouched; self-host unaffected ✓
- Vercel free-tier constraint relaxed for operator instance (explicit GH Actions alternative provided for free-tier-only operators) ✓

---

## Open questions / follow-ups (not blocking)

1. **Error aggregation**: the runbook mentions Sentry under "Monitoring" but doesn't set it up. A follow-up plan could wire `@sentry/nextjs` with a flag-gated init that skips on self-host.
2. **Trial usage telemetry**: no plan-level analytics yet (e.g. "how many trials provisioned per day?"). Could be a small follow-up — add a simple `GET /api/hosted/stats` for operators.
3. **DNS / Turnstile callback domain update automation**: currently step-7 relies on the operator remembering to update Cloudflare after DNS changes. Could be automated with a Cloudflare API call, but that's scope creep.
4. **Vercel plan detection**: `vercel.json` adds a second cron; operators on single-cron plans silently get that cron ignored. A follow-up could fail deployment loudly on cron-count mismatch.
