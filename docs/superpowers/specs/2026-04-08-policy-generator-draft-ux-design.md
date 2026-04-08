# Policy Generator Draft UX

Date: 2026-04-08
Owner: Codex
Status: Proposed

## Goal

Turn the AI policy generator into a structured draft flow that ends in the same guided authoring experience used on `/policies`, instead of showing raw JSON rules as the primary result.

## Problem

The current generator at `app/policies/generate/page.jsx` behaves like a raw preview tool:

- user enters freeform text
- backend returns generated policies
- UI shows policy type plus raw `rules` JSON
- user creates policies directly from the preview

That has three problems:

1. It leaks implementation structure instead of policy intent.
2. It creates a second authoring model separate from the new guided policy builder.
3. It encourages operators to trust generated structure they cannot comfortably inspect.

This conflicts with the platform rule established in the operator config UX work:

- raw JSON/YAML should be advanced-only
- the primary operator flow should be structured and human-readable

## Recommendation

Adopt a generator-to-editor draft flow.

The AI generator should produce one or more draft policy candidates, but the primary result should be a structured draft editor:

- select a generated candidate
- normalize it into the shared policy form model
- open the same guided policy editor used on `/policies`
- let the operator review and adjust the draft
- only save once the operator explicitly confirms

Nothing should be auto-persisted when AI generation completes.

## Approaches Considered

### 1. Recommended: Generator to guided draft editor

Pros:

- consistent with the new manual authoring experience
- keeps operator control
- no raw JSON required for normal use
- easiest mental model: "AI drafts, human approves"

Cons:

- requires mapping generator output into the shared form model
- multi-policy generation becomes a queue/select flow rather than one-click bulk create

### 2. Suggestion panel with separate import step

Pros:

- safer separation between AI and authoring

Cons:

- duplicates the review step
- adds friction
- still feels like two disconnected systems

### 3. Auto-create persisted draft policies

Pros:

- minimal clicks

Cons:

- too risky for governance surfaces
- harder to explain and recover from
- weak trust model

## Scope

This slice covers:

- `app/policies/generate/page.jsx`
- shared adapter utilities that convert generator output into guided form state
- structured generated-draft review UI
- explicit advanced/raw view for unsupported details

This slice does not cover:

- policy import/YAML redesign
- policy templates/gallery redesign
- policy backend contract changes
- AI generator prompt/back-end rearchitecture beyond what is required to support the draft flow
- multi-step wizard across the entire policies page

## Target User Experience

### Entry

The page still starts with a freeform prompt box:

- "Describe what you want the policy to prevent or enforce"

Optional supporting context may be added later, but is not required in v1.

### Generate

User clicks `Generate Drafts`.

The page returns one or more draft candidates. Each candidate should show:

- generated name
- policy type label
- short human-readable summary
- confidence badge if present
- warning badge if advanced review is needed

### Draft Review

When the user selects a candidate, the page opens a structured draft editor using the same model as the main policy page:

- policy name
- policy type
- type-specific fields
- agent scope
- live policy summary

The draft is editable before save.

### Save

Primary action:

- `Create Policy`

This saves only the currently reviewed draft.

### Advanced

If the generator returns rule shapes the structured builder cannot express completely:

- show the best structured draft possible
- show a compact warning like:
  - "Advanced details need review before saving"
- reveal raw JSON only behind an `Advanced details` disclosure

Raw JSON is secondary, not the main result.

## Information Architecture

Recommended page structure:

1. Prompt input
2. Generate button
3. Draft candidate list
4. Selected draft editor
5. Advanced warnings/details

This replaces the current direct raw preview grid as the primary UI.

## Data Model Strategy

Reuse the guided policy form model introduced in:

- `app/policies/lib/policyFormModel.js`

Add a generator adapter layer, for example:

- `app/policies/lib/policyGeneratorDrafts.js`

Responsibilities:

- normalize generated policy shape into policy form state
- derive draft summary
- flag unsupported/advanced fields
- preserve original generated payload for advanced review if needed

The editor itself should continue to submit through `compilePolicyPayload(...)`.

## Multi-Candidate Behavior

If multiple drafts are returned:

- show them as selectable draft cards
- default to the first candidate
- switch editor state when another candidate is selected

V1 behavior:

- create one reviewed policy at a time

Do not keep the current bulk-create-from-checkbox-preview flow as the primary experience.

## Error Handling

### Generation failure

Show a plain language error:

- "DashClaw could not generate a policy draft from that input. Try being more specific about the action, risk, or approval rule you want."

### Empty generation result

Show a guided empty state instead of a generic error.

### Unsupported generated shape

Do not fail if partial normalization is possible.
Load the supported fields into the editor and surface an advanced-review warning.

### Save failure

Keep the draft state intact so the operator does not lose edits.

## Testing Strategy

Add focused tests for:

1. generator adapter helper
   - normalizes supported policy types into form state
   - flags unsupported advanced fields

2. generator page
   - shows draft candidate cards instead of raw JSON as the primary result
   - loads selected draft into structured fields
   - saves through compiled payload
   - keeps advanced details behind disclosure

Keep existing route tests intact.

## Acceptance Criteria

- AI generator no longer requires operators to inspect raw JSON to review a draft
- generated drafts load into the same structured policy authoring model used on `/policies`
- save action persists only after explicit operator confirmation
- raw JSON/details remain available only as an advanced fallback
- page tests cover generate → review → save behavior

## Rollout Order

1. add generator draft adapter helpers and tests
2. replace raw preview primary UI with candidate cards + structured draft editor
3. keep advanced/raw details behind disclosure
4. verify with focused tests, docs check, contracts check, and build
