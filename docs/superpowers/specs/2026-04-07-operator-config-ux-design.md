# Operator Config UX Redesign

Date: 2026-04-07
Status: Proposed
Owner: Codex

## Summary

DashClaw currently exposes too much raw configuration surface directly to operators. Users are expected to understand JSON payloads, YAML policy definitions, and freeform config blobs in places where the product should instead guide them through structured choices.

Wave 1 of this redesign standardizes a new product rule across the operator/admin experience:

- structured builders are the default
- raw JSON/YAML editors are advanced escape hatches
- summaries, previews, and generated test inputs replace low-context code/text areas

This wave applies the pattern first to:

- Capabilities
- Model Strategies
- Policies

The rest of the platform will follow the same standard in later waves.

## Problem

Today the product often behaves like an admin console for internal data models instead of a guided operating layer.

Examples:

- Capabilities mixes registry metadata and runnable runtime configuration, but only `http_api` capabilities are truly invocable.
- Capability testing expects a hand-authored JSON payload.
- Model Strategies exposes raw config JSON as the primary editing experience.
- Policies still exposes raw YAML import and several JSON-shaped rule concepts in the operator flow.

This creates three major failures:

1. Users cannot tell what is metadata vs what is actually executable.
2. Users are asked to understand internal config structures instead of product concepts.
3. The product looks more capable than it feels because common workflows are not operable without technical guesswork.

## Design Goals

1. Eliminate raw JSON/YAML as the default UX for operator workflows.
2. Make runtime-vs-metadata distinctions explicit in the UI.
3. Replace freeform config authoring with guided builders, typed controls, and previews.
4. Preserve advanced/raw editing only as an explicit fallback.
5. Establish one reusable interaction model that can later extend to workflows, prompts, evaluations, and other configuration-heavy surfaces.

## Non-Goals

- Full platform redesign in one pass
- Removing advanced/raw editors entirely
- Building a drag-and-drop workflow canvas in this wave
- Designing a universal nested-schema builder for every possible payload shape
- Reworking API contracts in Wave 1 unless the current UI cannot support the intended flow without it

## Product Rule

DashClaw should treat raw configuration syntax as an implementation detail, not the primary operator interface.

For operator/admin screens:

- the default experience should be form-driven
- the product should speak in domain language, not storage language
- the product should explain consequences in plain English
- test flows should offer valid starting inputs instead of blank code editors
- advanced editing should require an explicit opt-in

This rule is strict for:

- Capabilities
- Policies
- Model Strategies

This rule becomes the default standard for future waves on:

- Workflows
- Prompts
- Evaluations
- Routing
- Webhooks
- Compliance exports where relevant

## Wave 1 Scope

### 1. Capabilities

#### Current problem

The current register screen presents capability creation as if every listed source type is equally operational, while the runtime only meaningfully executes `http_api` capabilities. The form primarily collects metadata, but the detail screen exposes a runtime test panel that assumes a valid invocation contract exists.

This mismatch is the single clearest example of product-model confusion in the current app.

#### Target experience

Capability creation becomes a guided flow with an explicit fork:

- `Registry entry only`
- `Runnable HTTP capability`

##### Registry entry only

For capabilities that are not yet executable through DashClaw runtime:

- collect descriptive metadata only
- clearly label the entry as registry-only
- hide or disable runtime health, certification, invoke, and test affordances
- guide the user toward upgrading it later into a runnable capability

##### Runnable HTTP capability

For executable capabilities:

Step 1. Basics

- name
- description
- category
- tags
- docs URL
- risk level
- approval requirement

Step 2. Endpoint

- base endpoint URL
- HTTP method
- timeout
- endpoint template help text

Step 3. Auth

- no auth
- bearer token
- API key
- associated settings key selector/input

Step 4. Input definition

- simple field builder instead of raw JSON schema
- fields include:
  - label
  - field key
  - type
  - required toggle
  - help text

Step 5. Test setup

- generated test form from the defined input fields
- optional declared goal
- optional advanced raw payload editor

#### Detail page behavior

The capability detail page should:

- show whether a capability is registry-only or runnable
- show missing configuration clearly
- hide the test panel when runtime setup is incomplete
- replace the raw payload textarea with generated input fields when input definitions exist
- keep a collapsible advanced JSON panel for debugging and power users

### 2. Model Strategies

#### Current problem

Model Strategies currently exposes raw config JSON as the main authoring interface. This makes a central control-plane concept feel like a developer-only settings blob.

#### Target experience

Replace raw JSON-first editing with a structured strategy builder.

Sections:

- basics
  - name
  - description
- primary execution
  - provider
  - model
- fallback behavior
  - ordered fallback chain
  - retry count
- controls
  - budget cap
  - cost sensitivity
  - latency sensitivity
  - allowed providers

Derived output:

- human-readable strategy summary
- structured config preview
- optional advanced JSON editor

The advanced editor should remain available, but never be the first thing shown.

### 3. Policies

#### Current problem

Policies already has more structured logic than Capabilities, but still leaks too much storage-level complexity:

- raw YAML import is too close to the main operator flow
- JSON-shaped rules remain part of how policies are explained and manipulated
- different policy types feel like different implementation details instead of consistent guardrail builders

#### Target experience

Policy authoring should be entirely form-driven for standard policy types.

Supported builders should include:

- threshold policy
- require approval for action types
- block action types
- rate limiting
- webhook policy
- instruction policy

Advanced import remains available, but is moved behind a clear `Advanced import` affordance and positioned as an exception path.

Policy views should always render human-readable rule summaries first.

## Shared Interaction Pattern

Wave 1 should establish one reusable pattern across all three surfaces:

1. **Guided mode first**
   - dropdowns
   - radios
   - segmented choices
   - toggles
   - add/remove rows
   - sortable lists where appropriate

2. **Plain-English summaries**
   - every builder should produce a readable summary card
   - the summary should tell the operator what the config will do

3. **Generated test inputs or previews**
   - avoid empty code editors as starting points
   - provide sample valid inputs by default

4. **Advanced mode second**
   - keep raw editing as a collapsible panel
   - never make it mandatory for standard workflows

5. **State clarity**
   - distinguish:
     - draft vs configured
     - metadata-only vs runnable
     - healthy vs untested vs misconfigured

## Implementation Strategy

Wave 1 order:

1. Capabilities
2. Model Strategies
3. Policies

Rationale:

- Capabilities is the most visibly broken and confusing today.
- Model Strategies is structurally simpler than Policies and is a good second proving ground.
- Policies has the most surface area and should absorb the patterns after they have already been validated.

## Testing Strategy

For each surface:

- add or update UI tests that verify guided-builder behavior
- preserve existing API/runtime tests
- verify advanced mode still round-trips valid raw config where supported
- verify that unsupported runtime actions are not shown as available

Platform-level verification:

- docs stay aligned with actual UX and runtime support
- build passes
- contract checks pass

## Acceptance Criteria

### Capabilities

- A user can create a registry-only capability without implying it is runnable.
- A user can create a runnable HTTP capability without manually authoring JSON schema.
- A user can run a capability test through structured inputs.
- The test panel no longer defaults to a blank raw JSON textarea for normal use.

### Model Strategies

- A user can create and edit common model strategies through structured controls.
- The main experience no longer requires editing config JSON.
- The strategy detail page presents a readable summary of execution behavior.

### Policies

- A user can create/edit standard policies without touching raw JSON or YAML.
- Raw YAML import remains available only behind an advanced path.
- Policy summaries are readable without exposing storage-level config.

## Risks

1. Existing power users may rely on raw editors.
   - Mitigation: keep advanced mode available.

2. Some runtime structures are more flexible than the guided builders.
   - Mitigation: support only the common/operator-safe subset in guided mode and leave advanced editing for edge cases.

3. UI builders may drift from backend contracts.
   - Mitigation: keep guided state compiled into the same contract shape used by existing APIs and test both modes.

## Follow-On Waves

After Wave 1, apply the same product rule to:

- Workflows
- Prompts
- Evaluations
- Routing
- Other config-heavy operator surfaces identified in the audit

The long-term objective is a DashClaw operator experience where:

- normal governance and runtime configuration is understandable without reading structured text formats
- advanced syntax remains available, but no longer defines the primary product feel

