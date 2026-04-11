# DashClaw Portal v1 Concept

Date: 2026-04-06
Status: Product concept
Constraint: Strategy artifact only. No code changes.

## One-line concept

DashClaw Portal is a machine-native operating surface where AI agents can discover governed capabilities, inspect policy, retrieve context, run safety checks, request approvals, and execute real-world work under explicit accountability.

## Core idea

Most software environments are built for humans first. Agents are forced to navigate:
- human documentation
- human dashboards
- human authentication flows
- ad hoc APIs
- scattered scripts
- inconsistent permissions
- weak auditability

DashClaw Portal flips that model.

It is built for agents first.
Humans still observe and govern it, but the interface is designed so an agent can arrive, identify itself, learn what it is allowed to do, discover available capabilities, and operate safely.

## The problem it solves

Modern agents often have:
- model access
- prompts
- tool hooks
- maybe some memory
- weak environmental awareness
- poor discoverability of capabilities
- unclear policy boundaries
- weak cross-run accountability

That means agents can act, but they do not really have an environment.

DashClaw Portal gives them one.

## Product thesis

As agents become more capable, the valuable layer is not just another tool or another chat UI.
The valuable layer is the operating surface between the agent and real-world consequences.

DashClaw Portal should become the place where an agent goes to:
- discover what exists
- understand what is allowed
- invoke guarded capabilities
- retrieve relevant context
- request approvals when needed
- leave behind a verifiable operational trail

## What Portal is

Portal is:
- a machine-native service layer
- a capability registry
- a policy-aware execution environment
- an accountability and governance layer
- an agent-facing home base for real work

Portal is not:
- a generic chatbot UI
- a CRM
n- an all-purpose workflow builder for everyone
- a replacement for every specialized app
- a toy marketplace full of ungoverned tools

## Design principles

### 1. Agent-first, not human-first
All important capabilities should be discoverable and usable by agents without reading prose-heavy human docs.

### 2. API-first, machine-legible, human-observable
Portal should expose structured contracts first. Human dashboards are a monitoring and intervention layer, not the primary product surface.

### 3. Explicit policy before execution
The agent should know:
- what it can do
- what requires approval
- what carries risk
- what budget constraints apply
- what environment and org it is acting in

### 4. Safe by default
Security, outbound review, secret scanning, prompt-injection defense, and preflight checks should be native capabilities, not optional afterthoughts.

### 5. Traceability is part of the action
Every meaningful action should leave behind structured evidence: intent, assumptions, inputs, outputs, approvals, result, and outcome summary.

### 6. Capability discovery is a core feature
Agents should not need hardcoded knowledge of every operation. Portal should support self-discovery.

## Portal v1 jobs to be done

An AI agent should be able to use Portal v1 to answer these questions:

1. Who am I here?
2. What workspace or org am I in?
3. What am I allowed to do?
4. What capabilities exist?
5. What will require approval?
6. What safety checks can I run before acting?
7. What memory or context is relevant?
8. How do I start an action and report progress?
9. How do I request human review?
10. How do I hand off or finish cleanly?

## Portal v1 capability pillars

## 1. Identity and trust introspection
The agent can inspect:
- agent identity
- organization/workspace
- granted capabilities
- trust tier
- policy profile
- active budgets or limits
- approval scope

Example questions:
- Who am I?
- What can I do in this org?
- What actions are blocked, allowed, or approval-gated?

## 2. Capability registry
Portal exposes a machine-readable registry of available capabilities.

Each capability should describe:
- name
- purpose
- risk level
- input schema
- output schema
- auth requirements
- approval requirements
- budget or cost hints
- execution mode
- tags/category

Examples:
- secret-scan
- prompt-injection-defense
- outbound-review
- policy-simulate
- action-start
- approval-request
- memory-search
- workflow-launch
- route-task
- replay-action

## 3. Safety and security utilities
Portal should provide governed utilities agents can call before external action.

Candidate v1 utilities:
- prompt injection defense
- secret scanning
- outbound message review
- URL risk scan
- content sanitization
- action preflight policy simulation
- dependency or package risk checks

These are especially valuable because they are reusable across domains.

## 4. Action lifecycle
Portal should make action accountability easy and standard.

Core lifecycle operations:
- start action
- update status
- attach assumptions
- attach artifacts or references
- request approval
- complete action
- fail action
- cancel action

Each action should support a structured task-outcome record with:
- id
- goal
- actor
- target
- status
- summary
- duration
- cost
- artifacts
- needs_review
- error

## 5. Context and memory retrieval
Portal should help agents load the right context before acting.

Candidate v1 context services:
- retrieve relevant prior actions
- fetch workspace decisions
- search knowledge collections
- load policy docs relevant to a task
- inspect similar past outcomes
- attach context bundle to current action

## 6. Approval and escalation
Portal should provide a clean route from agent autonomy to human oversight.

The agent should be able to:
- determine whether an action requires approval
- create an approval request with structured context
- poll or subscribe for approval state
- resume or abort cleanly based on outcome

## Example v1 agent journey

An outreach agent wants to send a message.

1. Agent authenticates to Portal using its identity
2. Agent checks capability registry for outbound communication rules
3. Agent runs outbound-review and prompt-injection-defense on its draft
4. Agent starts an action record: `send_outreach_message`
5. Portal policy indicates approval required
6. Agent submits approval request with message preview, target, risk, and rationale
7. Human reviews in DashClaw human console
8. Approval granted
9. Agent completes the external action
10. Agent records outcome summary and artifacts

This is the intended Portal shape: discover, verify, govern, execute, record.

## Human role in the Portal model

Humans are not the primary interface, but they remain essential.

Humans use DashClaw to:
- define policy
- monitor actions
- approve risky operations
- inspect replays
- debug failures
- review drift and anomaly signals
- manage integrations and capabilities

In other words:
- Portal is what agents interact with
- DashClaw console is what humans use to supervise Portal

## Suggested v1 API surfaces

These are conceptual surfaces, not implementation commitments.

### Identity and policy
- `GET /api/portal/self`
- `GET /api/portal/policies/effective`
- `GET /api/portal/budgets`

### Capability discovery
- `GET /api/portal/capabilities`
- `GET /api/portal/capabilities/:id`
- `POST /api/portal/capabilities/:id/simulate`

### Safety utilities
- `POST /api/portal/security/prompt-injection-check`
- `POST /api/portal/security/secret-scan`
- `POST /api/portal/security/outbound-review`
- `POST /api/portal/security/url-risk-scan`

### Action lifecycle
- `POST /api/portal/actions`
- `PATCH /api/portal/actions/:id`
- `POST /api/portal/actions/:id/assumptions`
- `POST /api/portal/actions/:id/complete`
- `POST /api/portal/actions/:id/fail`

### Context and memory
- `POST /api/portal/context/search`
- `GET /api/portal/actions/:id/replay`
- `POST /api/portal/context/bundle`

### Approval flows
- `POST /api/portal/approvals`
- `GET /api/portal/approvals/:id`
- `POST /api/portal/approvals/:id/ack`

## Minimum v1 payload ideas

### Capability object
```json
{
  "id": "outbound-review",
  "name": "Outbound Review",
  "description": "Review outbound content for policy, secrecy, and risk before send",
  "category": "security",
  "riskLevel": "medium",
  "requiresApproval": false,
  "inputSchema": {},
  "outputSchema": {},
  "costHintUsd": 0.001,
  "tags": ["security", "outbound", "review"]
}
```

### Action create request
```json
{
  "actionType": "send_outreach_message",
  "goal": "Send approved first-touch outreach to prospect",
  "target": {
    "entityType": "prospect",
    "entityId": "pros_123"
  },
  "riskScore": 62,
  "metadata": {
    "workspace": "practical-systems",
    "channel": "email"
  }
}
```

### Task outcome record
```json
{
  "task_id": "act_123",
  "status": "completed",
  "summary": "Approved outreach email sent to Jane Doe at Acme",
  "cost_usd": 0.002,
  "duration_ms": 14882,
  "artifacts": ["outreach_touch:touch_123"],
  "needs_review": false,
  "error": null
}
```

## Non-goals for v1

Portal v1 should not try to be:
- full agent app store
- universal workflow builder
- browser automation suite
- hosted model platform
- replacement for GitHub, Slack, Notion, or every SaaS tool
- complete memory OS
- decentralized protocol layer

Those are scope traps.

## Why this matters strategically

This moves DashClaw from:
- dashboard for humans

to:
- operating environment for agents

That is a stronger and more defensible category if executed well.

The differentiator is not just observability.
It is giving agents a governed place to operate.

## Relationship to Practical Systems

Practical Systems is a good proving ground for Portal.

Practical Systems agents could become early Portal users:
- outreach agent uses outbound review + approval flow
- researcher agent uses context retrieval + action records
- orchestrator uses routing + status updates
- meeting/content agents use policy-aware execution and replay

This makes Practical Systems the vertical application and DashClaw Portal the agent operating layer underneath it.

## Product positioning draft

DashClaw Portal is the machine-native operating surface for AI agents.
It lets agents discover governed capabilities, retrieve context, run safety checks, request approvals, and execute work with explicit accountability.

## Final product test

If an agent arrives at Portal for the first time, can it answer:
- who am I
- what can I do
- what should I not do
- what tools exist
- what requires approval
- how do I act safely
- how do I leave behind a clean record

If yes, the Portal is working.
If not, it is still just a human dashboard with API endpoints attached.
