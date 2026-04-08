# Workflow Linked Resources And AI Draft Design

Date: 2026-04-08
Status: Draft for review
Owner: Codex

## Goal

Upgrade workflow authoring so operators can:

- configure workflow-level linked resources through guided pickers
- describe a workflow in plain English and have DashClaw generate a draft into the same editor

The manual and AI paths should feed one canonical workflow editor model. Nothing should be saved until the user explicitly reviews and creates or updates the workflow.

## Problem

The workflow builder now has a better step authoring experience, but the surrounding workflow authoring surface is still incomplete:

- workflow-level linked resources are visible as facts, not a strong authoring flow
- workflow creation still assumes the user wants to build everything manually
- there is no plain-English draft path for users who do not want to compose steps directly

That means workflows are more understandable than before, but still not fully approachable.

## Desired Outcome

Users should be able to author a workflow in two ways:

1. manually, through structured workflow basics, linked resource pickers, and executable steps
2. through AI, by describing the workflow in plain English and reviewing the generated draft in the same editor

Both flows should produce the same editable draft state and the same persisted workflow contract.

## Approach Options

### 1. Recommended: dual-entry workflow authoring in one editor

Keep one workflow editor surface. Add:

- structured linked resource pickers
- a `Generate with AI` mode/panel that creates a draft into the same editor

Pros:

- one canonical authoring model
- safest operator experience
- easiest to reason about and test

Cons:

- requires a bit more page-state design than a separate generator page

### 2. Separate AI workflow generator page

Build a standalone generator and import its output into the editor.

Pros:

- easier to isolate initially

Cons:

- duplicates authoring logic
- clunkier operator flow

### 3. Fully automatic AI workflow creation

Allow AI to create saved workflows directly.

Pros:

- fastest user path

Cons:

- too risky for governance-oriented workflow authoring
- harder to trust and debug

## Recommendation

Use approach 1.

This keeps the workflow editor as the single source of truth and makes the AI path feel like a drafting assistant, not a second system.

## UX Principles

- The editor is the canonical review surface.
- AI produces drafts, not saved workflows.
- Workflow-level context should be configured through real platform objects, not IDs.
- Unsupported AI suggestions should be normalized or surfaced as review notes, not silently persisted.

## Scope

### In scope

- workflow-level linked resource pickers on create and detail
- AI workflow draft generation panel on the create flow
- AI draft normalization into the existing editor model
- draft hydration for:
  - basics
  - linked resources
  - sequential executable steps

### Out of scope

- auto-save from AI
- branching/conditional workflow generation
- arbitrary unsupported step types
- permanent secret-vault behavior for generator API keys
- runtime debugger or simulation engine

## Affected Surfaces

- `app/workflows/new/page.jsx`
- `app/workflows/[templateId]/page.jsx`
- workflow step builder and helper files already in place
- likely new workflow-level resource section components
- likely new AI generation panel helpers/components

Potential new API surface:

- workflow draft generation route if the current repo does not already expose one suitable for this

## Canonical Workflow Editor Model

The manual and AI paths must feed one shared draft shape:

- workflow basics:
  - name
  - slug
  - description
  - objective
  - status
- linked resources:
  - model strategy
  - linked policies
  - linked knowledge collections
  - linked capabilities
  - linked prompt templates
  - capability tags
- executable steps:
  - only supported runtime step types

No separate AI-only workflow representation should be introduced on the page.

## Workflow-Level Linked Resource UX

The editor should gain a structured section for workflow context.

### Fields

- `Model strategy`
  - single-select picker
- `Policies`
  - multi-select picker
- `Knowledge collections`
  - multi-select picker
- `Capabilities`
  - multi-select picker
- `Prompt templates`
  - multi-select picker
- `Capability tags`
  - chip/token input with optional suggestions

### Behavior

- uses real platform objects, not IDs
- preserves existing saved values when editing
- compiles back into the current stored workflow fields
- supports best-effort fallback display when a linked object no longer exists

## AI Draft UX

### Entry point

On the new workflow page, add a clear `Generate with AI` entry point near the existing create flow.

### Panel contents

- plain-English workflow description textarea
- API key input
- optional toggle:
  - `Prefer existing linked resources when possible`

### Generated draft contents

The AI should return a draft containing:

- workflow name
- description
- objective
- suggested linked resources
- ordered executable steps
- step names and configs

### Hydration

After generation:

- populate the editor fields directly
- let the operator review and edit everything
- do not save yet

## API Key Model

For v1, the generator uses a user-supplied API key that is session-scoped to the generation request.

### Rules

- user pastes key into the generation panel
- key is used only for that draft-generation request
- key is not silently persisted as a platform secret
- the UI should make this behavior explicit

This keeps the feature straightforward and avoids mixing first-pass workflow authoring with long-term secret management design.

## AI Draft Normalization Rules

The AI output must be normalized before hydration.

### Normalization goals

- map the draft into supported workflow fields only
- keep only supported step types
- convert suggested resources into known linked resource IDs when available
- preserve unknown suggestions as review notes or empty selections rather than inventing invalid IDs

### Unsupported AI suggestions

If the model suggests something DashClaw cannot run today:

- normalize to the closest supported step type where safe
- otherwise surface a non-blocking note in the draft UI
- do not persist fake graph or branching semantics

## Data Flow

### Manual path

1. page loads editor and linked resource options
2. user chooses workflow-level resources and configures steps
3. save compiles to current workflow template schema

### AI path

1. page loads editor and linked resource options
2. user opens `Generate with AI`
3. user submits description + API key
4. AI route returns a draft
5. draft normalizer hydrates the editor
6. user reviews and manually saves

## Error Handling

### Linked resource loading failures

- show non-blocking warning
- keep editor usable
- preserve existing saved values

### AI generation failures

- show inline error
- do not clear any existing editor state
- let the user retry with the same or updated description/API key

### Partial draft quality

If the AI returns an incomplete draft:

- hydrate the valid parts
- leave the rest editable
- surface concise notes instead of rejecting everything

## Testing Strategy

### Unit tests

- linked resource draft normalization
- AI draft normalization into the editor model
- fallback handling for missing linked resources

### UI tests

- create page renders workflow-level linked resource pickers
- detail page renders workflow-level linked resource pickers with saved values
- AI generation panel accepts prompt + API key
- successful AI generation hydrates the editor
- save still posts the expected workflow contract

### Verification

- workflow-focused `npx vitest run`
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

## Rollout Order

1. add workflow-level linked resource picker model and UI
2. add AI generation draft adapter and panel
3. wire AI draft hydration into the editor
4. verify create/detail behavior and save path

## Acceptance Criteria

- workflow create/edit supports real linked resource pickers
- users can describe a workflow in plain English and receive a draft in the editor
- AI drafts are not auto-saved
- manual and AI paths share one editor model
- unsupported AI output is normalized or surfaced honestly
- tests, docs check, contracts check, and build all pass
