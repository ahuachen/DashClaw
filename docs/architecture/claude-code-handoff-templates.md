# Claude Code Handoff Templates

Date: 2026-04-10
Status: Draft v1
Owner: DashClaw internal infrastructure

## Purpose

These templates standardize how MoltFire delegates organism-driven maintenance tasks to Claude Code.

The goal is to keep delegated work:
- narrow
- verifiable
- policy-compatible
- easy to review
- hard to let sprawl

Every handoff should make it obvious what Claude Code is allowed to do, what it must not do, and when it must stop and escalate.

## Universal rules for organism-driven handoffs

Every handoff should include five parts:

1. Objective
2. Scope
3. Out of bounds
4. Verification
5. Escalation conditions

### Default out-of-bounds list
Unless explicitly overridden by Wes, organism-driven Claude Code tasks must not touch:
- `organism.json`
- `.organism/**`
- auth paths
- middleware
- approval engine
- policy engine
- payments
- migrations/schema
- public API contracts
- archive deletion

### Default behavior rule
If Claude Code discovers that the requested work requires behavior changes outside the declared scope, it must stop and escalate instead of improvising.

## Template 1: subsystem documentation

### Use when
- documenting internal architecture
- reducing bus factor
- explaining subsystem boundaries
- clarifying control flow or data flow

### Template
Objective:
- Document the `<subsystem name>` subsystem so a new engineer can understand its purpose, boundaries, moving parts, and operating model.

Scope:
- You may edit only documentation files under `<allowed doc paths>`.
- You may inspect referenced implementation files as needed.

Out of bounds:
- Do not change runtime code.
- Do not modify `organism.json` or `.organism/**`.
- Do not change public contracts or policy behavior.

Verification:
- The document should explain purpose, components, boundaries, lifecycle/flow, and operational constraints.
- All file references should be accurate.
- No runtime files changed.

Escalate if:
- The docs cannot be made accurate without changing code.
- The subsystem boundary is ambiguous enough that documentation would likely mislead.

## Template 2: isolated route tests

### Use when
- organism identifies untested routes
- the route behavior is already stable
- tests can be added without changing application behavior

### Template
Objective:
- Add isolated tests for `<route or route set>` to improve coverage without changing runtime behavior.

Scope:
- You may edit only the target route test files, nearby test helpers, and minimal test configuration needed for those tests.

Out of bounds:
- Do not edit auth, middleware, policy engine, SDK public surface, OpenAPI, `organism.json`, or `.organism/**`.
- Do not change route behavior unless explicitly instructed.

Verification:
- New targeted tests pass.
- Existing relevant tests still pass.
- No API contract changes.
- No unrelated file edits.

Escalate if:
- Adding tests requires changing runtime behavior.
- Shared test harness refactoring becomes necessary.
- The route behavior is too ambiguous to assert safely.

## Template 3: TODO/FIXME triage

### Use when
- organism flags TODO/FIXME concentration
- the safe move is analysis, not blind code edits

### Template
Objective:
- Triage TODO/FIXME comments in `<target area>` into a structured summary with categories, risk, likely next action, and suggested priority.

Scope:
- You may inspect the target files and write results to a documentation or analysis file only.

Out of bounds:
- Do not “fix” TODOs unless explicitly instructed.
- Do not change runtime logic.
- Do not modify `organism.json` or `.organism/**`.

Verification:
- Every TODO/FIXME in scope is accounted for.
- Output includes category, location, likely meaning, and suggested action.
- Runtime code remains unchanged unless separately approved.

Escalate if:
- A TODO indicates a hidden defect or security issue that should be surfaced immediately.

## Template 4: safe internal cleanup

### Use when
- cleanup is local
- no protected paths are involved
- the change is demonstrably reversible and low risk

### Template
Objective:
- Perform low-risk cleanup in `<target area>` to improve clarity or remove obvious dead weight without changing behavior.

Scope:
- You may edit only `<allowed paths>`.

Out of bounds:
- No deletes outside explicitly approved files.
- No protected paths.
- No broad refactors.
- No contract changes.

Verification:
- Behavior remains unchanged.
- Relevant tests or static checks pass.
- Diff is narrow and understandable.

Escalate if:
- Cleanup turns into refactor work.
- Deletion becomes ambiguous.
- Shared abstractions or behavior changes are required.

## Template 5: moderate refactor with review gate

### Use when
- work is useful but not auto-safe
- MoltFire wants Claude Code to draft the change for review

### Template
Objective:
- Refactor `<target area>` to improve maintainability while preserving behavior.

Scope:
- Limit edits to `<allowed paths>`.

Out of bounds:
- No protected paths.
- No public contract changes.
- No schema changes.
- No archive deletion.

Verification:
- Relevant tests pass.
- Refactor boundaries are documented in the final summary.
- Behavior impact is explicitly stated.

Escalate if:
- Hidden coupling expands scope.
- Behavior preservation cannot be confidently maintained.

## Required completion format

Every Claude Code maintenance run should return:

### Summary
- what changed

### Files changed
- exact files touched

### Verification run
- what was executed and what passed/failed

### Risk notes
- any uncertainty, compromises, or follow-up needs

### Escalations
- anything that blocked safe completion

## Review rule

MoltFire should not treat a delegated task as complete just because files changed.

A task counts as complete only when:
- the output matches the declared objective
- the diff stayed within scope
- verification succeeded
- no forbidden zones were touched
- any residual risk is clearly stated

## Current best first uses

The best current uses for these templates in DashClaw are:
- subsystem documentation
- tiny isolated route test batches
- TODO/FIXME triage summaries

Those are the highest-value and lowest-risk ways to prove the governed maintenance loop.
