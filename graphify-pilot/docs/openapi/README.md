---
source-of-truth: false
owner: API Governance Lead
last-verified: 2026-02-13
doc-type: architecture
---

# OpenAPI Artifacts

This folder contains generated OpenAPI artifacts for DashClaw APIs.

## Critical Stable Spec

- Artifact: `docs/openapi/critical-stable.openapi.json`
- Generator: `scripts/generate-openapi.mjs`
- Command: `npm run openapi:generate`
- Drift check command: `npm run openapi:check`

## Stable Breaking-Change Exception Workflow

Default behavior:

- `npm run openapi:check` fails when generated OpenAPI differs from committed artifact.

Approved exception path:

- If a PR intentionally introduces a stable API breaking change, include this commit message tag:
  - `[openapi-breaking-rfc: RFC-<id>]`
- The drift check script will detect this tag and bypass failure for that commit.
- The referenced RFC must document:
  - the breaking surface,
  - migration guidance,
  - rollout/rollback plan.

## Scope

The generated critical stable spec includes endpoints under these prefixes:

- `/api/actions`
- `/api/guard`
- `/api/policies`
- `/api/settings`
- `/api/webhooks`
- `/api/messages`
- `/api/context`
- `/api/handoffs`
- `/api/snippets`
- `/api/memory`
- `/api/keys`
- `/api/orgs`
- `/api/team`
- `/api/invite`
- `/api/usage`
- `/api/health`
