# Agent Identity Settings Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore agent pairing/identity API routes and add an "Agent Identity" management tab to settings for full identity lifecycle management.

**Architecture:** Two new repository files extract SQL from archived routes. Six API routes are restored from `_archive/` with one new DELETE endpoint. A client component (`AgentIdentityPanel.js`) adds a third tab to settings with enforcement toggle, pending pairings inbox, and approved identities table. The standalone pairings pages are removed; `/pair/[id]` becomes a redirect.

**Tech Stack:** Next.js 15 App Router, Postgres (via `getSql()` tagged templates), React client components

**Spec:** `docs/superpowers/specs/2026-03-23-agent-identity-settings-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/lib/repositories/pairings.repository.js` | CRUD for `agent_pairings` table with `ensureTable()` |
| `app/lib/repositories/identities.repository.js` | CRUD for `agent_identities` table with `ensureTable()` |
| `app/api/pairings/route.js` | POST create + GET list pairings |
| `app/api/pairings/[pairingId]/route.js` | GET single pairing (with soft-expiry) |
| `app/api/pairings/[pairingId]/approve/route.js` | POST approve pairing |
| `app/api/identities/route.js` | POST register + GET list identities |
| `app/api/identities/[agentId]/route.js` | DELETE revoke identity |
| `app/settings/components/AgentIdentityPanel.js` | Client component for identity tab |

### Modified Files
| File | Change |
|------|--------|
| `scripts/check-api-boundary.mjs` | Add `pairings` + `identities` to Tier 3 whitelist |
| `app/lib/repositories/settings.repository.js` | Add `ENFORCE_AGENT_SIGNATURES` to `VALID_SETTING_KEYS` |
| `app/api/actions/route.js` | Read enforcement from DB setting, fall back to env var |
| `app/settings/page.js` | Add identity tab definition + conditional render |
| `app/pair/[pairingId]/page.js` | Replace with redirect to settings |

### Deleted Files
| File | Reason |
|------|--------|
| `app/pairings/page.js` | Replaced by settings tab |
| `app/pair/[pairingId]/pairApprovalClient.js` | Replaced by settings tab |

---

## Task 1: Create Pairings Repository

**Files:**
- Create: `app/lib/repositories/pairings.repository.js`

- [ ] **Step 1: Create pairings repository with ensureTable and all CRUD functions**

```javascript
// app/lib/repositories/pairings.repository.js
let _tableChecked = false;

async function ensureTable(sql) {
  if (_tableChecked) return;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_pairings (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT,
      public_key TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'RSASSA-PKCS1-v1_5',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_pairings_org_status ON agent_pairings (org_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_agent_pairings_org_agent ON agent_pairings (org_id, agent_id)`;
  _tableChecked = true;
}

export async function createPairing(sql, { orgId, id, agentId, agentName, publicKey, algorithm, expiresAt }) {
  await ensureTable(sql);
  return sql`
    INSERT INTO agent_pairings (id, org_id, agent_id, agent_name, public_key, algorithm, status, expires_at)
    VALUES (${id}, ${orgId}, ${agentId}, ${agentName}, ${publicKey}, ${algorithm}, 'pending', ${expiresAt})
    RETURNING id, agent_id, agent_name, algorithm, status, created_at, expires_at
  `;
}

export async function listPairings(sql, orgId, status = 'pending', limit = 50) {
  await ensureTable(sql);
  return sql`
    SELECT id, agent_id, agent_name, algorithm, status, created_at, updated_at, expires_at
    FROM agent_pairings
    WHERE org_id = ${orgId} AND status = ${status}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getPairing(sql, orgId, pairingId) {
  await ensureTable(sql);
  return sql`
    SELECT id, agent_id, agent_name, public_key, algorithm, status, created_at, updated_at, expires_at
    FROM agent_pairings
    WHERE org_id = ${orgId} AND id = ${pairingId}
    LIMIT 1
  `;
}

export async function expirePairing(sql, orgId, pairingId) {
  await ensureTable(sql);
  return sql`
    UPDATE agent_pairings
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE org_id = ${orgId} AND id = ${pairingId}
  `;
}

export async function approvePairing(sql, orgId, pairingId) {
  await ensureTable(sql);
  return sql`
    UPDATE agent_pairings
    SET status = 'approved', updated_at = CURRENT_TIMESTAMP
    WHERE org_id = ${orgId} AND id = ${pairingId}
  `;
}

export async function expirePendingByAgent(sql, orgId, agentId) {
  await ensureTable(sql);
  return sql`
    UPDATE agent_pairings
    SET status = 'expired', updated_at = CURRENT_TIMESTAMP
    WHERE org_id = ${orgId} AND agent_id = ${agentId} AND status = 'pending'
  `;
}
```

- [ ] **Step 2: Verify file was created correctly**

Run: `node -e "import('./app/lib/repositories/pairings.repository.js').then(m => console.log(Object.keys(m)))"`
Expected: Array listing exported function names

- [ ] **Step 3: Commit**

```bash
git add app/lib/repositories/pairings.repository.js
git commit -m "feat: add pairings repository (extracted from archived routes)"
```

---

## Task 2: Create Identities Repository

**Files:**
- Create: `app/lib/repositories/identities.repository.js`

- [ ] **Step 1: Create identities repository with ensureTable and all CRUD functions**

```javascript
// app/lib/repositories/identities.repository.js
let _tableChecked = false;

async function ensureTable(sql) {
  if (_tableChecked) return;
  await sql`
    CREATE TABLE IF NOT EXISTS agent_identities (
      org_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      algorithm TEXT NOT NULL DEFAULT 'RSASSA-PKCS1-v1_5',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (org_id, agent_id)
    )
  `;
  _tableChecked = true;
}

export async function upsertIdentity(sql, { orgId, agentId, publicKey, algorithm }) {
  await ensureTable(sql);
  return sql`
    INSERT INTO agent_identities (org_id, agent_id, public_key, algorithm)
    VALUES (${orgId}, ${agentId}, ${publicKey}, ${algorithm || 'RSASSA-PKCS1-v1_5'})
    ON CONFLICT (org_id, agent_id) DO UPDATE
    SET public_key = EXCLUDED.public_key,
        algorithm = EXCLUDED.algorithm,
        updated_at = CURRENT_TIMESTAMP
    RETURNING agent_id, algorithm, created_at, updated_at
  `;
}

export async function listIdentities(sql, orgId) {
  await ensureTable(sql);
  return sql`
    SELECT agent_id, algorithm, created_at, updated_at
    FROM agent_identities
    WHERE org_id = ${orgId}
    ORDER BY agent_id ASC
  `;
}

export async function deleteIdentity(sql, orgId, agentId) {
  await ensureTable(sql);
  return sql`
    DELETE FROM agent_identities
    WHERE org_id = ${orgId} AND agent_id = ${agentId}
    RETURNING agent_id
  `;
}

export async function getIdentity(sql, orgId, agentId) {
  await ensureTable(sql);
  return sql`
    SELECT public_key, algorithm
    FROM agent_identities
    WHERE org_id = ${orgId} AND agent_id = ${agentId}
    LIMIT 1
  `;
}
```

- [ ] **Step 2: Verify file was created correctly**

Run: `node -e "import('./app/lib/repositories/identities.repository.js').then(m => console.log(Object.keys(m)))"`
Expected: Array listing exported function names

- [ ] **Step 3: Commit**

```bash
git add app/lib/repositories/identities.repository.js
git commit -m "feat: add identities repository with ensureTable and revoke support"
```

---

## Task 3: Update Governance Boundary Whitelist

**Files:**
- Modify: `scripts/check-api-boundary.mjs`

- [ ] **Step 1: Add `pairings` and `identities` to the Tier 3 Infrastructure section**

In `scripts/check-api-boundary.mjs`, add to the `ALLOWED_RUNTIME_ROUTES` Set, in the Tier 3 section alongside other infrastructure routes like `auth`, `keys`, `settings`:

```javascript
// Tier 3: Essential Infrastructure
'pairings',      // Agent identity pairing enrollment
'identities',    // Approved agent identity management
```

- [ ] **Step 2: Verify boundary check passes**

Run: `npm run governance:boundary:check`
Expected: Exit 0, no violations (pairings and identities routes don't exist yet, but the whitelist is ready)

- [ ] **Step 3: Commit**

```bash
git add scripts/check-api-boundary.mjs
git commit -m "feat: add pairings and identities to governance boundary whitelist (Tier 3)"
```

---

## Task 4: Restore Pairings API Routes

**Files:**
- Create: `app/api/pairings/route.js`
- Create: `app/api/pairings/[pairingId]/route.js`
- Create: `app/api/pairings/[pairingId]/approve/route.js`

- [ ] **Step 1: Create `app/api/pairings/route.js` (POST + GET)**

Restore from `app/api/_archive/pairings/route.js` but replace inline SQL with repository calls:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId, getOrgRole } from '../../lib/org.js';
import { createPairing, listPairings } from '../../lib/repositories/pairings.repository.js';

function isPemPublicKey(s) {
  return typeof s === 'string' && s.includes('BEGIN PUBLIC KEY') && s.includes('END PUBLIC KEY');
}

export async function POST(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();
    const agent_id = body.agent_id;
    const agent_name = body.agent_name || null;
    const public_key = body.public_key;
    const algorithm = body.algorithm || 'RSASSA-PKCS1-v1_5';

    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }
    if (!public_key || !isPemPublicKey(public_key)) {
      return NextResponse.json({ error: 'public_key must be a PEM public key' }, { status: 400 });
    }

    const id = `pair_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const rows = await createPairing(sql, {
      orgId, id, agentId: agent_id, agentName: agent_name,
      publicKey: public_key, algorithm, expiresAt,
    });

    const u = new URL(request.url);
    u.pathname = `/pair/${id}`;
    u.search = '';

    return NextResponse.json({ pairing: rows[0], pairing_url: u.toString() });
  } catch (error) {
    console.error('Pairing create error:', error);
    return NextResponse.json({ error: 'Failed to create pairing' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const rows = await listPairings(sql, orgId, status, limit);
    return NextResponse.json({ pairings: rows });
  } catch (error) {
    console.error('Pairings list error:', error);
    return NextResponse.json({ error: 'Failed to list pairings' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/pairings/[pairingId]/route.js` (GET with soft-expiry)**

Restore from archive with `await params` fix and repository calls:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getPairing, expirePairing } from '../../../lib/repositories/pairings.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { pairingId } = await params;

    const rows = await getPairing(sql, orgId, pairingId);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Pairing not found' }, { status: 404 });
    }

    const pairing = rows[0];
    const expired = pairing.expires_at ? new Date(pairing.expires_at).getTime() < Date.now() : false;

    if (expired && pairing.status === 'pending') {
      await expirePairing(sql, orgId, pairingId);
      pairing.status = 'expired';
    }

    // Strip public_key from response — non-admin callers don't need it
    const { public_key: _pk, ...safePairing } = pairing;
    return NextResponse.json({ pairing: safePairing });
  } catch (error) {
    console.error('Pairing fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch pairing' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/pairings/[pairingId]/approve/route.js` (POST)**

Restore from archive with repository calls:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId, getOrgRole } from '../../../../lib/org.js';
import { getPairing, expirePairing, approvePairing } from '../../../../lib/repositories/pairings.repository.js';
import { upsertIdentity } from '../../../../lib/repositories/identities.repository.js';

export async function POST(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { pairingId } = await params;

    const rows = await getPairing(sql, orgId, pairingId);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Pairing not found' }, { status: 404 });
    }

    const pairing = rows[0];
    const expired = pairing.expires_at ? new Date(pairing.expires_at).getTime() < Date.now() : false;
    if (expired) {
      await expirePairing(sql, orgId, pairingId);
      return NextResponse.json({ error: 'Pairing expired' }, { status: 410 });
    }

    if (pairing.status !== 'pending') {
      return NextResponse.json({ error: `Pairing is not pending (status=${pairing.status})` }, { status: 409 });
    }

    const identityRows = await upsertIdentity(sql, {
      orgId,
      agentId: pairing.agent_id,
      publicKey: pairing.public_key,
      algorithm: pairing.algorithm || 'RSASSA-PKCS1-v1_5',
    });

    await approvePairing(sql, orgId, pairingId);

    return NextResponse.json({ identity: identityRows[0] });
  } catch (error) {
    console.error('Pairing approve error:', error);
    return NextResponse.json({ error: 'Failed to approve pairing' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run governance boundary check**

Run: `npm run governance:boundary:check`
Expected: Exit 0, `pairings` route is now present and whitelisted

- [ ] **Step 5: Commit**

```bash
git add app/api/pairings/
git commit -m "feat: restore pairings API routes (POST/GET/approve) with repository pattern"
```

---

## Task 5: Restore Identities API Routes + New DELETE

**Files:**
- Create: `app/api/identities/route.js`
- Create: `app/api/identities/[agentId]/route.js`

- [ ] **Step 1: Create `app/api/identities/route.js` (POST + GET)**

Restore from archive with repository calls and admin check on GET:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId, getOrgRole } from '../../lib/org.js';
import { upsertIdentity, listIdentities } from '../../lib/repositories/identities.repository.js';

function isPemPublicKey(s) {
  return typeof s === 'string' && s.includes('BEGIN PUBLIC KEY') && s.includes('END PUBLIC KEY');
}

export async function POST(request) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { agent_id, public_key, algorithm } = body;

    if (!agent_id || !public_key) {
      return NextResponse.json({ error: 'agent_id and public_key are required' }, { status: 400 });
    }
    if (!isPemPublicKey(public_key)) {
      return NextResponse.json({ error: 'public_key must be a PEM public key' }, { status: 400 });
    }

    const sql = getSql();
    const result = await upsertIdentity(sql, { orgId, agentId: agent_id, publicKey: public_key, algorithm });
    return NextResponse.json({ identity: result[0] });
  } catch (error) {
    console.error('Identity registration error:', error);
    return NextResponse.json({ error: 'Failed to register identity' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const sql = getSql();
    const identities = await listIdentities(sql, orgId);
    return NextResponse.json({ identities });
  } catch (error) {
    console.error('Identity fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch identities' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/identities/[agentId]/route.js` (DELETE)**

New endpoint for revoking agent identity:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId, getOrgRole } from '../../../lib/org.js';
import { deleteIdentity } from '../../../lib/repositories/identities.repository.js';
import { expirePendingByAgent } from '../../../lib/repositories/pairings.repository.js';

export async function DELETE(request, { params }) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { agentId } = await params;
    const sql = getSql();

    const deleted = await deleteIdentity(sql, orgId, agentId);
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Expire any pending pairings for this agent
    await expirePendingByAgent(sql, orgId, agentId);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Identity revoke error:', error);
    return NextResponse.json({ error: 'Failed to revoke identity' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run governance boundary check**

Run: `npm run governance:boundary:check`
Expected: Exit 0, `identities` route is now present and whitelisted

- [ ] **Step 4: Commit**

```bash
git add app/api/identities/
git commit -m "feat: restore identities API routes (POST/GET) + new DELETE for revocation"
```

---

## Task 6: Add ENFORCE_AGENT_SIGNATURES to Settings + Update Actions Route

**Files:**
- Modify: `app/lib/repositories/settings.repository.js` — add key to `VALID_SETTING_KEYS`
- Modify: `app/api/actions/route.js` — read enforcement from DB, fall back to env var

- [ ] **Step 1: Add `ENFORCE_AGENT_SIGNATURES` to VALID_SETTING_KEYS**

In `app/lib/repositories/settings.repository.js`, add to the `VALID_SETTING_KEYS` array (in the appropriate section, near system/security keys):

```javascript
'ENFORCE_AGENT_SIGNATURES',
```

- [ ] **Step 2: Update actions route to read enforcement from DB setting**

In `app/api/actions/route.js`, find the line:

```javascript
const enforceSignatures = process.env.ENFORCE_AGENT_SIGNATURES === 'true';
```

First, update the import from `settings.repository.js` to include `getSettings` (currently only `getModelPricing` is imported):

```javascript
import { getModelPricing, getSettings } from '../../lib/repositories/settings.repository.js';
```

Then replace the enforcement check with:

```javascript
// Check DB setting first (runtime-toggleable), fall back to env var
let enforceSignatures = process.env.ENFORCE_AGENT_SIGNATURES === 'true';
try {
  const enforcementSettings = await getSettings(sql, orgId, { key: 'ENFORCE_AGENT_SIGNATURES' });
  if (enforcementSettings.length > 0) {
    enforceSignatures = enforcementSettings[0].value === 'true';
  }
} catch { /* table may not exist yet — use env var fallback */ }
```

Note: When called with a `key` filter and no `agentId`, `getSettings` takes the simple org-level path. The try/catch handles fresh instances where the settings table doesn't exist yet.

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add app/lib/repositories/settings.repository.js app/api/actions/route.js
git commit -m "feat: make ENFORCE_AGENT_SIGNATURES runtime-toggleable via settings"
```

---

## Task 7: Create AgentIdentityPanel Component

**Files:**
- Create: `app/settings/components/AgentIdentityPanel.js`

This is the main UI component. It follows the `ModelPricingPanel.js` pattern (client component, self-fetching data, POST to settings API).

- [ ] **Step 1: Create the AgentIdentityPanel client component**

```javascript
// app/settings/components/AgentIdentityPanel.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Trash2, ShieldCheck, ShieldOff, Plus, X } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeUntil(dateStr) {
  if (!dateStr) return '';
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.ceil(ms / 60000);
  return `${mins}m remaining`;
}

export default function AgentIdentityPanel({ highlightPairingId }) {
  const [enforcement, setEnforcement] = useState(false);
  const [enforcementLoading, setEnforcementLoading] = useState(true);
  const [pairings, setPairings] = useState([]);
  const [pairingsLoading, setPairingsLoading] = useState(true);
  const [identities, setIdentities] = useState([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerAgentId, setRegisterAgentId] = useState('');
  const [registerPublicKey, setRegisterPublicKey] = useState('');
  const [registering, setRegistering] = useState(false);

  // ── Fetch enforcement setting ──
  const fetchEnforcement = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?key=ENFORCE_AGENT_SIGNATURES');
      const data = await res.json();
      if (res.ok && data.settings?.length > 0) {
        setEnforcement(data.settings[0].value === 'true');
      }
    } catch { /* default false */ }
    finally { setEnforcementLoading(false); }
  }, []);

  const toggleEnforcement = async () => {
    const next = !enforcement;
    setEnforcement(next);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ENFORCE_AGENT_SIGNATURES', value: String(next), category: 'system' }),
      });
      if (!res.ok) {
        setEnforcement(!next);
        const data = await res.json();
        setError(data.error || 'Failed to update enforcement setting');
      }
    } catch {
      setEnforcement(!next);
      setError('Failed to update enforcement setting');
    }
  };

  // ── Fetch pending pairings ──
  const fetchPairings = useCallback(async () => {
    setPairingsLoading(true);
    try {
      const res = await fetch('/api/pairings?status=pending&limit=200');
      const data = await res.json();
      if (res.ok) setPairings(data.pairings || []);
      else setError(data.error || 'Failed to load pairings');
    } catch { setError('Failed to load pairings'); }
    finally { setPairingsLoading(false); }
  }, []);

  const approveOne = async (id, { skipRefresh = false } = {}) => {
    setError(null);
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to approve ${id}`);
        return;
      }
      if (!skipRefresh) {
        await fetchPairings();
        await fetchIdentities();
      }
    } catch { setError(`Failed to approve pairing`); }
  };

  const approveAll = async () => {
    setError(null);
    for (const p of pairings) {
      await approveOne(p.id, { skipRefresh: true });
    }
    await fetchPairings();
    await fetchIdentities();
  };

  // ── Fetch identities ──
  const fetchIdentities = useCallback(async () => {
    setIdentitiesLoading(true);
    try {
      const res = await fetch('/api/identities');
      const data = await res.json();
      if (res.ok) setIdentities(data.identities || []);
      else setError(data.error || 'Failed to load identities');
    } catch { setError('Failed to load identities'); }
    finally { setIdentitiesLoading(false); }
  }, []);

  const revokeIdentity = async (agentId) => {
    setError(null);
    try {
      const res = await fetch(`/api/identities/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to revoke identity');
        return;
      }
      await fetchIdentities();
      await fetchPairings();
    } catch { setError('Failed to revoke identity'); }
  };

  const registerIdentity = async () => {
    if (!registerAgentId || !registerPublicKey) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: registerAgentId, public_key: registerPublicKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register identity');
        return;
      }
      setRegisterAgentId('');
      setRegisterPublicKey('');
      setShowRegisterForm(false);
      await fetchIdentities();
    } catch { setError('Failed to register identity'); }
    finally { setRegistering(false); }
  };

  // ── Initial load ──
  useEffect(() => {
    fetchEnforcement();
    fetchPairings();
    fetchIdentities();
  }, [fetchEnforcement, fetchPairings, fetchIdentities]);

  // ── Scroll to highlighted pairing ──
  useEffect(() => {
    if (highlightPairingId && !pairingsLoading) {
      const el = document.getElementById(`pairing-${highlightPairingId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand/50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-brand/50'), 3000);
      }
    }
  }, [highlightPairingId, pairingsLoading]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}

      {/* ── Signature Enforcement ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enforcement ? <ShieldCheck size={20} className="text-emerald-400" /> : <ShieldOff size={20} className="text-zinc-500" />}
            <div>
              <div className="text-sm font-medium text-white">Signature Enforcement</div>
              <div className="text-xs text-zinc-500 mt-0.5">When enabled, actions without valid signatures are rejected (401)</div>
            </div>
          </div>
          <button
            onClick={toggleEnforcement}
            disabled={enforcementLoading}
            className={`relative w-11 h-6 rounded-full transition-colors ${enforcement ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enforcement ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Pending Pairings ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">Pending Pairings</div>
          {pairings.length > 0 && (
            <button
              onClick={approveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
            >
              <CheckCircle2 size={14} />
              Approve All ({pairings.length})
            </button>
          )}
        </div>
        {pairingsLoading ? (
          <div className="text-sm text-zinc-500 py-6 text-center">Loading…</div>
        ) : pairings.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No pending pairing requests</div>
        ) : (
          <div className="space-y-2">
            {pairings.map((p) => (
              <div
                key={p.id}
                id={`pairing-${p.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] transition-all"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{p.agent_id}</span>
                    {p.agent_name && <span className="text-xs text-zinc-500">({p.agent_name})</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {timeUntil(p.expires_at)} · <span className="font-mono">{p.algorithm || 'RSASSA-PKCS1-v1_5'}</span>
                  </div>
                </div>
                <button
                  onClick={() => approveOne(p.id)}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-brand hover:bg-brand/90 transition-colors"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Approved Identities ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">Approved Identities</div>
          <button
            onClick={() => setShowRegisterForm(!showRegisterForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] rounded-lg transition-colors"
          >
            {showRegisterForm ? <X size={14} /> : <Plus size={14} />}
            {showRegisterForm ? 'Cancel' : 'Register Manually'}
          </button>
        </div>

        {showRegisterForm && (
          <div className="mb-4 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Agent ID</label>
              <input
                type="text"
                value={registerAgentId}
                onChange={(e) => setRegisterAgentId(e.target.value)}
                placeholder="my-agent"
                className="w-full px-3 py-2 text-sm bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Public Key (PEM)</label>
              <textarea
                value={registerPublicKey}
                onChange={(e) => setRegisterPublicKey(e.target.value)}
                placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                rows={4}
                className="w-full px-3 py-2 text-sm font-mono bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-brand/50"
              />
            </div>
            <button
              onClick={registerIdentity}
              disabled={registering || !registerAgentId || !registerPublicKey}
              className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 disabled:opacity-60 rounded-lg transition-colors"
            >
              {registering ? 'Registering…' : 'Register'}
            </button>
          </div>
        )}

        {identitiesLoading ? (
          <div className="text-sm text-zinc-500 py-6 text-center">Loading…</div>
        ) : identities.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No agents enrolled. Share a pairing URL or register directly.</div>
        ) : (
          <div className="space-y-2">
            {identities.map((id) => (
              <div
                key={id.agent_id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white font-mono">{id.agent_id}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    <span className="font-mono">{id.algorithm || 'RSASSA-PKCS1-v1_5'}</span> · Enrolled {formatDate(id.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => revokeIdentity(id.agent_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add app/settings/components/AgentIdentityPanel.js
git commit -m "feat: add AgentIdentityPanel component for settings identity tab"
```

---

## Task 8: Add Identity Tab to Settings Page

**Files:**
- Modify: `app/settings/page.js`

- [ ] **Step 1: Add import for AgentIdentityPanel**

At the top of `app/settings/page.js`, add the import alongside other component imports:

```javascript
import AgentIdentityPanel from './components/AgentIdentityPanel';
```

- [ ] **Step 2: Add identity tab to the tabs array**

Find the tabs definition (around line 73):

```javascript
const tabs = [
  { key: 'setup', label: 'Setup & Verify', href: '/settings' },
  { key: 'pricing', label: 'Model Pricing', href: '/settings?tab=pricing' },
];
```

Add the identity tab:

```javascript
const tabs = [
  { key: 'setup', label: 'Setup & Verify', href: '/settings' },
  { key: 'pricing', label: 'Model Pricing', href: '/settings?tab=pricing' },
  { key: 'identity', label: 'Agent Identity', href: '/settings?tab=identity' },
];
```

- [ ] **Step 3: Add identity tab content block**

After the `{tab === 'pricing' && ...}` block, add:

```javascript
{tab === 'identity' && (
  <AgentIdentityPanel highlightPairingId={resolvedSearchParams?.pairing || null} />
)}
```

- [ ] **Step 4: Update page subtitle**

Find the subtitle prop on PageLayout and update to:

```javascript
subtitle="Instance configuration, verification, model pricing, and agent identity."
```

- [ ] **Step 5: Verify dev server renders the tab**

Run: `npm run dev` (if not already running)
Visit: `http://localhost:3000/settings?tab=identity`
Expected: Tab bar shows three tabs, identity tab renders the three sections

- [ ] **Step 6: Commit**

```bash
git add app/settings/page.js
git commit -m "feat: add Agent Identity tab to settings page"
```

---

## Task 9: Update Pair Page to Redirect + Clean Up Standalone Pages

**Files:**
- Modify: `app/pair/[pairingId]/page.js` — replace with redirect
- Delete: `app/pairings/page.js`
- Delete: `app/pair/[pairingId]/pairApprovalClient.js`

- [ ] **Step 1: Replace pair page with redirect**

Overwrite `app/pair/[pairingId]/page.js` with:

```javascript
import { redirect } from 'next/navigation';

export default async function PairRedirectPage({ params }) {
  const { pairingId } = await params;
  redirect(`/settings?tab=identity&pairing=${encodeURIComponent(pairingId)}`);
}
```

- [ ] **Step 2: Delete standalone pages**

```bash
rm app/pairings/page.js
rm app/pair/[pairingId]/pairApprovalClient.js
```

Verify `app/pairings/` directory is now empty (or remove it if so):

```bash
rmdir app/pairings 2>/dev/null || true
```

- [ ] **Step 3: Verify redirect works**

Visit: `http://localhost:3000/pair/test-id`
Expected: Redirects to `/settings?tab=identity&pairing=test-id`

- [ ] **Step 4: Commit**

```bash
git add -A app/pair/ app/pairings/
git commit -m "feat: redirect /pair/[id] to settings identity tab, remove standalone pages"
```

---

## Task 10: Run Full Verification

- [ ] **Step 1: Run governance boundary check**

Run: `npm run governance:boundary:check`
Expected: Exit 0

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run dev server and manually verify**

1. Visit `/settings?tab=identity` — three sections render (enforcement toggle, pending pairings, identities)
2. Visit `/pair/some-id` — redirects to `/settings?tab=identity&pairing=some-id`
3. Toggle enforcement switch — setting persists on page reload
4. Click "Register Manually" — form appears, can enter agent_id + PEM key

- [ ] **Step 4: Run OpenAPI and API inventory checks**

```bash
npm run openapi:generate
npm run api:inventory:generate
npm run openapi:check
npm run api:inventory:check
```

- [ ] **Step 5: Commit any generated file updates**

```bash
git add docs/openapi/ docs/api-inventory.*
git commit -m "docs: update OpenAPI spec and API inventory for pairings + identities routes"
```

---

## Task 11: Documentation Updates

Per the SDK documentation checklist, all new API routes require updates across 7 surfaces. This task covers the documentation pass.

**Files:**
- Modify: `docs/api-inventory.md` — add pairings + identities routes (auto-generated in Task 10)
- Modify: `PROJECT_DETAILS.md` — add routes to canonical route list
- Modify: `docs/sdk-parity.md` — update route counts
- Modify: `app/docs/page.js` — add method entries for new endpoints
- Modify: `sdk/README.md` — document pairing/identity methods
- Modify: `sdk-python/README.md` — document pairing/identity methods
- Modify: `docs/dashclaw website in markdown.md` — update website content snapshot

- [ ] **Step 1: Update PROJECT_DETAILS.md**

Add `pairings` and `identities` to the route list in the Tier 3 Infrastructure section.

- [ ] **Step 2: Update sdk-parity.md**

Add pairing and identity methods to the parity matrix. Note that these methods exist in the legacy SDK (`sdk/legacy/dashclaw-v1.js`) but may need to be added to the v2 SDK surface.

- [ ] **Step 3: Update app/docs/page.js**

Add navItems entries and MethodEntry components for:
- `POST /api/pairings` — Create pairing request
- `GET /api/pairings` — List pairings (admin)
- `GET /api/pairings/:id` — Get pairing
- `POST /api/pairings/:id/approve` — Approve pairing (admin)
- `POST /api/identities` — Register identity (admin)
- `GET /api/identities` — List identities (admin)
- `DELETE /api/identities/:agentId` — Revoke identity (admin)

- [ ] **Step 4: Update sdk/README.md and sdk-python/README.md**

Add documentation for pairing and identity SDK methods with request/response examples.

- [ ] **Step 5: Update docs/dashclaw website in markdown.md**

Update the website content snapshot to reflect the new endpoints.

- [ ] **Step 6: Run docs check**

Run: `npm run docs:check`
Expected: Pass

- [ ] **Step 7: Commit**

```bash
git add PROJECT_DETAILS.md docs/ app/docs/page.js sdk/README.md sdk-python/README.md
git commit -m "docs: add pairings and identities endpoints to all documentation surfaces"
```
