# Build Prompt: DashClaw Portal

You are working inside the DashClaw codebase.
Your task is to design and implement the first version of **DashClaw Portal** as a real product surface inside this repository.

This is not a generic dashboard feature.
DashClaw Portal is a **machine-native operating surface for AI agents**.
It should be a place where agents can:
- identify themselves
- inspect permissions and policy
- discover capabilities
- run safety/security checks
- request approvals
- start and track governed actions
- retrieve relevant context
- leave behind clean operational records

Portal should feel like an environment for agents, with human supervision layered on top.

---

## Core product framing

DashClaw Portal exists because agents currently have prompts and tools, but not a real environment.

Portal should solve that by giving agents a governed place to:
1. understand where they are
2. understand what they can do
3. understand what is allowed
4. safely invoke capabilities
5. request approval when needed
6. track action lifecycle and outcomes

This should be implemented as a real DashClaw feature, not just mocked marketing copy.

---

## Your objective

Build a first-pass Portal product surface inside DashClaw that makes the concept concrete and navigable.

The end result should make a human reviewer feel:
- this is distinct from the normal dashboard
- this is clearly agent-facing
- this is capability/policy/action oriented
- this could become a real machine-native operating layer

Do not build a toy landing page only.
At minimum, build a usable product surface with clear internal structure.

---

## High-level feature scope for v1

Implement Portal around these five capability pillars:

### 1. Identity and trust introspection
A surface where the current agent/session can inspect:
- identity
- workspace/org
- granted scopes
- trust level
- budget/limits if available
- effective policy state

### 2. Capability registry
A browsable/searchable registry of capabilities, such as:
- secret scan
- prompt injection defense
- outbound review
- action preflight
- action tracking
- approval request
- memory/context search
- replay

This can be seeded with static/demo data at first if needed, but the architecture should make real wiring obvious.

### 3. Safety/security utilities
A section or capability detail flow for running governed checks, such as:
- prompt injection defense
- secret scan
- outbound review
- URL/content risk scan

### 4. Action lifecycle
A structured action flow where an agent can:
- start an action
- inspect preflight state
- see approval requirement state
- update status
- complete/fail action
- see outcome summary

### 5. Context and policy visibility
A surface for:
- effective policy/profile visibility
- context retrieval or related-prior-actions display
- structured explanation of constraints and next-step recommendations

---

## Product requirements

### The Portal must feel agent-native
This is critical.

Avoid making this feel like:
- a standard admin dashboard
- a human CRM
- a generic settings page
- a normal SaaS homepage with agent language pasted onto it

It should feel like a place where a machine agent can orient, inspect, invoke, and record actions.

### The Portal must show object types clearly
The interface should visibly distinguish between:
- identities
- capabilities
- policies
- actions
- context bundles
- approval states

### The Portal must feel operational
Important questions a user should be able to answer quickly:
- what capabilities are available
- what is allowed vs blocked vs approval-gated
- what action is being attempted
- what happened in the last action
- what should happen next

### The Portal must be credible as product direction
Even if some data is seeded or mocked for v1, the result should feel like a serious foundation for future real wiring.

---

## UX / design direction

Follow the design intent from these ideas:
- dark-first
- machine-native
- exact
- policy-aware
- structured, not chatty
- discoverable, not cluttered
- serious, not cyberpunk
- elegant, not flashy

The Portal should feel calmer and more structured than the normal DashClaw control-plane UI.

Prioritize:
- capability cards
- policy/introspection panels
- structured action views
- semantic status badges
- searchable registry patterns
- clean layout with strong grouping

Do not rely on giant decorative gradients or empty marketing-space minimalism.

---

## Suggested information architecture

Implement a Portal entry in the app navigation and build at least these views or equivalent sections:

### Portal home
Should show:
- current identity / trust / workspace summary
- effective policy summary
- top capabilities
- recent actions
- recommended next steps or common tasks

### Capability registry
Should show:
- searchable list/grid of capabilities
- category filters if useful
- risk level
- approval requirement
- short purpose description

### Capability detail / invoke view
For a selected capability, show:
- description
- input contract or sample input area
- policy notes
- status / availability
- invoke or simulate action area

### Action trace / run view
Show:
- action name
- state timeline
- preflight result
- approval status
- outputs / artifacts
- summary/outcome

### Policy/context panel or page
Show:
- effective constraints
- relevant policy snippets or summaries
- related context or past actions

You do not have to use these exact route names, but the structure should be clearly present.

---

## Data model expectations

You may use mocked or seeded data where needed, but model the UI around realistic object shapes.

Examples:

### Identity object
```json
{
  "id": "agent_openclaw_main",
  "type": "agent",
  "workspace": "org_default",
  "trustTier": "standard",
  "scopes": ["actions:create", "security:scan", "approvals:request"],
  "budget": {
    "dailyUsd": 5,
    "remainingUsd": 4.22
  }
}
```

### Capability object
```json
{
  "id": "prompt-injection-defense",
  "name": "Prompt Injection Defense",
  "category": "security",
  "riskLevel": "medium",
  "requiresApproval": false,
  "description": "Analyze content for prompt injection and unsafe instruction contamination.",
  "status": "available",
  "inputSchemaSummary": "text | html | markdown | fetched_content",
  "outputSchemaSummary": "risk score, findings, recommended action"
}
```

### Action object
```json
{
  "id": "act_demo_001",
  "actionType": "outbound_review",
  "goal": "Review outbound client email before send",
  "status": "approval_required",
  "riskScore": 68,
  "approvalState": "pending",
  "artifacts": [],
  "summary": null
}
```

### Policy summary object
```json
{
  "profile": "default-governed",
  "rules": [
    "External sends require review above risk threshold 60",
    "Secret leakage blocks action",
    "Unknown content source triggers prompt-injection scan"
  ]
}
```

---

## Technical implementation guidance

Use the existing DashClaw architecture and patterns wherever reasonable.
Do not create a disconnected mini-app unless the repo architecture truly requires it.

### Expectations
- integrate with the current app structure cleanly
- reuse existing UI primitives/components/styles where appropriate
- keep naming consistent with DashClaw concepts
- keep code readable and production-leaning
- if mocked data is necessary, isolate it cleanly so it can later be replaced by real sources

### Prefer
- clear route/page structure
- reusable presentational components
- small seeded data modules if needed
- realistic state/status handling
- obvious extension points for future backend wiring

### Avoid
- hacky one-file demo pages
- lorem ipsum product copy
- fake features with no internal logic at all
- overengineering backend wiring that is not yet needed

---

## Desired output quality

The result should look like something that could be shown as:
- an internal product direction demo
- a foundation for real buildout
- a strong concept prototype for the Portal thesis

It should not look like:
- a UI sketch tossed together in one hour
- a standard dashboard page renamed to "Portal"
- a chat app with a few cards added

---

## Deliverables

1. Implement the Portal surface in the DashClaw codebase
2. Add any necessary routes/pages/components/data scaffolding
3. Make the experience visually and structurally distinct from existing dashboard surfaces
4. Ensure the Portal communicates:
   - identity
   - capability discovery
   - policy visibility
   - safety utilities
   - action lifecycle
5. Document what you built and what remains mocked or conceptual

---

## Final quality bar

When finished, a reviewer should be able to say:
- "I understand why this exists"
- "I understand how an agent would use it"
- "This feels like a real machine-native operating surface"
- "This could plausibly become a core DashClaw product direction"

If the result looks stylish but does not communicate those things, keep refining.

---

## Bonus points

If time permits, include any of the following:
- recent action replay panel
- recommended next capability suggestions
- approval queue snippet
- schema view for capability inputs/outputs
- policy simulation result state
- context bundle / related prior actions panel

---

## Implementation note

Prefer shipping a coherent vertical slice over touching too many areas shallowly.
A polished Portal home + capability registry + one strong invoke/action flow is better than ten weak pages.

Build something real.
