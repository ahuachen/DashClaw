# Minimal Runtime API

DashClaw is designed around a small, stable core of governance primitives. This API allows any agent, regardless of framework, to participate in the DashClaw governance lifecycle.

## The Governance Lifecycle

The runtime API follows a deterministic flow for every agent action:

1. **Guard** — Intent is declared and evaluated against policies.
2. **Action** — The attempt is registered if the guard allows it.
3. **Outcome** — The final result (success/failure) is recorded.
4. **Assumptions** — Beliefs that underpinned the decision are logged.
5. **Approvals** — High-risk actions are gated for human review.

---

## 1. Guard (`POST /api/guard`)

The "Universal Interceptor". This endpoint determines if an action is allowed to proceed.

### Request
```json
{
  "action": "deploy",
  "intent": "deploy commit abc123 to production",
  "agent_id": "agent-001",
  "risk_score": 85,
  "context": {
    "systems": ["github", "vercel"]
  }
}
```

### Response
```json
{
  "decision": "allow | block | require_approval",
  "action_id": "act_gd_...",
  "signals": ["High risk deployment", "Production environment access"],
  "reason": "Risk score exceeds organization threshold (80)"
}
```

---

## 2. Actions (`POST /api/actions`)

Registers an active attempt. This promotes a "guarded intent" into a recorded "action record".

### Request
```json
{
  "action_type": "deploy",
  "declared_goal": "deploy commit abc123 to production",
  "agent_id": "agent-001",
  "status": "running"
}
```

### Response
```json
{
  "action_id": "act_...",
  "status": "running"
}
```

---

## 3. Outcomes (`PATCH /api/actions/:id`)

Updates the result of a recorded action. This provides the "evidence" layer of the governance cycle.

### Request
```json
{
  "status": "completed | failed",
  "output_summary": "Deployment successful. URL: https://...",
  "duration_ms": 4500,
  "artifacts_created": ["deployment_log.txt"]
}
```

---

## 4. Assumptions (`POST /api/assumptions`)

Records beliefs or facts the agent assumed were true when making the decision. DashClaw uses these to detect reasoning drift.

### Request
```json
{
  "action_id": "act_...",
  "assumption": "The database migration has already been run by the CI/CD pipeline.",
  "basis": "Last pipeline run status was 'success'"
}
```

---

## 5. Approvals (`POST /api/approvals/:id`)

The endpoint used by human operators (via Mission Control) to resolve `pending_approval` actions.

### Request
```json
{
  "decision": "allow | deny",
  "reasoning": "Verified that migration was indeed run."
}
```

---

## Implementation Notes

- **Idempotency**: All `POST` and `PATCH` operations are designed to be idempotent where possible.
- **Backward Compatibility**: The `/api/actions/[id]/approve` and `/api/actions/assumptions` endpoints are preserved via Next.js rewrites.
- **Security**: All endpoints require a valid `X-API-KEY`.
