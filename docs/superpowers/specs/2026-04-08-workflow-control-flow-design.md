# Workflow Runtime V2 — Wave B: Control Flow Design Spec

Date: 2026-04-08
Status: Approved
Wave: Workflow Runtime V2 — Wave B

## Goal

Add conditional step execution and failure tolerance to the workflow executor so steps can be skipped based on prior outputs and non-critical steps can fail without aborting the workflow.

## Problem

The executor runs every step unconditionally and aborts on the first failure. Workflow authors cannot express "only run this step if the previous step found results" or "this step is optional — continue if it fails." Both are common patterns in real operational workflows.

## Approach

Keep the sequential execution model. Add two optional fields per step: `condition` and `continue_on_failure`. No DAG, no dependency graph, no expression parser. No eval or dynamic code execution.

## Step Schema Changes

Two new optional fields:

```javascript
{
  id: 'step_2',
  type: 'prompt',
  name: 'Summarize findings',
  config: { ... },
  condition: '${steps.step_1.output.chunks.length}',  // NEW
  continue_on_failure: true,                            // NEW
}
```

Both fields are optional. When omitted, behavior is unchanged from today (always run, abort on failure).

## Condition Evaluation

The `condition` field is a template string resolved against the rolling execution context using the existing `resolveVars` from `template-vars.js`.

After resolution, the value is checked for truthiness. The step is skipped if the resolved value is any of: `null`, `undefined`, `''`, `0`, `false`, `'false'`, `'0'`.

No dynamic code execution. Just template resolution (the same mechanism already used for step config interpolation) plus a truthiness check.

### Examples

| Condition | Resolves to | Result |
|---|---|---|
| `${steps.search.output.chunks.length}` | `3` | Run |
| `${steps.search.output.chunks.length}` | `0` | Skip |
| `${variables.include_research}` | `true` | Run |
| `${variables.include_research}` | `''` (not provided) | Skip |
| `${steps.classify.output.risk_level}` | `'high'` | Run |
| (not set) | N/A | Run (no condition = always run) |

## Condition Evaluator

Pure function in `app/lib/workflow-condition.js`:

```javascript
export function evaluateCondition(conditionTemplate, context)
```

- Takes the raw condition string and the execution context
- Resolves the template using `resolveVars`
- Returns `{ shouldRun: boolean, resolvedValue: any }`
- Falsy values: `null`, `undefined`, `''`, `0`, `false`, `'false'`, `'0'`
- If conditionTemplate is null/undefined/empty, returns `{ shouldRun: true, resolvedValue: null }`

This is a pure function with no dynamic code execution — easy to test independently.

## continue_on_failure Behavior

When `step.continue_on_failure` is `true` and the step fails (after exhausting retries):

1. Record the step as `failed` in action_records and step_results (same as today)
2. Push the failure to stepResults (same as today)
3. Do NOT add the step output to `context.steps` (there is no output)
4. Do NOT return early — continue to the next step in the loop

When `continue_on_failure` is `false` or not set (default): current behavior — abort and return.

## New Step Status: skipped

When a step condition evaluates to falsy:

1. Create child action_record with `status = 'skipped'`, `output_summary = 'Condition not met'`
2. Write step_result with `status = 'skipped'`, `duration_ms = 0`
3. Push `{ step_id, type, status: 'skipped', elapsed_ms: 0 }` to stepResults
4. Do NOT add to `context.steps` — subsequent steps cannot reference skipped step output
5. Continue to next step

## Executor Changes

In `workflow-executor.js`, modify the step loop:

### Before creating child action record — evaluate condition:

```
if step.condition is defined:
  evaluate condition against context
  if should NOT run:
    create action_record with status='skipped'
    write step_result with status='skipped'
    push skipped result to stepResults
    continue to next step
```

### After step failure (in the if-not-succeeded block):

```
if step.continue_on_failure:
  record failure (action_record, step_result, stepResults) — same as today
  continue to next step (instead of returning)
else:
  current behavior — return early with failure
```

## Form Model Changes

In `app/workflows/lib/workflowStepFormModel.js`:

- `createDefaultExecutableStep(type)` returns steps with `condition: ''` and `continue_on_failure: false`
- `buildWorkflowStepSummary(step)` includes condition and continue_on_failure in the summary text when set

## UI Changes

In `app/workflows/components/WorkflowStepCard.jsx`:

- Add an optional "Condition" text field (collapsed by default, shown via "Add condition" toggle)
- Add a "Continue on failure" checkbox
- Both fields bind to the step data and flow through onChange

## Testing

### workflow-condition.test.js

- Truthy values pass: number > 0, non-empty string, true, array with items
- Falsy values skip: 0, empty string, null, undefined, false, 'false', '0'
- Template resolution works: step output references resolve correctly
- Missing template returns shouldRun: true

### workflow-executor.test.js (extend)

- Step with truthy condition runs normally
- Step with falsy condition is skipped (status='skipped', not in context.steps)
- Step with continue_on_failure=true fails but next step runs
- Step with continue_on_failure=false fails and aborts (existing behavior)
- Skipped step does not add to context.steps
- Failed continue_on_failure step does not add to context.steps
- persistStepResult called with status='skipped' for conditional skips

### workflow-step-form-model.test.js (extend)

- Default step includes condition and continue_on_failure fields
- Summary reflects condition when set
- Summary reflects continue_on_failure when true

## Scope Boundaries

### In scope
- `condition` field on steps (template string, truthiness evaluation)
- `continue_on_failure` field on steps (boolean)
- `skipped` status for action_records and step_results
- `evaluateCondition` pure function in new module
- Executor changes for skip and continue-on-failure
- Form model field additions
- Step card UI fields (condition input, checkbox)
- Tests for all of the above

### Out of scope
- Expression parser or comparison operators (gt, lt, eq)
- DAG or dependency graph
- Parallel step execution
- Step grouping or sub-workflows
- Condition builder UI (just a text field for now)
