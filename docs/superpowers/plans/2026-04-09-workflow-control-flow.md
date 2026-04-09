# Workflow Control Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conditional step execution (`condition` field) and failure tolerance (`continue_on_failure` field) to the workflow executor, plus corresponding UI controls on the step builder.

**Architecture:** One new pure module (`workflow-condition.js`) for condition evaluation. Executor changes for skip logic and continue-on-failure. Form model and step card UI additions for the two new fields. All changes are additive — existing workflows without these fields behave identically.

**Tech Stack:** Next.js 15 App Router, Vitest, existing template-vars.js for resolution

---

## File Map

### New files to create

- `app/lib/workflow-condition.js` — pure evaluateCondition function
- `__tests__/unit/workflow-condition.test.js` — condition evaluator tests

### Existing files to modify

- `app/lib/workflow-executor.js` — add condition check + continue_on_failure logic
- `app/workflows/lib/workflowStepFormModel.js` — add fields to defaults + sanitizer + summary
- `app/workflows/components/WorkflowStepCard.jsx` — add condition input + checkbox
- `__tests__/unit/workflow-executor.test.js` — extend with condition/continue tests
- `__tests__/unit/workflow-step-form-model.test.js` — extend with new field tests

### Existing files to leave alone

- `app/lib/template-vars.js` — consumed as-is by the condition evaluator
- `app/lib/step-handlers.js` — step execution unchanged
- `app/api/workflows/templates/[templateId]/execute/route.js` — no changes needed

---

## Chunk 1: Condition Evaluator

### Task 1: Add the condition evaluator module with tests

**Files:**
- Create: `__tests__/unit/workflow-condition.test.js`
- Create: `app/lib/workflow-condition.js`

- [ ] **Step 1: Write failing tests**

Create `__tests__/unit/workflow-condition.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../../app/lib/workflow-condition.js';

describe('evaluateCondition', () => {
  const context = {
    variables: { query: 'test', include_research: 'true', empty_var: '' },
    steps: {
      step_1: { output: { chunks: [{ content: 'doc' }], found: true, count: 3 } },
      step_2: { output: { risk_level: 'high', score: 0 } },
    },
  };

  it('returns shouldRun: true when no condition is provided', () => {
    expect(evaluateCondition(null, context)).toEqual({ shouldRun: true, resolvedValue: null });
    expect(evaluateCondition(undefined, context)).toEqual({ shouldRun: true, resolvedValue: null });
    expect(evaluateCondition('', context)).toEqual({ shouldRun: true, resolvedValue: null });
  });

  it('runs when condition resolves to truthy number', () => {
    const result = evaluateCondition('${steps.step_1.output.count}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe(3);
  });

  it('skips when condition resolves to 0', () => {
    const result = evaluateCondition('${steps.step_2.output.score}', context);
    expect(result.shouldRun).toBe(false);
    expect(result.resolvedValue).toBe(0);
  });

  it('runs when condition resolves to non-empty string', () => {
    const result = evaluateCondition('${steps.step_2.output.risk_level}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe('high');
  });

  it('skips when condition resolves to empty string', () => {
    const result = evaluateCondition('${variables.empty_var}', context);
    expect(result.shouldRun).toBe(false);
    expect(result.resolvedValue).toBe('');
  });

  it('runs when condition resolves to boolean true', () => {
    const result = evaluateCondition('${steps.step_1.output.found}', context);
    expect(result.shouldRun).toBe(true);
    expect(result.resolvedValue).toBe(true);
  });

  it('skips when condition resolves to string "false"', () => {
    const result = evaluateCondition('false', {});
    expect(result.shouldRun).toBe(false);
  });

  it('skips when condition resolves to string "0"', () => {
    const result = evaluateCondition('0', {});
    expect(result.shouldRun).toBe(false);
  });

  it('runs when condition resolves to array with items', () => {
    const result = evaluateCondition('${steps.step_1.output.chunks}', context);
    expect(result.shouldRun).toBe(true);
  });

  it('skips when variable path does not exist (unresolved template)', () => {
    const result = evaluateCondition('${steps.nonexistent.output}', context);
    // resolveVars returns the raw template string when path doesn't resolve
    // The raw template string is truthy, but we treat unresolved templates as falsy
    expect(result.shouldRun).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/workflow-condition.test.js`
Expected: FAIL because module does not exist

- [ ] **Step 3: Implement the condition evaluator**

Create `app/lib/workflow-condition.js`:

```javascript
/**
 * Workflow step condition evaluator.
 * Resolves a condition template against execution context and checks truthiness.
 * No dynamic code execution — uses the same resolveVars as step config interpolation.
 */

import { resolveVars } from './template-vars.js';

const FALSY_STRINGS = new Set(['false', '0', '']);

function isFalsy(value) {
  if (value == null) return true;
  if (value === false || value === 0) return true;
  if (typeof value === 'string' && FALSY_STRINGS.has(value.toLowerCase().trim())) return true;
  return false;
}

function isUnresolvedTemplate(value) {
  return typeof value === 'string' && /\$\{[^}]+\}/.test(value);
}

/**
 * Evaluate a condition template against the workflow execution context.
 *
 * @param {string|null|undefined} conditionTemplate - template string like '${steps.step_1.output.found}'
 * @param {object} context - { variables, steps } execution context
 * @returns {{ shouldRun: boolean, resolvedValue: any }}
 */
export function evaluateCondition(conditionTemplate, context) {
  if (conditionTemplate == null || conditionTemplate === '') {
    return { shouldRun: true, resolvedValue: null };
  }

  const resolved = resolveVars(conditionTemplate, context);

  // If the template didn't resolve (still contains ${...}), treat as falsy
  if (isUnresolvedTemplate(resolved)) {
    return { shouldRun: false, resolvedValue: resolved };
  }

  return {
    shouldRun: !isFalsy(resolved),
    resolvedValue: resolved,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/workflow-condition.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/workflow-condition.js __tests__/unit/workflow-condition.test.js
git commit -m "feat: add workflow step condition evaluator"
```

---

## Chunk 2: Executor Changes

### Task 2: Add condition skip and continue_on_failure to the executor

**Files:**
- Modify: `app/lib/workflow-executor.js`
- Modify: `__tests__/unit/workflow-executor.test.js`

- [ ] **Step 1: Write failing executor tests**

Add these tests to `__tests__/unit/workflow-executor.test.js`:

```javascript
it('skips step when condition resolves to falsy', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

  const persistStepResult = vi.fn().mockResolvedValue(undefined);

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

  expect(result.success).toBe(true);
  expect(result.steps).toHaveLength(2);
  expect(result.steps[0].status).toBe('completed');
  expect(result.steps[1].status).toBe('skipped');
  expect(handlePrompt).not.toHaveBeenCalled();
});

it('runs step when condition resolves to truthy', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'found' }], query: 'test' });
  handlePrompt.mockResolvedValueOnce({ text: 'summary', tokens_in: 10, tokens_out: 5 });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

  expect(result.success).toBe(true);
  expect(result.steps).toHaveLength(2);
  expect(result.steps[0].status).toBe('completed');
  expect(result.steps[1].status).toBe('completed');
  expect(handlePrompt).toHaveBeenCalled();
});

it('continues to next step when continue_on_failure is true', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
  handleCapabilityInvoke.mockRejectedValueOnce(new Error('capability_timeout'));
  handlePrompt.mockResolvedValueOnce({ text: 'done', tokens_in: 10, tokens_out: 5 });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'capability_invoke', name: 'Optional API', config: { capability_id: 'cap_1', body: {} }, continue_on_failure: true },
    { id: 'step_3', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

  expect(result.success).toBe(true);
  expect(result.steps).toHaveLength(3);
  expect(result.steps[0].status).toBe('completed');
  expect(result.steps[1].status).toBe('failed');
  expect(result.steps[2].status).toBe('completed');
  expect(handlePrompt).toHaveBeenCalled();
});

it('aborts when continue_on_failure is false (default behavior)', async () => {
  handleCapabilityInvoke.mockRejectedValueOnce(new Error('fatal'));

  const steps = [
    { id: 'step_1', type: 'capability_invoke', name: 'Required API', config: { capability_id: 'cap_1', body: {} } },
    { id: 'step_2', type: 'prompt', name: 'Summarize', config: { prompt_template: 'test' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

  expect(result.success).toBe(false);
  expect(result.steps).toHaveLength(1);
  expect(handlePrompt).not.toHaveBeenCalled();
});

it('skipped step does not add to context.steps', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
  handlePrompt.mockResolvedValueOnce({ text: 'result', tokens_in: 10, tokens_out: 5 });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    { id: 'step_2', type: 'prompt', name: 'Conditional', config: { prompt_template: 'test' }, condition: '${steps.step_1.output.chunks.length}' },
    { id: 'step_3', type: 'prompt', name: 'Final', config: { prompt_template: 'Using: ${steps.step_2.output.text}' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

  expect(result.success).toBe(true);
  // step_3 prompt_template should NOT have resolved step_2 output (it was skipped)
  expect(handlePrompt).toHaveBeenCalledWith(
    mockSql,
    'org_1',
    expect.objectContaining({
      prompt_template: expect.stringContaining('${steps.step_2.output.text}'),
    }),
    expect.any(Object),
  );
});

it('writes skipped step_result via persistStepResult', async () => {
  const persistStepResult = vi.fn().mockResolvedValue(undefined);

  const steps = [
    { id: 'step_1', type: 'prompt', name: 'Conditional', config: { prompt_template: 'test' }, condition: '${variables.run_this}' },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

  expect(result.success).toBe(true);
  expect(persistStepResult).toHaveBeenCalledWith(
    expect.objectContaining({
      step_id: 'step_1',
      status: 'skipped',
    }),
  );
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: New tests FAIL, existing tests still PASS

- [ ] **Step 3: Implement condition skip and continue_on_failure in the executor**

In `app/lib/workflow-executor.js`:

1. Add import at the top:
```javascript
import { evaluateCondition } from './workflow-condition.js';
```

2. At the start of the step loop (after `const stepActionId = ...` and before `// Create child action record`), add condition evaluation:

```javascript
    // Condition evaluation — skip if falsy
    if (step.condition) {
      const { shouldRun } = evaluateCondition(step.condition, context);
      if (!shouldRun) {
        const stepIndex = steps.indexOf(step);

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
            input_summary: 'Condition not met',
          },
          actionStatus: 'skipped',
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
            status: 'skipped',
            duration_ms: 0,
            finished_at: new Date().toISOString(),
          }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
        }

        stepResults.push({
          step_id: step.id,
          type: step.type,
          status: 'skipped',
          elapsed_ms: 0,
        });
        continue;
      }
    }
```

3. In the `if (!succeeded)` block, replace the hard `return` with conditional continue. Change:

```javascript
      return {
        success: false,
        steps: stepResults,
        error: `Step ${step.id} failed: ${lastError.message}`,
        total_elapsed_ms: Date.now() - start,
      };
```

To:

```javascript
      if (step.continue_on_failure) {
        continue;
      }

      return {
        success: false,
        steps: stepResults,
        error: `Step ${step.id} failed: ${lastError.message}`,
        total_elapsed_ms: Date.now() - start,
      };
```

4. After the for loop, check if any step failed (for continue_on_failure cases). Change the success return to account for partial failures:

```javascript
  // All steps completed — check for partial failures
  const hasFailures = stepResults.some((s) => s.status === 'failed');
  const lastCompletedStep = [...stepResults].reverse().find((s) => s.status === 'completed');
  const lastStepId = lastCompletedStep?.step_id || steps[steps.length - 1].id;
  const result = context.steps[lastStepId]?.output || {};

  return {
    success: !hasFailures,
    steps: stepResults,
    result,
    total_elapsed_ms: Date.now() - start,
    ...(hasFailures ? { error: 'One or more steps failed (continue_on_failure)' } : {}),
  };
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: ALL tests PASS (existing 10 + new 6 = 16)

- [ ] **Step 5: Commit**

```bash
git add app/lib/workflow-executor.js __tests__/unit/workflow-executor.test.js
git commit -m "feat: add condition skip and continue_on_failure to workflow executor"
```

---

## Chunk 3: Form Model + UI

### Task 3: Add condition and continue_on_failure to the form model

**Files:**
- Modify: `app/workflows/lib/workflowStepFormModel.js`
- Modify: `__tests__/unit/workflow-step-form-model.test.js`

- [ ] **Step 1: Write failing form model tests**

Add these tests to `__tests__/unit/workflow-step-form-model.test.js`:

```javascript
it('default step includes condition and continue_on_failure fields', () => {
  const step = createDefaultWorkflowStep('prompt', 1);
  expect(step.condition).toBe('');
  expect(step.continue_on_failure).toBe(false);
});

it('sanitizeExecutableSteps preserves condition and continue_on_failure', () => {
  const steps = sanitizeExecutableSteps([
    { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, condition: '${variables.run}', continue_on_failure: true },
  ]);
  expect(steps[0].condition).toBe('${variables.run}');
  expect(steps[0].continue_on_failure).toBe(true);
});

it('sanitizeExecutableSteps defaults missing condition and continue_on_failure', () => {
  const steps = sanitizeExecutableSteps([
    { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' } },
  ]);
  expect(steps[0].condition).toBeUndefined();
  expect(steps[0].continue_on_failure).toBeUndefined();
});

it('summary includes condition when set', () => {
  const step = { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, condition: '${steps.step_0.output.found}' };
  const summary = buildWorkflowStepSummary(step);
  expect(summary).toContain('Condition');
});

it('summary includes continue on failure when true', () => {
  const step = { id: 'step_1', type: 'prompt', name: 'Test', config: { prompt_template: 'hi' }, continue_on_failure: true };
  const summary = buildWorkflowStepSummary(step);
  expect(summary).toContain('continue');
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run __tests__/unit/workflow-step-form-model.test.js`
Expected: New tests FAIL

- [ ] **Step 3: Update createDefaultWorkflowStep**

In `app/workflows/lib/workflowStepFormModel.js`, modify `createDefaultWorkflowStep` (around line 100):

```javascript
export function createDefaultWorkflowStep(type, ordinal = 1) {
  return {
    id: `step_${ordinal}`,
    type,
    name: `${STEP_NAME_PREFIX[type] || 'Step'} ${ordinal}`,
    config: deepClone(STEP_CONFIG_DEFAULTS[type] || {}),
    condition: '',
    continue_on_failure: false,
  };
}
```

- [ ] **Step 4: Update sanitizeExecutableSteps to preserve the new fields**

In `sanitizeExecutableSteps`, after the `retryPolicy` handling (around line 122), add:

```javascript
      if (typeof step.condition === 'string' && step.condition.trim()) {
        sanitized.condition = step.condition.trim();
      }
      if (step.continue_on_failure === true) {
        sanitized.continue_on_failure = true;
      }
```

- [ ] **Step 5: Update buildWorkflowStepSummary to include new fields**

At the end of `buildWorkflowStepSummary`, before the final `default` case's return, add a suffix builder. Modify the function to append condition/continue info to the base summary. After each `return` statement in the switch cases, instead change to build a `base` variable and append:

Replace the entire function with:

```javascript
export function buildWorkflowStepSummary(step) {
  let resourceLookups = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!step || !step.type) return 'Unsupported workflow step';

  let base;
  switch (step.type) {
    case 'knowledge_search': {
      const collection = resourceLookups.knowledgeCollections?.[step.config?.collection_id]
        || step.config?.collection_id
        || 'a collection';
      const query = step.config?.query || 'a query';
      const topK = normalizeNumber(step.config?.top_k, 5);
      base = `Search ${collection} for "${query}" and return top ${topK} matches.`;
      break;
    }
    case 'capability_invoke': {
      const capability = resourceLookups.capabilities?.[step.config?.capability_id]
        || step.config?.capability_id
        || 'a capability';
      const bodyKeys = Object.keys(step.config?.body || {});
      if (bodyKeys.length === 0) {
        base = `Invoke ${capability} with an empty payload.`;
      } else {
        base = `Invoke ${capability} with ${bodyKeys.length} payload field${bodyKeys.length === 1 ? '' : 's'}.`;
      }
      break;
    }
    case 'prompt': {
      const prompt = step.config?.prompt_template || '';
      const preview = prompt.trim().slice(0, 60);
      base = preview
        ? `Run prompt using the linked model strategy: "${preview}${prompt.trim().length > 60 ? '...' : ''}".`
        : 'Run prompt using the linked model strategy.';
      break;
    }
    default:
      return 'Unsupported workflow step';
  }

  const suffixes = [];
  if (step.condition) suffixes.push(`Condition: ${step.condition}`);
  if (step.continue_on_failure) suffixes.push('Will continue on failure.');

  return suffixes.length > 0 ? `${base} ${suffixes.join(' ')}` : base;
}
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `npx vitest run __tests__/unit/workflow-step-form-model.test.js`
Expected: ALL tests PASS

- [ ] **Step 7: Commit**

```bash
git add app/workflows/lib/workflowStepFormModel.js __tests__/unit/workflow-step-form-model.test.js
git commit -m "feat: add condition and continue_on_failure to workflow step form model"
```

---

### Task 4: Add condition and continue_on_failure fields to the step card UI

**Files:**
- Modify: `app/workflows/components/WorkflowStepCard.jsx`

- [ ] **Step 1: Add the condition and continue_on_failure UI controls**

In `WorkflowStepCard.jsx`, add state for showing the condition field:

```javascript
const [showCondition, setShowCondition] = useState(!!step.condition);
```

Add field IDs:

```javascript
const conditionId = makeFieldId(step.id, 'condition');
```

After the retry policy section (or at the end of the collapsed content area, before the closing `</div>` of the card body), add:

```jsx
{/* ── Condition & Failure Handling ── */}
<div className="border-t border-[rgba(255,255,255,0.06)] pt-4 mt-4 space-y-3">
  {!showCondition ? (
    <button
      type="button"
      onClick={() => setShowCondition(true)}
      className="text-[10px] text-brand hover:text-brand-hover transition-colors"
    >
      + Add condition
    </button>
  ) : (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={conditionId} className={labelClass}>Condition (skip if falsy)</label>
        <button
          type="button"
          onClick={() => { setShowCondition(false); updateStep({ condition: '' }); }}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Remove
        </button>
      </div>
      <div className="flex gap-2">
        <input
          id={conditionId}
          type="text"
          value={step.condition || ''}
          onChange={(e) => updateStep({ condition: e.target.value })}
          placeholder="${steps.prev_step.output.found}"
          className={inputClass}
        />
        <WorkflowVariableInsertButton
          groups={variableGroups}
          onInsert={(token) => updateStep({ condition: insertVariableToken(step.condition || '', token) })}
        />
      </div>
      <p className="text-[10px] text-zinc-600 mt-1">Step is skipped if this resolves to empty, 0, false, or null.</p>
    </div>
  )}

  <label className="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      checked={!!step.continue_on_failure}
      onChange={(e) => updateStep({ continue_on_failure: e.target.checked })}
      className="rounded border-white/20 bg-surface-tertiary text-brand focus:ring-brand/30"
    />
    <span className="text-xs text-zinc-400">Continue on failure</span>
  </label>
</div>
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/workflows/components/WorkflowStepCard.jsx
git commit -m "feat: add condition and continue_on_failure controls to step card"
```

---

## Chunk 4: Verification

### Task 5: Final verification

- [ ] **Step 1: Run all related tests**

Run:
```bash
npx vitest run __tests__/unit/workflow-condition.test.js __tests__/unit/workflow-executor.test.js __tests__/unit/workflow-step-form-model.test.js
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
```
Expected: PASS

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Update PROJECT_DETAILS.md**

In the workflow execute route description, add mention of condition and continue_on_failure:

Update the execute route row to mention: "Steps support optional `condition` (template truthiness check — skip if falsy) and `continue_on_failure` (proceed on step failure instead of aborting)."

- [ ] **Step 6: Commit**

```bash
git add PROJECT_DETAILS.md
git commit -m "docs: update PROJECT_DETAILS for workflow control flow"
```

---

## Notes For Execution

- The condition evaluator is a pure function with no side effects — test it thoroughly.
- The executor changes are additive — existing workflows without `condition` or `continue_on_failure` behave identically.
- `evaluateCondition` uses `resolveVars` from template-vars.js, which is already well-tested. No need to re-test variable resolution — just test the truthiness logic.
- The `skipped` status is new for action_records. It's a string value — no schema changes needed.
- The step card UI adds the controls inside the existing collapsed content area. Only the condition/continue_on_failure section is new.
- The `continue_on_failure` behavior changes the overall workflow success: if any step failed (even with continue_on_failure), the workflow returns `success: false`.
