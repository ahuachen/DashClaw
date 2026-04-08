# Agent Identity Settings Tab — Design Spec

**Date**: 2026-03-23
**Status**: Approved
**Scope**: Restore archived pairing/identity API routes, add "Agent Identity" tab to settings, remove standalone pairing pages.

---

## Problem

The agent pairing flow is documented in the connect guide and SDK, but the API routes that power it (`/api/pairings`, `/api/identities`) were moved to `_archive/` and are unreachable. The standalone `/pairings` and `/pair/[id]` UI pages exist but 404 on their API calls. There is no way for admins to manage agent identities or toggle signature enforcement from the UI.

## Solution

1. Restore pairing and identity API routes from `_archive/` to live endpoints.
2. Add an "Agent Identity" tab to the settings page for full identity lifecycle management.
3. Remove standalone pairing pages; redirect the pairing URL to settings.

---

## API Routes

Restore from `app/api/_archive/` to `app/api/`:

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/pairings` | POST | Org member | Agent creates pairing request (agent_id + public_key) |
| `/api/pairings` | GET | Admin | List pairings (filterable by status) |
| `/api/pairings/[pairingId]` | GET | Org member | Fetch single pairing (soft-expires on read) |
| `/api/pairings/[pairingId]/approve` | POST | Admin | Approve pairing → upsert agent_identity |
| `/api/identities` | POST | Admin | Direct-register identity (bypass pairing) |
| `/api/identities` | GET | Admin | List approved agent identities |
| `/api/identities/[agentId]` | DELETE | Admin | Revoke agent identity (NEW) |

### Governance Boundary

Add `'pairings'` and `'identities'` to the Tier 3 (Essential Infrastructure) whitelist in `scripts/check-api-boundary.mjs`.

### New Endpoint: DELETE `/api/identities/[agentId]`

- Admin-only
- Deletes from `agent_identities` where `org_id` and `agent_id` match
- Returns 200 `{ deleted: true }` on success, 404 `{ error: "Identity not found" }` if no match
- Also expires any pending pairings for that agent_id (UPDATE status → 'expired')
- After revocation, the agent's signed actions will fail identity lookup (`verified: false`); if enforcement is on, they get 401

### Repository Pattern

The archived routes contain inline SQL. During restoration, all database queries must be extracted into repository files following the project convention (no direct SQL in route files):

- `app/lib/repositories/pairings.repository.js` — CRUD for `agent_pairings` table
- `app/lib/repositories/identities.repository.js` — CRUD for `agent_identities` table

Both repositories must include `ensureTable()` functions (matching the pattern in other repositories) so the tables are created on first access for fresh instances.

### Next.js 15 Compatibility

The archived `[pairingId]/route.js` GET handler accesses `params.pairingId` synchronously. All restored routes must use `const { pairingId } = await params;` to match the Next.js 15 App Router pattern used across the codebase.

---

## Settings Tab: "Agent Identity"

New tab at `/settings?tab=identity`. Single client component: `AgentIdentityPanel.js`.

### Tab Definition

```javascript
{ key: 'identity', label: 'Agent Identity', href: '/settings?tab=identity' }
```

### Section 1: Signature Enforcement Toggle

- Card at top of tab
- Shows current enforcement status (on/off)
- Toggle switch that POSTs to `/api/settings` with key `ENFORCE_AGENT_SIGNATURES` (must be added to `VALID_SETTING_KEYS` in `settings.repository.js`)
- The `/api/actions` route currently reads enforcement from `process.env.ENFORCE_AGENT_SIGNATURES`. Update it to check the DB setting first, falling back to the env var. This allows runtime toggling without redeployment.
- Helper text: "When enabled, actions without valid signatures are rejected (401)"

### Section 2: Pending Pairings Inbox

- Table: Agent ID, Agent Name, Algorithm, Expires In, Actions
- Per-row "Approve" button → POST `/api/pairings/[id]/approve`
- "Approve All" bulk action (sequential, best-effort — skips expired pairings, continues on error)
- Empty state: "No pending pairing requests"
- Auto-refreshes after approvals
- Highlights specific pairing when `?pairing=X` query param is present

### Section 3: Approved Identities

- Table: Agent ID, Algorithm, Enrolled At, Actions
- Per-row "Revoke" button → DELETE `/api/identities/[agentId]`
- "Register Manually" button → inline form (agent_id + public_key PEM) → POST `/api/identities`
- Empty state: "No agents enrolled. Share a pairing URL or register directly."

### Settings Page Subtitle

Update to: "Instance configuration, verification, model pricing, and agent identity."

---

## Page Cleanup

### Remove

- `app/pairings/page.js` — replaced by settings tab
- `app/pair/[pairingId]/pairApprovalClient.js` — replaced by settings tab

### Redirect

- `app/pair/[pairingId]/page.js` → server component that redirects to `/settings?tab=identity&pairing=[pairingId]`
- Preserves SDK flow: agent prints pairing URL → admin clicks → lands on approval in settings

---

## Data Flow

```
Agent SDK                          DashClaw
─────────                          ────────
generateKeypair()
     │
     ├─── POST /api/pairings ──────► agent_pairings (status: pending)
     │                               returns pairing_url
     │
     ├─── prints pairing_url ──────► Admin clicks URL
     │                               → redirects to /settings?tab=identity&pairing=X
     │                               → Admin clicks "Approve"
     │                               → POST /api/pairings/X/approve
     │                               → agent_identities (upsert)
     │                               → agent_pairings (status: approved)
     │
     ├─── waitForPairing() polls ──► GET /api/pairings/X → status: approved
     │
     └─── POST /api/actions ───────► verifyAgentSignature()
           (with _signature field)    → looks up agent_identities
                                      → crypto.verify() → verified: true
```

### Enforcement Behavior (existing, unchanged)

- `ENFORCE_AGENT_SIGNATURES=false` (default): signatures verified if present, not required
- `ENFORCE_AGENT_SIGNATURES=true`: unsigned actions rejected with 401

### Revocation Flow (new)

- Admin clicks "Revoke" in settings → DELETE `/api/identities/[agentId]`
- Agent's next signed action → identity lookup fails → `verified: false`
- If enforcement is on → 401 rejection

---

## Files Changed

### New Files

- `app/settings/components/AgentIdentityPanel.js` — client component for identity tab
- `app/api/pairings/route.js` — restored from archive
- `app/api/pairings/[pairingId]/route.js` — restored from archive
- `app/api/pairings/[pairingId]/approve/route.js` — restored from archive
- `app/api/identities/route.js` — restored from archive
- `app/api/identities/[agentId]/route.js` — new DELETE endpoint

### Modified Files

- `app/settings/page.js` — add identity tab definition + conditional render
- `app/pair/[pairingId]/page.js` — replace with redirect
- `scripts/check-api-boundary.mjs` — add pairings + identities to Tier 3 whitelist
- `app/lib/repositories/settings.repository.js` — add `ENFORCE_AGENT_SIGNATURES` to `VALID_SETTING_KEYS`
- `app/api/actions/route.js` — read enforcement from DB setting (fallback to env var)

### Deleted Files

- `app/pairings/page.js`
- `app/pair/[pairingId]/pairApprovalClient.js`

---

## Documentation Checklist

Per project convention, after implementation the following must be updated for the new `/api/pairings` and `/api/identities` routes:

1. `app/docs/page.js` — website docs page
2. `sdk/README.md` — Node SDK README
3. `sdk-python/README.md` — Python SDK README
4. `docs/sdk-parity.md` — SDK parity matrix
5. `docs/api-inventory.md` — API route inventory
6. `PROJECT_DETAILS.md` — canonical architecture doc
7. `docs/dashclaw website in markdown.md` — website content snapshot

Run: `npm run docs:check`, `npm run openapi:generate`, `npm run api:inventory:generate`
