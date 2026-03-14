---
source-of-truth: false
owner: API Governance Lead
last-verified: 2026-02-13
doc-type: architecture
---

# API Inventory

- Source: `app/api/**/route.js`
- Artifact: `docs/api-inventory.json`
- Maturity levels: `stable`, `beta`, `experimental`

## Summary

- Total routes: `148`
- Stable routes: `23`
- Beta routes: `5`
- Experimental routes: `120`

## Routes

| Path | Methods | Maturity | Rule Prefix | File |
|---|---|---|---|---|
| `/api/_archive/activity` | `GET` | `experimental` | `(default)` | `app/api/_archive/activity/route.js` |
| `/api/_archive/agent-schedules` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/agent-schedules/route.js` |
| `/api/_archive/bounties` | `GET` | `experimental` | `(default)` | `app/api/_archive/bounties/route.js` |
| `/api/_archive/bug-hunter` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/bug-hunter/route.js` |
| `/api/_archive/calendar` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/calendar/route.js` |
| `/api/_archive/compliance/evidence` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/evidence/route.js` |
| `/api/_archive/compliance/exports` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/compliance/exports/route.js` |
| `/api/_archive/compliance/exports/{exportId}` | `DELETE, GET` | `experimental` | `(default)` | `app/api/_archive/compliance/exports/[exportId]/route.js` |
| `/api/_archive/compliance/exports/{exportId}/download` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/exports/[exportId]/download/route.js` |
| `/api/_archive/compliance/frameworks` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/frameworks/route.js` |
| `/api/_archive/compliance/gaps` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/gaps/route.js` |
| `/api/_archive/compliance/map` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/map/route.js` |
| `/api/_archive/compliance/report` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/report/route.js` |
| `/api/_archive/compliance/schedules` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/compliance/schedules/route.js` |
| `/api/_archive/compliance/schedules/{scheduleId}` | `DELETE, PATCH` | `experimental` | `(default)` | `app/api/_archive/compliance/schedules/[scheduleId]/route.js` |
| `/api/_archive/compliance/trends` | `GET` | `experimental` | `(default)` | `app/api/_archive/compliance/trends/route.js` |
| `/api/_archive/content` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/content/route.js` |
| `/api/_archive/context/points` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/context/points/route.js` |
| `/api/_archive/context/threads` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/context/threads/route.js` |
| `/api/_archive/context/threads/{threadId}` | `GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/context/threads/[threadId]/route.js` |
| `/api/_archive/context/threads/{threadId}/entries` | `POST` | `experimental` | `(default)` | `app/api/_archive/context/threads/[threadId]/entries/route.js` |
| `/api/_archive/cron/learning-episodes-backfill` | `GET` | `experimental` | `(default)` | `app/api/_archive/cron/learning-episodes-backfill/route.js` |
| `/api/_archive/cron/learning-recommendations` | `GET` | `experimental` | `(default)` | `app/api/_archive/cron/learning-recommendations/route.js` |
| `/api/_archive/cron/memory-maintenance` | `GET` | `experimental` | `(default)` | `app/api/_archive/cron/memory-maintenance/route.js` |
| `/api/_archive/cron/routing-maintenance` | `POST` | `experimental` | `(default)` | `app/api/_archive/cron/routing-maintenance/route.js` |
| `/api/_archive/cron/signals` | `GET` | `experimental` | `(default)` | `app/api/_archive/cron/signals/route.js` |
| `/api/_archive/digest` | `GET` | `experimental` | `(default)` | `app/api/_archive/digest/route.js` |
| `/api/_archive/docs/raw` | `GET` | `experimental` | `(default)` | `app/api/_archive/docs/raw/route.js` |
| `/api/_archive/drift/alerts` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/drift/alerts/route.js` |
| `/api/_archive/drift/alerts/{alertId}` | `DELETE, PATCH` | `experimental` | `(default)` | `app/api/_archive/drift/alerts/[alertId]/route.js` |
| `/api/_archive/drift/metrics` | `GET` | `experimental` | `(default)` | `app/api/_archive/drift/metrics/route.js` |
| `/api/_archive/drift/snapshots` | `GET` | `experimental` | `(default)` | `app/api/_archive/drift/snapshots/route.js` |
| `/api/_archive/drift/stats` | `GET` | `experimental` | `(default)` | `app/api/_archive/drift/stats/route.js` |
| `/api/_archive/evaluations` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/evaluations/route.js` |
| `/api/_archive/evaluations/runs` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/evaluations/runs/route.js` |
| `/api/_archive/evaluations/runs/{runId}` | `GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/evaluations/runs/[runId]/route.js` |
| `/api/_archive/evaluations/scorers` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/evaluations/scorers/route.js` |
| `/api/_archive/evaluations/scorers/{scorerId}` | `DELETE, PATCH` | `experimental` | `(default)` | `app/api/_archive/evaluations/scorers/[scorerId]/route.js` |
| `/api/_archive/evaluations/stats` | `GET` | `experimental` | `(default)` | `app/api/_archive/evaluations/stats/route.js` |
| `/api/_archive/feedback` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/feedback/route.js` |
| `/api/_archive/feedback/stats` | `GET` | `experimental` | `(default)` | `app/api/_archive/feedback/stats/route.js` |
| `/api/_archive/feedback/{feedbackId}` | `DELETE, GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/feedback/[feedbackId]/route.js` |
| `/api/_archive/goals` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/goals/route.js` |
| `/api/_archive/handoffs` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/handoffs/route.js` |
| `/api/_archive/identities` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/identities/route.js` |
| `/api/_archive/inspiration` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/inspiration/route.js` |
| `/api/_archive/invite/{token}` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/invite/[token]/route.js` |
| `/api/_archive/learning` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/learning/route.js` |
| `/api/_archive/learning/analytics/curves` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/learning/analytics/curves/route.js` |
| `/api/_archive/learning/analytics/maturity` | `GET` | `experimental` | `(default)` | `app/api/_archive/learning/analytics/maturity/route.js` |
| `/api/_archive/learning/analytics/summary` | `GET` | `experimental` | `(default)` | `app/api/_archive/learning/analytics/summary/route.js` |
| `/api/_archive/learning/analytics/velocity` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/learning/analytics/velocity/route.js` |
| `/api/_archive/learning/recommendations` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/learning/recommendations/route.js` |
| `/api/_archive/learning/recommendations/events` | `POST` | `experimental` | `(default)` | `app/api/_archive/learning/recommendations/events/route.js` |
| `/api/_archive/learning/recommendations/metrics` | `GET` | `experimental` | `(default)` | `app/api/_archive/learning/recommendations/metrics/route.js` |
| `/api/_archive/learning/recommendations/{recommendationId}` | `PATCH` | `experimental` | `(default)` | `app/api/_archive/learning/recommendations/[recommendationId]/route.js` |
| `/api/_archive/memory` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/memory/route.js` |
| `/api/_archive/messages` | `GET, PATCH, POST` | `experimental` | `(default)` | `app/api/_archive/messages/route.js` |
| `/api/_archive/messages/attachments` | `GET` | `experimental` | `(default)` | `app/api/_archive/messages/attachments/route.js` |
| `/api/_archive/messages/docs` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/messages/docs/route.js` |
| `/api/_archive/messages/threads` | `GET, PATCH, POST` | `experimental` | `(default)` | `app/api/_archive/messages/threads/route.js` |
| `/api/_archive/notifications` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/notifications/route.js` |
| `/api/_archive/onboarding/api-key` | `POST` | `experimental` | `(default)` | `app/api/_archive/onboarding/api-key/route.js` |
| `/api/_archive/onboarding/status` | `GET` | `experimental` | `(default)` | `app/api/_archive/onboarding/status/route.js` |
| `/api/_archive/onboarding/workspace` | `POST` | `experimental` | `(default)` | `app/api/_archive/onboarding/workspace/route.js` |
| `/api/_archive/pairings` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/pairings/route.js` |
| `/api/_archive/pairings/{pairingId}` | `GET` | `experimental` | `(default)` | `app/api/_archive/pairings/[pairingId]/route.js` |
| `/api/_archive/pairings/{pairingId}/approve` | `POST` | `experimental` | `(default)` | `app/api/_archive/pairings/[pairingId]/approve/route.js` |
| `/api/_archive/preferences` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/preferences/route.js` |
| `/api/_archive/prompts/agent-connect/raw` | `GET` | `experimental` | `(default)` | `app/api/_archive/prompts/agent-connect/raw/route.js` |
| `/api/_archive/prompts/render` | `POST` | `experimental` | `(default)` | `app/api/_archive/prompts/render/route.js` |
| `/api/_archive/prompts/runs` | `GET` | `experimental` | `(default)` | `app/api/_archive/prompts/runs/route.js` |
| `/api/_archive/prompts/sdk-coverage/raw` | `GET` | `experimental` | `(default)` | `app/api/_archive/prompts/sdk-coverage/raw/route.js` |
| `/api/_archive/prompts/server-setup/raw` | `GET` | `experimental` | `(default)` | `app/api/_archive/prompts/server-setup/raw/route.js` |
| `/api/_archive/prompts/stats` | `GET` | `experimental` | `(default)` | `app/api/_archive/prompts/stats/route.js` |
| `/api/_archive/prompts/templates` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/prompts/templates/route.js` |
| `/api/_archive/prompts/templates/{templateId}` | `DELETE, GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/prompts/templates/[templateId]/route.js` |
| `/api/_archive/prompts/templates/{templateId}/versions` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/prompts/templates/[templateId]/versions/route.js` |
| `/api/_archive/prompts/templates/{templateId}/versions/{versionId}` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/prompts/templates/[templateId]/versions/[versionId]/route.js` |
| `/api/_archive/relationships` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/relationships/route.js` |
| `/api/_archive/routing/agents` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/routing/agents/route.js` |
| `/api/_archive/routing/agents/{agentId}` | `DELETE, GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/routing/agents/[agentId]/route.js` |
| `/api/_archive/routing/health` | `GET` | `experimental` | `(default)` | `app/api/_archive/routing/health/route.js` |
| `/api/_archive/routing/stats` | `GET` | `experimental` | `(default)` | `app/api/_archive/routing/stats/route.js` |
| `/api/_archive/routing/tasks` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/routing/tasks/route.js` |
| `/api/_archive/routing/tasks/{taskId}` | `DELETE, GET` | `experimental` | `(default)` | `app/api/_archive/routing/tasks/[taskId]/route.js` |
| `/api/_archive/routing/tasks/{taskId}/complete` | `POST` | `experimental` | `(default)` | `app/api/_archive/routing/tasks/[taskId]/complete/route.js` |
| `/api/_archive/schedules` | `GET` | `experimental` | `(default)` | `app/api/_archive/schedules/route.js` |
| `/api/_archive/scoring/calibrate` | `POST` | `experimental` | `(default)` | `app/api/_archive/scoring/calibrate/route.js` |
| `/api/_archive/scoring/profiles` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/scoring/profiles/route.js` |
| `/api/_archive/scoring/profiles/{profileId}` | `DELETE, GET, PATCH` | `experimental` | `(default)` | `app/api/_archive/scoring/profiles/[profileId]/route.js` |
| `/api/_archive/scoring/profiles/{profileId}/dimensions` | `POST` | `experimental` | `(default)` | `app/api/_archive/scoring/profiles/[profileId]/dimensions/route.js` |
| `/api/_archive/scoring/profiles/{profileId}/dimensions/{dimensionId}` | `DELETE, PATCH` | `experimental` | `(default)` | `app/api/_archive/scoring/profiles/[profileId]/dimensions/[dimensionId]/route.js` |
| `/api/_archive/scoring/risk-templates` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/scoring/risk-templates/route.js` |
| `/api/_archive/scoring/risk-templates/{templateId}` | `DELETE, PATCH` | `experimental` | `(default)` | `app/api/_archive/scoring/risk-templates/[templateId]/route.js` |
| `/api/_archive/scoring/score` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/scoring/score/route.js` |
| `/api/_archive/security/prompt-injection` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/security/prompt-injection/route.js` |
| `/api/_archive/security/scan` | `POST` | `experimental` | `(default)` | `app/api/_archive/security/scan/route.js` |
| `/api/_archive/security/status` | `GET` | `experimental` | `(default)` | `app/api/_archive/security/status/route.js` |
| `/api/_archive/settings` | `DELETE, GET, POST` | `experimental` | `(default)` | `app/api/_archive/settings/route.js` |
| `/api/_archive/settings/llm-status` | `GET` | `experimental` | `(default)` | `app/api/_archive/settings/llm-status/route.js` |
| `/api/_archive/settings/test` | `POST` | `experimental` | `(default)` | `app/api/_archive/settings/test/route.js` |
| `/api/_archive/snippets` | `DELETE, GET, POST` | `experimental` | `(default)` | `app/api/_archive/snippets/route.js` |
| `/api/_archive/snippets/{snippetId}` | `GET` | `experimental` | `(default)` | `app/api/_archive/snippets/[snippetId]/route.js` |
| `/api/_archive/snippets/{snippetId}/use` | `POST` | `experimental` | `(default)` | `app/api/_archive/snippets/[snippetId]/use/route.js` |
| `/api/_archive/stream` | `GET` | `experimental` | `(default)` | `app/api/_archive/stream/route.js` |
| `/api/_archive/swarm/graph` | `GET` | `experimental` | `(default)` | `app/api/_archive/swarm/graph/route.js` |
| `/api/_archive/swarm/link` | `GET` | `experimental` | `(default)` | `app/api/_archive/swarm/link/route.js` |
| `/api/_archive/sync` | `POST` | `experimental` | `(default)` | `app/api/_archive/sync/route.js` |
| `/api/_archive/tokens` | `GET, POST` | `experimental` | `(default)` | `app/api/_archive/tokens/route.js` |
| `/api/_archive/tokens/budget` | `GET, PUT` | `experimental` | `(default)` | `app/api/_archive/tokens/budget/route.js` |
| `/api/_archive/workflows` | `GET` | `experimental` | `(default)` | `app/api/_archive/workflows/route.js` |
| `/api/actions` | `DELETE, GET, POST` | `stable` | `/api/actions` | `app/api/actions/route.js` |
| `/api/actions/loops` | `GET, POST` | `stable` | `/api/actions` | `app/api/actions/loops/route.js` |
| `/api/actions/loops/{loopId}` | `GET, PATCH` | `stable` | `/api/actions` | `app/api/actions/loops/[loopId]/route.js` |
| `/api/actions/{actionId}` | `GET, PATCH` | `stable` | `/api/actions` | `app/api/actions/[actionId]/route.js` |
| `/api/actions/{actionId}/trace` | `GET` | `stable` | `/api/actions` | `app/api/actions/[actionId]/trace/route.js` |
| `/api/agents` | `GET` | `experimental` | `/api/agents` | `app/api/agents/route.js` |
| `/api/agents/connections` | `GET, POST` | `experimental` | `/api/agents` | `app/api/agents/connections/route.js` |
| `/api/agents/heartbeat` | `POST` | `experimental` | `/api/agents` | `app/api/agents/heartbeat/route.js` |
| `/api/agents/{agentId}` | `GET` | `experimental` | `/api/agents` | `app/api/agents/[agentId]/route.js` |
| `/api/approvals/{actionId}` | `POST` | `experimental` | `(default)` | `app/api/approvals/[actionId]/route.js` |
| `/api/assumptions` | `GET, POST` | `experimental` | `(default)` | `app/api/assumptions/route.js` |
| `/api/assumptions/{assumptionId}` | `GET, PATCH` | `experimental` | `(default)` | `app/api/assumptions/[assumptionId]/route.js` |
| `/api/auth/config` | `GET` | `beta` | `/api/auth` | `app/api/auth/config/route.js` |
| `/api/auth/local` | `DELETE, POST` | `beta` | `/api/auth` | `app/api/auth/local/route.js` |
| `/api/guard` | `GET, POST` | `stable` | `/api/guard` | `app/api/guard/route.js` |
| `/api/health` | `GET` | `stable` | `/api/health` | `app/api/health/route.js` |
| `/api/keys` | `DELETE, GET, POST` | `stable` | `/api/keys` | `app/api/keys/route.js` |
| `/api/orgs` | `GET, POST` | `stable` | `/api/orgs` | `app/api/orgs/route.js` |
| `/api/orgs/{orgId}` | `GET, PATCH` | `stable` | `/api/orgs` | `app/api/orgs/[orgId]/route.js` |
| `/api/orgs/{orgId}/keys` | `DELETE, GET, POST` | `stable` | `/api/orgs` | `app/api/orgs/[orgId]/keys/route.js` |
| `/api/policies` | `DELETE, GET, PATCH, POST` | `stable` | `/api/policies` | `app/api/policies/route.js` |
| `/api/policies/import` | `POST` | `stable` | `/api/policies` | `app/api/policies/import/route.js` |
| `/api/policies/proof` | `GET` | `stable` | `/api/policies` | `app/api/policies/proof/route.js` |
| `/api/policies/simulate` | `POST` | `stable` | `/api/policies` | `app/api/policies/simulate/route.js` |
| `/api/policies/test` | `POST` | `stable` | `/api/policies` | `app/api/policies/test/route.js` |
| `/api/setup/live-proof` | `POST` | `beta` | `/api/setup` | `app/api/setup/live-proof/route.js` |
| `/api/setup/proof` | `GET` | `beta` | `/api/setup` | `app/api/setup/proof/route.js` |
| `/api/setup/status` | `GET` | `beta` | `/api/setup` | `app/api/setup/status/route.js` |
| `/api/signals` | `GET` | `experimental` | `(default)` | `app/api/signals/route.js` |
| `/api/team` | `GET` | `stable` | `/api/team` | `app/api/team/route.js` |
| `/api/team/invite` | `DELETE, GET, POST` | `stable` | `/api/team` | `app/api/team/invite/route.js` |
| `/api/team/{userId}` | `DELETE, PATCH` | `stable` | `/api/team` | `app/api/team/[userId]/route.js` |
| `/api/usage` | `GET` | `stable` | `/api/usage` | `app/api/usage/route.js` |
| `/api/webhooks` | `DELETE, GET, POST` | `stable` | `/api/webhooks` | `app/api/webhooks/route.js` |
| `/api/webhooks/{webhookId}/deliveries` | `GET` | `stable` | `/api/webhooks` | `app/api/webhooks/[webhookId]/deliveries/route.js` |
| `/api/webhooks/{webhookId}/test` | `POST` | `stable` | `/api/webhooks` | `app/api/webhooks/[webhookId]/test/route.js` |

