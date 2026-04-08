# Policy Manual Authoring Guided UX Design

Date: 2026-04-08
Status: Draft for review
Owner: Codex

## Summary

DashClaw's policy surface already has some structured controls, but the operator
experience is still too close to policy structure instead of policy intent. The
main Policies page mixes too many responsibilities into one screen, and the
manual create/edit flow still leaks rule structure, hidden JSON expectations,
and advanced concepts into the primary operator path.

This spec improves the manual create/edit authoring experience first, without
trying to redesign the entire policies surface in one pass.

Wave 1 covers:

- guided manual create flow on the main Policies page
- guided manual edit flow on the main Policies page
- type-specific builders for the six current policy types
- human-readable policy summaries
- agent scope remains structured and first-class

Wave 1 does not redesign:

- AI policy generation
- raw YAML import
- policy-pack install
- proof report flow
- policy test runner
- full page information architecture

## Problem

The main Policies page currently does too much at once:

- manual create/edit
- import policy pack
- raw YAML import
- simulation
- policy test runner
- template gallery
- proof report generation
- recent guard decisions

That density makes the page feel like a toolbox instead of a guided control
plane. Within that page, the manual authoring path is still too close to the
underlying rule model:

- operators must reason about rule shapes and policy types instead of guided
  outcomes
- create/edit logic is buried inside a large page file
- summaries are present but not the primary authoring model
- advanced concepts and operational utilities sit too close to the default
  authoring path

This is the same core problem already fixed in Capabilities and Model
Strategies: the system knows the domain model, but the UI still asks the
operator to think like the storage format.

## Goals

- Make manual policy creation feel guided and type-specific.
- Make editing use the same structured form as creation.
- Keep the main user task focused on policy intent, not serialized rules.
- Compile back into the existing route contract without backend changes.
- Improve legibility through human-readable summaries.

## Non-Goals

- No full redesign of the Policies page layout.
- No AI generator redesign in this slice.
- No YAML import redesign in this slice.
- No new backend policy schema.
- No removal of advanced import/test/proof capabilities.

## Recommended Scope

Wave 1 should only fix manual create/edit authoring.

That means:

- keep the rest of the Policies page intact for now
- replace the create/edit policy flow with structured type-specific builders
- keep raw YAML and AI generation outside the normal manual authoring path

This is the smallest slice that produces meaningful operator value without
turning the page into a multi-week redesign project.

## Supported Policy Types

Wave 1 should support the current manual policy types directly:

- risk threshold
- require approval
- block action type
- rate limit
- webhook check
- semantic check

These already map naturally to structured controls. That means the default
experience should never require YAML or JSON for any of them.

## Recommended Approach

Use a shared policy form model plus type-specific builder sections.

### Why This Approach

- It fits the existing API contract.
- It keeps the create/edit path consistent.
- It reduces operator confusion without reopening backend design.
- It creates a reusable pattern for the later AI and import slices.

## Primary UX Structure

The main create/edit flow should follow one consistent structure.

### Section 1: Policy Basics

Fields:

- policy name
- policy type

Purpose:

- identify the policy
- choose the intent category first, before dealing with rule details

### Section 2: Type-Specific Rule Builder

Each supported type gets a tailored builder:

#### Risk Threshold

Fields:

- threshold
- outcome: warn, block, require approval

Summary example:

> Block actions when risk is 80 or higher.

#### Require Approval

Fields:

- action-type chip picker

Summary example:

> Require approval for deploy and security actions.

#### Block Action Type

Fields:

- action-type chip picker

Summary example:

> Block deploy and cleanup actions entirely.

#### Rate Limit

Fields:

- max actions
- time window in minutes
- outcome

Summary example:

> Warn when an agent exceeds 50 actions in 60 minutes.

#### Webhook Check

Fields:

- webhook URL
- timeout
- on-timeout behavior

Summary example:

> Call `your-api.example.com` before allowing the action. If the webhook times
> out, allow the action.

#### Semantic Check

Fields:

- natural-language instruction
- fallback behavior

Summary example:

> Use a semantic check to evaluate whether the action violates the instruction:
> “Do not allow the agent to delete files in the system directory.”

### Section 3: Agent Scope

Keep the current structured agent scope selector.

Behavior:

- `All agents` remains the default
- selecting specific agents stays chip-based

Purpose:

- scope should remain a first-class part of authoring
- operators should not have to think about serialized `agent_ids`

### Section 4: Policy Summary

Every create/edit flow should show a human-readable summary that updates with
the form.

This summary should become the operator’s main mental model of the policy.

The summary should be:

- concise
- domain-language first
- clear about action, threshold, scope, and fallback behavior where relevant

## Create Flow Behavior

The create flow should:

- start with a default policy type
- show only the fields relevant to that type
- keep the page in form mode rather than rule-structure mode
- submit the current API contract:
  - `name`
  - `policy_type`
  - `rules`
  - `agent_ids`

The create flow should not:

- expose raw YAML or JSON as part of normal authoring
- force the user to understand `buildRulesJson(...)`-style internals

## Edit Flow Behavior

The edit flow should use the same builder as create.

That means:

- parse persisted policy rules into type-specific form state
- show the same builder controls
- show the same summary
- save back into the current route contract

This removes the split between “nice create flow” and “different edit flow.”

## Page-Level Scope Control

Wave 1 should intentionally avoid a full page rewrite.

That means:

- leave simulation where it is
- leave proof/test sections where they are
- leave YAML import and template gallery where they are
- only refactor the create/edit authoring seam

This keeps risk low and lets the page improve incrementally.

## Data Model Helpers

The UI should be backed by pure helper functions that handle:

- create default policy form state
- parse existing policy record into form state
- compile form state into the current request payload
- generate readable summary text by type

Suggested helper responsibilities:

- `createDefaultPolicyFormState()`
- `decompilePolicyForm(policy)`
- `compilePolicyPayload(formState)`
- `buildPolicySummary(formState)`

This keeps the page logic smaller and testable even if the page file remains
large in wave 1.

## Testing Strategy

Required coverage:

- helper tests for parse, compile, and summary by policy type
- page tests for guided create behavior
- page tests for edit behavior
- keep existing route tests unchanged

Focus test cases on:

- correct type-specific field rendering
- correct summary generation
- correct payload generation to the existing route contract
- correct agent scope serialization

## Acceptance Criteria

This slice is done when:

- users can create any of the six standard policy types without typing YAML or
  JSON
- users can edit those same policy types through the same structured builder
- policy summaries are clearly readable
- the current policy API contract remains unchanged
- route tests still pass
- the page no longer treats raw structural policy thinking as the default

## Risks

### Risk: The Policies page is too large to change safely

Mitigation:

- isolate create/edit logic into helper functions and builder subcomponents
- do not redesign unrelated sections in wave 1

### Risk: Existing summaries and persistence logic diverge

Mitigation:

- make one helper layer the source of truth for compile/decompile/summary

### Risk: Manual authoring still feels crowded because the page is dense

Mitigation:

- keep the wave-1 improvement focused on the create/edit seam
- treat page-wide IA cleanup as a later dedicated slice

## Implementation Order

1. add pure policy form helpers and tests
2. move create authoring to the guided builder
3. move edit authoring to the same builder
4. add shared summary rendering
5. run focused policy UI tests plus `docs:check`, `contracts:check`, and `build`

## Recommendation

Ship this as the next operator UX slice after model strategies. It solves the
biggest remaining manual authoring problem without getting trapped in a full
policies-platform redesign before delivering value.
