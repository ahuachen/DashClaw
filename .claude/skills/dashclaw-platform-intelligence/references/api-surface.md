# DashClaw API Surface

99 routes across 21 categories. Node SDK uses camelCase, Python SDK uses snake_case.

## Table of Contents

- [Action Recording](#action-recording)
- [Loops and Assumptions](#loops-and-assumptions)
- [Signals](#signals)
- [Behavior Guard](#behavior-guard)
- [Policies](#policies)
- [Context Manager](#context-manager)
- [Agent Messaging](#agent-messaging)
- [Automation Snippets](#automation-snippets)
- [Session Handoffs](#session-handoffs)
- [Memory](#memory)
- [User Preferences](#user-preferences)
- [Daily Digest](#daily-digest)
- [Security Scanning](#security-scanning)
- [Webhooks](#webhooks)
- [Agent Pairing](#agent-pairing)
- [Identity Binding](#identity-binding)
- [Organization Management](#organization-management)
- [Activity Logs](#activity-logs)
- [Compliance Engine](#compliance-engine)
- [Task Routing](#task-routing)
- [Bulk Sync](#bulk-sync)
- [Dashboard Data and Other Routes](#dashboard-data-and-other-routes)

## Action Recording

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/actions` | GET, POST, DELETE | `createAction`, `getActions` | `create_action`, `get_actions` |
| `/api/actions/{actionId}` | GET, PATCH | `getAction`, `updateOutcome` | `get_action`, `update_outcome` |
| `/api/actions/{actionId}/approve` | POST | `approveAction` | `approve_action` |
| `/api/actions/{actionId}/trace` | GET | `getActionTrace` | `get_action_trace` |

`getPendingApprovals` / `get_pending_approvals` -- queries actions with status=pending_approval.

## Loops and Assumptions

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/actions/loops` | GET, POST | `reportLoop`, `getLoops` | `report_loop`, `get_loops` |
| `/api/actions/loops/{loopId}` | GET, PATCH | `closeLoop` | `close_loop` |
| `/api/actions/assumptions` | GET, POST | `reportAssumption`, `getAssumptions` | `report_assumption`, `get_assumptions` |
| `/api/actions/assumptions/{assumptionId}` | GET, PATCH | `getAssumption`, `updateAssumption` | `get_assumption`, `update_assumption` |

## Signals

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/actions/signals` | GET | `getSignals` | `get_signals` |

## Behavior Guard

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/guard` | GET, POST | `guard`, `getGuardDecisions` | `guard`, `get_guard_decisions` |

POST sends an action for policy evaluation. Returns `{ decision, reasons, warnings, matched_policies, risk_score }`.
Decisions: `allow`, `block`, `warn`, `require_approval`.

## Policies

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/policies` | GET, POST, PATCH, DELETE | `importPolicies` | `import_policies` |
| `/api/policies/import` | POST | `importPolicies` | `import_policies` |
| `/api/policies/test` | POST | `testPolicy` | `test_policy` |
| `/api/policies/proof` | GET | `getProofReport` | `get_proof_report` |

## Context Manager

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/context/points` | GET, POST | `saveContextPoint`, `getContextPoints` | `save_context_point`, `get_context_points` |
| `/api/context/threads` | GET, POST | `createThread`, `getThreads` | `create_thread`, `get_threads` |
| `/api/context/threads/{threadId}` | GET, PATCH | `getThread`, `closeThread` | `get_thread`, `close_thread` |
| `/api/context/threads/{threadId}/entries` | POST | `addThreadEntry` | `add_thread_entry` |

Context thread IDs use `ct_` prefix.

## Agent Messaging

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/messages` | GET, POST, PATCH | `sendMessage`, `getMessages`, `markRead`, `archiveMessages`, `broadcast` | `send_message`, `get_messages`, `mark_read`, `archive_messages`, `broadcast` |
| `/api/messages/threads` | GET, POST, PATCH | `createMessageThread`, `getMessageThreads`, `resolveMessageThread` | `create_message_thread`, `get_message_threads`, `resolve_message_thread` |
| `/api/messages/docs` | GET, POST | `getSharedDocs`, `saveSharedDoc` | `get_shared_docs`, `save_shared_doc` |
| `/api/messages/attachments` | GET | `getMessageAttachments` | `get_message_attachments` |

Message thread IDs use `mt_` prefix.

## Automation Snippets

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/snippets` | GET, POST, DELETE | `saveSnippet`, `getSnippets`, `deleteSnippet` | `save_snippet`, `get_snippets`, `delete_snippet` |
| `/api/snippets/{snippetId}` | GET | `getSnippet` | `get_snippet` |
| `/api/snippets/{snippetId}/use` | POST | `useSnippet` | `use_snippet` |

Snippet IDs use `sn_` prefix.

## Session Handoffs

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/handoffs` | GET, POST | `createHandoff`, `getHandoffs`, `getLatestHandoff` | `create_handoff`, `get_handoffs`, `get_latest_handoff` |

## Memory

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/memory` | GET, POST | `reportMemoryHealth` | `report_memory_health` |

Python SDK accepts both composed report payload and split arguments.

## User Preferences

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/preferences` | GET, POST | `logObservation`, `setPreference`, `logMood`, `trackApproach`, `getPreferenceSummary`, `getApproaches` | `log_observation`, `set_preference`, `log_mood`, `track_approach`, `get_preference_summary`, `get_approaches` |

GET accepts `?type=summary|observations|preferences|moods|approaches`.

## Daily Digest

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/digest` | GET | `getDailyDigest` | `get_daily_digest` |

## Security Scanning

**Maturity:** Beta

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/security/scan` | POST | `scanContent` | `scan_content` |
| `/api/security/status` | GET | `reportSecurityFinding` | `report_security_finding` |
| `/api/security/prompt-injection` | GET, POST | `scanPromptInjection` | `scan_prompt_injection` |

POST scans text for prompt injection attacks (role overrides, delimiter injection, instruction smuggling, context manipulation, data exfiltration, output manipulation, encoding evasion). Returns `{ clean, risk_level, recommendation, findings_count, categories, findings }`. Recommendation: `allow`, `warn`, or `block`. GET lists recent scans. Scan metadata (never raw content) optionally stored with `pi_` prefixed IDs.

## Webhooks

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/webhooks` | GET, POST, DELETE | `getWebhooks`, `createWebhook`, `deleteWebhook` | `get_webhooks`, `create_webhook`, `delete_webhook` |
| `/api/webhooks/{webhookId}/test` | POST | `testWebhook` | `test_webhook` |
| `/api/webhooks/{webhookId}/deliveries` | GET | `getWebhookDeliveries` | `get_webhook_deliveries` |

## Agent Pairing

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/pairings` | GET, POST | `createPairing` | `create_pairing` |
| `/api/pairings/{pairingId}` | GET | `getPairing` | `get_pairing` |
| `/api/pairings/{pairingId}/approve` | POST | `waitForPairing` | `wait_for_pairing` |

Full pairing flow: generate keypair, POST with PEM, operator approves at approval URL, agent polls or uses `waitForPairing()`.

## Identity Binding

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/identities` | GET, POST | `registerIdentity`, `getIdentities` | `register_identity`, `get_identities` |

## Organization Management

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/orgs` | GET, POST | `getOrg`, `createOrg` | `get_org`, `create_org` |
| `/api/orgs/{orgId}` | GET, PATCH | `getOrgById`, `updateOrg` | `get_org_by_id`, `update_org` |
| `/api/orgs/{orgId}/keys` | GET, POST, DELETE | `getOrgKeys` | `get_org_keys` |

## Activity Logs

**Maturity:** Beta

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/activity` | GET | `getActivityLogs` | `get_activity_logs` |

## Compliance Engine

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/compliance/frameworks` | GET | `getFrameworks` | `get_frameworks` |
| `/api/compliance/map` | GET | `getComplianceMap` | `get_compliance_map` |
| `/api/compliance/gaps` | GET | `getComplianceGaps` | `get_compliance_gaps` |
| `/api/compliance/evidence` | GET | `getComplianceEvidence` | `get_compliance_evidence` |
| `/api/compliance/report` | GET | `getComplianceReport` | `get_compliance_report` |

## Task Routing

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/routing/agents` | GET, POST | `registerRoutingAgent`, `getRoutingAgents` | `register_routing_agent`, `get_routing_agents` |
| `/api/routing/agents/{agentId}` | GET, PATCH, DELETE | `getRoutingAgent`, `updateRoutingAgent`, `removeRoutingAgent` | `get_routing_agent`, `update_routing_agent`, `remove_routing_agent` |
| `/api/routing/tasks` | GET, POST | `submitTask`, `getTasks` | `submit_task`, `get_tasks` |
| `/api/routing/tasks/{taskId}` | GET, DELETE | `getTask` | `get_task` |
| `/api/routing/tasks/{taskId}/complete` | POST | `completeTask` | `complete_task` |
| `/api/routing/health` | GET | `getRoutingHealth` | `get_routing_health` |
| `/api/routing/stats` | GET | (dashboard only) | (dashboard only) |

## Real-Time Events

**Maturity:** Stable

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/stream` | GET | `events()` | (planned) |

The `events()` method returns an `EventEmitter` (Node) that listens to the platform SSE stream.
Events: `action.created`, `action.updated`, `decision.created`, `guard.decision.created`, `signal.detected`, `token.usage`, `policy.updated`, `task.assigned`, `task.completed`.

## Bulk Sync

**Maturity:** Experimental

| Endpoint | Methods | Node SDK | Python SDK |
|---|---|---|---|
| `/api/sync` | POST | `syncState` | `sync_state` |

Accepts multiple categories in one request: `connections`, `memory`, `goals`, `learning`, `content`, `context_points`, `context_threads`, `snippets`, `preferences`, `handoffs`, `inspiration`, `relationships`, `capabilities`.

## Dashboard Data and Other Routes

**SDK helper:** `wrapClient(llmClient)` (Node) / `wrap_client(llm_client)` (Python) — wraps an Anthropic or OpenAI client to auto-report token usage to `/api/tokens` after every call. Fire-and-forget; streaming calls safely ignored.

These routes primarily serve the dashboard UI:

| Endpoint | Maturity | Purpose |
|---|---|---|
| `/api/health` | Stable | Server health check (public) |
| `/api/stream` | Stable | SSE real-time events (actions, decisions, guards, signals, tokens) |        
| `/api/settings` | Stable | Workspace settings |
| `/api/auth/config` | Stable | List enabled auth providers |
| `/api/team` | Stable | Team management || `/api/team/invite` | Stable | Team invitations |
| `/api/team/{userId}` | Stable | Per-user management |
| `/api/keys` | Stable | API key management |
| `/api/usage` | Stable | Usage analytics |
| `/api/invite/{token}` | Stable | Invitation acceptance |
| `/api/tokens` | Experimental | Token tracking |
| `/api/tokens/budget` | Experimental | Token budget management |
| `/api/goals` | Experimental | Goals tracking |
| `/api/learning` | Experimental | Learning/decisions |
| `/api/learning/recommendations` | Experimental | Adaptive recommendations |
| `/api/calendar` | Experimental | Calendar events |
| `/api/content` | Experimental | Content management |
| `/api/relationships` | Experimental | Relationship tracking |
| `/api/inspiration` | Experimental | Ideas/inspiration |
| `/api/agents` | Experimental | Agent listing |
| `/api/agents/connections` | Experimental | Agent connections |
| `/api/swarm/graph` | Experimental | Swarm visualization |
| `/api/workflows` | Experimental | Workflow management |
| `/api/schedules` | Experimental | Job scheduling |
| `/api/notifications` | Beta | Notifications |
| `/api/onboarding/*` | Beta | Onboarding flow |
| `/api/docs/raw` | Beta | Raw markdown docs (public) |
