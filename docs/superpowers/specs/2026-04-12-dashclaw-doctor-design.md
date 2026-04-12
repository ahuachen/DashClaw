# DashClaw Doctor — Design Spec

**Date:** 2026-04-12
**Status:** Approved

## Overview

`dashclaw doctor` is a diagnostic and auto-fix tool for DashClaw instances. It checks database connectivity, environment configuration, authentication, deployment, SDK reachability, and governance setup — then automatically fixes what it can.

**Audience:** Both self-hosters (running their own instance) and agent developers (connecting via SDK/CLI).

**Delivery:**
- `npm run doctor` — local mode for self-hosters (direct env/DB/filesystem access)
- `dashclaw doctor` — remote mode via `@dashclaw/cli` (HTTP calls to the instance)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Doctor Engine                     │
│              app/lib/doctor/                      │
│                                                   │
│  engine.mjs ── runDoctor() / applyFix()          │
│  checks/    ── one module per check              │
│  fixes/     ── one handler per fix action        │
│  format.mjs ── terminal renderer (shared)        │
└──────────┬──────────────────┬────────────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │ npm run     │   │ GET /api/   │
    │ doctor      │   │ doctor      │
    │             │   │             │
    │ scripts/    │   │ POST /api/  │
    │ doctor.mjs  │   │ doctor/fix  │
    └─────────────┘   └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │ dashclaw    │
                      │ doctor      │
                      │ (CLI)       │
                      └─────────────┘
```

- **Local mode** (`npm run doctor`): imports engine directly, has filesystem + DB access.
- **Remote mode** (`dashclaw doctor`): calls `/api/doctor` and `/api/doctor/fix` over HTTP. CLI is a thin renderer.

## Check Result Shape

Every check returns a uniform structure:

```js
{
  id: "db_connection",
  category: "database",        // database | config | auth | sdk | deployment | governance
  status: "fail",              // pass | warn | fail
  title: "Database Connection",
  message: "Connection refused — is Postgres running?",
  fix: {                       // null if no auto-fix available
    type: "auto",              // auto | prompt | manual
    description: "Run pending migrations",
    action: "migrate"          // key the fix endpoint understands
  }
}
```

## Checks

### Reusing Existing Readiness Infrastructure

| Check | Source Module | Category |
|-------|-------------|----------|
| Database connection + core tables | `readiness/databaseCheck.mjs` | database |
| Missing migrations | `setupStatus.mjs` | database |
| Required env vars (DATABASE_URL, NEXTAUTH_SECRET) | `readiness/configurationCheck.mjs` | config |
| Advisory env vars (NEXTAUTH_URL, DASHCLAW_API_KEY, CRON_SECRET) | `readiness/configurationCheck.mjs` | config |
| Auth providers configured | `readiness/authCheck.mjs` | auth |
| NEXTAUTH_URL alignment | `readiness/deployCheck.mjs` | deployment |
| SDK reachability | `readiness/sdkCheck.mjs` | sdk |
| API key validity | `/api/setup/ping` logic | auth |

### New Doctor-Only Checks

| Check | Category | Description |
|-------|----------|-------------|
| Schema version drift | database | Compare expected tables/columns vs actual |
| Governance policies exist | governance | Query `guard_policies` table |
| Agent has sent actions | governance | Query `action_records` table |
| Stale governance | governance | Policies exist but no actions in 7+ days |
| CORS misconfiguration | deployment | `ALLOWED_ORIGIN` doesn't match requesting agent origin |
| SDK version check | sdk | Agent SDK version vs server expected minimum |

### Local-Only Checks (npm run doctor)

| Check | Description |
|-------|-------------|
| `.env` file exists | Basic prerequisite |
| `.env` in `.gitignore` | Security check |
| `node_modules/` exists | Dependencies installed |
| Next.js build health | App builds successfully |
| Port availability | Configured port is not in use |

## Fix Engine

### Auto-Fix Actions

| Action Key | What It Does | Type |
|------------|-------------|------|
| `migrate` | Runs DDL migrations (same logic as `/api/setup/migrate`) | auto |
| `generate_secret` | Generates random NEXTAUTH_SECRET, writes to `.env` | auto |
| `generate_encryption_key` | Generates 32-char key, writes to `.env` | auto |
| `generate_api_key` | Mints DASHCLAW_API_KEY via existing key generation | auto |
| `fix_cors` | Sets `ALLOWED_ORIGIN` to match detected agent origin | auto |
| `create_default_policy` | Inserts starter log-all governance policy | auto |

### Prompt Actions (Critical Blockers)

| Action Key | What It Does |
|------------|-------------|
| `prompt_database_url` | Interactive prompt for Postgres connection string, validates before saving |
| `prompt_nextauth_url` | Prompts for public URL, validates format |

### Manual Actions (Printed in Summary)

These are never auto-fixed — they require external service setup:

- OAuth credentials (GitHub, Google, OIDC)
- Stripe keys
- Redis/Upstash config
- `GUARD_LLM_KEY` / `OPENAI_API_KEY`

### Safety Rules

- Env writes back up `.env` to `.env.backup` first
- Fixes never delete data — only add or update
- Database mutations (migrate, create_default_policy) are idempotent
- Fix response includes `{ applied: true, description: "what changed" }` for reporting

## API Endpoints

### `GET /api/doctor`

Run all checks, return results.

- **Auth:** API key required
- **Query params:**
  - `category` — comma-separated filter (e.g., `?category=database,config`)
  - `include_fixes` — include fix metadata in response (`?include_fixes=true`)
- **Response:**

```json
{
  "status": "unhealthy",
  "summary": { "pass": 7, "warn": 2, "fail": 1 },
  "checks": [],
  "timestamp": "2026-04-12T..."
}
```

### `POST /api/doctor/fix`

Apply a specific fix action.

- **Auth:** API key required
- **Body:** `{ "action": "migrate" }`
- **Response:**

```json
{
  "applied": true,
  "action": "migrate",
  "description": "Created 3 missing tables: guard_policies, action_records, guard_decisions",
  "recheck": {}
}
```

The `recheck` field re-runs the related check after the fix so the caller immediately knows if it worked.

**Security:** Only accepts predefined action keys from the fix engine — no arbitrary commands. Check results never expose sensitive values (env vars report "present" or "missing", never the actual value).

## CLI Integration (`dashclaw doctor`)

New subcommand in `@dashclaw/cli`. Thin renderer — all logic is server-side.

**Usage:**

```bash
dashclaw doctor                           # Rich terminal output
dashclaw doctor --json                    # CI/scripting output
dashclaw doctor --category database,config  # Filter checks
dashclaw doctor --no-fix                  # Diagnose only, skip auto-fixes
```

**Flow:**

1. Call `GET /api/doctor?include_fixes=true`
2. Render check results grouped by category (colored pass/warn/fail)
3. For each failing check with `fix.type: "auto"` — apply immediately via `POST /api/doctor/fix`
4. For each failing check with `fix.type: "prompt"` — prompt the user inline, then apply
5. For each failing check with `fix.type: "manual"` — collect into summary list at the end
6. After all fixes, re-run `GET /api/doctor` and show updated status
7. Print final summary: what was fixed, what still needs attention

**Output example:**

```
 DashClaw Doctor

 Database
  ✓ Database connection
  ✓ Core tables exist
  ✗ Missing 2 tables (guard_policies, guard_decisions)
    → Fixed: ran migrations, created 2 tables

 Configuration
  ✓ DATABASE_URL
  ✓ NEXTAUTH_SECRET
  ⚠ NEXTAUTH_URL not set (advisory)

 Auth
  ✓ API key valid
  ⚠ No OAuth providers configured

 Governance
  ✗ No governance policies found
    → Fixed: created default log-all policy

 Summary: 8 passed, 2 warnings, 0 remaining failures
 2 issues auto-fixed this run

 Manual action needed:
  • Set NEXTAUTH_URL to your public deployment URL
  • Configure at least one OAuth provider for user sign-in
```

## Local Mode (`npm run doctor`)

`scripts/doctor.mjs` imports the doctor engine directly — no HTTP round-trip.

```bash
npm run doctor              # Rich terminal output
npm run doctor -- --json    # CI output
npm run doctor -- --no-fix  # Diagnose only
```

Runs the same checks as the API, plus local-only checks (`.env` exists, `.gitignore` correct, deps installed, build health, port available). Has direct filesystem access for env writes (prompt fixes write to `.env` directly).

## Shared Code Map

```
app/lib/doctor/
  engine.mjs      — runDoctor(options) and applyFix(action, params)
  checks/
    database.mjs  — DB connection, tables, migrations, schema drift
    config.mjs    — required + advisory env vars
    auth.mjs      — API key, OAuth providers
    deployment.mjs — NEXTAUTH_URL, CORS
    sdk.mjs       — reachability, version check
    governance.mjs — policies exist, actions recorded, staleness
  fixes/
    migrate.mjs
    generate-secret.mjs
    generate-encryption-key.mjs
    generate-api-key.mjs
    fix-cors.mjs
    create-default-policy.mjs
    prompt-database-url.mjs
    prompt-nextauth-url.mjs
  format.mjs      — terminal renderer (pass/warn/fail, colors, grouping, JSON mode)

app/api/doctor/
  route.js        — GET handler
  fix/
    route.js      — POST handler

scripts/doctor.mjs — local mode entry point (npm run doctor)

cli/lib/doctor.js  — remote mode logic (dashclaw doctor subcommand)
```

## What This Does NOT Include

- No web UI — the `/setup` page already covers that surface
- No scheduled health checks or alerting — that's a separate concern
- No agent-side SDK method (`claw.doctor()`) — the CLI covers remote diagnosis
- No OpenClaw plugin integration — doctor is an operator tool, not an agent tool
