# Workflow Runtime V2 — Wave C: Resume from Checkpoint Design Spec

Date: 2026-04-09
Status: Approved
Wave: Workflow Runtime V2 — Wave C

## Goal

Allow operators to resume a failed workflow run from the last completed step, rehydrating prior step outputs and continuing execution without re-running completed work.

## Problem

When a workflow fails at step 4 of 6, the operator must re-run the entire workflow from scratch. Steps 1-3 may have already succeeded (incurring API costs, time, and side effects). There's no way to pick up where execution left off.

## Approach

Resume is context rehydration + offset execution. No new execution model. Load completed step outputs from `workflow_step_results` into the rolling context, tell the executor to skip already-completed steps, and run the rest normally. A resume creates a new run (new parent action_record) that references the original.

## Executor Change

One new optional field in `workflowContext`: `resumeContext`

```javascript
{
  resumeFromIndex: 2,
  priorSteps: {
    step_1: { output: { chunks: [...] } },
    step_2: { output: { text: '...' } },
  }
}
```

At the start of the step loop, before condition evaluation:

```
if resumeContext exists AND step index < resumeFromIndex:
  load prior output into context.steps[step.id]
  create action_record with status='reused'
  write step_result with status='reused'
  push { step_id, type, status: 'reused', elapsed_ms: 0 } to stepResults
  continue to next step
```

Steps at or after `resumeFromIndex` execute normally (including condition checks, retries, continue_on_failure).

### Pre-loading Context

Before the step loop begins, if `resumeContext.priorSteps` is provided, merge it into the initial context:

```javascript
if (workflowContext.resumeContext?.priorSteps) {
  for (const [stepId, data] of Object.entries(workflowContext.resumeContext.priorSteps)) {
    context.steps[stepId] = data;
  }
}
```

This ensures that the first resumed step can reference outputs from reused steps via `${steps.step_1.output.field}`.

## New Step Status: reused

Steps loaded from a prior run get `status = 'reused'` in:
- `action_records` — child action with status='reused', output_summary='Reused from prior run'
- `workflow_step_results` — status='reused', output_json copied from prior run, duration_ms=0
- API response stepResults — `{ step_id, type, status: 'reused', elapsed_ms: 0 }`

The `reused` status is distinct from `skipped` (condition not met) and `completed` (ran this execution). It tells the operator "this step's output came from a prior run."

## Repository Helper

New function in `app/lib/repositories/workflow-runs.repository.js`:

```javascript
export async function buildResumeContext(sql, orgId, runActionId)
```

1. Load all step_results for the given run, ordered by step_index
2. Find the first non-completed step (status != 'completed')
3. Build `priorSteps` from all completed steps before that index, parsing output_json back to objects
4. Return `{ resumeFromIndex, priorSteps, failedStepId }` or `null` if nothing to resume (all completed or no steps)

If `from_step` is provided by the caller, use that step's index as `resumeFromIndex` instead of auto-detecting.

## API Route

### `POST /api/workflows/templates/[templateId]/runs/[runActionId]/resume`

Request body:
```json
{
  "from_step": "step_3",     // optional — resume from this step. If omitted, auto-detect.
  "variables": {},            // optional — override variables for the resumed run
  "agent_id": "deploy-bot"   // optional — defaults to original run's agent
}
```

Behavior:
1. Load the original run via `getWorkflowRun`
2. Load the template via `getWorkflowTemplate`
3. If original run status is not 'failed', return 400 (can only resume failed runs)
4. Build resume context via `buildResumeContext` (with optional `from_step`)
5. If nothing to resume, return 400
6. Create a NEW parent action_record with:
   - `action_type: 'workflow_execute'`
   - `trigger: 'workflow:${templateId}'`
   - `reasoning: JSON.stringify({ template_id, template_name, resumed_from: runActionId, resume_step_index })`
7. Build `persistStepResult` callback (same as normal execute)
8. Call `executeWorkflow` with the resume context
9. Update parent action with result
10. Return the new run's action_id and step results

Response:
```json
{
  "success": true,
  "action_id": "act_new_run",
  "resumed_from": "act_original_run",
  "resume_step_index": 2,
  "steps": [...],
  "result": {...},
  "total_elapsed_ms": 1234
}
```

Error responses:
- 404: original run not found
- 400: run is not failed, or nothing to resume
- 403: blocked by guard policy

## UI Changes

### Run Detail Page — Resume Button

In `WorkflowRunHeader.jsx`, when `run.status === 'failed'`:

Show a "Resume from checkpoint" button that:
1. POSTs to `/api/workflows/templates/${templateId}/runs/${runActionId}/resume`
2. On success, navigates to the new run's detail page
3. Shows loading state during the POST
4. Shows error inline if resume fails

### Run Detail Page — Reused Steps

In `WorkflowRunStepCard.jsx`, the `reused` status renders with:
- A distinct icon (e.g., `RotateCcw` from lucide-react)
- Muted styling (zinc tones, not green)
- Label: "Reused from prior run"
- Input/output still expandable (the data is there from the prior run)

## Testing

### workflow-runs.repository.test.js (extend)

- `buildResumeContext` returns correct resumeFromIndex and priorSteps for a run with steps [completed, completed, failed]
- `buildResumeContext` returns null for a fully completed run
- `buildResumeContext` respects `from_step` override
- `buildResumeContext` parses output_json back to objects

### workflow-executor.test.js (extend)

- Executor with resumeContext skips steps before resumeFromIndex
- Skipped steps get status='reused' in stepResults
- Prior step outputs are available in context for resumed steps
- Executor runs steps at and after resumeFromIndex normally

### workflow-run-detail.page.test.jsx (extend)

- Resume button appears for failed runs
- Resume button does not appear for completed runs

## Scope Boundaries

### In scope
- `buildResumeContext` repository helper
- Executor `resumeContext` support with `reused` status
- `POST .../resume` API route
- Resume button on run detail page
- `reused` step status in UI (WorkflowRunStepCard)

### Out of scope
- Async job queue or background execution
- Scheduled automatic retries
- Partial step resume (always restarts from the beginning of the failed step)
- Rerun a single step in isolation
- Resume for runs that succeeded (only failed runs)
- Variable override UI (API supports it, UI just uses original variables)
