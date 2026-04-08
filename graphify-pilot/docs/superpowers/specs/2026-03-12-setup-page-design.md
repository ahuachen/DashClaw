# /setup — Instance Status Page Design

**Date:** 2026-03-12
**Status:** Approved

## Goal

Replace the current `app/setup/page.js` redirect-to-dashboard stub with a real, server-rendered instance status page that tells a user exactly whether their DashClaw instance is usable, what is missing, and what to do next.

## Constraints

- Server component only — no client fetch layer, no `'use client'`
- No new files unless the single-file approach becomes unreadable
- No new abstractions — reuse `getSetupStatus()` and `getAuthConfig()` directly
- `/setup` stays visible even when the instance is fully ready (no auto-redirect)
- Page distinct from `/self-host` (which is marketing/deployment guidance)

## Architecture

`app/setup/page.js` is a Next.js async Server Component.

It calls both utilities at request time:

```js
const dbStatus = await getSetupStatus(process.env);
const authConfig = getAuthConfig(process.env);
```

It composes a single `instanceStatus` object (local to the component) that captures:
- `db.ok` — mapped from `dbStatus.configured` (boolean)
- `db.reason` — one of: `missing_database_url`, `connection_error`, `no_tables`, `ready`
- `db.message` — human-readable string from `dbStatus.message`
- `db.missing` — array of missing table names from `dbStatus.missing` (when present). Use `db.missing.length` for count display, not the separate `dbStatus.missing_tables` integer.
- `auth.ok` — `authConfig.hasAnySignInMethod`
- `auth.methods` — assembled from `authConfig.oauthProviders[].name` (e.g. `"GitHub"`, `"Google"`, or `authConfig.oauthProviders[].name` for OIDC which may be a custom display name from `OIDC_DISPLAY_NAME`), plus the string `"Local password"` appended if `authConfig.hasLocalPassword` is true
- `auth.hasAny` — `authConfig.hasAnySignInMethod`
- `overall` — `"ready" | "partial" | "not_configured"`

## State Matrix

| DB state | Auth state | `overall` |
|---|---|---|
| `missing_database_url` | any | `not_configured` |
| `connection_error` | any | `not_configured` |
| `no_tables` | any | `not_configured` |
| `ready` | no methods | `partial` |
| `ready` | has methods | `ready` |

Note: `partial` and `ready` are the only two states where the DB section shows green.

## Page Structure

### 1. Header
- Title: "Instance Status"
- Subtitle: "DashClaw — [hostname or `localhost`]"
- No DashClaw marketing copy, no feature list

### 2. Status Checklist (two rows)

Each row shows:
- Icon: ✓ (green), ✗ (red), or ⚠ (amber)
- Label: "Database" / "Sign-in"
- Short status message

**Database row messages:**
- `missing_database_url`: "DATABASE_URL is not set"
- `connection_error`: "Cannot reach database"
- `no_tables`: "Connected — migrations not run (N tables missing)"
- `ready`: "Connected and migrated"

**Sign-in row messages:**
- No methods: "No sign-in method configured"
- Has methods: Explicit list — e.g. "GitHub, Local password" or "Google"

### 3. Recommended Next Action (prominent block)

One block, changes based on state priority (DB problems take precedence over auth problems):

| State | Action shown |
|---|---|
| `missing_database_url` | Set `DATABASE_URL` — with example snippet |
| `connection_error` | Check DB host / start Docker — with example connection string |
| `no_tables` | Run core bootstrap migrations (exact commands below) |
| `ready` + no auth | Set `DASHCLAW_LOCAL_ADMIN_PASSWORD` for solo/local access, or configure GitHub/Google/OIDC — both paths shown side-by-side |
| `ready` + auth ready | "Your instance is ready. Go to /login or /dashboard." |

### 4. Footer Links (quiet)

- Link to `/self-host` — "Deployment guide"
- Link to `/login` — only shown when auth is configured
- Link to `/dashboard` — only shown when both DB and auth are ready

## Design Decisions

**Migration commands for `no_tables` state.** The page shows these exact core bootstrap commands:

```
node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
node scripts/_run-with-env.mjs scripts/migrate-capabilities.mjs
```

Note: these are the core bootstrap migrations. Additional feature migrations may exist in `scripts/`. The page copy should say so.

---

**No auto-redirect when ready.** The page is a truth surface. A user should be able to bookmark `/setup` and use it to verify instance health at any time.

**Concrete method names in auth status.** "GitHub, Local password" is more useful than "2 sign-in methods configured". Names come directly from `getAuthConfig()`.

**Collapsed ready state.** There is one `ready` state (DB ready + auth configured). No separate "fully ready" vs "almost ready" — `partial` covers the DB-ready-but-auth-missing case.

**No client-side refresh.** Users reload the page. This is honest — the page reflects the server's env at request time.

## Files Changed

| File | Change |
|---|---|
| `app/setup/page.js` | Full replacement — was a 5-line redirect stub |

No other files are changed. `setupStatus.mjs` and `authConfig.mjs` are consumed as-is.

## Out of Scope

- Animated checklist or wizard flow
- Automatic migration runner (UI trigger)
- Live polling / refresh button
- `/api/setup/status` API extension (optional, deferred)
