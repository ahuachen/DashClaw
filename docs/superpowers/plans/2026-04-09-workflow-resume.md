# Workflow Resume from Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to resume a failed workflow run from the last completed step, reusing prior step outputs without re-executing completed work.

**Architecture:** Add a `buildResumeContext` repository helper that rehydrates prior step outputs from `workflow_step_results`. Add `resumeContext` support to the executor so it skips already-completed steps. Add a `POST .../resume` API route. Add a "Resume" button to the run detail page.

**Tech Stack:** Next.js 15 App Router, Postgres via postgres.js, Vitest, existing executor + repository patterns

---

## File Map

### New files to create

- `app/api/workflows/templates/[templateId]/runs/[runActionId]/resume/route.js` — POST resume endpoint
- `__tests__/unit/workflow-resume.test.js` — resume context builder + executor resume tests

### Existing files to modify

- `app/lib/repositories/workflow-runs.repository.js` — add `buildResumeContext`
- `app/lib/workflow-executor.js` — add `resumeContext` handling with `reused` status
- `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx` — add Resume button
- `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx` — add `reused` status styling
- `app/workflows/[templateId]/runs/[runActionId]/page.jsx` — add resume handler + navigation

### Existing files to leave alone

- `app/api/workflows/templates/[templateId]/execute/route.js` — resume has its own route
- `app/lib/workflow-condition.js` — consumed as-is
- `app/lib/step-handlers.js` — unchanged

---

## Chunk 1: Resume Context Builder

### Task 1: Add buildResumeContext to the repository with tests

**Files:**
- Modify: `app/lib/repositories/workflow-runs.repository.js`
- Create: `__tests__/unit/workflow-resume.test.js`

- [ ] **Step 1: Write failing tests for buildResumeContext**

Create `__tests__/unit/workflow-resume.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { buildResumeContext } from '../../app/lib/repositories/workflow-runs.repository.js';

describe('buildResumeContext', () => {
  it('returns resumeFromIndex at first non-completed step', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: '{"chunks":[]}' },
      { step_id: 'step_2', step_index: 1, status: 'completed', output_json: '{"text":"done"}' },
      { step_id: 'step_3', step_index: 2, status: 'failed', output_json: null },
    ];

    const result = buildResumeContext(stepResults);
    expect(result.resumeFromIndex).toBe(2);
    expect(result.failedStepId).toBe('step_3');
    expect(Object.keys(result.priorSteps)).toEqual(['step_1', 'step_2']);
  });

  it('parses output_json into objects for priorSteps', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: '{"answer":"yes"}' },
      { step_id: 'step_2', step_index: 1, status: 'failed', output_json: null },
    ];

    const result = buildResumeContext(stepResults);
    expect(result.priorSteps.step_1).toEqual({ output: { answer: 'yes' } });
  });

  it('returns null when all steps completed', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: '{}' },
      { step_id: 'step_2', step_index: 1, status: 'completed', output_json: '{}' },
    ];

    const result = buildResumeContext(stepResults);
    expect(result).toBeNull();
  });

  it('returns null when no steps exist', () => {
    const result = buildResumeContext([]);
    expect(result).toBeNull();
  });

  it('respects fromStepId override', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: '{"a":1}' },
      { step_id: 'step_2', step_index: 1, status: 'completed', output_json: '{"b":2}' },
      { step_id: 'step_3', step_index: 2, status: 'failed', output_json: null },
    ];

    // Resume from step_2 (re-run it even though it completed)
    const result = buildResumeContext(stepResults, 'step_2');
    expect(result.resumeFromIndex).toBe(1);
    expect(Object.keys(result.priorSteps)).toEqual(['step_1']);
  });

  it('handles skipped steps in the prior run', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: '{"x":1}' },
      { step_id: 'step_2', step_index: 1, status: 'skipped', output_json: null },
      { step_id: 'step_3', step_index: 2, status: 'failed', output_json: null },
    ];

    const result = buildResumeContext(stepResults);
    expect(result.resumeFromIndex).toBe(2);
    // skipped steps have no output — not included in priorSteps
    expect(Object.keys(result.priorSteps)).toEqual(['step_1']);
  });

  it('handles malformed output_json gracefully', () => {
    const stepResults = [
      { step_id: 'step_1', step_index: 0, status: 'completed', output_json: 'not-json' },
      { step_id: 'step_2', step_index: 1, status: 'failed', output_json: null },
    ];

    const result = buildResumeContext(stepResults);
    expect(result.priorSteps.step_1).toEqual({ output: null });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/workflow-resume.test.js`
Expected: FAIL because `buildResumeContext` is not exported

- [ ] **Step 3: Implement buildResumeContext**

In `app/lib/repositories/workflow-runs.repository.js`, add before the query functions section:

```javascript
/**
 * Build resume context from a prior run's step results.
 * Returns { resumeFromIndex, priorSteps, failedStepId } or null if nothing to resume.
 *
 * @param {Array} stepResults - step_result rows ordered by step_index
 * @param {string|null} fromStepId - optional step_id to resume from (re-runs that step)
 */
export function buildResumeContext(stepResults, fromStepId = null) {
  if (!stepResults || stepResults.length === 0) return null;

  let resumeFromIndex;
  let failedStepId = null;

  if (fromStepId) {
    const targetStep = stepResults.find((s) => s.step_id === fromStepId);
    if (!targetStep) return null;
    resumeFromIndex = targetStep.step_index;
  } else {
    const firstNonCompleted = stepResults.find(
      (s) => s.status !== 'completed' && s.status !== 'skipped' && s.status !== 'reused',
    );
    if (!firstNonCompleted) return null; // all completed — nothing to resume
    resumeFromIndex = firstNonCompleted.step_index;
    failedStepId = firstNonCompleted.step_id;
  }

  const priorSteps = {};
  for (const step of stepResults) {
    if (step.step_index >= resumeFromIndex) break;
    if (step.status !== 'completed') continue; // skip skipped/failed steps
    priorSteps[step.step_id] = {
      output: safeJsonParse(step.output_json),
    };
  }

  return { resumeFromIndex, priorSteps, failedStepId };
}
```

Note: `safeJsonParse` is already defined at the top of this file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/workflow-resume.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/repositories/workflow-runs.repository.js __tests__/unit/workflow-resume.test.js
git commit -m "feat: add buildResumeContext for workflow run resume"
```

---

## Chunk 2: Executor Resume Support

### Task 2: Add resumeContext handling to the executor

**Files:**
- Modify: `app/lib/workflow-executor.js`
- Modify: `__tests__/unit/workflow-executor.test.js`

- [ ] **Step 1: Write failing executor tests for resume**

Add these tests to `__tests__/unit/workflow-executor.test.js`:

```javascript
it('skips steps before resumeFromIndex and marks them as reused', async () => {
  handlePrompt.mockResolvedValueOnce({ text: 'resumed result', tokens_in: 10, tokens_out: 5 });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'Based on: ${steps.step_1.output.chunks[0].content}' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
    strategyConfig: {},
    resumeContext: {
      resumeFromIndex: 1,
      priorSteps: {
        step_1: { output: { chunks: [{ content: 'prior data' }], query: 'test' } },
      },
    },
  });

  expect(result.success).toBe(true);
  expect(result.steps).toHaveLength(2);
  expect(result.steps[0].status).toBe('reused');
  expect(result.steps[0].elapsed_ms).toBe(0);
  expect(result.steps[1].status).toBe('completed');
  expect(handleKnowledgeSearch).not.toHaveBeenCalled();
  expect(handlePrompt).toHaveBeenCalled();
});

it('reused step outputs are available to resumed steps via context', async () => {
  handlePrompt.mockResolvedValueOnce({ text: 'got it', tokens_in: 10, tokens_out: 5 });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Use prior', config: { prompt_template: 'Data: ${steps.step_1.output.answer}' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
    strategyConfig: {},
    resumeContext: {
      resumeFromIndex: 1,
      priorSteps: {
        step_1: { output: { answer: 'forty-two' } },
      },
    },
  });

  expect(result.success).toBe(true);
  // Verify the prompt received the resolved prior output
  expect(handlePrompt).toHaveBeenCalledWith(
    mockSql,
    'org_1',
    expect.objectContaining({
      prompt_template: 'Data: forty-two',
    }),
    expect.any(Object),
  );
});

it('writes reused step_result via persistStepResult', async () => {
  handlePrompt.mockResolvedValueOnce({ text: 'ok', tokens_in: 10, tokens_out: 5 });
  const persistStepResult = vi.fn().mockResolvedValue(undefined);

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Go', config: { prompt_template: 'test' } },
  ];

  await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, {
    strategyConfig: {},
    persistStepResult,
    resumeContext: {
      resumeFromIndex: 1,
      priorSteps: {
        step_1: { output: { data: 'cached' } },
      },
    },
  });

  expect(persistStepResult).toHaveBeenCalledWith(
    expect.objectContaining({
      step_id: 'step_1',
      status: 'reused',
      output_json: { data: 'cached' },
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: New tests FAIL, existing 16 tests PASS

- [ ] **Step 3: Implement resumeContext in the executor**

In `app/lib/workflow-executor.js`:

1. After `const persistStepResult = workflowContext.persistStepResult || null;` (line 47), add:

```javascript
  const resumeContext = workflowContext.resumeContext || null;

  // Pre-load prior step outputs for resume
  if (resumeContext?.priorSteps) {
    for (const [stepId, data] of Object.entries(resumeContext.priorSteps)) {
      context.steps[stepId] = data;
    }
  }
```

2. At the very start of the step loop (after `const stepActionId = ...`), BEFORE the condition evaluation block, add:

```javascript
    // Resume: skip steps before resumeFromIndex
    if (resumeContext && steps.indexOf(step) < resumeContext.resumeFromIndex) {
      const stepIndex = steps.indexOf(step);
      const priorOutput = resumeContext.priorSteps?.[step.id]?.output || null;

      await createActionRecord(sql, {
        orgId,
        action_id: stepActionId,
        data: {
          agent_id: workflowContext.agentId || 'anonymous',
          action_type: `workflow_step:${step.type}`,
          declared_goal: `Step: ${step.name || step.id}`,
          parent_action_id: parentActionId,
          risk_score: 0,
          confidence: 100,
          systems_touched: [`workflow_step:${step.type}`],
          reversible: true,
          input_summary: 'Reused from prior run',
        },
        actionStatus: 'reused',
        costEstimate: 0,
        signature: null,
        verified: false,
        timestamp_start: new Date().toISOString(),
      });

      if (persistStepResult) {
        await persistStepResult({
          step_id: step.id,
          step_index: stepIndex,
          step_type: step.type,
          step_name: step.name || step.id,
          status: 'reused',
          output_json: priorOutput,
          duration_ms: 0,
          finished_at: new Date().toISOString(),
        }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
      }

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'reused',
        elapsed_ms: 0,
      });
      continue;
    }
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: ALL tests PASS (16 existing + 3 new = 19)

- [ ] **Step 5: Commit**

```bash
git add app/lib/workflow-executor.js __tests__/unit/workflow-executor.test.js
git commit -m "feat: add resume context support to workflow executor"
```

---

## Chunk 3: Resume API Route

### Task 3: Add the resume API route

**Files:**
- Create: `app/api/workflows/templates/[templateId]/runs/[runActionId]/resume/route.js`

- [ ] **Step 1: Create the resume route**

Create `app/api/workflows/templates/[templateId]/runs/[runActionId]/resume/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../../../../lib/db.js';
import { getOrgId } from '../../../../../../../lib/org.js';
import { apiErrorResponse } from '../../../../../../../lib/apiErrors.js';
import { evaluateGuard } from '../../../../../../../lib/guard.js';
import { getWorkflowTemplate } from '../../../../../../../lib/repositories/workflow-templates.repository.js';
import { getWorkflowRun, buildResumeContext } from '../../../../../../../lib/repositories/workflow-runs.repository.js';
import { insertStepResult, updateStepResult } from '../../../../../../../lib/repositories/workflow-runs.repository.js';
import { createActionRecord } from '../../../../../../../lib/repositories/actions.repository.js';
import { executeWorkflow } from '../../../../../../../lib/workflow-executor.js';

export async function POST(request, { params }) {
  try {
    const { templateId, runActionId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json().catch(() => ({}));

    // 1. Load original run
    const originalRun = await getWorkflowRun(sql, orgId, runActionId);
    if (!originalRun) {
      return NextResponse.json({ error: 'run_not_found' }, { status: 404 });
    }

    if (originalRun.status !== 'failed') {
      return NextResponse.json(
        { error: 'only_failed_runs', message: 'Only failed runs can be resumed.' },
        { status: 400 },
      );
    }

    // 2. Load template
    const template = await getWorkflowTemplate(sql, orgId, templateId);
    if (!template) {
      return NextResponse.json({ error: 'workflow_not_found' }, { status: 404 });
    }

    const steps = template.steps || [];
    if (steps.length === 0) {
      return NextResponse.json({ error: 'workflow_has_no_steps' }, { status: 400 });
    }

    // 3. Build resume context
    const fromStepId = body.from_step || null;
    const resumeCtx = buildResumeContext(originalRun.steps, fromStepId);
    if (!resumeCtx) {
      return NextResponse.json(
        { error: 'nothing_to_resume', message: 'All steps completed or no steps to resume.' },
        { status: 400 },
      );
    }

    const action_id = `act_${crypto.randomUUID()}`;
    const timestamp_start = new Date().toISOString();
    const agentId = body.agent_id || originalRun.agent_id || 'anonymous';
    const variables = body.variables || {};

    // 4. Guard evaluation
    const guardDecision = await evaluateGuard(
      orgId,
      {
        action_type: 'workflow_execute',
        risk_score: 40,
        agent_id: agentId,
        systems_touched: [`workflow:${template.slug}`],
        reversible: true,
        declared_goal: `Resume workflow: ${template.name} (from step ${resumeCtx.resumeFromIndex})`,
      },
      sql,
    );

    if (guardDecision.decision === 'block') {
      return NextResponse.json(
        { error: 'blocked_by_policy', guard_decision: guardDecision },
        { status: 403 },
      );
    }

    // 5. Create parent action record for new run
    const reasoning = JSON.stringify({
      template_id: template.template_id,
      template_name: template.name,
      resumed_from: runActionId,
      resume_step_index: resumeCtx.resumeFromIndex,
    });

    await createActionRecord(sql, {
      orgId,
      action_id,
      data: {
        agent_id: agentId,
        action_type: 'workflow_execute',
        declared_goal: `Resume workflow: ${template.name}`,
        systems_touched: [`workflow:${template.slug}`],
        reversible: true,
        risk_score: 40,
        confidence: 50,
        input_summary: `Resumed from ${runActionId} at step ${resumeCtx.resumeFromIndex}`,
        trigger: `workflow:${template.template_id}`,
      },
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start,
    });

    // 6. Build step result persistence callback
    const persistStepResult = async (stepData) => {
      if (stepData.status === 'running') {
        await insertStepResult(sql, {
          stepResultId: `sr_${crypto.randomUUID()}`,
          runActionId: action_id,
          orgId,
          templateId,
          stepData,
        });
      } else {
        await updateStepResult(sql, {
          runActionId: action_id,
          orgId,
          stepData,
        });
      }
    };

    // For reused steps, insert directly (they don't go through running→completed flow)
    const originalPersist = persistStepResult;
    const resumePersist = async (stepData) => {
      if (stepData.status === 'reused') {
        await insertStepResult(sql, {
          stepResultId: `sr_${crypto.randomUUID()}`,
          runActionId: action_id,
          orgId,
          templateId,
          stepData: { ...stepData, started_at: timestamp_start },
        });
        await updateStepResult(sql, {
          runActionId: action_id,
          orgId,
          stepData,
        });
        return;
      }
      return originalPersist(stepData);
    };

    // 7. Execute with resume context
    const result = await executeWorkflow(
      sql,
      orgId,
      action_id,
      steps,
      variables,
      {
        strategyConfig: null,
        agentId,
        persistStepResult: resumePersist,
        resumeContext: resumeCtx,
      },
    );

    // 8. Update parent action
    const timestamp_end = new Date().toISOString();
    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${result.success ? JSON.stringify(result.result).slice(0, 500) : result.error},
          error_message = ${result.success ? null : result.error},
          reasoning = ${reasoning},
          timestamp_end = ${timestamp_end},
          duration_ms = ${result.total_elapsed_ms || 0}
      WHERE action_id = ${action_id} AND org_id = ${orgId}
    `;

    return NextResponse.json({
      success: result.success,
      action_id,
      resumed_from: runActionId,
      resume_step_index: resumeCtx.resumeFromIndex,
      steps: result.steps,
      result: result.result || undefined,
      error: result.error || undefined,
      total_elapsed_ms: result.total_elapsed_ms,
    });
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW_RESUME');
  }
}
```

- [ ] **Step 2: Run lint and checks**

Run:
```bash
npm run lint
npm run route-sql:check
```
Expected: lint passes. Route-sql may flag the parent action UPDATE — if so, move it to the repository.

- [ ] **Step 3: Commit**

```bash
git add "app/api/workflows/templates/[templateId]/runs/[runActionId]/resume/route.js"
git commit -m "feat: add workflow resume API route"
```

---

## Chunk 4: UI Changes

### Task 4: Add Resume button and reused status to run detail page

**Files:**
- Modify: `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx`
- Modify: `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx`
- Modify: `app/workflows/[templateId]/runs/[runActionId]/page.jsx`

- [ ] **Step 1: Add `reused` status to WorkflowRunStepCard**

In `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx`, add to the `STATUS_CONFIG` object:

```javascript
reused: { icon: RotateCcw, color: 'text-zinc-400', bg: 'bg-zinc-400/5' },
```

Import `RotateCcw` from `lucide-react` alongside the existing icons.

- [ ] **Step 2: Add Resume button to WorkflowRunHeader**

In `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx`:

Add props: `onResume`, `resuming`

Add `RotateCcw` to the lucide-react imports.

After the status badge in the header, add:

```jsx
{run.status === 'failed' && onResume && (
  <button
    onClick={onResume}
    disabled={resuming}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors disabled:opacity-50"
  >
    <RotateCcw className={`w-3 h-3 ${resuming ? 'animate-spin' : ''}`} />
    {resuming ? 'Resuming...' : 'Resume from checkpoint'}
  </button>
)}
```

- [ ] **Step 3: Add resume handler to the page**

In `app/workflows/[templateId]/runs/[runActionId]/page.jsx`:

Add state:

```javascript
const [resuming, setResuming] = useState(false);
```

Add handler:

```javascript
async function handleResume() {
  setResuming(true);
  try {
    const res = await fetch(`/api/workflows/templates/${templateId}/runs/${runActionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/workflows/${templateId}/runs/${data.action_id}`;
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.message || 'Resume failed');
    }
  } catch {
    alert('Resume failed');
  } finally {
    setResuming(false);
  }
}
```

Pass to header:

```jsx
<WorkflowRunHeader run={run} templateId={templateId} onResume={handleResume} resuming={resuming} />
```

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx" "app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx" "app/workflows/[templateId]/runs/[runActionId]/page.jsx"
git commit -m "feat: add resume button and reused status to run detail page"
```

---

## Chunk 5: Verification

### Task 5: Final verification and docs

- [ ] **Step 1: Run all related tests**

Run:
```bash
npx vitest run __tests__/unit/workflow-resume.test.js __tests__/unit/workflow-executor.test.js __tests__/unit/workflow-runs.repository.test.js
```
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 3: Run all checks**

Run:
```bash
npm run lint
npm run docs:check
npm run contracts:check
npm run route-sql:check
npm run build
```
Expected: ALL PASS

- [ ] **Step 4: Update PROJECT_DETAILS.md**

Add the new resume route to the route table:

```markdown
| `POST /api/workflows/templates/:templateId/runs/:runActionId/resume` | Resume a failed workflow run from the last completed checkpoint. Reuses prior step outputs, creates a new run with `reused` steps, and continues execution from the first non-completed step. Supports optional `from_step` override and `variables` override. |
```

- [ ] **Step 5: Commit and push**

```bash
git add PROJECT_DETAILS.md
git commit -m "docs: add workflow resume route to PROJECT_DETAILS"
git push origin main
```

---

## Notes For Execution

- `buildResumeContext` is a pure function (no SQL) — it takes step result rows and returns the context. Easy to test.
- The resume route mirrors the execute route pattern closely. Key differences: loads original run, validates it failed, builds resume context, passes `resumeContext` to executor.
- The resume route creates its own parent action_record — resumed runs are independent governance records.
- The `reused` status is a new string value. No schema changes needed (status is text).
- The route-sql guard may flag the parent action UPDATE in the resume route. If so, move it to a `updateRunOutcome` repository function (same pattern as the execute route fix from earlier).
- The `resumePersist` wrapper handles the fact that reused steps go directly to `reused` status without a `running` intermediate. It does an insert then an update to match the existing step result flow.
