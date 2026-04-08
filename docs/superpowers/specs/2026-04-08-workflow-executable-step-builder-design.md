# Workflow Executable Step Builder

Date: 2026-04-08
Owner: Codex
Status: Proposed

## Goal

Replace the misleading workflow step canvas with a guided executable step builder that matches what DashClaw can actually run today.

## Problem

The current workflow step UI implies a generic graph editor:

- drag nodes
- connect edges
- choose visual node types like `action`, `guard`, `approval`, `condition`

But the actual runtime in `app/lib/workflow-executor.js` is a sequential executor that only supports three executable step types:

- `knowledge_search`
- `capability_invoke`
- `prompt`

That creates a severe product mismatch:

1. the UI suggests branching/graph semantics that do not exist
2. the editor stores graph-first `nodes/edges` data instead of a runtime-aligned step model
3. operators cannot tell what a step actually does or whether it will execute

The current steps surface is therefore confusing even when it saves successfully.

## Recommendation

Replace the default workflow step authoring experience with a vertical, ordered step builder.

Each step should represent one executable runtime operation, and the UI should clearly state that workflows currently execute steps in order.

Keep a source view only as an advanced fallback on the detail page.

## Approaches Considered

### 1. Recommended: guided executable step builder

Pros:

- aligns directly with the runtime
- easier to understand
- easier to validate
- removes fake graph expectations

Cons:

- less visually impressive than a canvas

### 2. Keep the canvas but constrain it

Pros:

- smaller visual change
- preserves the current aesthetic

Cons:

- still suggests graph behavior the runtime does not support
- harder to explain and harder to trust

### 3. Hybrid graph + list builder

Pros:

- maximum flexibility

Cons:

- too much complexity for the current runtime
- doubles the authoring surface before the execution model is mature

## Scope

This slice covers:

- workflow step authoring on `app/workflows/new/page.jsx`
- workflow step editing on `app/workflows/[templateId]/page.jsx`
- a new guided step builder component/model
- fallback handling for old graph-shaped step data

This slice does not cover:

- branching or conditional runtime
- graph execution semantics
- workflow debugger UI
- scheduled workflow execution
- generalized variable language redesign

## Product Rule

Workflow steps must mean executable runtime operations, not visual placeholders.

The UI should present workflows as:

- ordered sequences
- reusable templates
- governed execution packaging

Not as a no-code graph engine.

## Target User Experience

### Create page

The `Steps` section should:

- explain that steps run in order
- start empty with an `Add first step` action
- let the user build a sequence of executable steps
- show a short summary for each step

### Detail page

The detail page should:

- default to the same guided step builder
- allow editing existing steps in place
- keep `Source` as an advanced fallback
- save back into the canonical executable step format

### Step row behavior

Each step row should support:

- expand/collapse
- move up
- move down
- duplicate
- delete

Each row should show:

- step name
- step type
- human-readable summary

## Supported Step Types

### 1. Knowledge Search

Fields:

- step name
- knowledge collection
- query
- top K

Summary example:

- Search Customer FAQ for `refund eligibility` and return top 5 matches.

### 2. Capability Invoke

Fields:

- step name
- capability
- request body / payload inputs

Summary example:

- Invoke `Send Slack Message` with the selected payload fields.

### 3. Prompt

Fields:

- step name
- prompt template
- optional system prompt
- max tokens
- temperature

Summary example:

- Run prompt using the linked model strategy and earlier step outputs.

## Variable References

Later steps should be able to reference earlier outputs, but the UI should not force users to invent raw structured syntax on their own.

Recommended v1 behavior:

- provide helper tokens for:
  - workflow input
  - previous step output
  - knowledge chunks
- include plain examples in field help text

If a full structured picker is too large for this slice, helper chips and examples are sufficient.

## Data Model Direction

The authoring model should align with the executor:

- ordered array of steps
- each step has `id`, `type`, `name`, and `config`

Example direction:

```json
[
  {
    "id": "step_1",
    "type": "knowledge_search",
    "name": "Find refund policy",
    "config": {
      "collection_id": "kn_123",
      "query": "refund eligibility",
      "top_k": 5
    }
  }
]
```

The graph-first `{ nodes, edges }` model should no longer be the primary authoring format.

## Backward Compatibility

Existing templates may already have graph-shaped `steps_json`.

For this slice:

- the builder should detect unsupported graph-shaped step data
- present a readable fallback state instead of pretending it is executable
- keep `Source` view available so existing data is not hidden

If graph data cannot be reliably converted into executable steps, the UI should say so clearly.

## Error Handling

- invalid or unsupported existing step data should show a clear warning
- unsupported step types should not silently disappear
- save should block invalid executable step definitions

## Testing Strategy

Add focused coverage for:

1. create page step builder authoring
2. detail page guided editing
3. compile/decompile helpers for executable step schema
4. fallback handling for old graph-shaped step data

Keep current backend execution tests in place.

## Acceptance Criteria

- workflows no longer default to a misleading graph canvas
- create/edit use an ordered executable step builder
- only real runtime-supported step types are offered
- `Source` remains available as advanced fallback
- unsupported old graph data is surfaced honestly
- focused UI/helper tests cover the new builder

## Rollout Order

1. introduce executable step form helpers
2. replace new workflow page step canvas
3. replace detail page default step editor
4. keep source view as advanced fallback
5. add fallback handling for old graph-shaped step data
