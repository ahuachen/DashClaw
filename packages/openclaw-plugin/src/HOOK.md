---
name: dashclaw-governance
description: Policy enforcement, human-in-the-loop approval, and decision recording for every OpenClaw tool call. Powered by DashClaw.
version: 1.0.1
---

# DashClaw Governance Hook

Intercepts every OpenClaw tool call through a four-step governance loop:

1. **Guard** — `before_tool_call` sends the tool name, risk score, and a 500-character parameter summary to DashClaw `/api/guard`. Policies decide `allow`, `warn`, `block`, or `require_approval`.
2. **Record** — On `allow`/`warn`/`require_approval`, the hook opens a governance record via `/api/actions`. The server is authoritative — it may upgrade an `allow` decision to `pending_approval` for capabilities that require human review.
3. **Wait** — For `pending_approval` actions, the hook calls `waitForApproval(action_id)` using the **action_records ID from step 2**, not the `guard_decisions` ID from step 1. Operators approve from the DashClaw dashboard, CLI, or mobile PWA.
4. **Outcome** — `after_tool_call` records `completed` or `failed` with the error message, giving DashClaw a full intent → policy → outcome trail.

The hook never modifies tool parameters or results. It only blocks, allows, waits, or records.

## Configuration

Configured via `openclaw.plugin.json` — see the `configSchema` section in that file. Required fields are `dashclawUrl` and `dashclawApiKey`. Optional fields control fail-closed behavior, default risk score, high-risk tool mappings, and agent identity.

## Failure modes

- If `createAction` fails and `failClosed=true` (default), the tool call is blocked with a clear reason.
- If `failClosed=false`, the tool call proceeds ungoverned with a warning in the console.
- If the guard verdict is `block`, no action record is opened — the tool call is hard-stopped and no governance row is created.

## See also

- Canonical HITL flow: `sdk/README.md` → Human-in-the-Loop (HITL) Approval Flow
- Plugin source: `src/index.ts`
- Config schema: `openclaw.plugin.json`
