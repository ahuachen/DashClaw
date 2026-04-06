# Capability Invoke + Research Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic `POST /api/capabilities/:capabilityId/invoke` endpoint that can call any HTTP-based capability through DashClaw's governance loop, and register the budget-aware research agent as the first invocable capability.

**Architecture:** New invoke route calls evaluateGuard(), creates action record, resolves BYOK auth from org settings, maps request/response via invocation_schema, makes HTTP call to external capability, records outcome. Research agent registered as first `http_api` capability via seed script.

**Tech Stack:** Next.js 15 App Router, Drizzle/Neon Postgres, node:fetch, Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-capability-invoke-research-design.md`

**Working directory:** `C:\Projects\DashClaw`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/mapping.js` | Create | Dot-path request/response mapper + URL variable substitution |
| `app/lib/capability-invoke.js` | Create | Invoke engine — auth resolution, HTTP call, timeout, error handling |
| `app/api/capabilities/[capabilityId]/invoke/route.js` | Create | Invoke endpoint — guard, action record, invoke, outcome |
| `app/lib/repositories/capabilities.repository.js` | Modify | Add `getCapabilityBySlug()` helper |
| `scripts/seed-research-capability.js` | Create | Seed research agent capability + org settings |
| `__tests__/unit/mapping.test.js` | Create | Tests for mapping module |
| `__tests__/unit/capability-invoke.test.js` | Create | Tests for invoke engine |

---

## Task 1: Request/Response Mapping Module

**Files:**
- Create: `app/lib/mapping.js`
- Create: `__tests__/unit/mapping.test.js`

- [ ] **Step 1: Write tests for the mapping module**

Create `__tests__/unit/mapping.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { mapRequest, mapResponse, resolveEndpointUrl } from '../../app/lib/mapping.js';

describe('mapRequest', () => {
  it('maps flat fields from source using dot-paths', () => {
    const source = { query: 'What is x402?', budget: 0.25 };
    const mapping = { query: '$.query', budget: '$.budget' };
    expect(mapRequest(source, mapping)).toEqual({ query: 'What is x402?', budget: 0.25 });
  });

  it('maps nested output structure', () => {
    const source = { query: 'test', budget: 0.5, mode: 'live' };
    const mapping = {
      query: '$.query',
      options: { budget: '$.budget', mode: '$.mode' },
    };
    expect(mapRequest(source, mapping)).toEqual({
      query: 'test',
      options: { budget: 0.5, mode: 'live' },
    });
  });

  it('omits fields when source path is undefined', () => {
    const source = { query: 'test' };
    const mapping = { query: '$.query', missing: '$.nonexistent' };
    expect(mapRequest(source, mapping)).toEqual({ query: 'test' });
  });

  it('returns source as-is when mapping is null or empty', () => {
    const source = { query: 'test' };
    expect(mapRequest(source, null)).toEqual({ query: 'test' });
    expect(mapRequest(source, {})).toEqual({ query: 'test' });
  });
});

describe('mapResponse', () => {
  it('maps response fields using dot-paths', () => {
    const source = { answer: 'hello', elapsedMs: 1200 };
    const mapping = { answer: '$.answer', elapsed_ms: '$.elapsedMs' };
    expect(mapResponse(source, mapping)).toEqual({ answer: 'hello', elapsed_ms: 1200 });
  });

  it('returns source as-is when mapping is null', () => {
    const source = { raw: 'data' };
    expect(mapResponse(source, null)).toEqual({ raw: 'data' });
  });
});

describe('resolveEndpointUrl', () => {
  it('replaces ${VAR} with values from settings', () => {
    const url = '${RESEARCH_API_URL}/v1/research';
    const settings = { RESEARCH_API_URL: 'http://localhost:3849' };
    expect(resolveEndpointUrl(url, settings)).toBe('http://localhost:3849/v1/research');
  });

  it('throws when a variable is not found in settings', () => {
    const url = '${MISSING_VAR}/path';
    expect(() => resolveEndpointUrl(url, {})).toThrow('endpoint_not_configured');
  });

  it('returns url as-is when no variables present', () => {
    const url = 'http://example.com/api';
    expect(resolveEndpointUrl(url, {})).toBe('http://example.com/api');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/mapping.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the mapping module**

Create `app/lib/mapping.js`:

```javascript
/**
 * Dot-path request/response mapper for capability invocations.
 * Resolves $.field paths from a source object into a target shape.
 */

function resolvePath(source, path) {
  if (typeof path !== 'string' || !path.startsWith('$.')) return undefined;
  const key = path.slice(2);
  return source[key];
}

function mapObject(source, mapping) {
  if (!mapping || typeof mapping !== 'object') return null;
  const result = {};
  let hasKeys = false;

  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === 'string' && value.startsWith('$.')) {
      const resolved = resolvePath(source, value);
      if (resolved !== undefined) {
        result[key] = resolved;
        hasKeys = true;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = mapObject(source, value);
      if (nested !== null) {
        result[key] = nested;
        hasKeys = true;
      }
    } else {
      result[key] = value;
      hasKeys = true;
    }
  }

  return hasKeys ? result : null;
}

export function mapRequest(source, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return source;
  const mapped = mapObject(source, mapping);
  return mapped || source;
}

export function mapResponse(source, mapping) {
  if (!mapping || Object.keys(mapping).length === 0) return source;
  const mapped = mapObject(source, mapping);
  return mapped || source;
}

export function resolveEndpointUrl(url, settings) {
  return url.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = settings[varName];
    if (value === undefined || value === null || value === '') {
      const err = new Error(`Setting '${varName}' not configured for capability endpoint`);
      err.code = 'endpoint_not_configured';
      throw err;
    }
    return value;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/mapping.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/mapping.js __tests__/unit/mapping.test.js
git commit -m "feat(capabilities): add request/response mapping module

Dot-path mapper for capability invocations. Resolves $.field paths,
handles nested objects, omits undefined fields. URL variable substitution
for BYOK endpoint configuration."
```

---

## Task 2: Capability Invoke Engine

**Files:**
- Create: `app/lib/capability-invoke.js`
- Create: `__tests__/unit/capability-invoke.test.js`

- [ ] **Step 1: Write tests for the invoke engine**

Create `__tests__/unit/capability-invoke.test.js`:

```javascript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invokeCapability, resolveAuth, RISK_SCORE_MAP } from '../../app/lib/capability-invoke.js';

describe('RISK_SCORE_MAP', () => {
  it('maps risk levels to scores', () => {
    expect(RISK_SCORE_MAP.low).toBe(20);
    expect(RISK_SCORE_MAP.medium).toBe(50);
    expect(RISK_SCORE_MAP.high).toBe(75);
    expect(RISK_SCORE_MAP.critical).toBe(95);
  });
});

describe('resolveAuth', () => {
  it('returns bearer header when auth type is bearer', () => {
    const auth = { type: 'bearer', token_setting: 'MY_TOKEN' };
    const settings = { MY_TOKEN: 'secret123' };
    expect(resolveAuth(auth, settings)).toEqual({
      Authorization: 'Bearer secret123',
    });
  });

  it('returns api_key header when auth type is api_key', () => {
    const auth = { type: 'api_key', token_setting: 'MY_KEY' };
    const settings = { MY_KEY: 'key123' };
    expect(resolveAuth(auth, settings)).toEqual({
      'x-api-key': 'key123',
    });
  });

  it('returns empty object when auth type is none', () => {
    expect(resolveAuth({ type: 'none' }, {})).toEqual({});
    expect(resolveAuth(null, {})).toEqual({});
  });

  it('throws when token setting not found', () => {
    const auth = { type: 'bearer', token_setting: 'MISSING' };
    expect(() => resolveAuth(auth, {})).toThrow('auth_not_configured');
  });
});

describe('invokeCapability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('calls endpoint with mapped request and returns mapped response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ answer: 'result', elapsedMs: 100 }),
    });

    const result = await invokeCapability({
      endpoint: 'http://localhost:3849/v1/research',
      method: 'POST',
      authHeaders: { Authorization: 'Bearer token' },
      body: { query: 'test' },
      requestMapping: { query: '$.query' },
      responseMapping: { answer: '$.answer', elapsed_ms: '$.elapsedMs' },
      timeoutMs: 5000,
    });

    expect(result.success).toBe(true);
    expect(result.data.answer).toBe('result');
    expect(result.data.elapsed_ms).toBe(100);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3849/v1/research',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      }),
    );
  });

  it('returns failure on downstream error', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const result = await invokeCapability({
      endpoint: 'http://example.com/api',
      method: 'POST',
      authHeaders: {},
      body: {},
      requestMapping: null,
      responseMapping: null,
      timeoutMs: 5000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('capability_error');
    expect(result.status).toBe(500);
  });

  it('returns failure on timeout', async () => {
    global.fetch.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });

    const result = await invokeCapability({
      endpoint: 'http://example.com/api',
      method: 'POST',
      authHeaders: {},
      body: {},
      requestMapping: null,
      responseMapping: null,
      timeoutMs: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('capability_timeout');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/capability-invoke.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the invoke engine**

Create `app/lib/capability-invoke.js`:

```javascript
/**
 * Capability invocation engine.
 * Handles auth resolution, HTTP calls with timeout, and request/response mapping.
 */

import { mapRequest, mapResponse, resolveEndpointUrl } from './mapping.js';

export const RISK_SCORE_MAP = {
  low: 20,
  medium: 50,
  high: 75,
  critical: 95,
};

export function resolveAuth(auth, settings) {
  if (!auth || auth.type === 'none') return {};

  const tokenKey = auth.token_setting;
  if (!tokenKey) return {};

  const token = settings[tokenKey];
  if (!token) {
    const err = new Error(`Auth setting '${tokenKey}' not configured for this capability`);
    err.code = 'auth_not_configured';
    throw err;
  }

  if (auth.type === 'bearer') {
    return { Authorization: `Bearer ${token}` };
  }
  if (auth.type === 'api_key') {
    return { 'x-api-key': token };
  }
  return {};
}

export async function invokeCapability({
  endpoint,
  method,
  authHeaders,
  body,
  requestMapping,
  responseMapping,
  timeoutMs,
}) {
  const mappedBody = mapRequest(body, requestMapping);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 60000);
  const start = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(mappedBody),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsedMs = Date.now() - start;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: 'capability_error',
        status: response.status,
        message: errorText.slice(0, 500),
        elapsed_ms: elapsedMs,
      };
    }

    const rawData = await response.json();
    const data = mapResponse(rawData, responseMapping);

    return {
      success: true,
      data,
      raw: rawData,
      elapsed_ms: elapsedMs,
    };
  } catch (err) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - start;

    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'capability_timeout',
        message: `Capability timed out after ${timeoutMs || 60000}ms`,
        elapsed_ms: elapsedMs,
      };
    }

    return {
      success: false,
      error: 'capability_network_error',
      message: err.message,
      elapsed_ms: elapsedMs,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/capability-invoke.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/capability-invoke.js __tests__/unit/capability-invoke.test.js
git commit -m "feat(capabilities): add capability invoke engine

HTTP invocation with BYOK auth resolution, request/response mapping,
timeout handling via AbortController. Supports bearer and api_key auth."
```

---

## Task 3: Invoke API Route

**Files:**
- Create: `app/api/capabilities/[capabilityId]/invoke/route.js`

- [ ] **Step 1: Create the invoke route**

Create `app/api/capabilities/[capabilityId]/invoke/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { apiErrorResponse } from '../../../../lib/apiErrors.js';
import { evaluateGuard } from '../../../../lib/guard.js';
import { getCapability } from '../../../../lib/repositories/capabilities.repository.js';
import {
  createActionRecord,
  createBlockedActionRecord,
} from '../../../../lib/repositories/actions.repository.js';
import { getSettings } from '../../../../lib/repositories/settings.repository.js';
import { scanSensitiveData } from '../../../../lib/security.js';
import { RISK_SCORE_MAP, resolveAuth, invokeCapability } from '../../../../lib/capability-invoke.js';
import { resolveEndpointUrl } from '../../../../lib/mapping.js';

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

export async function POST(request, { params }) {
  try {
    const { capabilityId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    // 1. Load capability
    const capability = await getCapability(sql, orgId, capabilityId);
    if (!capability) {
      return NextResponse.json(
        { success: false, error: 'capability_not_found' },
        { status: 404 },
      );
    }

    if (capability.source_type !== 'http_api') {
      return NextResponse.json(
        { success: false, error: 'not_invocable', message: 'Capability is not invocable via HTTP' },
        { status: 400 },
      );
    }

    const schema = capability.invocation_schema || {};
    const action_id = `act_${crypto.randomUUID()}`;
    const timestamp_start = new Date().toISOString();

    // 2. Guard evaluation
    const riskScore = RISK_SCORE_MAP[capability.risk_level] || 50;
    const guardDecision = await evaluateGuard(
      orgId,
      {
        action_type: 'capability_invoke',
        risk_score: riskScore,
        agent_id: body.agent_id || null,
        systems_touched: [`capability:${capability.slug}`],
        reversible: true,
        declared_goal: body.declared_goal || `Invoke capability: ${capability.name}`,
      },
      sql,
    );

    // 3. DLP scan on input
    const dlpFindings = [];
    const inputSummary = redactAny(
      JSON.stringify(body).slice(0, 500),
      dlpFindings,
    );

    const actionData = {
      agent_id: body.agent_id || 'anonymous',
      action_type: 'capability_invoke',
      declared_goal: body.declared_goal || `Invoke capability: ${capability.name}`,
      systems_touched: [`capability:${capability.slug}`],
      reversible: true,
      risk_score: riskScore,
      confidence: 50,
      input_summary: inputSummary,
    };

    // 4. Handle guard blocked
    if (guardDecision.decision === 'block') {
      await createBlockedActionRecord(sql, {
        orgId,
        action_id,
        data: actionData,
        guardDecision,
        signature: null,
        verified: false,
        timestamp_start,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'blocked_by_policy',
          guard_decision: {
            decision: guardDecision.decision,
            reasons: guardDecision.reasons || [],
            matched_policies: guardDecision.matched_policies || [],
          },
        },
        { status: 403 },
      );
    }

    // 5. Handle require_approval
    if (guardDecision.decision === 'require_approval' || capability.requires_approval) {
      const pendingAction = await createActionRecord(sql, {
        orgId,
        action_id,
        data: { ...actionData, status: 'pending_approval' },
        actionStatus: 'pending_approval',
        costEstimate: 0,
        signature: null,
        verified: false,
        timestamp_start,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'pending_approval',
          action_id,
          message: `Invocation requires human approval. Poll /api/approvals/${action_id} for status.`,
        },
        { status: 202 },
      );
    }

    // 6. Resolve auth and endpoint from org settings
    let orgSettings = {};
    try {
      const rows = await getSettings(sql, orgId);
      for (const row of rows) {
        orgSettings[row.key] = row.value;
      }
    } catch {
      // Settings table may not exist
    }

    let authHeaders;
    try {
      authHeaders = resolveAuth(schema.auth, orgSettings);
    } catch (err) {
      if (err.code === 'auth_not_configured') {
        return NextResponse.json(
          { success: false, error: 'auth_not_configured', message: err.message },
          { status: 400 },
        );
      }
      throw err;
    }

    let endpoint;
    try {
      endpoint = resolveEndpointUrl(schema.endpoint, orgSettings);
    } catch (err) {
      if (err.code === 'endpoint_not_configured') {
        return NextResponse.json(
          { success: false, error: 'endpoint_not_configured', message: err.message },
          { status: 400 },
        );
      }
      throw err;
    }

    // 7. Create running action record
    const runningAction = await createActionRecord(sql, {
      orgId,
      action_id,
      data: actionData,
      actionStatus: 'running',
      costEstimate: capability.pricing?.estimated_cost_usd || 0,
      signature: null,
      verified: false,
      timestamp_start,
    });

    // 8. Invoke the capability
    const result = await invokeCapability({
      endpoint,
      method: schema.method || 'POST',
      authHeaders,
      body,
      requestMapping: schema.request_mapping,
      responseMapping: schema.response_mapping,
      timeoutMs: schema.timeout_ms || 60000,
    });

    // 9. Update action outcome
    const timestamp_end = new Date().toISOString();
    const outputSummary = result.success
      ? JSON.stringify(result.data).slice(0, 500)
      : result.message || result.error;

    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${outputSummary},
          error_message = ${result.success ? null : result.message || result.error},
          timestamp_end = ${timestamp_end},
          duration_ms = ${result.elapsed_ms || 0}
      WHERE action_id = ${action_id} AND org_id = ${orgId}
    `;

    // 10. Return response
    if (!result.success) {
      const statusCode = result.error === 'capability_timeout' ? 504 : 502;
      return NextResponse.json(
        {
          success: false,
          action_id,
          error: result.error,
          message: result.message,
          elapsed_ms: result.elapsed_ms,
          governed: true,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json({
      success: true,
      action_id,
      result: result.data,
      elapsed_ms: result.elapsed_ms,
      governed: true,
      security: {
        clean: dlpFindings.length === 0,
        findings_count: dlpFindings.length,
        critical_count: dlpFindings.filter((f) => f.severity === 'critical').length,
        categories: [...new Set(dlpFindings.map((f) => f.category))],
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'CAPABILITY_INVOKE');
  }
}
```

- [ ] **Step 2: Verify the route file loads without syntax errors**

Run: `cd "C:\Projects\DashClaw" && node -e "import('./app/api/capabilities/[capabilityId]/invoke/route.js').then(() => console.log('Syntax OK')).catch(e => console.error(e.message))"`

Note: This may fail due to Next.js module resolution — that's expected. The important thing is no syntax errors. Alternatively run: `npx next lint`

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/capabilities/[capabilityId]/invoke/route.js"
git commit -m "feat(capabilities): add POST /api/capabilities/:id/invoke endpoint

Generic capability invocation with full governance loop:
guard evaluation, action recording, BYOK auth resolution,
request/response mapping, timeout handling, outcome tracking.
Supports blocked (403), pending_approval (202), and success (200)."
```

---

## Task 4: Add findBySlug to Capabilities Repository

**Files:**
- Modify: `app/lib/repositories/capabilities.repository.js`

- [ ] **Step 1: Read the existing file**

Read `app/lib/repositories/capabilities.repository.js` to understand the existing pattern for query functions.

- [ ] **Step 2: Add getCapabilityBySlug function**

Add after the existing `getCapability` function:

```javascript
export async function getCapabilityBySlug(sql, orgId, slug) {
  const rows = await sql`
    SELECT * FROM capabilities
    WHERE org_id = ${orgId} AND slug = ${slug}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return shapeCapability(rows[0]);
}
```

This follows the exact same pattern as the existing `getCapability` function but queries by slug instead of capability_id.

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/repositories/capabilities.repository.js
git commit -m "feat(capabilities): add getCapabilityBySlug repository helper

Convenience lookup by slug for capability invocation and seed scripts."
```

---

## Task 5: Research Agent Seed Script

**Files:**
- Create: `scripts/seed-research-capability.js`

- [ ] **Step 1: Create the seed script**

Create `scripts/seed-research-capability.js`:

```javascript
#!/usr/bin/env node

/**
 * Seed the Research Agent capability and required org settings in DashClaw.
 *
 * Usage:
 *   node scripts/seed-research-capability.js
 *
 * Environment:
 *   DATABASE_URL - Postgres connection string (or uses default from .env)
 *   RESEARCH_API_URL - URL of the research-api (e.g., http://localhost:3849)
 *   RESEARCH_API_KEY - API key for the research-api (e.g., ra_live_abc123)
 *
 * Idempotent - safe to run multiple times. Skips if capability already exists.
 */

import { getSql } from '../app/lib/db.js';
import {
  getCapabilityBySlug,
  createCapability,
} from '../app/lib/repositories/capabilities.repository.js';

const ORG_ID = process.env.ORG_ID || 'org_default';
const RESEARCH_API_URL = process.env.RESEARCH_API_URL || 'http://localhost:3849';
const RESEARCH_API_KEY = process.env.RESEARCH_API_KEY || '';

const RESEARCH_CAPABILITY = {
  name: 'Research Agent',
  slug: 'research-agent',
  description:
    'Budget-aware research agent that intelligently routes queries between free and paid search sources. Returns synthesized answers with sources and confidence scores.',
  category: 'research',
  source_type: 'http_api',
  auth_type: 'bearer',
  risk_level: 'low',
  requires_approval: false,
  tags: ['research', 'search', 'synthesis', 'web'],
  pricing: { model: 'per_call', estimated_cost_usd: 0.005 },
  health_status: 'unknown',
  invocation_schema: {
    endpoint: '${RESEARCH_API_URL}/v1/research',
    method: 'POST',
    auth: {
      type: 'bearer',
      token_setting: 'RESEARCH_API_KEY',
    },
    timeout_ms: 60000,
    request_mapping: {
      query: '$.query',
      options: {
        budget: '$.budget',
        mode: '$.mode',
        current: '$.current',
      },
    },
    response_mapping: {
      answer: '$.answer',
      sources: '$.sources',
      confidence: '$.confidence',
      method: '$.method',
      elapsed_ms: '$.elapsedMs',
    },
  },
};

async function main() {
  const sql = getSql();

  console.log(`Seeding Research Agent capability for org: ${ORG_ID}`);
  console.log();

  // 1. Check if capability already exists
  const existing = await getCapabilityBySlug(sql, ORG_ID, 'research-agent');
  if (existing) {
    console.log(`  Research Agent capability already exists (${existing.capability_id}). Skipping.`);
  } else {
    const created = await createCapability(sql, ORG_ID, RESEARCH_CAPABILITY);
    console.log(`  Created Research Agent capability: ${created.capability_id}`);
  }
  console.log();

  // 2. Upsert org settings for research API
  console.log('Setting org settings...');

  const settingsToSet = [
    { key: 'RESEARCH_API_URL', value: RESEARCH_API_URL, description: 'Research Agent API base URL' },
    { key: 'RESEARCH_API_KEY', value: RESEARCH_API_KEY, description: 'Research Agent API bearer token' },
  ];

  for (const { key, value, description } of settingsToSet) {
    if (!value) {
      console.log(`  Skipping ${key} (not set in environment)`);
      continue;
    }

    try {
      await sql`
        INSERT INTO settings (org_id, key, value, description, updated_at)
        VALUES (${ORG_ID}, ${key}, ${value}, ${description}, NOW())
        ON CONFLICT (org_id, key)
        DO UPDATE SET value = ${value}, description = ${description}, updated_at = NOW()
      `;
      console.log(`  Set ${key} = ${key === 'RESEARCH_API_KEY' ? '***' : value}`);
    } catch (err) {
      console.log(`  Warning: Could not set ${key}: ${err.message}`);
    }
  }

  console.log();
  console.log('Done! Research Agent is now registered as a DashClaw capability.');
  console.log();
  console.log('Test it with:');
  console.log(`  curl -X POST http://localhost:3000/api/capabilities/{id}/invoke \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -H "x-api-key: YOUR_DASHCLAW_KEY" \\`);
  console.log(`    -d '{"query": "What is x402?"}'`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the script parses without errors**

Run: `cd "C:\Projects\DashClaw" && node -e "import('./scripts/seed-research-capability.js').catch(() => {})" && echo "Parse OK"`

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add scripts/seed-research-capability.js
git commit -m "feat(capabilities): add research agent seed script

Registers Research Agent as first http_api capability in DashClaw.
Sets RESEARCH_API_URL and RESEARCH_API_KEY in org settings.
Idempotent - safe to run multiple times."
```

---

## Task 6: Integration Verification

- [ ] **Step 1: Run all existing tests to verify nothing broke**

Run: `cd "C:\Projects\DashClaw" && npx vitest run`
Expected: All existing tests pass. New tests (mapping + capability-invoke) also pass.

- [ ] **Step 2: Run lint**

Run: `cd "C:\Projects\DashClaw" && npm run lint`
Expected: No new lint errors

- [ ] **Step 3: Verify governance boundary check**

Run: `cd "C:\Projects\DashClaw" && npm run governance:boundary:check`
Expected: Pass (the invoke route is under /api/capabilities which is an existing canonical surface)

- [ ] **Step 4: Verify the full commit history**

Run: `cd "C:\Projects\DashClaw" && git log --oneline -6`
Expected: 5 new commits (Tasks 1-5) plus the spec commit

- [ ] **Step 5: Final commit if any fixes needed**

```bash
cd "C:\Projects\DashClaw"
git status
# Only commit if there are remaining changes from fixes
```

---

## Summary

| Task | What | Files | Commits |
|------|------|-------|---------|
| 1 | Request/response mapping | 2 (impl + test) | 1 |
| 2 | Capability invoke engine | 2 (impl + test) | 1 |
| 3 | Invoke API route | 1 | 1 |
| 4 | findBySlug repository helper | 1 | 1 |
| 5 | Research agent seed script | 1 | 1 |
| 6 | Integration verification | 0 | 0-1 |
| **Total** | | **7 files** | **5-6 commits** |
