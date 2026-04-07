# Design Spec: Capability Invoke Endpoint + Research Agent Capability

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Add a generic capability invoke endpoint to DashClaw and register the budget-aware research agent as the first invocable capability.

---

## 1. Overview

DashClaw's capability registry is currently metadata-only — capabilities can be registered and discovered but not executed. This spec adds a generic `POST /api/capabilities/:capabilityId/invoke` endpoint that can call any `http_api` capability, with full governance (guard evaluation, action recording, outcome tracking).

The budget-aware research agent becomes the first capability registered and invocable through DashClaw, proving the pattern works.

**Goal:** Any DashClaw user can invoke `POST /api/capabilities/{research-agent-id}/invoke` with a query and get a synthesized research answer back — fully governed, auditable, and cost-tracked.

---

## 2. Architecture

```
Agent / Workflow / SDK
    |
    |  POST /api/capabilities/:id/invoke
    |  { "query": "What is x402?", "budget": 0.25 }
    |
    v
Capability Invoke Route (NEW)
    |
    |-- 1. Load capability from registry
    |-- 2. Validate source_type == "http_api"
    |-- 3. Guard evaluation (risk_level -> risk_score)
    |       |-- blocked -> 403 with guard decision
    |       |-- require_approval -> 202 with action_id
    |-- 4. Create action record (action_type: "capability_invoke")
    |-- 5. Resolve auth token from org settings (BYOK)
    |-- 6. Map request body via invocation_schema.request_mapping
    |-- 7. HTTP call to capability endpoint (with timeout)
    |-- 8. Map response via invocation_schema.response_mapping
    |-- 9. Update action outcome (completed/failed)
    |-- 10. Return response to caller
    |
    v
Research API (external)
    POST /v1/research
```

**Key design decisions:**
- The invoke endpoint is GENERIC — works for any `http_api` capability, not just research
- Guard runs on every invocation. Risk level mapping: low=20, medium=50, high=75, critical=95
- Auth tokens stored in org settings (encrypted), referenced by key name in `invocation_schema.auth.token_setting`
- Action records tie every invocation to the governance audit trail
- The research agent is just the first capability — the pattern scales to any HTTP API
- No database schema changes. Uses existing tables (capabilities, action_records, org settings)

---

## 3. Invoke Endpoint

**Route:** `POST /api/capabilities/:capabilityId/invoke`

**Request body:** Free-form JSON passed through request_mapping to build the downstream request.

```json
{
  "query": "What is x402 and how does it work?",
  "budget": 0.25,
  "mode": "dry"
}
```

### Response: Success (200)

```json
{
  "success": true,
  "action_id": "act_abc123",
  "result": {
    "answer": "x402 is a payment protocol...",
    "sources": [],
    "confidence": 0.85
  },
  "elapsed_ms": 4200,
  "governed": true
}
```

### Response: Guard Blocked (403)

```json
{
  "success": false,
  "error": "blocked_by_policy",
  "guard_decision": {
    "decision": "block",
    "reasons": ["Rate limit exceeded"],
    "matched_policies": ["cap_rate_limiter"]
  }
}
```

### Response: Requires Approval (202)

```json
{
  "success": false,
  "error": "pending_approval",
  "action_id": "act_abc123",
  "message": "Invocation requires human approval. Poll /api/approvals/act_abc123 for status."
}
```

### Error Responses

| Condition | Status | Error |
|-----------|--------|-------|
| Capability not found | 404 | `capability_not_found` |
| source_type not `http_api` | 400 | `not_invocable` |
| Missing auth token in org settings | 400 | `auth_not_configured` |
| Missing endpoint URL variable in org settings | 400 | `endpoint_not_configured` |
| Downstream timeout | 504 | `capability_timeout` (action recorded as failed) |
| Downstream error (4xx/5xx) | 502 | `capability_error` (action recorded as failed, error forwarded) |

---

## 4. Guard Integration

Every invocation runs through DashClaw's guard engine before the HTTP call is made.

**Risk score mapping from capability risk_level:**

| risk_level | risk_score |
|-----------|-----------|
| low | 20 |
| medium | 50 |
| high | 75 |
| critical | 95 |

**Guard context sent:**

```json
{
  "action_type": "capability_invoke",
  "risk_score": 20,
  "declared_goal": "Invoke capability: Research Agent",
  "capability_id": "cap_abc123",
  "capability_slug": "research-agent",
  "capability_category": "research",
  "reversible": true,
  "systems_touched": ["capability:research-agent"]
}
```

**Guard outcomes:**
- `allow` — proceed with invocation
- `warn` — proceed but include warnings in response
- `block` — return 403, do not invoke, record blocked action
- `require_approval` — create pending action, return 202 with action_id for polling

---

## 5. Action Recording

Every invocation creates an action record regardless of guard outcome.

**Action fields:**

| Field | Value |
|-------|-------|
| `action_type` | `capability_invoke` |
| `declared_goal` | `Invoke capability: {capability.name}` |
| `risk_score` | Mapped from capability risk_level |
| `systems_touched` | `["capability:{slug}"]` |
| `input_summary` | First 500 chars of request body JSON |
| `status` | `running` -> `completed` or `failed` |
| `output_summary` | First 500 chars of mapped response |
| `duration_ms` | Time from HTTP call start to response |

Blocked invocations get status `failed` with `error_message: "Blocked by guard policy"`.
Timed-out invocations get status `failed` with `error_message: "Capability timeout after {timeout_ms}ms"`.

---

## 6. Request/Response Mapping

A simple dot-path mapper transforms the caller's request into the downstream API format and vice versa. No external dependencies — ~30 lines of code.

### Request Mapping

Given caller sends `{ "query": "What is x402?", "budget": 0.25 }` and the mapping is:

```json
{
  "query": "$.query",
  "options": { "budget": "$.budget", "mode": "$.mode" }
}
```

The mapper builds:

```json
{
  "query": "What is x402?",
  "options": { "budget": 0.25 }
}
```

Missing fields (`$.mode` is undefined) are omitted, not set to null.

### Response Mapping

Same logic in reverse. Downstream returns `{ "answer": "...", "elapsedMs": 4200 }`, mapping `"elapsed_ms": "$.elapsedMs"` produces `{ "elapsed_ms": 4200 }`.

### Variable Substitution in Endpoint URL

`${RESEARCH_API_URL}/v1/research` — at invocation time, the handler reads `RESEARCH_API_URL` from org settings and replaces the `${VAR}` pattern. If the setting doesn't exist, the invocation fails with `endpoint_not_configured` error.

### Passthrough Mode

If `request_mapping` is empty/absent, the caller's body is sent as-is to the downstream endpoint. Same for `response_mapping` — if absent, the downstream response is returned as-is. This supports simple APIs that don't need transformation.

---

## 7. Auth Resolution

Auth tokens are resolved from org settings at invocation time (BYOK pattern, same as model strategies).

**Supported auth types:**

| auth.type | Behavior |
|-----------|----------|
| `bearer` | Reads `auth.token_setting` from org settings, sends as `Authorization: Bearer {token}` |
| `api_key` | Reads `auth.token_setting` from org settings, sends as `x-api-key: {token}` |
| `none` | No auth header sent |

If `auth.token_setting` references a setting that doesn't exist in the org, the invocation fails with `auth_not_configured`.

---

## 8. Research Agent Capability Registration

Registered via seed script or DashClaw UI:

```json
{
  "name": "Research Agent",
  "slug": "research-agent",
  "description": "Budget-aware research agent that intelligently routes queries between free and paid search sources. Returns synthesized answers with sources and confidence scores.",
  "category": "research",
  "source_type": "http_api",
  "auth_type": "bearer",
  "risk_level": "low",
  "requires_approval": false,
  "tags": ["research", "search", "synthesis", "web"],
  "pricing": {
    "model": "per_call",
    "estimated_cost_usd": 0.005
  },
  "health_status": "unknown",
  "invocation_schema": {
    "endpoint": "${RESEARCH_API_URL}/v1/research",
    "method": "POST",
    "auth": {
      "type": "bearer",
      "token_setting": "RESEARCH_API_KEY"
    },
    "timeout_ms": 60000,
    "request_mapping": {
      "query": "$.query",
      "options": {
        "budget": "$.budget",
        "mode": "$.mode",
        "current": "$.current"
      }
    },
    "response_mapping": {
      "answer": "$.answer",
      "sources": "$.sources",
      "confidence": "$.confidence",
      "method": "$.method",
      "elapsed_ms": "$.elapsedMs"
    }
  }
}
```

**Org settings required (stored encrypted):**
- `RESEARCH_API_URL` — e.g., `http://localhost:3849` or `https://research-api.onrender.com`
- `RESEARCH_API_KEY` — e.g., `ra_live_abc123`

---

## 9. Files Changed

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/capabilities/[capabilityId]/invoke/route.js` | Create | Invoke endpoint — guard, map, call, record |
| `app/lib/capability-invoke.js` | Create | Invoke engine — HTTP call, auth resolution, timeout, error handling |
| `app/lib/mapping.js` | Create | Request/response dot-path mapper |
| `app/lib/repositories/capabilities.repository.js` | Modify | Add `findBySlug()` for convenience lookups |
| `scripts/seed-research-capability.js` | Create | Seed script to register research agent capability |

**No database schema changes.** Uses existing tables.

**No SDK changes.** Standard HTTP call. Convenience wrapper can be added later.

**Estimated scope:** ~250 lines of new code across 5 files.

---

## 10. Success Criteria

- [ ] `POST /api/capabilities/:id/invoke` works for any `http_api` capability
- [ ] Guard evaluates every invocation using capability's risk_level
- [ ] Blocked invocations return 403 with guard decision
- [ ] Require_approval invocations return 202 with action_id
- [ ] Successful invocations create action records with outcome tracking
- [ ] Auth tokens resolved from org settings (BYOK), never stored in capability record
- [ ] Request/response mapping transforms payloads correctly
- [ ] Missing mapping fields are omitted, not null
- [ ] Endpoint URL variables resolved from org settings
- [ ] Downstream timeouts return 504 with failed action record
- [ ] Downstream errors return 502 with error details forwarded
- [ ] Research agent registered as first capability with correct invocation schema
- [ ] Research agent invocable end-to-end through DashClaw
