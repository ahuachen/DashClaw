# DashClaw Agent Operating Layer Roadmap

Date: 2026-04-07
Owner: Product / Platform
Status: Proposed

## Purpose

This roadmap turns the current DashClaw platform shape into a concrete build sequence aimed at:

1. increasing adoption and revenue,
2. sharpening the product's core wedge,
3. making DashClaw meaningfully harder to replace with stitched-together tools.

The recommended strategy is:

- Lead with the capability gateway as the commercial wedge.
- Strengthen workflow execution so DashClaw runs real work, not just governs it.
- Unify the operator experience so the platform feels like one system.
- Add first-class artifacts/evidence so work products live inside DashClaw.
- Tighten docs, SDK maturity, and starter paths so teams can adopt quickly.

## Product Thesis

DashClaw should evolve from "decision infrastructure" into:

**The governed runtime and control plane for agent work.**

That means the product should become the default place where teams:

- register callable capabilities,
- execute workflows,
- route model calls,
- approve risky actions,
- inspect failures and drift,
- review artifacts and evidence,
- manage agent sessions and operating posture.

## Prioritization Principles

Use these rules when choosing what to build first:

1. Prefer features that improve adoption, paid usage, or stickiness within one quarter.
2. Prefer deepening existing high-leverage surfaces over adding new surface area.
3. Prefer features that make DashClaw the execution chokepoint for agent work.
4. Prefer features with clear operator-visible value over backend-only sophistication.
5. Do not expand compliance or peripheral memory features until the runtime spine is stronger.

## Roadmap Overview

### Now — SHIPPED (v2.9–v2.11)

All NOW tier items have been delivered:

- Capability Gateway V2: contracts, runtime hardening (retry, circuit breaker), operator surface, health, certification
- Workflow Runtime V2: run persistence, conditional execution, continue-on-failure, resume from checkpoint, cancel, run detail page
- Operator Cockpit V1: unified operations feed, decision support actions (approve/deny/retry/disable/cancel), runtime summary
- Docs/SDK Maturity: product story refresh, SDK tiers, ROADMAP.md, maturity labels on all UI pages

### Next — SHIPPED (v2.11)

- Artifact & Evidence Layer (M1+M2): durable artifacts table, CRUD routes, auto-capture from workflow steps, evidence bundle endpoint, artifacts tab on decision and run detail pages
- Runtime Observability & Recovery: stuck workflow + approval backlog signals, cancel workflow action, runtime summary metrics widget
- Pricing & Packaging: deferred (plan exists at `docs/superpowers/plans/2026-04-06-billing-metering.md`)

### Later

Time horizon: next major cycle

Goal: complete the transition into a differentiated operating layer for agent teams.

---

## NOW

## 1. Capability Gateway V2

### Why this is first

This is the clearest monetizable wedge. It puts DashClaw directly in the highest-leverage path: tool invocation.

### Outcome

DashClaw becomes the governed gateway for external APIs and internal tools, with strong enough contracts that teams trust it for production use.

### Deliverables

- Versioned capability contract model
- Request validation and response validation
- Health checks and health history per capability
- Retry policy support per capability
- Timeout policy support per capability
- Better auth binding and secret resolution UX
- Capability test harness and certification flow
- Operator-facing capability status and recent failure visibility

### Concrete milestones

#### M1. Contract hardening

- Add structured schema fields for request, response, auth requirements, error taxonomy, and version.
- Reject invalid capability definitions at create/update time.
- Validate invocation input before the network call.
- Validate mapped output before returning success.

#### M2. Runtime hardening

- Add retry policies: none, fixed, exponential.
- Add explicit retryable status code handling.
- Add circuit-open style health degradation after repeated failures.
- Record richer invocation outcome data: status code, retry count, failure class, latency bucket.

#### M3. Capability operator surface

- Add capability detail page sections for health, error rate, p95 latency, last success, and approval requirements.
- Add "test capability" flow from UI.
- Add capability certification badge based on passing contract and test checks.

### Success metrics

- Teams can onboard at least 3 real capabilities without custom glue.
- Capability invocation success rate is measurable and reviewable per capability.
- At least one pricing or packaging lever can be tied to capability invocations.

### Non-goals for Now

- Full marketplace
- Full sandboxed execution
- Arbitrary plugin runtime

---

## 2. Workflow Runtime V2

### Why this is second

DashClaw now has a real workflow execution path, but it is still too shallow for serious operational workflows. This is the biggest product-depth gap after capability runtime.

### Outcome

DashClaw workflows can run meaningful multi-step governed work with enough resilience to be used beyond demos and internal experiments.

### Deliverables

- Step retry support
- Step outputs as named runtime artifacts
- Conditional branching
- Resume from failed or interrupted runs
- Checkpoints for long-running workflows
- Better workflow execution history and step diagnostics

### Concrete milestones

#### M1. Step reliability

- Add per-step retry configuration.
- Add timeout and failure classification per step.
- Add explicit step status model: pending, running, completed, failed, skipped.

#### M2. Control flow

- Add basic `if` branching using prior step outputs and variables.
- Add step dependency semantics.
- Add `continue_on_failure` where appropriate for non-critical steps.

#### M3. Resume and checkpoints

- Persist step execution state.
- Support resume from last completed checkpoint.
- Support rerun-from-step for operator intervention.

#### M4. Workflow visibility

- Add workflow run detail UI with timeline, step outputs, step failures, and linked actions.
- Add workflow run filters for failed, blocked, waiting approval, and slow.

### Success metrics

- One internal or demo workflow uses resume/checkpoint semantics successfully.
- Operators can diagnose a failed workflow without reading server logs.
- Workflow runs produce durable step-by-step evidence records.

### Non-goals for Now

- General-purpose DAG engine
- Full Temporal-style orchestration
- Multi-day distributed workflow scheduling

---

## 3. Operator Cockpit V1

### Why this is third

DashClaw has many useful surfaces, but they still feel fragmented. This is a product clarity problem, not just a UI problem.

### Outcome

Operators can answer the core operational questions from one place:

- What is running?
- What is blocked?
- What needs approval?
- What failed?
- What is drifting?
- What is costing money?

### Deliverables

- Unified live operations dashboard
- Shared queue for approvals, failures, stalled sessions, degraded capabilities, and failed workflows
- Common filter model across actions, sessions, workflows, and capabilities
- Clear severity model

### Concrete milestones

#### M1. Unified operations feed

- Build one page combining pending approvals, failed workflow runs, stalled sessions, critical drift alerts, and degraded capabilities.
- Add severity labels and timestamps.

#### M2. Shared drill-down model

- Standardize links from feed items to action replay, workflow run detail, session detail, capability detail, or policy evidence.
- Ensure every operational alert has a clear "why" view.

#### M3. Decision support

- Add recommended next action for each critical item, for example:
  - approve/deny
  - retry run
  - disable capability
  - tighten policy
  - re-run health check

### Success metrics

- Operators can resolve common incidents from one area of the product.
- New users understand the platform faster because the system reads as one operating surface.

### Non-goals for Now

- Full dashboard redesign
- Heavy analytics exploration UI

---

## 4. Docs, Positioning, and SDK Maturity Cleanup

### Why this is fourth

The code has outgrown the story. Right now DashClaw is easier to underestimate than it should be.

### Outcome

DashClaw tells one clear story externally and internally:

**Governed capability gateway + workflow runtime + operator control plane.**

### Deliverables

- Updated README framing
- Explicit maturity map by product area
- Resolved SDK parity documentation drift
- Clear "start here" adoption paths

### Concrete milestones

#### M1. Product story refresh

- Reframe README and connect docs around the new spine.
- Keep "governance" as the trust layer, not the whole identity.

#### M2. Maturity labeling

- Mark surfaces as stable, beta, or experimental across docs and UI.
- Publish one canonical feature matrix for Node v2, Node legacy, Python, and raw HTTP.

#### M3. Adoption paths

- Publish 3-5 opinionated starter guides:
  - governed coding agent,
  - governed customer comms agent,
  - governed tool gateway,
  - RAG plus workflow stack,
  - enterprise audit-ready setup.

### Success metrics

- Reduced confusion around SDKs and platform shape.
- Faster conversion from repo visitor to trial user.

---

## NEXT

## 5. First-Class Artifact and Evidence Layer

### Why this matters

Without first-class artifacts, DashClaw governs work but does not fully contain the work product. That weakens platform gravity.

### Outcome

Artifacts become durable objects in the system, not just strings attached to actions.

### Deliverables

- Artifact model with type, lineage, owner, retention, and permissions
- Artifact attachment to actions, workflow steps, sessions, and compliance exports
- Artifact preview/search/diff support for key types
- Evidence bundles composed from artifacts plus governance records

### Concrete milestones

#### M1. Artifact schema

- Define artifact table(s) and reference model.
- Support core artifact types: file, patch, report, JSON payload, transcript, evidence bundle.

#### M2. Artifact linkage

- Link artifacts to workflow steps, actions, sessions, and capabilities.
- Surface artifacts in replay and workflow run views.

#### M3. Operator usability

- Add artifact previews where feasible.
- Add evidence bundle export from action or workflow scope.

### Success metrics

- Important outputs from workflows and capabilities are reviewable inside DashClaw.
- Compliance and debugging surfaces rely on first-class evidence objects, not ad hoc summaries.

---

## 6. Runtime Observability and Recovery

### Why this matters

Inspection after the fact is not enough. DashClaw needs more explicit production operations semantics.

### Outcome

DashClaw becomes better at telling operators when the runtime is unhealthy and what to do about it.

### Deliverables

- Queue depth and stuck-run detection
- Capability failure clustering
- Workflow bottleneck analytics
- Approval delay analytics
- Recovery actions and retry orchestration

### Concrete milestones

#### M1. Runtime health signals

- Add metrics for stuck workflows, degraded capabilities, repeated retries, and approval backlog.

#### M2. Recovery actions

- Add operator-triggered retry, resume, cancel, disable-capability, and requeue actions.

#### M3. System summaries

- Add org-level runtime summary for throughput, failures, latency, and backlog.

### Success metrics

- Operators can identify and remediate runtime health issues without DB inspection.

---

## 7. Pricing and Packaging That Matches the Product

### Why this matters

If DashClaw becomes the execution gateway, pricing should map to where value is created.

### Outcome

Packaging aligns with usage patterns that customers understand.

### Deliverables

- Pricing levers around governed actions, capability invocations, workflow runs, and seats/org controls
- Plan limits that match operator value
- Clear upgrade paths

### Concrete milestones

#### M1. Packaging design

- Define free, pro, and enterprise packaging tied to the platform spine.

#### M2. Product enforcement

- Ensure billing and quota surfaces map cleanly to the new packaging.

#### M3. Upgrade UX

- Add contextual upgrade messaging from quota-bound runtime surfaces.

### Success metrics

- Packaging reads naturally from product usage.
- Sales and onboarding conversations become simpler.

---

## LATER

## 8. Multi-Agent Task Topology

### Why this moves later

It matters, but it is not the shortest path to adoption. It becomes more valuable once capabilities and workflows are stronger.

### Outcome

DashClaw can manage not just individual agents, but coordinated agent teams with explicit ownership and dependency structure.

### Deliverables

- Parent/child task model
- Dependency graph across agent tasks
- Ownership and blocking semantics
- Escalation flows
- Resource contention visibility

### Success metrics

- Operators can answer who owns a task, what is blocked, and what is on the critical path.

---

## 9. Trust, Permissions, and Delegated Authority

### Why this moves later

The platform already has pairings and identity primitives, but deeper trust boundaries matter most once teams rely on DashClaw for serious execution.

### Outcome

DashClaw has a credible authority model for many-agent environments.

### Deliverables

- Agent roles and scoped permissions
- Capability access policies by agent/org/environment
- Delegated authority model
- Approval chains by action class
- Provenance guarantees for artifacts and actions

### Success metrics

- Customers can safely run multiple agents with distinct authority boundaries.

---

## 10. Memory Architecture Unification

### Why this moves later

Knowledge collections are useful, but a full memory operating model is a second-order platform improvement after the runtime spine is stronger.

### Outcome

DashClaw has a clear model for episodic, semantic, procedural, and preference memory across scopes.

### Deliverables

- Memory scope model
- Freshness and trust metadata
- Memory retention and compaction rules
- Retrieval debugging and provenance

### Success metrics

- Memory behavior is inspectable, governable, and predictable.

---

## 11. Advanced Model Operations

### Why this moves later

Model strategies are already valuable, but advanced model ops should follow stronger workflow and capability usage.

### Outcome

DashClaw becomes a measurable model routing layer, not just a config surface.

### Deliverables

- A/B strategy experiments
- rollout controls
- structured output validation
- prompt/version lineage at execution time
- benchmarking across cost, latency, and quality

### Success metrics

- Teams can compare model strategies with real runtime evidence.

---

## What To Avoid

Avoid these until the above roadmap is materially complete:

- broadening compliance surface area without stronger evidence plumbing,
- adding more niche admin APIs,
- expanding low-leverage memory or preference features,
- adding more feature clusters that do not connect to the runtime spine,
- building a marketplace before the capability runtime is mature.

## Recommended Execution Order

Use this order for implementation planning:

1. Capability Gateway V2
2. Workflow Runtime V2
3. Operator Cockpit V1
4. Docs, Positioning, and SDK Maturity Cleanup
5. Artifact and Evidence Layer
6. Runtime Observability and Recovery
7. Pricing and Packaging
8. Multi-Agent Task Topology
9. Trust and Permissions
10. Memory Architecture
11. Advanced Model Ops

## Suggested Epic Breakdown for Claude Code

If this roadmap is going to be executed with Claude Code, break it into epics in this order:

1. `epic-capability-gateway-v2`
2. `epic-workflow-runtime-v2`
3. `epic-operator-cockpit-v1`
4. `epic-positioning-sdk-maturity`
5. `epic-artifact-evidence-layer`
6. `epic-runtime-observability-recovery`
7. `epic-packaging-billing-alignment`
8. `epic-multi-agent-topology`
9. `epic-trust-permissions-authority`
10. `epic-memory-architecture`
11. `epic-advanced-model-ops`

Each epic should have:

- a design spec,
- a milestone plan,
- explicit non-goals,
- verification commands,
- rollout notes,
- docs updates.

## Recommended First Build Sprint

If starting immediately, the first sprint should produce:

- capability contract validation,
- capability health model,
- capability test/certification flow,
- step retry support for workflows,
- workflow run detail page,
- one unified operator feed,
- README and SDK maturity cleanup.

That sprint would give DashClaw a visibly sharper story:

**DashClaw governs and runs tool-backed agent work, not just logs it.**
