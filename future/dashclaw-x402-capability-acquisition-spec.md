# DashClaw x402 Capability Acquisition

## Product Spec v1

## 1. Product Overview

### Summary
DashClaw enables agents to acquire paid external capabilities on demand through x402 and AgentCash, with operator visibility, governance, and decision logging built in.

### Product Thesis
This is not a crypto payment feature.

This is a governed capability acquisition system for agents.

DashClaw should let operators understand:
- what an agent bought
- why it bought it
- how much it spent
- what it got back
- whether the spend was justified
- what business outcome the purchase supported

### Core Value
- reduces setup friction for paid APIs
- increases agent autonomy
- adds governance to external tool use
- makes spend legible and reviewable
- improves end-to-end workflows from research to artifact delivery

---

## 2. Goals

### Primary Goals
- Let agents buy paid API access only when needed
- Make every paid acquisition visible in DashClaw
- Apply policy and approval controls before spend happens
- Connect spend to task outcomes, artifacts, and decisions
- Build a reusable foundation for paid research, enrichment, and publishing workflows

### Non-Goals
- general crypto wallet management product
- open-ended marketplace of every x402 provider on day one
- consumer-facing payments UX
- irreversible transactional automation in v1

---

## 3. User Types

### Operator
The human overseeing agents, budgets, policies, and outcomes.

Needs:
- visibility into spend and rationale
- policy controls
- approval workflows
- business-readable logs
- provider performance data

### Agent
The autonomous system making decisions during workflows.

Needs:
- a standard way to discover providers
- policy-aware purchase execution
- fallback behavior when blocked
- structured logging for purchase rationale and outcomes

### Admin
Workspace owner or system administrator.

Needs:
- provider allow/block controls
- spend caps
- category restrictions
- auditability across teams and agents

---

## 4. Core Use Cases

### 4.1 Paid Research
Examples:
- competitor analysis
- market mapping
- company research
- Reddit/X scanning
- citation-backed reporting

### 4.2 Sales and Lead Intelligence
Examples:
- company discovery
- org and people enrichment
- email verification
- LinkedIn profile enrichment

### 4.3 Local Market Intelligence
Examples:
- local business prospecting
- territory scans
- competitor footprint analysis

### 4.4 Shareable Artifact Generation
Examples:
- upload research reports
- host markdown or docs
- publish simple microsites
- share decision memos and client deliverables

---

## 5. Functional Requirements

## 5.1 Capability Acquisition Flow
The system must support this end-to-end flow:

1. Agent detects an information or capability gap
2. Agent evaluates available providers
3. DashClaw checks policy and spend limits
4. If allowed, DashClaw executes the x402 purchase
5. Agent receives result from provider
6. DashClaw logs spend, rationale, result summary, and outcome
7. If relevant, DashClaw attaches resulting artifacts or links to the task record

### Acceptance Criteria
- Every paid call creates a structured record in DashClaw
- Every paid call is linked to a task, action, or decision
- Policy checks happen before execution
- Failed calls are logged distinctly from successful ones
- Operators can review all purchases after the fact

---

## 5.2 x402 Action Logging
DashClaw must support a dedicated action type or subtype for paid capability acquisition.

### Required Fields
- action_id
- task_id
- parent_action_id
- decision_id
- agent_id
- provider_id
- provider_name
- endpoint_name
- endpoint_url
- category
- spend_amount
- currency
- payment_method
- wallet_id or wallet_label
- purchase_reason
- context_gap
- alternatives_considered
- expected_value
- approval_status
- approval_actor
- execution_status
- result_summary
- result_reference
- value_score
- confidence_score
- started_at
- completed_at
- failure_reason

### Acceptance Criteria
- x402 actions appear in the decision timeline
- operators can distinguish purchase intent, execution, and outcome
- structured fields are queryable for analytics and policy enforcement

---

## 5.3 Spend-Aware Decision Logging
Whenever a paid call is made, DashClaw must record:
- what gap the agent was trying to close
- why a provider was chosen
- what alternatives existed
- what value was expected
- whether the result was useful

### Acceptance Criteria
- paid actions cannot be logged without rationale fields
- operator can view rationale in the action detail panel
- rationale is linked to downstream outcome assessment

---

## 5.4 Policy Guardrails
DashClaw must support pre-execution policy enforcement.

### Policy Controls
- max spend per call
- max spend per task
- max spend per agent per day
- allowed providers list
- blocked providers list
- allowed categories
- blocked categories
- approval threshold by dollar amount
- approval requirement by endpoint category
- sensitivity-based restrictions

### Policy Categories
Example defaults:
- research: allowed
- uploads: allowed
- enrichment: allowed with logging
- personal data enrichment: approval-gated
- outreach-related actions: blocked or separate approval path
- high-sensitivity identity/property lookups: restricted

### Acceptance Criteria
- blocked requests fail before payment execution
- approval-required actions pause cleanly for human review
- policy decision is visible in logs
- operators can edit policies per workspace

---

## 5.5 Provider Registry
DashClaw must provide a registry of supported x402 providers and endpoints.

### Registry Data
- provider name
- endpoint list
- description
- category
- pricing
- average latency
- success rate
- historical usage count
- historical value score
- last used
- example use cases
- status: active, disabled, experimental

### Acceptance Criteria
- operator can browse providers in UI
- agent selection logic can read provider metadata
- registry supports curation, not uncontrolled provider sprawl

---

## 5.6 Cost-to-Value Feedback
After a paid call, DashClaw must capture whether the result justified the spend.

### Feedback Inputs
- agent self-assessment
- operator assessment
- task outcome linkage
- artifact generated yes/no
- downstream task completion impact

### Scoring Outputs
- useful / not useful
- justified / not justified
- provider value score
- provider preference weight
- future recommendation signal

### Acceptance Criteria
- each paid call can be scored after execution
- provider-level value trends are aggregated over time
- low-value providers can be deprioritized automatically later

---

## 5.7 Artifact Workflow
DashClaw must treat uploads and published outputs as first-class artifacts.

### Artifact Types
- uploaded file
- hosted markdown page
- hosted microsite
- lead sheet
- research memo
- decision memo

### Required Artifact Fields
- artifact_id
- source_action_id
- task_id
- title
- artifact_type
- file_url or site_url
- previewable summary
- created_at
- share_status

### Acceptance Criteria
- artifacts are linked to the paid action that created them
- artifacts are visible from task, timeline, and output views
- uploads are not stored as raw links only

---

## 6. UI Specification

## 6.1 Decision Timeline Updates
### Purpose
Make paid capability acquisition legible in the existing DashClaw timeline.

### UI Elements
- new action badge: "Paid Capability"
- provider chip
- spend amount chip
- approval state chip
- result status
- quick summary text

### Timeline Card Content
- agent bought Exa Search for competitor research
- cost: $X.XX
- rationale: "Needed current web coverage beyond free sources"
- result: "12 relevant sources returned"
- outcome: "Used in final report"
- link to artifact if created

### User Actions
- expand details
- view raw result metadata
- view related decision
- open policy evaluation
- see linked artifact

---

## 6.2 x402 Action Detail Drawer/Page
### Sections
#### A. Overview
- provider
- endpoint
- category
- spend
- timestamp
- agent
- task
- parent action

#### B. Why It Was Purchased
- context gap
- reason for purchase
- alternatives considered
- expected value

#### C. Policy Evaluation
- policy result
- whether approval was required
- who approved
- applied rule set

#### D. Result
- execution status
- result summary
- parsed output highlights
- failure reason if applicable

#### E. Outcome Assessment
- value score
- usefulness rating
- operator assessment
- business outcome supported

#### F. Linked Artifacts
- report
- upload
- site
- lead sheet
- share link

---

## 6.3 Spend Dashboard
### Purpose
Give operators a high-level view of capability spend and value.

### Sections
#### A. Summary Cards
- total spend
- spend this week
- successful paid calls
- failed paid calls
- approval-gated events
- average value score

#### B. Spend by Provider
- table or bar chart
- provider
- total spend
- call count
- avg value
- success rate

#### C. Spend by Workflow
- competitor research
- GTM prospecting
- local market scanning
- publishing

#### D. Value Analysis
- cost per useful artifact
- justified vs unjustified spend
- top providers by ROI
- worst-performing providers

#### E. Exceptions
- blocked calls
- policy violations
- high-cost outliers
- repeated low-value purchases

---

## 6.4 Provider Registry View
### Sections
#### A. Provider Catalog
- searchable list
- filter by category
- filter by allowed/blocked
- filter by active/experimental

#### B. Provider Detail
- description
- endpoints
- pricing
- success rate
- average value score
- historical usage
- example use cases

#### C. Governance Panel
- allowed or blocked
- max spend overrides
- category restrictions
- approval threshold

---

## 6.5 Approval Queue
### Purpose
Handle actions requiring human review before payment execution.

### Queue Item Fields
- requesting agent
- task
- provider
- endpoint
- estimated cost
- reason
- sensitivity category
- expected business value

### Approval Actions
- approve once
- approve for task
- deny
- adjust spend ceiling
- add provider rule

---

## 6.6 Workflow Templates UI
DashClaw should expose first-class workflow templates for demoable use cases.

### Initial Templates
- Competitor Research
- GTM Prospecting
- Local Market Scanner
- Research-to-Site Publishing

### Each Template Should Show
- required providers
- estimated spend range
- artifact outputs
- policy requirements
- expected value

---

## 7. Backend Requirements

## 7.1 Data Model

### New / Updated Entities

#### x402_providers
Fields:
- id
- name
- slug
- description
- category
- base_url
- status
- default_currency
- pricing_model
- created_at
- updated_at

#### x402_endpoints
Fields:
- id
- provider_id
- name
- slug
- description
- endpoint_url
- category
- sensitivity_level
- default_price
- price_unit
- enabled
- created_at
- updated_at

#### x402_purchases
Fields:
- id
- task_id
- action_id
- decision_id
- parent_action_id
- agent_id
- provider_id
- endpoint_id
- spend_amount
- currency
- wallet_reference
- payment_reference
- approval_status
- policy_result
- reason_for_purchase
- context_gap
- alternatives_considered
- expected_value
- execution_status
- raw_response_ref
- result_summary
- value_score
- operator_feedback
- created_at
- completed_at

#### x402_policies
Fields:
- id
- workspace_id
- name
- max_spend_per_call
- max_spend_per_task
- allowed_provider_ids
- blocked_provider_ids
- allowed_categories
- blocked_categories
- approval_threshold
- sensitivity_rules
- active
- created_at
- updated_at

#### x402_approvals
Fields:
- id
- purchase_id
- requested_by_agent_id
- status
- requested_at
- decided_at
- decided_by
- decision_notes

#### artifacts
If not already sufficient, extend artifact model with:
- source_purchase_id
- artifact_type
- external_url
- preview_summary
- share_status

---

## 7.2 Action System Integration
The existing action model must support x402-related action types or subtypes.

### Requirements
- add `x402_purchase` subtype or equivalent
- link actions to purchases
- link purchases to outcomes
- support timeline rendering and filtering
- preserve observability compatibility with current action records

---

## 7.3 Policy Engine
A preflight policy evaluation service must run before any x402 execution.

### Inputs
- agent
- task context
- provider
- endpoint
- category
- estimated cost
- sensitivity
- workspace policy

### Outputs
- allowed
- blocked
- approval_required
- applied_rule
- denial_reason

### Requirements
- deterministic evaluation
- full audit trail
- reusable across all workflows
- workspace-level configuration support

---

## 7.4 x402 Execution Service
Build a service responsible for:
- provider discovery
- endpoint selection support
- executing x402 purchase flow
- capturing payment metadata
- handling retries and failures
- normalizing responses for DashClaw logging

### Requirements
- provider adapters for Tier 1 integrations
- timeout handling
- retry policy for transient errors
- no silent failures
- purchase state machine: pending, approval_required, approved, executing, succeeded, failed, blocked

---

## 7.5 Provider Adapter Layer
Implement adapters per provider so the rest of DashClaw uses a unified interface.

### Common Adapter Interface
- discover()
- estimateCost()
- execute()
- normalizeResult()
- classifySensitivity()

### Tier 1 Adapters
- Exa Search
- Exa Contents
- Firecrawl Scrape
- Grok X Search
- StableUpload Upload

### Tier 2 Adapters
- Apollo Org Search
- Apollo People Search
- Hunter Email Verifier
- Google Maps Nearby Search
- Exa Find Similar

---

## 7.6 Metrics and Analytics Pipeline
The backend must track:

### Usage Metrics
- spend per task
- spend per provider
- successful paid calls
- failed paid calls
- provider reuse rate

### Decision Metrics
- justified vs unjustified spend
- blocked events
- approval-required events
- value score by provider
- completion lift after enrichment

### Product Metrics
- time saved vs manual workflow
- artifact generation rate
- repeat workflow usage
- operator approval rate

### Requirements
- queryable in dashboard
- exportable for analysis later
- rollups by workspace, agent, provider, and workflow

---

## 7.7 Auditability and Compliance
Every paid capability action must be auditable.

### Requirements
- immutable core purchase log
- policy decision recorded
- approval decision recorded
- payment metadata retained
- linked business outcome retained
- operator-readable summary retained

---

## 8. Recommended v1 Workflows

## 8.1 Competitor Research Workflow
### Steps
1. define company or market
2. search with Exa / Firecrawl / Grok X
3. synthesize findings
4. generate report
5. upload report via StableUpload
6. attach artifact and spend log to task

### Why First
- easy to demo
- immediately useful
- shows research plus artifact creation in one flow

---

## 8.2 GTM Prospecting Workflow
### Steps
1. define ICP or target segment
2. search companies
3. enrich organizations and people
4. verify emails
5. generate lead sheet
6. upload/share output
7. log all purchases and outcomes

---

## 8.3 Local Market Scanner
### Steps
1. define geography and niche
2. search local businesses
3. enrich place details
4. cluster and prioritize
5. generate outreach/research dossier

---

## 8.4 Research-to-Site Publishing
### Steps
1. gather data
2. generate summary
3. publish report or microsite
4. attach share link as artifact

---

## 9. MVP Scope

### In Scope
- Tier 1 provider integrations
- x402 purchase logging
- policy allowlist/blocklist
- spend caps
- approval thresholds
- timeline support
- provider registry
- spend dashboard basics
- artifact linking
- competitor research workflow

### Out of Scope for MVP
- automatic multi-provider fallback chains
- autonomous provider ranking loops
- advanced confidence-aware purchase decisions
- broad marketplace onboarding
- irreversible action purchases

---

## 10. Risks and Mitigations

### Risk: Overuse of Paid Calls
Mitigation:
- spend caps
- value scoring
- provider usage review
- approval thresholds

### Risk: Sensitive Data Misuse
Mitigation:
- endpoint classification
- approval gates
- category restrictions
- operator-visible logs

### Risk: Provider Sprawl
Mitigation:
- curated registry
- phased rollout
- admin controls

### Risk: Low-Value Results
Mitigation:
- outcome scoring
- provider rankings
- operator review feedback
- future deprioritization

---

## 11. Implementation Roadmap

### Phase 1: Foundation
- x402 provider and endpoint models
- purchase logging
- action integration
- policy engine
- spend caps and allowlists

### Phase 2: First-Class Workflows
- competitor research flow
- upload/share artifact flow
- initial dashboard wiring

### Phase 3: Operator UX
- provider registry UI
- spend dashboard
- approval queue
- value scoring UX

### Phase 4: Advanced Autonomy
- provider recommendation
- fallback chains
- confidence-aware purchase logic
- post-purchase learning loop

---

## 12. Immediate Build Priorities
1. Add x402 purchase records to backend data model
2. Add x402 purchase cards to the decision timeline
3. Build Tier 1 adapters
4. Add provider allowlist and spend cap policies
5. Build the competitor research workflow
6. Treat uploads as first-class artifacts

---

## 13. Positioning
### Plain-English Positioning
DashClaw helps agents buy and use external capabilities safely, visibly, and only when it’s worth it.

### Internal Product Framing
- agent capability acquisition
- governed external tool use
- decision-aware API purchasing
- payment-aware agent observability
