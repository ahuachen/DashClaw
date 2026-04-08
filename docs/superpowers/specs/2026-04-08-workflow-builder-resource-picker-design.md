# Workflow Builder Resource Picker Design

Date: 2026-04-08
Status: Draft for review
Owner: Codex

## Goal

Polish the new workflow executable step builder so operators can compose workflows from real DashClaw resources and insert runtime variables without typing opaque IDs or hand-writing template syntax.

This is a UX improvement pass on top of the shipped executable step builder. It does not change the core workflow runtime model.

## Problem

The workflow builder now correctly reflects DashClaw's real sequential runtime, but it still makes users guess too much:

- knowledge collections must be typed by ID
- capabilities must be typed by ID
- prompt steps require freeform prompt text only
- variable references must be invented manually

That means the product has moved past the misleading graph editor, but not yet into a genuinely guided authoring flow.

## Desired Outcome

Operators should be able to:

- pick knowledge collections, capabilities, and prompt templates from real platform objects
- insert workflow inputs and prior-step outputs using guided controls
- understand what a step is doing without knowing internal IDs or token syntax

The UI should still persist the same runtime-compatible step schema under the hood.

## Approach Options

### 1. Recommended: resource-aware builder with guided variable insertion

Fetch real workflow resource options into the create/detail pages and replace free-text ID fields with selectors. Add lightweight variable insertion controls for text fields and payload values.

Pros:

- best operator UX
- aligned with the rest of the structured-builder direction
- low runtime risk because it does not rewrite the step contract

Cons:

- adds some page-level loading/state work

### 2. Minimal helper layer

Keep free-text fields but add helper lists, examples, and token cheatsheets below them.

Pros:

- faster

Cons:

- still makes the operator think in IDs and template syntax

### 3. Full expression and contract builder

Introduce a richer variable browser, typed output explorer, and schema-aware payload form generation.

Pros:

- strongest long-term experience

Cons:

- too much for this pass
- would expand into runtime-contract design work

## Recommendation

Use approach 1.

This is the right balance of usability, product value, and implementation risk. It removes the most painful operator friction without changing the runtime model or introducing a new expression system.

## UX Principles

This pass follows the platform rule already established elsewhere in DashClaw:

- normal operator workflows should use dropdowns, guided inputs, and structured summaries
- raw IDs and token syntax are advanced details, not the primary interface
- the UI should expose real platform resources whenever possible

## Scope

### In scope

- load workflow-builder resource options on create and detail pages
- replace raw resource ID inputs with selectors
- add guided variable insertion helpers
- improve step summaries to use human-readable resource names
- add a compact variable/reference help panel

### Out of scope

- branching or conditional workflow logic
- graph/canvas editor return
- full expression language
- typed contract-driven capability payload forms
- runtime debugger or execution inspector

## Affected Surfaces

- `app/workflows/new/page.jsx`
- `app/workflows/[templateId]/page.jsx`
- `app/workflows/components/WorkflowStepBuilder.jsx`
- `app/workflows/components/WorkflowStepCard.jsx`
- `app/workflows/lib/workflowStepFormModel.js`

Likely new shared workflow UI helpers/components:

- resource option loader/helpers
- variable insertion helper/button
- workflow variable reference panel

## Resource-Aware Step UX

### Knowledge Search

Replace the collection ID text field with a searchable selector populated from real knowledge collections.

Fields:

- collection selector
- query text input
- top K numeric input

Variable support:

- query input gets an insert-variable action

Summary should read from the selected collection name, falling back to ID only if metadata is unavailable.

### Capability Invoke

Replace the capability ID text field with a searchable selector populated from real capabilities.

Fields:

- capability selector
- payload key/value rows

Variable support:

- payload value fields get insert-variable actions

This pass keeps the payload builder simple. It remains generic key/value entry, but the operator should choose a real capability and compose values with guided variables instead of guessing IDs and tokens.

### Prompt

Add a prompt template selector populated from real prompt templates.

Fields:

- prompt template selector
- optional freeform prompt override
- system prompt
- max tokens
- temperature

Variable support:

- prompt override and system prompt fields get insert-variable actions

This pass does not attempt to redesign model-strategy behavior inside the step. If the runtime remains workflow-level there, the prompt step should stay focused on prompt content.

## Variable Insertion

The first version should support guided insertion for the most important references:

- workflow inputs
- previous step outputs

The UI should expose these through a compact insertion affordance next to eligible fields.

Examples of insertion targets:

- workflow input
- step 1 output
- step 1 chunks
- step 2 answer

When the user selects one, the UI inserts the correct token syntax for them.

This is intentionally not a full expression builder. It is a guided token inserter.

## Data Flow

### Loading

Create and detail pages should load resource options for:

- knowledge collections
- capabilities
- prompt templates

Potential future addition:

- model strategies if the workflow UI starts exposing them per step

The UI should remain resilient if one or more resource lists fail to load:

- builder still renders
- selectors fall back to plain ID entry or disabled/empty state messaging
- existing saved workflows remain editable

### Persistence

No backend workflow schema changes are required for this pass.

The UI should continue compiling to the same step shape:

- `knowledge_search.config.collection_id`
- `capability_invoke.config.capability_id`
- `prompt.config.prompt_template` and related text fields

Variable references still persist as strings in the current runtime format.

## Error Handling

If resource loading fails:

- show inline non-blocking notice
- preserve current values if editing an existing workflow
- do not silently clear configured IDs

If a previously selected resource no longer exists:

- show the saved ID as a fallback option
- mark it as unavailable
- allow the operator to replace it

If variable insertion metadata is weak:

- offer the basic variable groups anyway
- do not block authoring on deeper schema awareness

## Testing Strategy

### Unit tests

- resource-aware compile/decompile behavior in workflow form helpers
- variable insertion helper behavior
- summary rendering with names vs IDs

### UI tests

- create page loads resource selectors
- detail page loads resource selectors
- selecting a collection/capability/prompt template persists the correct underlying ID/template value
- insert-variable helpers write the expected runtime token strings
- fallback behavior when resource fetches fail or selected resources are missing

### Verification

- `npx vitest run` for workflow-focused tests
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

## Rollout Order

1. Add resource loading and workflow option normalization helpers
2. Upgrade step cards to use resource selectors
3. Add guided variable insertion helpers
4. Add a compact reference/help panel
5. Verify create and detail flows together

## Acceptance Criteria

- operators no longer need to type knowledge collection IDs for normal workflow authoring
- operators no longer need to type capability IDs for normal workflow authoring
- prompt steps can choose a real prompt template
- variable insertion is guided for the key editable text fields
- existing workflow runtime schema remains intact
- create/detail builder tests, docs check, contracts check, and build all pass
