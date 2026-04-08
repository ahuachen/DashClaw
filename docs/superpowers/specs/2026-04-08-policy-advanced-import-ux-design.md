# Policy Advanced Import UX

Date: 2026-04-08
Owner: Codex
Status: Proposed

## Goal

Demote raw YAML and policy-pack import into an explicit advanced workflow on `/policies`, so the main operator lane stays focused on:

- Add Policy
- Generate with AI
- Browse Templates

## Problem

The current policies page still mixes expert import tooling directly into the main operator surface:

- raw YAML import is visible inline
- policy pack import sits beside normal policy creation
- the page still reads like an admin workbench instead of a guided control plane

That causes two UX problems:

1. raw import competes visually with normal policy authoring
2. advanced and normal paths are mixed together without a clear boundary

This conflicts with the operator UX rule already established for DashClaw:

- structured flows first
- advanced/raw inputs second

## Recommendation

Keep advanced import on `/policies`, but move it into a dedicated drawer or modal opened by an `Advanced import` action.

This keeps the expert path available without making it look like the primary way to work with policies.

## Approaches Considered

### 1. Recommended: advanced import drawer/modal on `/policies`

Pros:

- one policy surface
- no navigation break
- clear visual separation between normal and expert actions
- easy to keep current import logic intact

Cons:

- adds one extra click for advanced users

### 2. Inline advanced section on the same page

Pros:

- simpler implementation

Cons:

- still clutters the main page
- weak separation between normal and expert flows

### 3. Separate `/policies/import` screen

Pros:

- strongest isolation

Cons:

- too heavy for an escape hatch
- unnecessary navigation overhead

## Scope

This slice covers:

- the import section on `app/policies/page.jsx`
- a new advanced import container component
- focused tests for the new information architecture

This slice does not cover:

- import API changes
- YAML schema redesign
- policy template gallery redesign
- generator flow changes
- import history/audit pages

## Target User Experience

### Main actions

The top-level policy actions should read as:

- `Browse Templates`
- `Generate with AI`
- `Add Policy`
- `Advanced import`

`Advanced import` should be visually secondary.

### Advanced import surface

Clicking `Advanced import` opens a dedicated drawer or modal with an expert warning and two modes:

- `Policy pack`
- `Raw YAML`

The advanced surface should contain:

- import mode switch
- existing pack picker and preview details
- existing raw YAML textarea
- import button
- import results

Raw YAML should not be visible on the base page anymore.

## Information Architecture

### Base `/policies` page

Keep the main page focused on:

- policy overview/statistics
- manual create/edit
- template browsing
- simulation/testing/proof

Remove the large always-visible import block from the default reading flow.

### Advanced drawer/modal

Recommended structure:

1. title: `Advanced import`
2. short expert warning
3. mode switch
4. mode-specific content
5. import result feedback

Example warning:

> Advanced import is intended for expert users who already have a validated YAML policy definition or know which policy pack they want to install.

## Visual Behavior

- drawer or modal should feel clearly separate from normal authoring
- opening it should not hide the rest of the page permanently
- closing it should preserve any in-progress import text during the current session if practical

## Error Handling

- keep existing backend error handling behavior
- show import errors inside the advanced import surface
- do not bounce errors back into the main create/edit flow

## Testing Strategy

Add focused tests for:

1. main page no longer shows raw YAML import inline by default
2. `Advanced import` trigger opens the expert surface
3. switching between `Policy pack` and `Raw YAML` works
4. import result stays inside the advanced surface

Keep existing import route tests unchanged.

## Acceptance Criteria

- raw YAML import is no longer visible by default on `/policies`
- advanced import remains available from the same page
- policy pack import also lives inside the advanced surface
- normal operator actions are visually primary
- focused UI tests cover the new advanced import behavior

## Rollout Order

1. add advanced import container component
2. move existing inline import UI into the new surface
3. update action bar to expose `Advanced import`
4. add focused tests
5. run docs/contracts/build verification
