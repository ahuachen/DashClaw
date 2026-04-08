# Model Strategy Guided UX Design

Date: 2026-04-08
Status: Draft for review
Owner: Codex

## Summary

DashClaw's model strategy create and detail screens currently use raw JSON as the
primary authoring interface. That is the same product mistake we just fixed for
Capabilities: the backend contract is relatively constrained, but the operator is
forced to think in config shape instead of product intent.

This spec replaces JSON-first strategy authoring with a guided builder for the
default path while preserving advanced power behind an explicit collapsed section.

Wave 1 covers:

- guided create flow for model strategies
- guided detail/edit flow for model strategies
- live human-readable strategy summary
- advanced task-mode overrides behind a collapsed panel
- optional raw JSON escape hatch only when needed

Wave 1 does not add a completion playground or a fully visual routing composer.

## Problem

Current issues in the existing model strategy UX:

- The create page is a JSON textarea with a default config blob.
- The detail page is also a JSON textarea, so editing is still config-first.
- Users must know field names like `primary`, `fallback`, `maxBudgetUsd`, and
  `latencySensitivity` instead of being guided by product concepts.
- The interface does not explain the resulting behavior in human terms.
- Task-mode overrides are real but should not dominate the main authoring path.

This creates the same operator confusion we saw in Capabilities:

- too much raw structure too early
- no clear happy path
- advanced concepts mixed into the default surface
- easy to misconfigure, hard to understand

## Goals

- Make standard model strategy creation and editing form-driven.
- Keep the main mental model focused on default execution behavior.
- Compile the builder state into the existing `config` object the API expects.
- Preserve advanced power without forcing it onto every user.
- Make the resulting strategy readable as policy rather than raw config.

## Non-Goals

- No full drag-and-drop model routing composer.
- No runtime completion playground in this slice.
- No provider/model catalog service or external syncing.
- No removal of raw config entirely.
- No deep redesign of the list page in this wave.

## Existing Contract

The current backend contract is already builder-friendly:

- `config.primary.provider` and `config.primary.model` are required
- `config.fallback` is optional and array-shaped
- `config.costSensitivity` is one of `low | balanced | high-quality`
- `config.latencySensitivity` is one of `low | medium | high`
- `config.maxBudgetUsd` is optional number
- `config.maxRetries` is optional integer
- `config.allowedProviders` is optional string array
- `config.disallowedProviders` is optional string array
- `config.taskModes` may contain task-specific primary/fallback overrides

That means the UI should not expose raw JSON by default. It should expose those
concepts directly and compile them into the same persisted shape.

## Recommended Approach

Use a guided builder with one advanced section.

### Why This Approach

- It fixes the main usability problem without inventing a new backend contract.
- It keeps the default path simple and operator-friendly.
- It preserves power users' escape hatches.
- It gives DashClaw a reusable pattern for the next config-heavy surfaces.

## Primary UX Structure

Both create and detail pages should share the same model strategy builder.

### Section 1: Basics

Fields:

- strategy name
- description

Purpose:

- identify the strategy
- explain when it should be used

### Section 2: Default Execution

Fields:

- primary provider
- primary model
- fallback chain as repeatable rows
- max retries

Purpose:

- define the default provider/model path
- make failover explicit without exposing the full JSON shape

### Section 3: Operating Constraints

Fields:

- budget cap
- latency sensitivity
- cost sensitivity
- allowed providers
- blocked providers

Purpose:

- express the runtime guardrails in product language
- keep policy-like controls separate from provider selection

### Section 4: Strategy Summary

A live-readable summary card should translate the current builder state into
plain English, for example:

> Use OpenAI GPT-4.1 first, fall back to Claude Sonnet 4, prefer balanced cost,
> medium latency, retry twice, and cap requests at $0.50.

Purpose:

- make the strategy legible at a glance
- reduce the need to inspect raw config to understand behavior

### Section 5: Advanced

Collapsed by default.

Contains:

- task-mode overrides
- optional raw JSON editor if the current config contains unsupported shapes or
  the user explicitly opens advanced mode

Purpose:

- preserve flexibility without burdening the main workflow

## Task-Mode Overrides

Task-mode overrides are important, but not core enough to belong in the main
builder in wave 1.

Wave 1 behavior:

- show an "Advanced task-mode overrides" section
- allow adding rows shaped like:
  - task mode name
  - provider
  - model
- optionally allow override fallback rows if implementation stays manageable
- keep the UI minimal and explicit

This keeps task modes available without making the default strategy authoring
path feel like a routing engine.

## Create Page Behavior

The create page should:

- start from guided defaults instead of a JSON blob
- let the user configure a valid default strategy without touching code or JSON
- compile the builder state into the existing `config` object on submit
- route to the new detail page after success

The create page should not:

- force users to understand the raw config schema
- surface task modes before they have created the base strategy

## Detail Page Behavior

The detail page should:

- load the existing config
- decompile it into the builder state
- show the same structured sections as create
- show the summary card prominently
- keep advanced task-mode overrides collapsed by default
- keep delete behavior unchanged

If a strategy contains shapes the guided builder does not understand yet:

- preserve them through the raw config escape hatch
- show a clear advanced warning instead of silently dropping data

## Data Model Helpers

The UI should be backed by pure helper functions similar to the capability form
model work. The exact file shape can vary, but the helper layer should support:

- building default form state
- decompiling persisted `config` into structured form state
- compiling structured form state back into `config`
- generating a readable summary string
- detecting whether advanced/raw mode is required due to unsupported config

This keeps the UI components thin and testable.

## Testing Strategy

Required coverage:

- unit tests for form helpers
  - compile
  - decompile
  - summary generation
  - advanced/raw fallback detection
- create page tests
  - renders builder fields instead of raw JSON by default
  - submits compiled `config`
- detail page tests
  - loads existing strategy into the builder
  - saves compiled `config`
  - keeps advanced section collapsed by default

Existing repository and API tests remain unchanged.

## Acceptance Criteria

This slice is done when:

- users can create a standard model strategy without typing JSON
- users can edit a standard model strategy without typing JSON
- task-mode overrides are available behind an advanced section
- strategy behavior is summarized in human-readable text
- raw JSON is no longer the default primary surface
- tests cover the helper logic and the create/detail UI flows

## Risks

### Risk: Builder does not cover all real config shapes

Mitigation:

- keep a raw JSON escape hatch
- preserve unsupported config rather than dropping it
- clearly label advanced mode when required

### Risk: Provider/model inputs become stale or too free-form

Mitigation:

- use structured inputs now, even if model values remain typed or predefined
- treat provider/model catalog sophistication as a later enhancement

### Risk: Task-mode overrides create complexity creep

Mitigation:

- keep them out of the primary builder
- ship a minimal advanced-row editor in wave 1

## Implementation Order

1. add pure model strategy builder helpers and tests
2. replace create page JSON editor with structured builder
3. replace detail page JSON editor with structured builder and summary
4. add advanced task-mode override section
5. keep optional raw JSON fallback only as an escape hatch
6. run focused UI tests plus `docs:check`, `contracts:check`, and `build`

## Recommendation

Ship this as the next operator UX slice immediately after the capability guided
runtime work. It is the next highest-value raw-config surface, and the contract
is already narrow enough to support a clean guided builder without backend
changes.
